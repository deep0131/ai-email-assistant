# AI Email Assistant

A local, single-user email assistant. The Next.js interface sends a request to a FastAPI service, which uses Gemini and LangGraph to clarify, draft, review, and—only after the user explicitly chooses **Send**—send a new email through Gmail.

## What it currently does

- Supports composing **new emails**. Replying to existing threads and searching Gmail context are not currently part of the workflow.
- Checks whether the recipient and the facts needed for the requested message are present. If details are missing, it asks a clarification question and waits for a text answer before drafting.
- Generates a draft with Gemini, reviews it, and may automatically revise it up to two times.
- Pauses for a human decision: **Send**, **Reject**, or **Improve**. Improve requires feedback and runs the draft through review again.
- Uses reference files as information for composing and reviewing. These are not sent to the recipient.
- Keeps email attachments separate and sends those files only if the user approves the email.
- Requires a connected Gmail account before the user can start a workflow.

## Project layout

```text
ai-email-assistant/
├── ai-service/                  # FastAPI, Gemini agents, LangGraph, Gmail OAuth/API
│   ├── app/
│   ├── requirements.txt
│   ├── credentials.json         # Create locally; do not commit
│   ├── token.json               # Created by OAuth; do not commit
│   └── .env                     # Create locally; do not commit
├── frontend/                    # Next.js chat interface
│   ├── src/app/
│   ├── src/components/
│   └── .env.local               # Optional local frontend configuration
└── README.md
```

## Requirements

- Python 3.11 or later
- Node.js and npm
- A Gemini API key
- A Google Cloud OAuth client configured for the Gmail API

## Configure Gmail and Gemini

1. Enable the Gmail API in a Google Cloud project and create an OAuth client of type **Web application**.
2. Add this exact authorized redirect URI to that OAuth client:

   ```text
   http://localhost:8000/api/gmail/oauth/callback
   ```

3. Save the downloaded OAuth client JSON as `ai-service/credentials.json`.
4. Create `ai-service/.env`:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   FRONTEND_URL=http://localhost:3000
   ```

   `FRONTEND_URL` is optional for local development; the backend defaults to `http://localhost:3000`.

The first time the app starts, select **Connect Gmail** in the frontend and complete Google's consent flow. The backend saves the resulting OAuth token to `ai-service/token.json` for later local use. Keep both credential files private and never commit them.

## Run locally

Start the backend in one terminal:

```powershell
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate the environment with `source .venv/bin/activate` instead.

Start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend defaults to the backend at `http://localhost:8000`. To override it, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The backend API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs), and its health check is [http://localhost:8000/health](http://localhost:8000/health).

## Use the assistant

1. Connect Gmail using the button in the app header.
2. Enter a **non-empty text prompt** describing the email, its recipient, and its purpose. For example:

   ```text
   Write to alex@example.com thanking them for today's demo and confirming our meeting on Thursday.
   ```

3. Optionally add reference files and/or email attachments.
4. Answer any clarification question in the prompt box. File selection is disabled while the workflow is waiting for this answer.
5. Review the generated email. Choose **Send**, **Reject**, or **Improve** and provide feedback when improving.

### Important: a prompt is required

Files alone are not a complete workflow request. The current prompt composer can still enable submission when files are selected without text, but the backend intent agent requires prompt text and will return an error (for example, `contents are required`). Include a text request with every new workflow, even when uploading files.

## File uploads

The backend accepts up to five files total, with a 10 MB per-file limit and 20 MB combined limit. Supported extensions are PDF, TXT, MD, CSV, PNG, JPG, and JPEG. Text files must be UTF-8; PDF and image uploads are checked for valid file signatures.

- **Reference files** are supplied to the draft and review agents as untrusted reference material. They help ground the email but are not attached to it.
- **Email attachments** are kept separately and added to the outgoing email only after explicit approval.
- Uploaded bytes are held in memory for workflow processing and are not saved as uploaded files to disk. LangGraph's `MemorySaver` stores workflow state in process memory; active workflows do not survive a backend restart.

## API overview

### `POST /api/workflow`

Accepts `multipart/form-data` and starts or resumes a workflow.

| Field | Meaning |
| --- | --- |
| `prompt` | Text for starting a new workflow. Required in practice; include it even with uploads. |
| `reference_files` | Optional reference files for drafting/review. |
| `email_attachments` | Optional files to include in the email if it is approved. |
| `workflow_thread_id` | Workflow ID returned by the backend; send it when resuming an interrupt. |
| `resume_value` | JSON-encoded response to the current interrupt. |

Examples of `resume_value`:

```json
{"answer":"The injury happened yesterday and I need to work from home this week."}
```

```json
{"decision":"SEND"}
```

```json
{"decision":"REJECT"}
```

```json
{"decision":"IMPROVE","feedback":"Make the tone warmer and shorten the second paragraph."}
```

Responses include a `status` and `workflow_thread_id`, with relevant fields such as `clarification_question`, `draft`, `review`, `email_attachment_filenames`, `send_result`, and `error`. Common statuses are `IN_PROGRESS`, `WAITING_FOR_USER`, `WAITING_FOR_APPROVAL`, `APPROVED`, `SENT`, `REJECTED`, and `FAILED`.

### Gmail endpoints

- `GET /api/gmail/oauth/start` — begin Gmail authorization.
- `GET /api/gmail/oauth/callback` — OAuth callback handled by Google and the backend.
- `GET /api/gmail/status` — check the Gmail connection.
- `GET /health` — check backend health.

## Checks

Run frontend checks from `frontend/`:

```bash
npm run lint
npm run build
```

## Security and limitations

- Gemini is used only for intent analysis, drafting, and review; sending is a backend workflow action gated by an explicit user approval.
- Uploaded file contents and generated/user-provided email content are untrusted input; the agents are instructed not to follow instructions embedded in reference files.
- Gmail OAuth uses the `gmail.modify` scope so the app can send mail. OAuth tokens are stored locally in `ai-service/token.json`.
- This is a local, single-user development app: Gmail OAuth state and LangGraph workflow checkpoints are held in process memory, and there is no database or multi-user session isolation.
- The progress labels in the UI are timed frontend hints, not live events streamed from individual backend workflow nodes.
