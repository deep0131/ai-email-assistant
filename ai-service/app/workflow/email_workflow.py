from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from app.agents.email_draft import generate_draft
from app.agents.intent_analyze import analyze_intent
from app.agents.reviewer import review_draft
from app.gmail.client import GmailAttachment
from app.schemas import (
    EmailDraftRequest,
    ReviewDecision,
    ReviewRequest,
)
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
        "error": state.get("error"),
    }


async def analyze_intent_node(state: EmailWorkflowState) -> dict:
    intent = await analyze_intent(
        state.get("user_prompt", "")
    )

    return {
        "intent": intent,
        "status": "IN_PROGRESS",
        "clarification_question": None,
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
            update={"status": "IN_PROGRESS"},
            goto="generate_draft",
        )

    question = (
        intent.clarification_question
        if intent and intent.clarification_question
        else "Please describe the email you want to send."
    )

    answer = interrupt({
        "status": "WAITING_FOR_USER",
        "clarification_question": question,
    })

    if isinstance(answer, dict):
        answer = answer.get("answer", "")

    answer = str(answer or "")

    if not answer.strip():
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
        f"Additional information: {answer.strip()}"
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
            "status": "IN_PROGRESS",
            "clarification_question": None,
        },
        goto="analyze_intent",
    )


async def generate_draft_node(
    state: EmailWorkflowState,
) -> dict:
    draft_request = EmailDraftRequest(
        original_prompt=state.get("user_prompt", ""),
        intent=state["intent"],
    )

    draft = await generate_draft(
        request=draft_request,
        attachments=state.get("attachments", []),
    )

    return {
        "draft": draft,
        "status": "IN_PROGRESS",
    }


async def review_draft_node(
    state: EmailWorkflowState,
) -> dict:
    review_request = ReviewRequest(
        original_prompt=state.get("user_prompt", ""),
        intent=state["intent"],
        draft=state["draft"],
    )

    review = await review_draft(
        request=review_request,
        attachments=state.get("attachments", []),
    )

    return {
        "review": review,
        "status": "IN_PROGRESS",
        "clarification_question": None,
    }


async def revise_draft_node(
    state: EmailWorkflowState,
) -> dict:
    review = state.get("review")
    current_draft = state.get("draft")

    review_summary = review.summary if review else ""

    issues = "\n".join(
        f"- {issue}"
        for issue in review.issues
    ) if review else ""

    revision_instructions = "\n".join(
        f"- {instruction}"
        for instruction in review.revision_instructions
    ) if review else ""

    previous_subject = (
        current_draft.subject
        if current_draft
        else ""
    )

    previous_body = (
        current_draft.body
        if current_draft
        else ""
    )

    revision_prompt = f"""
ORIGINAL USER REQUEST:
{state.get("user_prompt", "")}

PREVIOUS DRAFT SUBJECT:
{previous_subject}

PREVIOUS DRAFT BODY:
{previous_body}

REVIEW SUMMARY:
{review_summary}

REVIEW ISSUES:
{issues}

REVISION INSTRUCTIONS:
{revision_instructions}

Rewrite the email draft using the review feedback.

Keep the original user intent.
Preserve correct information.
Fix every issue identified by the reviewer.
Do not mention the review process in the email.
Return a complete professional email.
"""

    draft_request = EmailDraftRequest(
        original_prompt=revision_prompt,
        intent=state["intent"],
    )

    draft = await generate_draft(
        request=draft_request,
        attachments=state.get("attachments", []),
    )

    return {
        "draft": draft,
        "revision_count": state.get("revision_count", 0) + 1,
        "status": "IN_PROGRESS",
    }


async def approval_node(
    state: EmailWorkflowState,
) -> dict | Command:
    question = state.get("clarification_question")

    interrupt_payload = {
        "status": "WAITING_FOR_APPROVAL",
        "draft": state.get("draft"),
        "options": ["SEND", "REJECT", "IMPROVE"],
    }

    if question:
        interrupt_payload["clarification_question"] = question

    response = interrupt(interrupt_payload)

    if isinstance(response, dict):
        decision = str(
            response.get("decision") or ""
        ).strip().upper()

        feedback = str(
            response.get("feedback") or ""
        ).strip()
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
                        "Please tell me what you would like me to improve."
                    ),
                },
                goto="approval",
            )

        current_prompt = state.get("user_prompt", "").strip()
        current_draft = state.get("draft")

        previous_subject = (
            current_draft.subject
            if current_draft
            else ""
        )

        previous_body = (
            current_draft.body
            if current_draft
            else ""
        )

        updated_prompt = f"""
{current_prompt}

PREVIOUS EMAIL SUBJECT:
{previous_subject}

PREVIOUS EMAIL BODY:
{previous_body}

USER'S IMPROVEMENT REQUEST:
{feedback}

Create an improved version of the previous email.
Keep the original purpose and recipient.
Apply the user's improvement request.
Return only the new email draft.
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


async def send_email_node(
    state: EmailWorkflowState,
) -> dict:
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
        send_result = _send_gmail_internal(
            to=recipients,
            subject=draft.subject,
            body=draft.body,
            attachments=state.get("attachments", []),
        )

        return {
            "status": "SENT",
            "send_result": send_result,
            "error": None,
        }

    except Exception as exc:
        return {
            "status": "FAILED",
            "error": str(exc),
        }


async def reject_email_node(
    state: EmailWorkflowState,
) -> dict:
    return {
        "status": "REJECTED",
        "send_result": None,
        "error": None,
    }


def route_after_review(
    state: EmailWorkflowState,
) -> str:
    review = state.get("review")
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 2)

    if (
        review
        and review.decision == ReviewDecision.FAIL
        and revision_count < max_revisions
    ):
        return "revise_draft"

    return "approval"


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

builder.add_edge(
    "analyze_intent",
    "clarification",
)

builder.add_edge(
    "generate_draft",
    "review_draft",
)

builder.add_conditional_edges(
    "review_draft",
    route_after_review,
    {
        "revise_draft": "revise_draft",
        "approval": "approval",
    },
)

builder.add_edge(
    "revise_draft",
    "review_draft",
)

builder.add_edge("send_email", END)
builder.add_edge("reject_email", END)

workflow_graph = builder.compile(
    checkpointer=memory
)


async def run_email_workflow(
    user_prompt: str,
    workflow_thread_id: str,
    attachments: list[GmailAttachment] | None = None,
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
            "attachments": attachments or [],
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
        interrupt_value = getattr(interrupts[0], "value", None)

        if isinstance(interrupt_value, dict):
            response.update(interrupt_value)

    return response