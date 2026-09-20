# Personal AI Email Assistant

A personal AI email assistant that understands natural-language email requests, generates drafts with Gemini, reviews those drafts independently, and will eventually use Gmail tools to search, draft, and send emails after explicit user approval.

The project is being built gradually with a feature-driven GitHub workflow.

## Current architecture

```text
Next.js frontend
        |
        v
Python FastAPI service
        |
        ├── Gemini intent analyzer
        ├── Gemini email draft generator
        ├── Gemini reviewer agent
        └── Gmail OAuth and Gmail API client
```

The current implementation does not yet include the final LangGraph workflow or Gmail tools.

## Current features

- Python FastAPI AI service.
- Gemini-powered intent analysis.
- Gemini-powered email draft generation.
- Gemini-powered draft review.
- Web-based Gmail OAuth connection.
- Gmail client for searching threads and reading thread messages.
- Temporary attachment metadata models.
- Manual verification through the browser, Python shell, and FastAPI Swagger UI.

## Planned features

- Gmail tools such as `search_gmail` and `get_email_thread`.
- Gmail draft creation.
- Approval-protected Gmail sending.
- LangGraph workflow orchestration.
- Direct prompt and attachment submission from the Next.js frontend.
- Automatic draft-review-revision loop.

## Project structure

```text
ai-email-assistant/
├── ai-service/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── intent_analyze.py
│   │   │   ├── email_draft.py
│   │   │   └── reviewer.py
│   │   ├── gmail/
│   │   │   ├── auth.py
│   │   │   └── client.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── .env
│   ├── credentials.json
│   ├── requirements.txt
│   └── token.json
├── frontend/
├── docs/
└── README.md
```

## Requirements

- Python 3.11 or newer.
- A Google Cloud project.
- Gmail API enabled in that project.
- A configured Google OAuth web application client.
- A Gemini API key.
- Node.js is required later for the Next.js frontend.

## Python setup

Open a terminal in the `ai-service` directory:

```bash
cd ai-service
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

## Environment configuration

Create `ai-service/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Place the downloaded Google OAuth client file here:

```text
ai-service/credentials.json
```

The application creates this file after the first successful OAuth connection:

```text
ai-service/token.json
```

Never commit `.env`, `credentials.json`, or `token.json`.

## Start the FastAPI service

Run the command from the `ai-service` directory:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

If running from the repository root instead:

```bash
python -m uvicorn app.main:app --reload --port 8000 --app-dir ai-service
```

## Current endpoints

### Health check

```text
GET http://localhost:8000/health
```

### Gmail OAuth

Start authorization:

```text
GET http://localhost:8000/api/gmail/oauth/start
```

OAuth callback:

```text
GET http://localhost:8000/api/gmail/oauth/callback
```

Check connection:

```text
GET http://localhost:8000/api/gmail/status
```

The registered Google OAuth redirect URI must exactly match:

```text
http://localhost:8000/api/gmail/oauth/callback
```

## Manual Gmail client verification

From the `ai-service` directory, start Python:

```bash
python
```

Then run:

```python
from app.gmail.client import GmailClient

client = GmailClient()

result = client.search_threads("in:inbox", 5)
print(result)

thread_id = result["threads"][0]["thread_id"]
thread = client.get_thread(thread_id)
print(thread)
```

The client currently supports:

- searching Gmail threads;
- reading messages inside a Gmail thread;
- extracting sender, recipient, subject, date, and plain-text body.

## Security notes

- Gmail access uses OAuth; the application never receives the Gmail password.
- OAuth tokens stay on the backend.
- `credentials.json` and `token.json` must remain private.
- The application must never send an email without explicit user approval.
- Email bodies, Gmail threads, resumes, and attachments are untrusted data.
- The model must not follow instructions found inside emails or attachments.

## Feature-driven development workflow

The project uses short-lived feature branches merged into `develop`.

```text
main
  └── develop
        ├── feature/google-oauth
        ├── feature/gmail-client
        ├── feature/gmail-tools
        ├── feature/gmail-write-client
        ├── feature/langgraph-workflow
        └── feature/frontend-integration
```

Recommended workflow:

```bash
git switch develop
git pull
git switch -c feature/your-feature
```

After manually verifying the feature:

```bash
git add .
git commit -m "feat(scope): describe the completed feature"
git push -u origin feature/your-feature
```

Open a pull request from the feature branch into `develop`. Do not push directly to `main` or `develop`.

## Development roadmap

1. Complete Gemini intent, draft, and reviewer agents.
2. Complete Gmail OAuth.
3. Complete the Gmail client for search and thread reading.
4. Add Gmail tools around the client.
5. Add Gmail draft creation.
6. Add approval-protected Gmail sending.
7. Build the LangGraph workflow and bounded revision loop.
8. Connect the Next.js frontend.

The final user-facing flow will be:

```text
Prompt + optional attachments
        ↓
LangGraph workflow
        ↓
Intent analysis
        ↓
Gmail tools when needed
        ↓
Draft generation
        ↓
Review and revision loop
        ↓
User approval
        ↓
Gmail draft/send operation
```

