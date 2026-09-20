from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException

from app.agents.email_draft import generate_draft
from app.agents.intent_analyze import analyze_intent
from app.agents.reviewer import review_draft
from app.schemas import (
    EmailDraftRequest,
    EmailDraftResponse,
    IntentRequest,
    IntentResponse,
    ReviewRequest,
    ReviewResponse,
)

app = FastAPI(
    title="AI Email Assistant — AI Service",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/intent", response_model=IntentResponse)
async def get_intent(request: IntentRequest) -> IntentResponse:
    try:
        return await analyze_intent(request.prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error analyzing intent with Gemini: {exc}",
        ) from exc


@app.post("/draft", response_model=EmailDraftResponse)
async def create_draft(request: EmailDraftRequest) -> EmailDraftResponse:
    try:
        return await generate_draft(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error generating draft with Gemini: {exc}",
        ) from exc


@app.post("/review", response_model=ReviewResponse)
async def review_email_draft(request: ReviewRequest) -> ReviewResponse:
    try:
        return await review_draft(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error reviewing draft with Gemini: {exc}",
        ) from exc