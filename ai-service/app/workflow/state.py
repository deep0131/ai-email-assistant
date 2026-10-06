from typing import TypedDict

from app.gmail.client import GmailAttachment
from app.schemas import (
    AvailableAttachment,
    EmailDraftResponse,
    IntentResponse,
    ReviewResponse,
)


class EmailWorkflowState(TypedDict, total=False):
    user_prompt: str
    attachments: list[GmailAttachment]
    available_attachments: list[AvailableAttachment]
    intent: IntentResponse | None
    context_text: str | None
    draft: EmailDraftResponse | None
    review: ReviewResponse | None
    revision_count: int
    draft_id: str | None
    selected_thread_id: str | None
    last_message_id: str | None
    original_subject: str | None
    send_result: dict | None
    status: str
    clarification_question: str | None
    # Approval
    approval_decision: str | None
    # Attachment confirmation
    attachment_decision: str | None
    selected_attachment_ids: list[str]
