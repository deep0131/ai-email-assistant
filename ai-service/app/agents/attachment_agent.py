import logging
import os
from enum import Enum
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)

SERVICE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(SERVICE_ROOT / ".env")

gemini_api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_api_key)


class AttachmentDecisionCategory(str, Enum):
    ATTACH = "ATTACH"
    SKIP = "SKIP"
    UNCLEAR = "UNCLEAR"


class AttachmentClassificationResponse(BaseModel):
    decision: AttachmentDecisionCategory
    reasoning: str


SYSTEM_INSTRUCTION = """You are an attachment confirmation assistant.

Your task is to classify a user's natural language response regarding whether they want uploaded files attached to an outgoing email.

Classify the user's intent into exactly one of three categories:
- ATTACH: The user wants the file(s) attached or included with the email.
  Examples: "okay", "sure", "go ahead", "attach it", "attach them", "send it with the resume", "send with the file", "include it", "yes", "y", "yep", "please attach".
- SKIP: The user does NOT want the file(s) attached, or wants to proceed without attaching them.
  Examples: "no", "skip it", "send without the file", "send without it", "leave it off", "do not attach", "send without", "n", "nope", "no thanks".
- UNCLEAR: The user's response is ambiguous, undecided, questioning, or hesitant.
  Examples: "maybe", "I am not sure", "what files?", "why?", "perhaps", "let me think", "not sure yet".

Return only valid JSON matching the schema.
"""


async def classify_attachment_decision(user_response: str) -> str:
    """Classify the user's natural response into ATTACH, SKIP, or UNCLEAR using Gemini only."""
    cleaned = (user_response or "").strip()
    if not cleaned:
        return "UNCLEAR"

    prompt = f"User response: {cleaned}"

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0,
                response_mime_type="application/json",
                response_schema=AttachmentClassificationResponse,
            ),
        )

        if response.text:
            parsed = AttachmentClassificationResponse.model_validate_json(response.text)
            if parsed.decision in (
                AttachmentDecisionCategory.ATTACH,
                AttachmentDecisionCategory.SKIP,
                AttachmentDecisionCategory.UNCLEAR,
            ):
                return parsed.decision.value
    except Exception as exc:
        logger.warning("Gemini attachment classification failed or returned invalid response: %s", exc)

    return "UNCLEAR"
