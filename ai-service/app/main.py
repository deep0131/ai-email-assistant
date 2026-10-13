import json
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.gmail.auth import (
    clear_oauth_state,
    create_auth_flow,
    create_auth_flow_with_verifier,
    retrieve_oauth_state,
    save_credentials,
    store_oauth_state,
)
from app.gmail.client import GmailAttachment, get_gmail_service
from app.workflow.email_workflow import run_email_workflow


app = FastAPI(title="AI Email Assistant", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/gmail/oauth/start")
def gmail_oauth_start():
    """Start the Gmail OAuth flow."""
    try:
        flow = create_auth_flow()

        authorization_url, state = flow.authorization_url(
            access_type="offline",
            prompt="consent",
        )

        store_oauth_state(state, flow.code_verifier)

        return RedirectResponse(url=authorization_url)

    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start OAuth flow: {exc}",
        ) from exc


@app.get("/api/gmail/oauth/callback")
def gmail_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """Handle the Gmail OAuth callback."""

    if error:
        if state:
            clear_oauth_state(state)

        return {
            "status": "error",
            "message": f"OAuth authorization was denied or cancelled: {error}",
        }

    if not code or not state:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'code' or 'state' parameter.",
        )

    try:
        code_verifier = retrieve_oauth_state(state)
        flow = create_auth_flow_with_verifier(code_verifier)

        flow.fetch_token(code=code)
        save_credentials(flow.credentials)

        return {
            "status": "success",
            "message": "Gmail account connected successfully.",
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"OAuth callback failed: {exc}",
        ) from exc


@app.get("/api/gmail/status")
def gmail_status():
    """Check whether Gmail is connected."""

    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId="me").execute()

        return {
            "status": "connected",
            "email": profile.get("emailAddress"),
        }

    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gmail connection failed: {exc}",
        ) from exc


@app.post("/api/workflow")
async def workflow_endpoint(
    prompt: str = Form(default=""),
    workflow_thread_id: str = Form(default=""),
    resume_value: str = Form(default=""),
    files: list[UploadFile] | None = File(default=None),
):
    """Start or resume the email workflow."""

    if not workflow_thread_id:
        workflow_thread_id = str(uuid.uuid4())

    attachments: list[GmailAttachment] = []

    for file in files or []:
        file_bytes = await file.read()

        attachments.append(
            GmailAttachment(
                attachment_id=str(uuid.uuid4()),
                filename=file.filename or "unnamed",
                content_type=file.content_type or "application/octet-stream",
                data=file_bytes,
            )
        )

    parsed_resume = None

    if resume_value:
        try:
            parsed_resume = json.loads(resume_value)
        except json.JSONDecodeError:
            parsed_resume = resume_value

    try:
        result = await run_email_workflow(
            user_prompt=prompt,
            workflow_thread_id=workflow_thread_id,
            attachments=attachments or None,
            resume_value=parsed_resume,
        )

        result["workflow_thread_id"] = workflow_thread_id
        return result

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Workflow error: {exc}",
        ) from exc