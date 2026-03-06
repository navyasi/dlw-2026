"""
FastAPI application entry point.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env file using stdlib only (no python-dotenv dependency needed).
# Must happen before any module that reads os.environ at import time.
# ---------------------------------------------------------------------------
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _val = _line.partition("=")
            os.environ.setdefault(_key.strip(), _val.strip())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.database import create_tables
from backend.routers import concepts, notebook, tutorial
from backend.routers import course as course_router
from backend.routers import chat as chat_router
from backend.routers import audio as audio_router
from backend.routers import quiz as quiz_router
from backend.routers import recall as recall_router
from backend.routers import integration as integration_router

logging.basicConfig(level=logging.INFO)

SAMPLE_DIR = Path(__file__).parent.parent / "sample_data"
_seed_done = False
_seed_error: str | None = None


async def _background_seed():
    global _seed_done, _seed_error
    try:
        from backend.seed import run_seed
        await run_seed()
        _seed_done = True
        logging.getLogger(__name__).info("✅ Background seed complete.")
    except Exception as exc:
        _seed_error = str(exc)
        logging.getLogger(__name__).error(f"❌ Seed failed: {exc}")
        _seed_done = True   # mark done so /ready doesn't hang


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create DB tables synchronously (fast — no LLM calls)
    await create_tables()
    # 2. Kick off seed pipeline in background so uvicorn starts immediately
    import asyncio
    asyncio.create_task(_background_seed())
    yield


app = FastAPI(title="Study Mode API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notebook.router)
app.include_router(concepts.router)
app.include_router(tutorial.router)
app.include_router(course_router.router)
app.include_router(chat_router.router)
app.include_router(audio_router.router)
app.include_router(quiz_router.router)
app.include_router(recall_router.router)
app.include_router(integration_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    """Returns whether the seed pipeline has finished. Poll this on first boot."""
    return {"ready": _seed_done, "error": _seed_error}


@app.get("/pdf/{filename}")
async def serve_pdf(filename: str):
    """Serve a PDF from sample_data/ so the frontend iframe can display it."""
    path = SAMPLE_DIR / filename
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(str(path), media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename={filename}",
    })
