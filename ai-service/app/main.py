from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException

from app.intent_analyze import analyze_intent
from app.schemas import IntentRequest, IntentResponse

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