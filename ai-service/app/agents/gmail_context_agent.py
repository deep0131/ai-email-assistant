import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.schemas import GmailContextResult, IntentResponse
from app.tools.gmail_tools import get_email_thread, search_gmail

logger = logging.getLogger(__name__)

# Load environment variables
SERVICE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(SERVICE_ROOT / ".env")

gemini_api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_api_key)


def search_gmail_for_gemini(query: str) -> dict:
    """Search Gmail threads matching the given query."""
    return search_gmail.invoke({
        "query": query,
        "max_results": 10,
    })


def get_email_thread_for_gemini(thread_id: str) -> dict:
    """Fetch the full content of a Gmail thread by its thread ID."""
    return get_email_thread.invoke({
        "thread_id": thread_id,
    })


SYSTEM_INSTRUCTION = """You are a Gmail context assistant.

For a new email, do not call Gmail tools. Return:
{
  "needs_gmail": false,
  "selected_thread_id": null,
  "last_message_id": null,
  "original_subject": null,
  "context_text": null,
  "clarification_question": null,
  "complete": true
}

For a reply or a request referring to a previous email:
- search Gmail using search_gmail_for_gemini;
- if multiple threads match, return a clarification result instead of randomly selecting one:
  set needs_gmail=true, complete=false, clarification_question listing candidate threads, selected_thread_id=null;
- if exactly one relevant thread matches, load it using get_email_thread_for_gemini;
- extract selected_thread_id, original_subject, last_message_id (from the last message's rfc_message_id), and formatted context_text;
- return complete=true.

If no matching thread is found, return needs_gmail=true, complete=false, and set clarification_question asking the user for more details.

Return only structured JSON matching GmailContextResult. Do not enclose the output in markdown code blocks.

Never send, draft, modify, or delete emails.
"""


async def resolve_gmail_context(
    user_prompt: str,
    intent: IntentResponse,
    context_text: str | None = None,
) -> GmailContextResult:
    """Resolve Gmail context using Gemini automatic function calling with a 5 tool-call limit."""
    prompt = f"""USER PROMPT: {user_prompt}
ACTION: {intent.action}
RECIPIENT: {intent.recipient or 'None'}
SOURCE: {intent.source}
EXISTING CONTEXT: {context_text or 'None'}
"""

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[
                    search_gmail_for_gemini,
                    get_email_thread_for_gemini,
                ],
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    maximum_remote_calls=5,
                ),
                temperature=0,
            ),
        )

        raw_text = (response.text or "").strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        return GmailContextResult.model_validate_json(raw_text)
    except Exception as exc:
        logger.error("Error or limit reached in Gmail context agent: %s", exc)
        return GmailContextResult(
            needs_gmail=True,
            selected_thread_id=None,
            last_message_id=None,
            original_subject=None,
            context_text=None,
            clarification_question=(
                "I was unable to retrieve email context within the tool limit. "
                "Please provide the subject or recipient details."
            ),
            complete=False,
        )
