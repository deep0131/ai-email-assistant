from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, UploadFile


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
