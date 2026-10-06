import logging

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from app.agents.attachment_agent import classify_attachment_decision
from app.agents.email_draft import generate_draft
from app.agents.gmail_context_agent import resolve_gmail_context
from app.agents.intent_analyze import analyze_intent
from app.agents.reviewer import review_draft
from app.gmail.client import GmailAttachment, GmailClient
from app.schemas import (
    ActionType,
    AvailableAttachment,
    EmailDraftRequest,
    ReviewDecision,
    ReviewRequest,
)
from app.tools.gmail_tools import set_request_attachments
from app.workflow.state import EmailWorkflowState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Checkpointer
# ---------------------------------------------------------------------------
memory = MemorySaver()


# ---------------------------------------------------------------------------
# Safe response builder — never leaks raw bytes or internal graph metadata
# ---------------------------------------------------------------------------
def build_safe_response(state: dict) -> dict:
    resp: dict = {
        "status": state.get("status", "IN_PROGRESS"),
        "intent": state.get("intent"),
        "draft": state.get("draft"),
        "review": state.get("review"),
        "revision_count": state.get("revision_count", 0),
        "draft_id": state.get("draft_id"),
        "clarification_question": state.get("clarification_question"),
        "selected_thread_id": state.get("selected_thread_id"),
        "attachment_decision": state.get("attachment_decision"),
        "selected_attachment_ids": state.get("selected_attachment_ids", []),
        "send_result": state.get("send_result"),
    }
    return resp


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def analyze_intent_node(state: EmailWorkflowState) -> dict:
    """Run the intent agent on the user prompt."""
    prompt = state.get("user_prompt", "")
    intent = await analyze_intent(prompt)
    return {"intent": intent, "status": "IN_PROGRESS"}


async def ask_clarification_node(state: EmailWorkflowState) -> dict | Command:
    """Check if the intent has enough info. Interrupt if not."""
    intent = state.get("intent")
    if not intent:
        return _do_clarification("I could not understand your request. Please describe the email you want to send.")

    problems: list[str] = []

    # Recipient is required for both NEW_EMAIL and REPLY
    if not intent.recipient:
        problems.append("Who should this email be sent to? Please provide a name or email address.")

    # We need at least a topic — the user does NOT need to write subject/body
    if not intent.has_email_content:
        problems.append("What should the email be about? Please describe the topic or purpose.")

    if problems:
        return _do_clarification("\n".join(f"- {p}" for p in problems))

    return {"status": "IN_PROGRESS"}


async def attachment_confirmation_node(state: EmailWorkflowState) -> dict | Command:
    """If the user uploaded files without explicit attachment instructions, ask."""
    intent = state.get("intent")
    attachments = state.get("attachments", [])
    decision = state.get("attachment_decision")

    # If a decision was already made, skip
    if decision in ("ATTACH", "SKIP"):
        return {"status": "IN_PROGRESS"}

    # If no files uploaded, nothing to ask
    if not attachments:
        return {"attachment_decision": "SKIP", "selected_attachment_ids": [], "status": "IN_PROGRESS"}

    # If intent explicitly says attachment needed → auto-attach all
    if intent and intent.needs_attachment:
        all_ids = [a.attachment_id for a in attachments]
        return {"attachment_decision": "ATTACH", "selected_attachment_ids": all_ids, "status": "IN_PROGRESS"}

    # Files uploaded but no explicit instruction → ask for confirmation
    filenames = ", ".join(a.filename for a in attachments)
    question = f"You uploaded {filenames}. Would you like me to attach {'it' if len(attachments) == 1 else 'them'} to the email?"

    while True:
        response = interrupt({
            "status": "WAITING_FOR_USER",
            "clarification_question": question,
        })

        # Parse the user's response
        if isinstance(response, dict):
            user_answer = response.get("attachment_decision") or response.get("answer", "")
        elif isinstance(response, str):
            user_answer = response
        elif isinstance(response, bool):
            user_answer = "yes" if response else "no"
        else:
            user_answer = str(response or "")

        classification = await classify_attachment_decision(str(user_answer))

        if classification == "ATTACH":
            selected_attachment_ids = [
                attachment.attachment_id
                for attachment in attachments
            ]
            return {"attachment_decision": "ATTACH", "selected_attachment_ids": selected_attachment_ids, "status": "IN_PROGRESS"}
        elif classification == "SKIP":
            return {"attachment_decision": "SKIP", "selected_attachment_ids": [], "status": "IN_PROGRESS"}
        else:
            # Result is UNCLEAR: ask the user again with interrupt()
            question = (
                f"I wasn't sure if you want to include {filenames}. "
                "Would you like me to attach the file(s) to the email? Please answer yes or no."
            )


async def gmail_context_agent_node(state: EmailWorkflowState) -> dict | Command:
    """Use the LLM Gmail context agent to decide and retrieve Gmail context."""
    intent = state.get("intent")
    if not intent:
        return _do_clarification("I could not understand your request. Please describe the email you want to send.")

    result = await resolve_gmail_context(
        user_prompt=state.get("user_prompt", ""),
        intent=intent,
        context_text=state.get("context_text"),
    )

    if result.clarification_question or not result.complete:
        return _do_clarification(
            result.clarification_question
            or "I could not find the relevant conversation. Please provide more details."
        )

    return {
        "context_text": result.context_text,
        "selected_thread_id": result.selected_thread_id,
        "last_message_id": result.last_message_id,
        "original_subject": result.original_subject,
        "status": "IN_PROGRESS",
    }


async def generate_draft_node(state: EmailWorkflowState) -> dict:
    draft_request = EmailDraftRequest(
        original_prompt=state.get("user_prompt", ""),
        intent=state["intent"],
        context_text=state.get("context_text"),
    )

    draft = await generate_draft(
        request=draft_request,
        attachments=state.get("attachments", []),
    )

    return {"draft": draft}


async def review_draft_node(state: EmailWorkflowState) -> dict:
    """Review the generated draft."""
    attachments = state.get("attachments", [])

    # Respect attachment decision
    decision = state.get("attachment_decision")
    selected_ids = state.get("selected_attachment_ids", [])
    if decision == "SKIP":
        attachments = []
    elif decision == "ATTACH" and selected_ids:
        attachments = [a for a in attachments if a.attachment_id in selected_ids]

    review_request = ReviewRequest(
        original_prompt=state.get("user_prompt", ""),
        intent=state["intent"],
        draft=state["draft"],
        context_text=state.get("context_text"),
        available_attachments=state.get("available_attachments", []),
    )
    review = await review_draft(review_request, attachments=attachments)
    return {"review": review}


async def revise_draft_node(state: EmailWorkflowState) -> dict:
    """Re-generate the draft with reviewer feedback appended."""
    intent = state["intent"]
    available_attachments = state.get("available_attachments", [])
    attachments = state.get("attachments", [])

    # Respect attachment decision
    decision = state.get("attachment_decision")
    selected_ids = state.get("selected_attachment_ids", [])
    if decision == "SKIP":
        attachments = []
        available_attachments = []
    elif decision == "ATTACH" and selected_ids:
        attachments = [a for a in attachments if a.attachment_id in selected_ids]
        available_attachments = [a for a in available_attachments if a.attachment_id in selected_ids]

    context_text = state.get("context_text") or ""

    review = state.get("review")
    if review and review.revision_instructions:
        feedback = "\n".join(f"- {inst}" for inst in review.revision_instructions)
        context_text += f"\n\nPREVIOUS REVIEW FEEDBACK:\n{feedback}"

    draft_request = EmailDraftRequest(
        original_prompt=state.get("user_prompt", ""),
        intent=intent,
        context_text=context_text if context_text else None,
        available_attachments=available_attachments,
    )

    draft = await generate_draft(draft_request, attachments=attachments)

    valid_ids = {att.attachment_id for att in attachments} if attachments else {att.attachment_id for att in available_attachments}
    draft.attachments = [a for a in draft.attachments if a.attachment_id in valid_ids]

    return {
        "draft": draft,
        "revision_count": state.get("revision_count", 0) + 1,
    }


async def create_gmail_draft_node(state: EmailWorkflowState) -> dict:
    """Create the Gmail draft via the API, with reply threading support."""
    draft = state["draft"]

    if not draft.subject.strip() or not draft.body.strip():
        return _do_clarification(
            "The generated email is incomplete. Please provide more detail about what the email should say."
        )

    if not draft.ready_for_approval:
        return _do_clarification(
            "The generated email is not ready yet. Please provide more detail about the request."
        )

    recipient_emails = [r.email for r in draft.to if r.email]
    if not recipient_emails:
        return _do_clarification(
            "The draft has no recipient email address. Please provide one."
        )

    # Verify every attachment_id belongs to the current request and resolve to GmailAttachment objects
    workflow_attachments = state.get("attachments", [])

    # Respect attachment decision
    decision = state.get("attachment_decision")
    selected_ids = state.get("selected_attachment_ids", [])
    if decision == "SKIP":
        workflow_attachments = []
    elif decision == "ATTACH" and selected_ids:
        workflow_attachments = [a for a in workflow_attachments if a.attachment_id in selected_ids]

    valid_attachments_by_id = {att.attachment_id: att for att in workflow_attachments}

    resolved_attachments: list[GmailAttachment] = []
    for att in draft.attachments:
        if att.attachment_id in valid_attachments_by_id:
            resolved_attachments.append(valid_attachments_by_id[att.attachment_id])

    # Reply threading: use thread_id, in_reply_to, references for replies
    thread_id = state.get("selected_thread_id")
    last_message_id = state.get("last_message_id")
    original_subject = state.get("original_subject")

    # For replies, preserve the original subject with Re: prefix
    subject = draft.subject
    intent = state.get("intent")
    if intent and intent.action == ActionType.REPLY and original_subject:
        if not subject.lower().startswith("re:"):
            subject = f"Re: {original_subject}"

    client = GmailClient()
    result = client.create_draft(
        to=recipient_emails,
        subject=subject,
        body=draft.body,
        attachments=resolved_attachments if resolved_attachments else None,
        thread_id=thread_id,
        in_reply_to=last_message_id,
        references=last_message_id,
    )

    return {
        "draft_id": result.get("draft_id"),
        "status": "WAITING_FOR_APPROVAL",
    }


async def human_approval_node(state: EmailWorkflowState) -> dict:
    """Interrupt and wait for explicit human approval before sending."""
    approval = interrupt({
        "status": "WAITING_FOR_APPROVAL",
        "draft": state.get("draft"),
        "review": state.get("review"),
        "draft_id": state.get("draft_id"),
    })

    is_approved = (
        approval is True
        or approval == "APPROVED"
        or (isinstance(approval, dict) and approval.get("approved") is True)
    )

    return {
        "approval_decision": "APPROVED" if is_approved else "REJECTED",
    }


async def reject_approved_draft_node(state: EmailWorkflowState) -> dict:
    """Mark the workflow as rejected when the user declines the draft."""
    return {
        "status": "REJECTED",
        "approval_decision": "REJECTED",
    }


async def send_approved_draft_node(state: EmailWorkflowState) -> dict:
    """Send the Gmail draft after human approval."""
    draft_id = state.get("draft_id")
    if not draft_id:
        raise ValueError("Cannot send without a Gmail draft ID")

    result = GmailClient().send_draft(draft_id)
    return {
        "status": "SENT",
        "send_result": result,
    }


# ---------------------------------------------------------------------------
# Review failed — interrupt so user can provide new instructions
# ---------------------------------------------------------------------------

async def review_failed_node(state: EmailWorkflowState) -> dict | Command:
    """After 2 failed revisions, interrupt and let the user provide guidance."""
    review = state.get("review")
    issues = review.issues if review else []
    revision_instructions = review.revision_instructions if review else []

    question = (
        "The draft still needs improvement after two revisions.\n\n"
        f"Issues: {', '.join(issues) if issues else 'None specified'}\n\n"
        f"Suggested fixes: {', '.join(revision_instructions) if revision_instructions else 'None specified'}\n\n"
        "What would you like me to change?"
    )

    response = interrupt({
        "status": "REVIEW_FAILED",
        "clarification_question": question,
        "review": review,
    })

    # User provides new instructions → restart from draft generation with updated prompt
    if isinstance(response, dict):
        additional_prompt = response.get("user_prompt") or response.get("prompt") or response.get("instructions", "")
    elif isinstance(response, str):
        additional_prompt = response
    else:
        additional_prompt = ""

    if additional_prompt:
        # Append user instructions to the existing prompt
        current_prompt = state.get("user_prompt", "")
        updated_prompt = f"{current_prompt}\n\nADDITIONAL INSTRUCTIONS: {additional_prompt}"
        return Command(
            update={
                "user_prompt": updated_prompt,
                "draft": None,
                "review": None,
                "revision_count": 0,
                "status": "IN_PROGRESS",
                "clarification_question": None,
                "approval_decision": None,
            },
            goto="generate_draft",
        )

    # No new prompt — stay paused
    return {
        "status": "REVIEW_FAILED",
        "clarification_question": question,
    }


# ---------------------------------------------------------------------------
# Clarification helper
# ---------------------------------------------------------------------------
def _do_clarification(question: str) -> dict | Command:
    """Interrupt for clarification. On resume, handle user response intelligently."""
    response = interrupt({
        "status": "WAITING_FOR_USER",
        "clarification_question": question,
    })

    # The user resumes with a new/updated prompt or thread selection
    if isinstance(response, dict):
        updated_prompt = response.get("user_prompt") or response.get("prompt")
        selected_thread_id = response.get("selected_thread_id") or response.get("thread_id")

        # If user selected a thread directly, skip intent re-analysis
        if selected_thread_id and not updated_prompt:
            return Command(
                update={
                    "selected_thread_id": selected_thread_id,
                    "status": "IN_PROGRESS",
                    "clarification_question": None,
                },
                goto="load_selected_thread",
            )

        if not updated_prompt and selected_thread_id:
            updated_prompt = f"Reply to conversation with thread ID {selected_thread_id}"
    elif isinstance(response, str):
        updated_prompt = response
        selected_thread_id = None
    else:
        updated_prompt = None
        selected_thread_id = None

    if updated_prompt:
        return Command(
            update={
                "user_prompt": updated_prompt,
                "intent": None,
                "context_text": None,
                "draft": None,
                "review": None,
                "draft_id": None,
                "revision_count": 0,
                "status": "IN_PROGRESS",
                "clarification_question": None,
                "selected_thread_id": selected_thread_id,
                "last_message_id": None,
                "original_subject": None,
                "send_result": None,
                "approval_decision": None,
            },
            goto="analyze_intent",
        )

    # If no new prompt was provided, stay paused
    return {
        "status": "WAITING_FOR_USER",
        "clarification_question": question,
    }


# ---------------------------------------------------------------------------
# Load selected thread node — used when user selects a thread directly
# ---------------------------------------------------------------------------

async def load_selected_thread_node(state: EmailWorkflowState) -> dict:
    """Load a user-selected Gmail thread and extract context for drafting."""
    thread_id = state.get("selected_thread_id")
    if not thread_id:
        return {
            "status": "WAITING_FOR_USER",
            "clarification_question": "No thread was selected. Please provide a thread ID.",
        }

    try:
        client = GmailClient()
        thread_data = client.get_thread(thread_id)
    except Exception as exc:
        logger.exception("Failed to load thread %s: %s", thread_id, exc)
        return {
            "status": "WAITING_FOR_USER",
            "clarification_question": f"Could not load thread {thread_id}. Please try again.",
        }

    messages = thread_data.get("messages", [])
    if not messages:
        return {
            "status": "WAITING_FOR_USER",
            "clarification_question": "The selected thread has no messages.",
        }

    # Build context text from thread messages
    context_parts = []
    for msg in messages:
        context_parts.append(
            f"From: {msg.get('from', '')}\n"
            f"To: {msg.get('to', '')}\n"
            f"Subject: {msg.get('subject', '')}\n"
            f"Date: {msg.get('date', '')}\n"
            f"Body:\n{msg.get('body', '')}"
        )
    context_text = "\n\n---\n\n".join(context_parts)

    # Extract last message info for reply threading
    last_msg = messages[-1]
    last_message_id = last_msg.get("rfc_message_id", "")
    original_subject = last_msg.get("subject", "")

    return {
        "context_text": context_text,
        "selected_thread_id": thread_id,
        "last_message_id": last_message_id,
        "original_subject": original_subject,
        "status": "IN_PROGRESS",
    }


# ---------------------------------------------------------------------------
# Routing functions
# ---------------------------------------------------------------------------
def route_after_clarification(state: EmailWorkflowState) -> str:
    """After ask_clarification: proceed to attachment_confirmation or handle pause/restart."""
    if state.get("intent") is None:
        return "analyze_intent"
    if state.get("status") == "WAITING_FOR_USER":
        return "end"
    return "attachment_confirmation"


def route_after_attachment_confirmation(state: EmailWorkflowState) -> str:
    """After attachment_confirmation: proceed to gmail_context_agent."""
    if state.get("status") == "WAITING_FOR_USER":
        return "end"
    return "gmail_context_agent"


def route_after_gmail_context(state: EmailWorkflowState) -> str:
    """After gmail_context_agent: proceed to generate_draft or handle pause/restart."""
    if state.get("intent") is None:
        return "analyze_intent"
    if state.get("status") == "WAITING_FOR_USER":
        return "end"
    return "generate_draft"


def route_after_load_thread(state: EmailWorkflowState) -> str:
    """After load_selected_thread: proceed to generate_draft or handle error."""
    if state.get("status") == "WAITING_FOR_USER":
        return "end"
    return "generate_draft"


def route_after_review(state: EmailWorkflowState) -> str:
    """After review: revise, or move to create draft."""
    review = state.get("review")
    revision_count = state.get("revision_count", 0)
    if review and review.decision == ReviewDecision.FAIL and revision_count < 2:
        return "revise_draft"
    if review and review.decision == ReviewDecision.FAIL:
        return "review_failed"
    return "create_gmail_draft"


def route_after_approval(state: EmailWorkflowState) -> str:
    """After human approval: send or reject."""
    if state.get("approval_decision") == "APPROVED":
        return "send_approved_draft"
    return "reject_approved_draft"


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------
builder = StateGraph(EmailWorkflowState)

builder.add_node("analyze_intent", analyze_intent_node)
builder.add_node("ask_clarification", ask_clarification_node)
builder.add_node("attachment_confirmation", attachment_confirmation_node)
builder.add_node("gmail_context_agent", gmail_context_agent_node)
builder.add_node("load_selected_thread", load_selected_thread_node)
builder.add_node("generate_draft", generate_draft_node)
builder.add_node("review_draft", review_draft_node)
builder.add_node("revise_draft", revise_draft_node)
builder.add_node("review_failed", review_failed_node)
builder.add_node("create_gmail_draft", create_gmail_draft_node)
builder.add_node("human_approval", human_approval_node)
builder.add_node("reject_approved_draft", reject_approved_draft_node)
builder.add_node("send_approved_draft", send_approved_draft_node)

builder.set_entry_point("analyze_intent")

# analyze_intent -> ask_clarification (always)
builder.add_edge("analyze_intent", "ask_clarification")

# ask_clarification -> analyze_intent | attachment_confirmation | END
builder.add_conditional_edges(
    "ask_clarification",
    route_after_clarification,
    {
        "analyze_intent": "analyze_intent",
        "attachment_confirmation": "attachment_confirmation",
        "end": END,
    },
)

# attachment_confirmation -> gmail_context_agent | END
builder.add_conditional_edges(
    "attachment_confirmation",
    route_after_attachment_confirmation,
    {
        "gmail_context_agent": "gmail_context_agent",
        "end": END,
    },
)

# gmail_context_agent -> analyze_intent | generate_draft | END
builder.add_conditional_edges(
    "gmail_context_agent",
    route_after_gmail_context,
    {
        "analyze_intent": "analyze_intent",
        "generate_draft": "generate_draft",
        "end": END,
    },
)

# load_selected_thread -> generate_draft | END
builder.add_conditional_edges(
    "load_selected_thread",
    route_after_load_thread,
    {
        "generate_draft": "generate_draft",
        "end": END,
    },
)

# generate_draft -> review_draft
builder.add_edge("generate_draft", "review_draft")

# review_draft -> revise_draft | review_failed | create_gmail_draft
builder.add_conditional_edges(
    "review_draft",
    route_after_review,
    {
        "revise_draft": "revise_draft",
        "review_failed": "review_failed",
        "create_gmail_draft": "create_gmail_draft",
    },
)

# revise_draft -> review_draft (loop back)
builder.add_edge("revise_draft", "review_draft")

# review_failed can either end or goto generate_draft via Command
builder.add_edge("review_failed", END)

# create_gmail_draft -> human_approval
builder.add_edge("create_gmail_draft", "human_approval")

# human_approval -> send_approved_draft | reject_approved_draft
builder.add_conditional_edges(
    "human_approval",
    route_after_approval,
    {
        "send_approved_draft": "send_approved_draft",
        "reject_approved_draft": "reject_approved_draft",
    },
)

# send_approved_draft -> END
builder.add_edge("send_approved_draft", END)

# reject_approved_draft -> END
builder.add_edge("reject_approved_draft", END)

workflow_graph = builder.compile(checkpointer=memory)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def run_email_workflow(
    user_prompt: str,
    workflow_thread_id: str,
    attachments: list[GmailAttachment] | None = None,
    resume_value=None,
) -> dict:
    """
    Start or resume the email workflow.

    Args:
        user_prompt: The user's request (e.g. "Send a thank-you email to John").
        workflow_thread_id: Unique ID for this workflow run (used by MemorySaver).
        attachments: Optional in-memory file attachments.
        resume_value: Value to resume a paused workflow (new prompt or approval).

    Returns:
        A safe dict with status, intent, draft, review, draft_id, send_result, etc.
    """
    config = {"configurable": {"thread_id": workflow_thread_id}}
    attachments_list = attachments or []

    if resume_value is not None:
        # Resume a paused workflow
        if attachments_list:
            set_request_attachments(attachments_list)
        else:
            saved = await workflow_graph.aget_state(config)
            if saved and saved.values.get("attachments"):
                set_request_attachments(saved.values["attachments"])

        final_state = await workflow_graph.ainvoke(
            Command(resume=resume_value), config=config,
        )
    else:
        # Start a new workflow
        set_request_attachments(attachments_list)

        available_attachments = [
            AvailableAttachment(attachment_id=a.attachment_id, filename=a.filename)
            for a in attachments_list
        ]

        initial_state: EmailWorkflowState = {
            "user_prompt": user_prompt,
            "attachments": attachments_list,
            "available_attachments": available_attachments,
            "revision_count": 0,
            "approval_decision": None,
        }

        final_state = await workflow_graph.ainvoke(initial_state, config=config)

    # Merge interrupt payload into state for the response
    response_data = dict(final_state)
    if final_state.get("__interrupt__"):
        try:
            interrupt_val = final_state["__interrupt__"][0]
            val = interrupt_val.value if hasattr(interrupt_val, "value") else {}
            if isinstance(val, dict):
                response_data.update(val)
        except Exception:
            pass

    return build_safe_response(response_data)
