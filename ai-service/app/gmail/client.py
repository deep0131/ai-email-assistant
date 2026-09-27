
import base64
from dataclasses import dataclass
from email.message import EmailMessage

from googleapiclient.discovery import build

from app.gmail.auth import get_valid_credentials


@dataclass
class GmailAttachment:
    attachment_id: str
    filename: str
    content_type: str
    data: bytes


def get_gmail_service():
    
    creds = get_valid_credentials()
    service = build("gmail", "v1", credentials=creds)
    return service


class GmailClient:
    """
    Thin wrapper around the Gmail API that exposes
    search_threads(), get_thread(), create_draft(), and send_draft() with clean return shapes.
    """

    def __init__(self):
        self.service = get_gmail_service()


    def search_threads(self, query: str, max_results: int = 10) -> dict:
        """Search Gmail threads and return useful candidate info per thread.

        For each thread returned by the list API, the first message is
        loaded to extract sender, subject, and date headers so the caller
        (and the user) can distinguish ambiguous results.
        """
        response = self.service.users().threads().list(
            userId="me",
            q=query,
            maxResults=max_results,
        ).execute()

        raw_threads = response.get("threads", [])

        threads: list[dict] = []
        for t in raw_threads:
            thread_id = t.get("id", "")
            snippet = t.get("snippet", "")

            # Load the thread with metadata format to get headers cheaply
            sender = ""
            subject = ""
            date = ""
            try:
                thread_data = self.service.users().threads().get(
                    userId="me",
                    id=thread_id,
                    format="metadata",
                    metadataHeaders=["From", "Subject", "Date"],
                ).execute()
                messages = thread_data.get("messages", [])
                if messages:
                    first_msg = messages[0]
                    headers = first_msg.get("payload", {}).get("headers", [])
                    sender = self._get_header(headers, "From")
                    subject = self._get_header(headers, "Subject")
                    date = self._get_header(headers, "Date")
            except Exception:
                pass

            threads.append({
                "thread_id": thread_id,
                "snippet": snippet,
                "sender": sender,
                "subject": subject,
                "date": date,
            })

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
    def _attach_files(message: EmailMessage, attachments: list[GmailAttachment]) -> None:
        """Attach in-memory files directly to a MIME message without writing to disk."""
        for att in attachments:
            content_type = att.content_type or "application/octet-stream"
            if "/" in content_type:
                maintype, subtype = content_type.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"

            message.add_attachment(
                att.data,
                maintype=maintype,
                subtype=subtype,
                filename=att.filename,
            )

    def create_draft(
        self,
        to: list[str],
        subject: str,
        body: str,
        attachments: list[GmailAttachment] | None = None,
        thread_id: str | None = None,
        in_reply_to: str | None = None,
        references: str | None = None,
    ) -> dict:
        """
        Create a Gmail draft with plain-text content and optional in-memory attachments.

        For replies, supply thread_id (and optionally in_reply_to / references)
        so the draft belongs to the correct Gmail thread.

        Args:
            to: List of recipient email addresses.
            subject: Subject line for the email.
            body: Plain-text body of the email.
            attachments: Optional list of in-memory GmailAttachment objects.
            thread_id: Gmail thread ID to attach the draft to (for replies).
            in_reply_to: RFC-2822 Message-ID of the message being replied to.
            references: RFC-2822 References header value.

        Returns:
            dict containing:
                - draft_id: Gmail draft identifier.
                - message_id: Gmail message identifier for the draft.
        """
        # 1. Build the MIME email message
        message = EmailMessage()
        if to:
            message["To"] = ", ".join(to)
        message["Subject"] = subject
        if in_reply_to:
            message["In-Reply-To"] = in_reply_to
        if references:
            message["References"] = references
        message.set_content(body)

        # 2. Attach any in-memory files provided
        if attachments:
            self._attach_files(message, attachments)

        # 3. Encode the message in URL-safe base64
        raw_bytes = message.as_bytes()
        encoded_message = base64.urlsafe_b64encode(raw_bytes).decode("utf-8")

        # 4. Build the API request body
        draft_body: dict = {"message": {"raw": encoded_message}}
        if thread_id:
            draft_body["message"]["threadId"] = thread_id

        # 5. Call Gmail API users.drafts.create
        draft = self.service.users().drafts().create(
            userId="me",
            body=draft_body,
        ).execute()

        # 6. Return draft ID and message ID
        return {
            "draft_id": draft.get("id", ""),
            "message_id": draft.get("message", {}).get("id", ""),
        }

    def send_email(
        self,
        to: list[str],
        subject: str,
        body: str,
        attachments: list[GmailAttachment] | None = None,
    ) -> dict:
        """
        Send an email via Gmail with plain-text content and optional in-memory attachments.

        Args:
            to: List of recipient email addresses.
            subject: Subject line for the email.
            body: Plain-text body of the email.
            attachments: Optional list of in-memory GmailAttachment objects.

        Returns:
            dict containing:
                - message_id: Gmail message identifier for the sent email.
                - thread_id: Gmail thread identifier.
        """
        # 1. Build the MIME email message
        message = EmailMessage()
        if to:
            message["To"] = ", ".join(to)
        message["Subject"] = subject
        message.set_content(body)

        # 2. Attach any in-memory files provided
        if attachments:
            self._attach_files(message, attachments)

        # 3. Encode the message in URL-safe base64
        raw_bytes = message.as_bytes()
        encoded_message = base64.urlsafe_b64encode(raw_bytes).decode("utf-8")

        # 4. Call Gmail API users.messages.send
        sent_message = self.service.users().messages().send(
            userId="me",
            body={"raw": encoded_message},
        ).execute()

        # 5. Return message ID and thread ID
        return {
            "message_id": sent_message.get("id", ""),
            "thread_id": sent_message.get("threadId", ""),
        }

    def send_draft(self, draft_id: str) -> dict:
        """Send an existing Gmail draft after trusted human approval."""
        if not draft_id:
            raise ValueError("draft_id is required")

        sent_message = self.service.users().drafts().send(
            userId="me",
            body={"id": draft_id},
        ).execute()

        return {
            "message_id": sent_message.get("id", ""),
            "thread_id": sent_message.get("threadId", ""),
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
            "rfc_message_id": self._get_header(headers, "Message-ID"),
            "body": self._extract_plain_text(payload, message_id=message_id),
        }
