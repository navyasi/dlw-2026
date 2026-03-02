"""
Audio router: generate TTS lecture audio from a notebook's PDF.
Caches generated audio to disk to avoid re-calling OpenAI TTS.
"""
from __future__ import annotations

import hashlib
import logging
import os
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/audio", tags=["audio"])

SAMPLE_DIR = Path(__file__).parent.parent.parent / "sample_data"
CACHE_DIR = Path(__file__).parent.parent.parent / ".audio_cache"
CACHE_DIR.mkdir(exist_ok=True)

logger = logging.getLogger(__name__)


def _get_openai_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def _cache_key(notebook_id: int, text_hash: str) -> str:
    """Deterministic cache key from notebook ID + content hash."""
    return f"lecture_{notebook_id}_{text_hash}"


def _text_hash(text: str) -> str:
    """SHA-256 of the normalized text content."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()[:16]


@router.post("/{notebook_id}/generate")
async def generate_audio(notebook_id: int):
    """
    Generate an MP3 audio lecture from the notebook's source PDF.
    Returns cached audio if available; only calls TTS if not cached.
    """
    from sqlalchemy import select
    from backend.database import AsyncSessionLocal, Notebook
    from backend.pdf_utils import extract_full_text
    from lecture import generate_audio_lecture_mp3

    # Look up notebook to get source_ref
    async with AsyncSessionLocal() as db:
        nb = await db.get(Notebook, notebook_id)
        if not nb:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not nb.source_ref:
            raise HTTPException(status_code=400, detail="No source file for this notebook")

    # Resolve PDF path
    pdf_path = SAMPLE_DIR / nb.source_ref
    if not pdf_path.exists():
        pdf_path = SAMPLE_DIR / Path(nb.source_ref).name
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF not found: {nb.source_ref}")

    # Extract text
    text = extract_full_text(str(pdf_path))
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from PDF")

    # Check disk cache
    content_hash = _text_hash(text)
    cache_file = CACHE_DIR / f"{_cache_key(notebook_id, content_hash)}.mp3"

    if cache_file.exists() and cache_file.stat().st_size > 0:
        logger.info("Audio cache HIT for notebook %d (key=%s)", notebook_id, cache_file.name)
        return StreamingResponse(
            open(cache_file, "rb"),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename=lecture_{notebook_id}.mp3",
                "X-Audio-Cached": "true",
            },
        )

    # Cache MISS — generate via OpenAI TTS
    logger.info("Audio cache MISS for notebook %d — generating TTS", notebook_id)
    client = _get_openai_client()
    mp3_bytes = generate_audio_lecture_mp3(client, text)

    # Save to disk cache
    cache_file.write_bytes(mp3_bytes)
    logger.info("Audio cached to disk: %s (%d bytes)", cache_file.name, len(mp3_bytes))

    return StreamingResponse(
        BytesIO(mp3_bytes),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f"attachment; filename=lecture_{notebook_id}.mp3",
            "X-Audio-Cached": "false",
        },
    )


@router.delete("/{notebook_id}/cache")
async def clear_audio_cache(notebook_id: int):
    """Explicitly clear cached audio for a notebook (for Regenerate button)."""
    cleared = 0
    for f in CACHE_DIR.glob(f"lecture_{notebook_id}_*.mp3"):
        f.unlink()
        cleared += 1
    return {"cleared": cleared}
