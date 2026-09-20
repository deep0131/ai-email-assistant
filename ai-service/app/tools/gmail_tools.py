
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
