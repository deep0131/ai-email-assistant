# Personal AI Email Assistant

A personal AI email assistant that understands natural-language email requests, retrieves relevant Gmail context, drafts professional emails with Gemini, independently reviews and revises them in a bounded loop, and safely creates drafts or sends emails via Gmail only after explicit human approval.

## Current Architecture

```text
Next.js Frontend / API Client
              |
              v
     POST /api/workflow
              |
              v
LangGraph Workflow Engine (MemorySaver checkpointer)
              |
              ├── 1. Intent Analysis Node (Gemini 2.5 Flash)
              │      └── Classifies NEW_EMAIL, REPLY, or DRAFT; extracts recipient & purpose
              │
              ├── 2. Clarification Node (LangGraph interrupt)
              │      └── Asks user if recipient or core email topic is missing
              │
              ├── 3. Attachment Confirmation Node (Gemini 2.5 Flash + interrupt)
              │      └── Classifies natural user response (ATTACH, SKIP, UNCLEAR)
              │      └── Python selects uploaded in-memory attachment IDs
              │
              ├── 4. Gmail Context Agent Node (Gemini 2.5 Flash AFC)
              │      ├── Read-only tools: search_gmail_for_gemini, get_email_thread_for_gemini
              │      ├── Automatic function calling with a 5 tool-call limit
              │      └── Returns structured GmailContextResult (RFC message ID, subject, context)
              │
              ├── 5. Draft Generator Node (Gemini 2.5 Flash)
              │      └── Composes subject, body, recipients, referencing uploaded files & thread context
              │
              ├── 6. Reviewer Agent Node (Gemini 2.5 Flash)
              │      ├── Evaluates accuracy, tone, completeness, and safety
              │      └── Bounded revision loop (max 3 revisions before failing gracefully)
              │
              ├── 7. Draft Creation Node (Gmail API)
              │      └── Creates Gmail draft with threading headers (threadId, In-Reply-To, References)
              │
              ├── 8. Human Approval Node (LangGraph interrupt)
              │      └── Pauses workflow and requires explicit user approval before sending
              │
              └── 9. Send Node (Gmail API)
                     └── Dispatches email only after user confirms approval
```

## Implemented Features

- **FastAPI Backend**: Complete REST API running with Uvicorn.
- **Unified Workflow Endpoint (`POST /api/workflow`)**:
  - Handles natural-language prompts.
  - Accepts multipart file uploads stored strictly in memory (`GmailAttachment`).
  - Supports thread persistence and interrupt resumption via `workflow_thread_id` and `resume_value`.
- **Gemini Agents**:
  - **Intent Analysis**: Classifies action, recipient, source requirement, and missing information.
  - **Attachment Confirmation**: Uses Gemini to understand natural confirmation responses (`ATTACH`, `SKIP`, `UNCLEAR`) while Python safely binds attachment IDs.
  - **Gmail Context Resolution**: Automatic function calling with read-only tools (`search_gmail_for_gemini`, `get_email_thread_for_gemini`) capped at 5 calls. Disambiguates multiple threads with clarification.
  - **Draft Generation**: Writes professional emails, preserves reply subjects, references in-memory attachment text.
  - **Independent Reviewer**: Evaluates draft quality and triggers revisions up to 3 times if quality standards are not met.
- **Gmail OAuth & API Integration**:
  - Standard OAuth2 authorization code flow with local token storage (`token.json`).
  - Read-only search and thread inspection.
  - Draft creation with proper reply threading headers (`In-Reply-To`, `References`, `threadId`).
  - Attachment handling using MIME multipart construction.
- **Safety by Design**:
  - **No Write Tools for Gemini**: Draft creation and sending are never exposed as tools to LLMs.
  - **Mandatory Human Approval**: Sending an email requires explicit approval via LangGraph `interrupt()`.
  - **Zero Disk Persistence for Attachments**: Uploaded file bytes exist only in RAM during the request lifecycle.
  - **Stateless & Database-Free**: State is tracked in-memory using LangGraph's `MemorySaver`.

## Project Structure

```text
ai-email-assistant/
├── ai-service/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── attachment_agent.py      # Natural language attachment decision agent
│   │   │   ├── email_draft.py           # Email draft generator agent
│   │   │   ├── gmail_context_agent.py   # Gmail read-only context retrieval agent
│   │   │   ├── intent_analyze.py        # Intent classification agent
│   │   │   └── reviewer.py              # Draft quality reviewer agent
│   │   ├── gmail/
│   │   │   ├── auth.py                  # OAuth2 flow & token management
│   │   │   └── client.py                # Gmail API wrapper (search, thread, draft, send)
│   │   ├── tools/
│   │   │   └── gmail_tools.py           # Read-only tools for Gemini & internal send helpers
│   │   ├── workflow/
│   │   │   ├── email_workflow.py        # LangGraph workflow definition & runner
│   │   │   └── state.py                 # TypedDict workflow state schema
│   │   ├── main.py                      # FastAPI application and routing
│   │   └── schemas.py                   # Pydantic models and request/response schemas
│   ├── .env                             # Environment configuration (API keys)
│   ├── credentials.json                 # Google OAuth client secret (not committed)
│   ├── requirements.txt                 # Python dependencies
│   └── token.json                       # Saved OAuth tokens (not committed)
├── frontend/                            # Next.js frontend client
└── README.md
```

## Requirements

- Python 3.11 or newer.
- Google Cloud Project with the Gmail API enabled.
- Configured Google OAuth 2.0 Web Application credentials (`credentials.json`).
- Gemini API Key (`GEMINI_API_KEY`).
- Node.js (for frontend development).

## Setup & Running the Service

### 1. Python Environment

Navigate to the `ai-service` directory:

```bash
cd ai-service
python -m venv .venv
```

Activate the virtual environment:

- **Windows (PowerShell)**:
  ```powershell
  .venv\Scripts\Activate.ps1
  ```
- **Linux/macOS**:
  ```bash
  source .venv/bin/activate
  ```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Create `ai-service/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Place your Google Cloud OAuth client credentials file at:

```text
ai-service/credentials.json
```

Ensure the OAuth redirect URI in your Google Cloud Console matches:

```text
http://localhost:8000/api/gmail/oauth/callback
```

### 3. Start the Backend

From the `ai-service` directory:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

The Swagger interactive documentation will be available at: `http://localhost:8000/docs`.

## API Endpoints

### Health & Status

- **`GET /health`**: Returns service health, version, and Gmail connection status.

### Gmail OAuth

- **`GET /api/gmail/oauth/start`**: Redirects the user to Google OAuth consent screen.
- **`GET /api/gmail/oauth/callback`**: Exchanges authorization code for credentials and saves `token.json`.
- **`GET /api/gmail/status`**: Returns `{"connected": true, "email": "..."}` or `{"connected": false}`.

### Unified Workflow

- **`POST /api/workflow`**: Initiates or resumes a workflow run.
  - **Form fields**:
    - `prompt` *(optional string)*: Natural language email request.
    - `reference_files` *(optional files)*: Files supplied to the draft and review agents as reference material; they are not sent with the email.
    - `email_attachments` *(optional files)*: Files attached to the outgoing email after user approval.
    - `workflow_thread_id` *(optional string)*: Thread identifier for multi-turn sessions.
    - `resume_value` *(optional string/json)*: Response to an `interrupt` (e.g. clarification, attachment choice, or approval).
  - **Response**:
    - `status`: `IN_PROGRESS`, `WAITING_FOR_USER`, `WAITING_FOR_APPROVAL`, `COMPLETED`, or `FAILED`.
    - `workflow_thread_id`: Session ID to pass back when resuming.
    - `draft`: The generated draft with subject, body, and recipients.
    - `review`: The reviewer decision, score, and summary.
    - `clarification_question`: Prompt presented to the user when waiting for input.
    - `email_attachment_filenames`: Names of files selected to be sent with the email.
    - `send_result`: Gmail Message ID and Thread ID if approved and sent.

## Security & Privacy Highlights

1. **Human in the Loop**: Emails are **never** sent automatically. The workflow halts at `human_approval` and waits for explicit user confirmation.
2. **Read-Only LLM Tools**: Gemini is only granted read access (`search_gmail_for_gemini`, `get_email_thread_for_gemini`). Writing drafts and sending messages are executed purely through deterministic LangGraph nodes.
3. **Separate In-Memory Uploads**: Reference files are available to the agents but are not emailed. Email attachments are held in memory and sent only after user approval. Uploads are not written to the server's disk.
4. **Prompt Injection Defense**: External emails, thread snippets, and uploaded files are treated strictly as untrusted data in all system prompts.
