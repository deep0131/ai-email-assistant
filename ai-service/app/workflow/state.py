from typing import Any, TypedDict

from app.gmail.client import GmailAttachment
from app.schemas import (
    EmailDraftResponse,
    IntentResponse,
    ReviewResponse,
)


class EmailWorkflowState(TypedDict, total=False):

    # User input
    user_prompt: str
    attachments: list[GmailAttachment]

    # Agent results
    intent: IntentResponse | None
    draft: EmailDraftResponse | None
    review: ReviewResponse | None

    # Workflow control
    revision_count: int
    max_revisions: int
    status: str
    clarification_question: str | None

    # Approval
    approval_decision: bool | None
    error: str | None
