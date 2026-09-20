"""
AI Email Assistant — AI Service

Minimal FastAPI application.  Only a health endpoint for now;
LangGraph workflows will be added in later features.
"""

from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(
    title="AI Email Assistant — AI Service",
    version="0.1.0",
)


@app.get("/health")
def health():
    """Return a simple health-check response."""
    return {
        "status": "ok",
        "service": "ai-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
