from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ActionType(str, Enum):
    NEW_EMAIL = "NEW_EMAIL"
    REPLY = "REPLY"
    DRAFT = "DRAFT"
    UNKNOWN = "UNKNOWN"


class SourceType(str, Enum):
    USER_PROVIDED = "USER_PROVIDED"
    GMAIL_REQUIRED = "GMAIL_REQUIRED"
    UNKNOWN = "UNKNOWN"


class IntentRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="The user's natural-language email request",
    )


class IntentResponse(BaseModel):
    action: ActionType
    recipient: Optional[str]
    source: SourceType
    has_email_content: bool
    needs_attachment: bool
    confidence: float = Field(ge=0.0, le=1.0)
    missing_information: List[str]
    reasoning_summary: str


class EmailRecipient(BaseModel):
    name: Optional[str]
    email: Optional[str]


class AvailableAttachment(BaseModel):
    attachment_id: str
    filename: str


class EmailAttachment(BaseModel):
    attachment_id: str
    filename: str


class EmailDraftRequest(BaseModel):
    original_prompt: str
    intent: IntentResponse
    context_text: Optional[str] = None
    available_attachments: List[AvailableAttachment] = Field(default_factory=list)


class EmailDraftResponse(BaseModel):
    subject: str
    to: List[EmailRecipient]
    body: str
    action: ActionType
    attachments: List[EmailAttachment]
    questions: List[str]
    ready_for_approval: bool


class ReviewDecision(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class ReviewRequest(BaseModel):
    original_prompt: str
    intent: IntentResponse
    draft: EmailDraftResponse
    context_text: Optional[str] = None
    available_attachments: List[AvailableAttachment] = Field(default_factory=list)


class ReviewResponse(BaseModel):
    decision: ReviewDecision
    score: float = Field(ge=0.0, le=1.0)
    summary: str
    issues: List[str]
    revision_instructions: List[str]
    ready_for_approval: bool


class GmailContextResult(BaseModel):
    needs_gmail: bool
    selected_thread_id: Optional[str]
    last_message_id: Optional[str]
    original_subject: Optional[str]
    context_text: Optional[str]
    clarification_question: Optional[str]
    complete: bool


class AttachmentDecision(str, Enum):
    ATTACH = "ATTACH"
    SKIP = "SKIP"
    PENDING = "PENDING"
