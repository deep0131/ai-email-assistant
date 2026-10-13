from enum import Enum

from pydantic import BaseModel, Field


class ActionType(str, Enum):
    NEW_EMAIL = "NEW_EMAIL"


class IntentRequest(BaseModel):
    prompt: str


class IntentResponse(BaseModel):
    action: ActionType
    recipient: str | None
    has_email_content: bool
    confidence: float = Field(ge=0.0, le=1.0)
    missing_information: list[str]
    clarification_question: str
    reasoning_summary: str


class EmailRecipient(BaseModel):
    name: str | None
    email: str | None


class EmailDraftRequest(BaseModel):
    original_prompt: str
    intent: IntentResponse


class EmailDraftResponse(BaseModel):
    subject: str
    to: list[EmailRecipient]
    body: str
    action: ActionType
    questions: list[str]


class ReviewRequest(BaseModel):
    original_prompt: str
    intent: IntentResponse
    draft: EmailDraftResponse


class ReviewDecision(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class ReviewResponse(BaseModel):
    decision: ReviewDecision
    score: float = Field(ge=0.0, le=1.0)
    summary: str
    issues: list[str]
    revision_instructions: list[str]