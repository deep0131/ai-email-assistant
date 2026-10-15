from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from app.agents.email_draft import generate_draft
from app.agents.intent_analyze import analyze_intent
from app.agents.reviewer import review_draft
from app.gmail.client import GmailAttachment
from app.schemas import EmailDraftRequest, ReviewDecision, ReviewRequest
from app.tools.gmail_tools import _send_gmail_internal
from app.workflow.state import EmailWorkflowState


memory = MemorySaver()


def build_safe_response(state: dict) -> dict:
    return {
        "status": state.get("status", "IN_PROGRESS"),
        "intent": state.get("intent"),
        "draft": state.get("draft"),
        "review": state.get("review"),
        "revision_count": state.get("revision_count", 0),
        "clarification_question": state.get("clarification_question"),
        "approval_decision": state.get("approval_decision"),
        "send_result": state.get("send_result"),
        "email_attachment_filenames": [
            attachment.filename
            for attachment in state.get("email_attachments", [])
        ],
        "error": state.get("error"),
    }


async def analyze_intent_node(state: EmailWorkflowState) -> dict:
    intent = await analyze_intent(state.get("user_prompt", ""))

    return {
        "intent": intent,
        "clarification_question": None,
        "status": "IN_PROGRESS",
    }


async def clarification_node(
    state: EmailWorkflowState,
) -> dict | Command:
    intent = state.get("intent")

    needs_clarification = (
        not intent
        or not intent.recipient
        or not intent.has_email_content
        or bool(intent.missing_information)
    )

    if not needs_clarification:
        return Command(
            update={
                "status": "IN_PROGRESS",
                "clarification_question": None,
            },
            goto="generate_draft",
        )

    question = (
        intent.clarification_question
        if intent and intent.clarification_question
        else "Please provide the missing details for the email."
    )

    answer = interrupt({
        "status": "WAITING_FOR_USER",
        "clarification_question": question,
    })

    if isinstance(answer, dict):
        answer = answer.get("answer", "")

    answer = str(answer or "").strip()

    if not answer:
        return Command(
            update={
                "status": "WAITING_FOR_USER",
                "clarification_question": question,
            },
            goto="clarification",
        )

    old_prompt = state.get("user_prompt", "").strip()

    updated_prompt = (
        f"{old_prompt}\n\n"
        f"Assistant's question: {question}\n"
        f"User's answer: {answer}"
    )

    return Command(
        update={
            "user_prompt": updated_prompt,
            "intent": None,
            "draft": None,
            "review": None,
            "revision_count": 0,
            "approval_decision": None,
            "send_result": None,
            "clarification_question": None,
            "status": "IN_PROGRESS",
        },
        goto="analyze_intent",
    )


async def generate_draft_node(state: EmailWorkflowState) -> dict:
    draft = await generate_draft(
        request=EmailDraftRequest(
            original_prompt=state.get("user_prompt", ""),
            intent=state["intent"],
        ),
        reference_attachments=state.get("reference_attachments", []),
    )

    return {
        "draft": draft,
        "review": None,
        "status": "IN_PROGRESS",
        "clarification_question": None,
    }


async def review_draft_node(state: EmailWorkflowState) -> dict:
    review = await review_draft(
        request=ReviewRequest(
            original_prompt=state.get("user_prompt", ""),
            intent=state["intent"],
            draft=state["draft"],
        ),
        reference_attachments=state.get("reference_attachments", []),
    )

    return {
        "review": review,
        "status": "IN_PROGRESS",
    }


async def revise_draft_node(state: EmailWorkflowState) -> dict:
    review = state.get("review")
    draft = state.get("draft")

    issues = "\n".join(f"- {item}" for item in review.issues) if review else ""
    instructions = (
        "\n".join(f"- {item}" for item in review.revision_instructions)
        if review
        else ""
    )

    revision_prompt = f"""
ORIGINAL USER REQUEST:
{state.get("user_prompt", "")}

PREVIOUS DRAFT SUBJECT:
{draft.subject if draft else ""}

PREVIOUS DRAFT BODY:
{draft.body if draft else ""}

REVIEW SUMMARY:
{review.summary if review else ""}

REVIEW ISSUES:
{issues}

REVISION INSTRUCTIONS:
{instructions}

Improve the email. Preserve the user's intent and supported facts.
Do not mention the review process.
"""

    revised_draft = await generate_draft(
        request=EmailDraftRequest(
            original_prompt=revision_prompt,
            intent=state["intent"],
        ),
        reference_attachments=state.get("reference_attachments", []),
    )

    return {
        "draft": revised_draft,
        "revision_count": state.get("revision_count", 0) + 1,
        "status": "IN_PROGRESS",
    }


def route_after_review(state: EmailWorkflowState) -> str:
    review = state.get("review")

    if (
        review
        and review.decision == ReviewDecision.FAIL
        and state.get("revision_count", 0) < state.get("max_revisions", 2)
    ):
        return "revise_draft"

    return "approval"


async def approval_node(
    state: EmailWorkflowState,
) -> dict | Command:
    payload = {
        "status": "WAITING_FOR_APPROVAL",
        "draft": state.get("draft"),
        "options": ["SEND", "REJECT", "IMPROVE"],
        "email_attachment_filenames": [
            attachment.filename
            for attachment in state.get("email_attachments", [])
        ],
    }

    question = state.get("clarification_question")
    if question:
        payload["clarification_question"] = question

    response = interrupt(payload)

    if isinstance(response, dict):
        decision = str(response.get("decision") or "").strip().upper()
        feedback = str(response.get("feedback") or "").strip()
    else:
        decision = str(response or "").strip().upper()
        feedback = ""

    if decision == "SEND":
        return Command(
            update={
                "approval_decision": "SEND",
                "status": "APPROVED",
                "clarification_question": None,
            },
            goto="send_email",
        )

    if decision == "REJECT":
        return Command(
            update={
                "approval_decision": "REJECT",
                "status": "REJECTED",
                "clarification_question": None,
            },
            goto="reject_email",
        )

    if decision == "IMPROVE":
        if not feedback:
            return Command(
                update={
                    "status": "WAITING_FOR_APPROVAL",
                    "clarification_question": (
                        "Please tell me what you would like improved."
                    ),
                },
                goto="approval",
            )

        draft = state.get("draft")
        updated_prompt = f"""
{state.get("user_prompt", "")}

PREVIOUS DRAFT SUBJECT:
{draft.subject if draft else ""}

PREVIOUS DRAFT BODY:
{draft.body if draft else ""}

USER'S IMPROVEMENT REQUEST:
{feedback}

Improve the email while keeping its original purpose and recipient.
"""

        return Command(
            update={
                "user_prompt": updated_prompt,
                "draft": None,
                "review": None,
                "approval_decision": None,
                "revision_count": 0,
                "status": "IN_PROGRESS",
                "clarification_question": None,
            },
            goto="generate_draft",
        )

    return Command(
        update={
            "status": "WAITING_FOR_APPROVAL",
            "clarification_question": (
                "Please choose SEND, REJECT, or IMPROVE."
            ),
        },
        goto="approval",
    )


async def send_email_node(state: EmailWorkflowState) -> dict:
    draft = state["draft"]
    recipients = [
        recipient.email
        for recipient in draft.to
        if recipient.email
    ]

    if not recipients:
        return {
            "status": "FAILED",
            "error": "The draft does not contain a recipient.",
        }

    try:
        result = _send_gmail_internal(
            to=recipients,
            subject=draft.subject,
            body=draft.body,
            attachments=state.get("email_attachments", []),
        )

        return {
            "status": "SENT",
            "send_result": result,
            "error": None,
        }
    except Exception as exc:
        return {
            "status": "FAILED",
            "error": str(exc),
        }


async def reject_email_node(state: EmailWorkflowState) -> dict:
    return {
        "status": "REJECTED",
        "send_result": None,
        "error": None,
    }


builder = StateGraph(EmailWorkflowState)

builder.add_node("analyze_intent", analyze_intent_node)
builder.add_node("clarification", clarification_node)
builder.add_node("generate_draft", generate_draft_node)
builder.add_node("review_draft", review_draft_node)
builder.add_node("revise_draft", revise_draft_node)
builder.add_node("approval", approval_node)
builder.add_node("send_email", send_email_node)
builder.add_node("reject_email", reject_email_node)

builder.set_entry_point("analyze_intent")

builder.add_edge("analyze_intent", "clarification")
builder.add_edge("generate_draft", "review_draft")
builder.add_edge("revise_draft", "review_draft")

builder.add_conditional_edges(
    "review_draft",
    route_after_review,
    {
        "revise_draft": "revise_draft",
        "approval": "approval",
    },
)

builder.add_edge("send_email", END)
builder.add_edge("reject_email", END)

workflow_graph = builder.compile(checkpointer=memory)


async def run_email_workflow(
    user_prompt: str,
    workflow_thread_id: str,
    reference_attachments: list[GmailAttachment] | None = None,
    email_attachments: list[GmailAttachment] | None = None,
    resume_value=None,
) -> dict:
    config = {
        "configurable": {
            "thread_id": workflow_thread_id,
        }
    }

    if resume_value is not None:
        saved_state = await workflow_graph.aget_state(config)

        if not saved_state or not saved_state.values:
            raise ValueError(
                f"No workflow found for thread ID: {workflow_thread_id}"
            )

        final_state = await workflow_graph.ainvoke(
            Command(resume=resume_value),
            config=config,
        )
    else:
        initial_state: EmailWorkflowState = {
            "user_prompt": user_prompt,
            "reference_attachments": reference_attachments or [],
            "email_attachments": email_attachments or [],
            "intent": None,
            "draft": None,
            "review": None,
            "revision_count": 0,
            "max_revisions": 2,
            "status": "IN_PROGRESS",
            "clarification_question": None,
            "approval_decision": None,
            "send_result": None,
            "error": None,
        }

        final_state = await workflow_graph.ainvoke(
            initial_state,
            config=config,
        )

    response = build_safe_response(final_state)
    interrupts = final_state.get("__interrupt__", [])

    if interrupts:
        value = getattr(interrupts[0], "value", None)
        if isinstance(value, dict):
            response.update(value)

    return response
