import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

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
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def gmail_oauth_redirect(status: str, message: str | None = None) -> RedirectResponse:
    """Return the browser to the frontend after Gmail OAuth completes."""
    query = {"gmail": status}
    if message:
        query["message"] = message
    return RedirectResponse(
        url=f"{FRONTEND_URL}/?{urlencode(query)}",
        status_code=303,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_FILES = 5
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024

ALLOWED_UPLOAD_TYPES = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/plain",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


async def read_validated_upload(
    file: UploadFile,
    total_bytes_so_far: int,
) -> tuple[str, str, bytes]:
    """Read one supported upload while enforcing per-file and request limits."""
    filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    extension = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""

    if not filename or extension not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Use PDF, TXT, MD, CSV, PNG, or JPG.",
        )

    remaining_total = MAX_TOTAL_UPLOAD_BYTES - total_bytes_so_far
    read_limit = min(MAX_FILE_SIZE_BYTES, remaining_total)
    data = await file.read(read_limit + 1)

    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{filename} exceeds the 10 MB per-file limit.",
        )

    if len(data) > remaining_total:
        raise HTTPException(
            status_code=413,
            detail="The combined upload size exceeds the 20 MB limit.",
        )

    if not data:
        raise HTTPException(status_code=400, detail=f"{filename} is empty.")

    if extension == ".pdf" and not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail=f"{filename} is not a valid PDF.")
    if extension == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=415, detail=f"{filename} is not a valid PNG.")
    if extension in {".jpg", ".jpeg"} and not data.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=415, detail=f"{filename} is not a valid JPEG.")

    if extension in {".txt", ".md", ".csv"}:
        try:
            data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=415,
                detail=f"{filename} must be UTF-8 text.",
            ) from exc

    return filename, ALLOWED_UPLOAD_TYPES[extension], data


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

        return gmail_oauth_redirect(
            "error",
            "Gmail authorization was cancelled or denied. Please try again.",
        )

    if not code or not state:
        return gmail_oauth_redirect(
            "error",
            "Gmail authorization did not complete. Please try again.",
        )

    try:
        code_verifier = retrieve_oauth_state(state)
        flow = create_auth_flow_with_verifier(code_verifier)

        flow.fetch_token(code=code)
        save_credentials(flow.credentials)

        return gmail_oauth_redirect("connected", "Gmail connected successfully.")

    except ValueError:
        return gmail_oauth_redirect(
            "error",
            "Gmail authorization expired. Please start the connection again.",
        )

    except Exception:
        return gmail_oauth_redirect(
            "error",
            "Gmail could not be connected. Please try again.",
        )


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
    reference_files: list[UploadFile] | None = File(default=None),
    email_attachments: list[UploadFile] | None = File(default=None),
):
    """Start or resume the email workflow."""

    if not workflow_thread_id:
        workflow_thread_id = str(uuid.uuid4())

    reference_uploads = reference_files or []
    email_uploads = email_attachments or []
    if len(reference_uploads) + len(email_uploads) > MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=413,
            detail=f"You can upload at most {MAX_UPLOAD_FILES} files total.",
        )

    total_upload_bytes = 0

    async def read_upload_group(uploads: list[UploadFile]) -> list[GmailAttachment]:
        nonlocal total_upload_bytes
        result: list[GmailAttachment] = []

        for upload in uploads:
            filename, content_type, data = await read_validated_upload(
                upload,
                total_upload_bytes,
            )
            total_upload_bytes += len(data)
            result.append(
                GmailAttachment(
                    attachment_id=str(uuid.uuid4()),
                    filename=filename,
                    content_type=content_type,
                    data=data,
                )
            )

        return result

    reference_attachments = await read_upload_group(reference_uploads)
    gmail_attachments = await read_upload_group(email_uploads)

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
            reference_attachments=reference_attachments or None,
            email_attachments=gmail_attachments or None,
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
