
from contextvars import ContextVar

from langchain_core.tools import tool

from app.gmail.client import GmailAttachment, GmailClient


# Context variable to hold in-memory attachments for the current request
_request_attachments: ContextVar[dict[str, GmailAttachment]] = ContextVar(
    "_request_attachments", default={}
)


def set_request_attachments(attachments: list[GmailAttachment]) -> None:
    """Register in-memory attachments available for the current request."""
    _request_attachments.set({att.attachment_id: att for att in attachments})


def get_request_attachments() -> dict[str, GmailAttachment]:
    """Get in-memory attachments registered for the current request."""
    return _request_attachments.get()


def clear_request_attachments() -> None:
    """Clear attachments for the current request."""
    _request_attachments.set({})


def _resolve_attachment_ids(attachment_ids: list[str] | None) -> list[GmailAttachment]:
    """
    Resolve attachment IDs against the attachments uploaded in the current request.
    Rejects any attachment_id that does not belong to the current request.
    """
    if not attachment_ids:
        return []

    available = get_request_attachments()
    resolved: list[GmailAttachment] = []
    for att_id in attachment_ids:
        if att_id not in available:
            raise ValueError(
                f"Invalid attachment_id: '{att_id}' does not belong to the current request."
            )
        resolved.append(available[att_id])
    return resolved


# ---------------------------------------------------------------------------
# Tools SAFE for Gemini (read-only Gmail access)
# ---------------------------------------------------------------------------

@tool
def search_gmail(query: str, max_results: int = 10) -> dict:
    """Search Gmail threads matching the given query.

    Use Gmail search syntax (e.g. "from:recruiter@company.com",
    "subject:job offer", "is:unread", "newer_than:7d").

    Args:
        query: Gmail search query string.
        max_results: Maximum number of threads to return (default 10).

    Returns:
        A dict with "threads" (list of thread_id, snippet, sender, subject, date) and "total".
    """
    client = GmailClient()
    return client.search_threads(query=query, max_results=max_results)


@tool
def get_email_thread(thread_id: str) -> dict:
    """Fetch the full content of a Gmail thread by its thread ID.

    Returns every message in the thread with parsed headers
    (from, to, subject, date) and the plain-text body.

    Args:
        thread_id: The Gmail thread ID to retrieve.

    Returns:
        A dict with "thread_id" and "messages" list.
    """
    client = GmailClient()
    return client.get_thread(thread_id=thread_id)


# ---------------------------------------------------------------------------
# Internal functions — NOT exposed to Gemini as tools.
# Draft creation is controlled by LangGraph.
# Sending is controlled by LangGraph after human approval.
# ---------------------------------------------------------------------------

def _create_gmail_draft_internal(
    to: list[str],
    subject: str,
    body: str,
    attachment_ids: list[str] | None = None,
    thread_id: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> dict:
    """Create a draft email in Gmail (internal, not a Gemini tool).

    Args:
        to: List of recipient email addresses.
        subject: Subject line for the email.
        body: Plain-text body content of the email.
        attachment_ids: Optional list of attachment IDs uploaded in the current request.
        thread_id: Gmail thread ID (for replies).
        in_reply_to: RFC-2822 Message-ID of the message being replied to.
        references: RFC-2822 References header value.

    Returns:
        A dict with "draft_id" and "message_id".

    Raises:
        ValueError: If any attachment_id does not belong to the current request.
    """
    resolved_attachments = _resolve_attachment_ids(attachment_ids)
    client = GmailClient()
    return client.create_draft(
        to=to,
        subject=subject,
        body=body,
        attachments=resolved_attachments if resolved_attachments else None,
        thread_id=thread_id,
        in_reply_to=in_reply_to,
        references=references,
    )


def _send_gmail_internal(
    to: list[str],
    subject: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict:
    """Send an email via Gmail (internal, not a Gemini tool).

    Args:
        to: List of recipient email addresses.
        subject: Subject line for the email.
        body: Plain-text body of the email.
        attachment_ids: Optional list of attachment IDs uploaded in the current request.

    Returns:
        A dict with "message_id" and "thread_id".

    Raises:
        ValueError: If any attachment_id does not belong to the current request.
    """
    resolved_attachments = _resolve_attachment_ids(attachment_ids)
    client = GmailClient()
    return client.send_email(
        to=to,
        subject=subject,
        body=body,
        attachments=resolved_attachments if resolved_attachments else None,
    )
