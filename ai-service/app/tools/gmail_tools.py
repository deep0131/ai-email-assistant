from app.gmail.client import GmailAttachment, GmailClient


def _send_gmail_internal(
    to: list[str],
    subject: str,
    body: str,
    attachments: list[GmailAttachment] | None = None,
) -> dict:
    """Send an approved email through Gmail."""

    client = GmailClient()

    return client.send_email(
        to=to,
        subject=subject,
        body=body,
        attachments=attachments or [],
    )