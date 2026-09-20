
import base64

from googleapiclient.discovery import build

from app.gmail.auth import get_valid_credentials


def get_gmail_service():
    
    creds = get_valid_credentials()
    service = build("gmail", "v1", credentials=creds)
    return service


class GmailClient:
    """
    Thin wrapper around the Gmail API that exposes
    search_threads() and get_thread() with clean return shapes.
    """

    def __init__(self):
        self.service = get_gmail_service()


    def search_threads(self, query: str, max_results: int = 10) -> dict:
        response = self.service.users().threads().list(
            userId="me",
            q=query,
            maxResults=max_results,
        ).execute()

        raw_threads = response.get("threads", [])

        threads = [
            {
                "thread_id": t.get("id", ""),
                "snippet": t.get("snippet", ""),
            }
            for t in raw_threads
        ]

        return {
            "threads": threads,
            "total": len(threads),
        }

    def get_thread(self, thread_id: str) -> dict:
        raw_thread = self.service.users().threads().get(
            userId="me",
            id=thread_id,
            format="full",
        ).execute()

        messages = []
        for raw_msg in raw_thread.get("messages", []):
            messages.append(self._parse_message(raw_msg))

        return {
            "thread_id": raw_thread.get("id", ""),
            "messages": messages,
        }


    @staticmethod
    def _get_header(headers: list[dict], name: str) -> str:
        """Safely extract a single header value by name (case-insensitive)."""
        name_lower = name.lower()
        for header in headers:
            if header.get("name", "").lower() == name_lower:
                return header.get("value", "")
        return ""

    def _extract_plain_text(self, payload: dict, message_id: str = "") -> str:
        """
        Recursively walk the message payload and return the first
        text/plain body found. Gmail nests parts inside parts for
        multipart messages, so we check recursively.
        """
        mime_type = payload.get("mimeType", "")

        # Simple single-part message
        if mime_type == "text/plain":
            body = payload.get("body", {})
            data = body.get("data", "")

            # If the body is large, Gmail omits inline data and provides attachmentId
            if not data and body.get("attachmentId") and message_id:
                attachment = (
                    self.service.users()
                    .messages()
                    .attachments()
                    .get(
                        userId="me",
                        messageId=message_id,
                        id=body["attachmentId"],
                    )
                    .execute()
                )
                data = attachment.get("data", "")

            if data:
                return base64.urlsafe_b64decode(
                    data + "=" * (-len(data) % 4)
                ).decode("utf-8", errors="replace")
            return ""

        # Multipart message — recurse into each child part
        for part in payload.get("parts", []):
            text = self._extract_plain_text(part, message_id=message_id)
            if text:
                return text

        return ""

    def _parse_message(self, raw_msg: dict) -> dict:
        """Convert a raw Gmail API message into a clean dict."""
        message_id = raw_msg.get("id", "")
        payload = raw_msg.get("payload", {})
        headers = payload.get("headers", [])

        return {
            "message_id": message_id,
            "thread_id": raw_msg.get("threadId", ""),
            "from": self._get_header(headers, "From"),
            "to": self._get_header(headers, "To"),
            "subject": self._get_header(headers, "Subject"),
            "date": self._get_header(headers, "Date"),
            "body": self._extract_plain_text(payload, message_id=message_id),
        }
