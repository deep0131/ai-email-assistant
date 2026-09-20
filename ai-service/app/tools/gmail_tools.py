
from langchain_core.tools import tool

from app.gmail.client import GmailClient


@tool
def search_gmail(query: str, max_results: int = 10) -> dict:
    """Search Gmail threads matching the given query.

    Use Gmail search syntax (e.g. "from:recruiter@company.com",
    "subject:job offer", "is:unread", "newer_than:7d").

    Args:
        query: Gmail search query string.
        max_results: Maximum number of threads to return (default 10).

    Returns:
        A dict with "threads" (list of thread_id + snippet) and "total".
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


@tool
def create_gmail_draft(
    to: list[str],
    subject: str,
    body: str,
    attachment_paths: list[str] | None = None,
) -> dict:
    """Create a draft email in Gmail.

    Builds a MIME email with the specified recipients, subject,
    plain-text body, and optional file attachments, then saves it
    to Gmail Drafts without sending it.

    Args:
        to: List of recipient email addresses.
        subject: Subject line for the email.
        body: Plain-text body content of the email.
        attachment_paths: Optional list of local file paths to attach.

    Returns:
        A dict with "draft_id" and "message_id".
    """
    client = GmailClient()
    return client.create_draft(
        to=to,
        subject=subject,
        body=body,
        attachment_paths=attachment_paths,
    )


@tool
def send_gmail(
    to: list[str],
    subject: str,
    body: str,
    approval_confirmed: bool = False,
    attachment_paths: list[str] | None = None,
) -> dict:
    """Send an email via Gmail with human-in-the-loop approval protection.

    Sends an email to the specified recipients with subject, plain-text body,
    and optional attachments. Requires explicit user approval before sending.

    Args:
        to: List of recipient email addresses.
        subject: Subject line for the email.
        body: Plain-text body of the email.
        approval_confirmed: Must be True to permit sending. If False, the email
            will not be sent.
        attachment_paths: Optional list of local file paths to attach.

    Returns:
        A dict with "message_id" and "thread_id".

    Raises:
        PermissionError: If approval_confirmed is not True.
    """
    if not approval_confirmed:
        raise PermissionError(
            "Email sending was aborted: explicit user approval is required "
            "(approval_confirmed must be True)."
        )

    client = GmailClient()
    return client.send_email(
        to=to,
        subject=subject,
        body=body,
        attachment_paths=attachment_paths,
    )
