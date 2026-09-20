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
    recipient: Optional[str] = None
    source: SourceType
    has_email_content: bool
    needs_attachment: bool
    confidence: float = Field(ge=0.0, le=1.0)
    missing_information: List[str] = Field(default_factory=list)
    reasoning_summary: str