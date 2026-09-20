from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse

from app.gmail.auth import (
    clear_oauth_state,
    create_auth_flow,
    create_auth_flow_with_verifier,
    retrieve_oauth_state,
    save_credentials,
    store_oauth_state,
)
from app.gmail.client import get_gmail_service


app = FastAPI(
    title="AI Email Assistant",
    version="0.3.0",
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
    """
    Step 1 — Start the Gmail OAuth flow.

    Builds the Google authorization URL, stores the PKCE code_verifier
    in server-side memory (keyed by the OAuth state), and redirects the
    browser to Google's consent screen.
    """
    try:
        flow = create_auth_flow()

        # Generate the authorization URL
        # access_type="offline" → requests a refresh token
        # prompt="consent"      → always show consent so Google issues
        #                         a refresh token even on re-auth
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            prompt="consent",
        )

        # Preserve the PKCE code_verifier so the callback can use it.
        # The Flow object created it internally during authorization_url().
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
    """
    Step 2 — Handle the OAuth callback from Google.

    Google redirects here with ?code=...&state=... query parameters on success,
    or ?error=...&state=... if authorization was denied or cancelled.
    We validate the state, recreate the Flow with the stored PKCE
    code_verifier, exchange the code for tokens, and save them.
    """
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
            detail="Missing required 'code' or 'state' parameter in OAuth callback.",
        )

    try:
        # Retrieve the code_verifier that was stored during /start
        code_verifier = retrieve_oauth_state(state)

        # Rebuild the Flow with the original verifier attached
        flow = create_auth_flow_with_verifier(code_verifier)

        # Exchange the authorization code for OAuth tokens
        flow.fetch_token(code=code)

        # Save the credentials (access token + refresh token) to disk
        creds = flow.credentials
        save_credentials(creds)

        return {
            "status": "success",
            "message": "Gmail account connected successfully. You can close this tab.",
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
    """
    Check Gmail OAuth connection status.

    Loads the saved token, refreshes it if expired, calls the Gmail API
    to fetch the authenticated user's profile, and returns the email address.
    """
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId="me").execute()
        return {
            "status": "connected",
            "email": profile.get("emailAddress"),
        }
    except ValueError as exc:
        # No credentials saved yet or credentials invalid
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gmail connection failed: {exc}",
        ) from exc
