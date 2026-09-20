

from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow


# Read/write access to Gmail messages, labels, drafts, and sending
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# The redirect URI must match exactly what is registered in the
# Google Cloud Console under "Authorized redirect URIs".
REDIRECT_URI = "http://localhost:8000/api/gmail/oauth/callback"

# Resolve paths relative to the ai-service root (two levels up from this file)
_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent
CREDENTIALS_FILE = _SERVICE_ROOT / "credentials.json"
TOKEN_FILE = _SERVICE_ROOT / "token.json"


# ---------------------------------------------------------------------------
# Temporary server-side storage for the OAuth PKCE flow.
#
# When /api/gmail/oauth/start generates an authorization URL, the Flow
# object creates a PKCE code_verifier internally.  We must preserve that
# verifier so the callback route can attach it to a *new* Flow before
# calling fetch_token().  For a single-user local app a simple dict is
# sufficient — no database or session store required.
# ---------------------------------------------------------------------------

_pending_oauth: dict[str, str] = {}


def create_auth_flow() -> Flow:
    """
    Build a google_auth_oauthlib Flow configured for the web-app client.

    The Flow object knows how to:
      - generate the Google authorization URL (flow.authorization_url())
      - exchange an authorization code for tokens  (flow.fetch_token())
    """
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"credentials.json not found at {CREDENTIALS_FILE}. "
            "Download it from the Google Cloud Console."
        )

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    return flow


def store_oauth_state(state: str, code_verifier: str) -> None:
    """
    Save the PKCE code_verifier, keyed by the OAuth state parameter.

    Called by /api/gmail/oauth/start right after generating the auth URL.
    """
    _pending_oauth[state] = code_verifier


def retrieve_oauth_state(state: str) -> str:
    """
    Pop and return the code_verifier for the given OAuth state.

    Called by /api/gmail/oauth/callback to attach the verifier to the
    new Flow before exchanging the authorization code.

    Raises ValueError if the state is unknown (expired or replayed).
    """
    code_verifier = _pending_oauth.pop(state, None)
    if code_verifier is None:
        raise ValueError(
            "Unknown or expired OAuth state. "
            "Please restart the flow at /api/gmail/oauth/start."
        )
    return code_verifier


def clear_oauth_state(state: str) -> None:
  
    _pending_oauth.pop(state, None)


def create_auth_flow_with_verifier(code_verifier: str) -> Flow:
    """
    Build a Flow and attach an existing PKCE code_verifier.

    Used in the callback route so that fetch_token() sends the correct
    verifier that matches the one Google received during authorization.
    """
    flow = create_auth_flow()
    flow.code_verifier = code_verifier
    return flow


def save_credentials(creds: Credentials) -> None:
    """Persist OAuth tokens to token.json for reuse across restarts."""
    TOKEN_FILE.touch(mode=0o600, exist_ok=True)
    TOKEN_FILE.chmod(0o600)
    TOKEN_FILE.write_text(creds.to_json())


def load_credentials() -> Credentials | None:
    """
    Load previously-saved OAuth credentials from token.json.

    Returns None if the file does not exist.
    """
    if not TOKEN_FILE.exists():
        return None
    return Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)


def get_valid_credentials() -> Credentials:
    
    creds = load_credentials()

    if creds is None:
        raise ValueError(
            "No Gmail credentials found. "
            "Visit /api/gmail/oauth/start to connect your Gmail account."
        )

    # Silently refresh expired credentials
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_credentials(creds)

    if not creds.valid:
        raise ValueError(
            "Gmail credentials are invalid. "
            "Visit /api/gmail/oauth/start to reconnect."
        )

    return creds
