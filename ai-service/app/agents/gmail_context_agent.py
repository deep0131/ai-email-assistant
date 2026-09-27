import json
import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.schemas import GmailContextResult, IntentResponse
from app.tools.gmail_tools import get_email_thread as _raw_get_email_thread
from app.tools.gmail_tools import search_gmail as _raw_search_gmail

logger = logging.getLogger(__name__)

SERVICE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(SERVICE_ROOT / ".env")

gemini_api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=gemini_api_key)

MAX_TOOL_CALLS = 5

SYSTEM_INSTRUCTION = """
You are an expert AI Gmail context agent for a personal AI Email Assistant.

Your task is to determine whether Gmail must be searched, use the provided read-only Gmail tools to find relevant email history, and return a final structured decision.

Available Tools:
- search_gmail(query: str, max_results: int = 10): Search Gmail threads matching a query using Gmail search syntax (e.g. from:user@example.com newer_than:30d).
- get_email_thread(thread_id: str): Fetch the complete message history of a specific Gmail thread.

Rules:
1. New Emails:
   - If the user wants to compose a brand new email and no past email context is needed, do NOT call any tools.
   - Return immediately:
     {
       "needs_gmail": false,
       "selected_thread_id": null,
       "last_message_id": null,
       "original_subject": null,
       "context_text": null,
       "clarification_question": null,
       "complete": true
     }

2. Replies & Past Context:
   - If the user wants to reply to an email or references past correspondence:
     * Call search_gmail with a targeted query (e.g. from:user@example.com newer_than:30d or "Sender Name" newer_than:30d).
     * If exactly one matching thread is found (or one thread is clearly the best match):
       Call get_email_thread(thread_id=...) to inspect the full conversation.
       Once the thread is loaded, compile the messages into context_text (include From, To, Subject, Date, and Body).
       From the LAST message in the thread, extract:
         - last_message_id: the rfc_message_id field (the RFC-2822 Message-ID header)
         - original_subject: the subject field
       Return:
       {
         "needs_gmail": true,
         "selected_thread_id": "<thread_id>",
         "last_message_id": "<rfc_message_id of last message>",
         "original_subject": "<subject of the thread>",
         "context_text": "<formatted messages>",
         "clarification_question": null,
         "complete": true
       }
     * If multiple threads match and it is ambiguous which conversation the user refers to:
       Do NOT arbitrarily choose a thread.
       Return a clarification question listing candidate threads (thread ID, sender, subject, date/snippet) so the user can choose:
       {
         "needs_gmail": true,
         "selected_thread_id": null,
         "last_message_id": null,
         "original_subject": null,
         "context_text": null,
         "clarification_question": "Which conversation should I reply to?\\n1. ...\\n2. ...",
         "complete": false
       }
     * If no threads match:
       Return:
       {
         "needs_gmail": true,
         "selected_thread_id": null,
         "last_message_id": null,
         "original_subject": null,
         "context_text": null,
         "clarification_question": "I could not find that conversation. Please provide the email address or subject.",
         "complete": false
       }

3. Output Format:
   - When calling tools, issue standard function calls.
   - When finished (or if no tools are needed), return ONLY a valid JSON object matching the schema:
     {
       "needs_gmail": boolean,
       "selected_thread_id": string or null,
       "last_message_id": string or null,
       "original_subject": string or null,
       "context_text": string or null,
       "clarification_question": string or null,
       "complete": boolean
     }
   - Never output markdown conversational text outside the JSON.
"""


def search_gmail(query: str, max_results: int = 10) -> dict[str, Any]:
    """Search Gmail threads matching the given query.

    Args:
        query: Gmail search query string (e.g. from:user@example.com newer_than:30d).
        max_results: Maximum number of threads to return (default 10).
    """
    return _raw_search_gmail.invoke({"query": query, "max_results": max_results})


def get_email_thread(thread_id: str) -> dict[str, Any]:
    """Fetch the full content of a Gmail thread by its thread ID.

    Args:
        thread_id: The Gmail thread ID to retrieve.
    """
    return _raw_get_email_thread.invoke({"thread_id": thread_id})


ALLOWED_TOOLS = {
    "search_gmail": search_gmail,
    "get_email_thread": get_email_thread,
}


def _clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


async def resolve_gmail_context(
    user_prompt: str,
    intent: IntentResponse,
    context_text: str | None = None,
    available_search_results: list[dict] | None = None,
) -> GmailContextResult:
    """Run the Gmail context agent with an LLM tool-calling loop."""
    prompt_content = f"""
ORIGINAL PROMPT:
{user_prompt}

STRUCTURED INTENT:
{intent.model_dump_json(indent=2)}

CURRENT GMAIL CONTEXT:
{context_text or "None"}

AVAILABLE GMAIL SEARCH RESULTS:
{json.dumps(available_search_results) if available_search_results else "None"}
"""

    contents: list[types.Content] = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt_content)],
        )
    ]

    tool_config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0,
        tools=[search_gmail, get_email_thread],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    tool_calls_count = 0

    while True:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=tool_config,
        )

        function_calls = response.function_calls

        if not function_calls:
            # Model produced final text
            raw_text = response.text or ""
            clean_text = _clean_json_text(raw_text)

            try:
                return GmailContextResult.model_validate_json(clean_text)
            except Exception:
                # Fallback: enforce JSON schema formatting without tools
                format_prompt = (
                    f"Convert this response into the requested JSON schema:\n\n{raw_text}"
                )
                structured_response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=format_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=(
                            "Extract the Gmail context decision into the requested JSON schema. "
                            "Output only valid JSON."
                        ),
                        temperature=0,
                        response_mime_type="application/json",
                        response_schema=GmailContextResult,
                    ),
                )
                return GmailContextResult.model_validate_json(structured_response.text)

        # Check maximum tool-call limit
        if tool_calls_count >= MAX_TOOL_CALLS:
            logger.warning(
                "Maximum tool-call limit of %d reached. Terminating tool loop.",
                MAX_TOOL_CALLS,
            )
            return GmailContextResult(
                needs_gmail=True,
                selected_thread_id=None,
                last_message_id=None,
                original_subject=None,
                context_text=None,
                clarification_question=(
                    "I searched Gmail but reached the search limit without finding the exact conversation. "
                    "Please provide the specific email address or subject line."
                ),
                complete=False,
            )

        # Append model's response turn containing the function call(s)
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_response_parts: list[types.Part] = []

        for call in function_calls:
            if tool_calls_count >= MAX_TOOL_CALLS:
                logger.warning(
                    "Maximum tool-call limit of %d reached during batch. Skipping remaining calls.",
                    MAX_TOOL_CALLS,
                )
                break

            tool_calls_count += 1

            # Safe logging: tool name, arguments, call count (no tokens, keys, email contents, or file bytes)
            safe_args = {k: v for k, v in (call.args or {}).items() if k in {"query", "max_results", "thread_id"}}
            logger.info(
                "Gemini requested tool: %s | Call %d/%d | Arguments: %s",
                call.name,
                tool_calls_count,
                MAX_TOOL_CALLS,
                safe_args,
            )

            if call.name not in ALLOWED_TOOLS:
                logger.error("Unauthorized tool call requested: %s", call.name)
                tool_result = {"error": f"Tool '{call.name}' is not allowed."}
            else:
                try:
                    tool_fn = ALLOWED_TOOLS[call.name]
                    tool_result = tool_fn(**(call.args or {}))
                except Exception as exc:
                    logger.exception("Error executing tool %s: %s", call.name, exc)
                    tool_result = {"error": f"Failed to execute {call.name}: {str(exc)}"}

            tool_response_parts.append(
                types.Part.from_function_response(
                    name=call.name,
                    response={"result": tool_result},
                )
            )

        contents.append(types.Content(role="tool", parts=tool_response_parts))
