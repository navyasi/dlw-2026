"""
Quiz router: generate kinesthetic quiz from a notebook and grade submissions.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

router = APIRouter(prefix="/quiz", tags=["quiz"])

SAMPLE_DIR = Path(__file__).parent.parent.parent / "sample_data"


def _get_openai_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


class GradeRequest(BaseModel):
    plan: dict[str, Any]
    completed_activity_ids: list[str]
    quiz_answers: dict[str, str]


@router.post("/{notebook_id}/generate")
async def generate_quiz(notebook_id: int):
    """
    Generate a kinesthetic learning plan (activities + quiz) from a notebook's content.
    Or return existing if already generated.
    """
    from sqlalchemy import select
    from backend.database import AsyncSessionLocal, Notebook, KinestheticPlan
    from backend.pdf_utils import extract_full_text
    from kinesthetics import generate_kinesthetic_plan
    import json

    async with AsyncSessionLocal() as db:
        nb = await db.get(Notebook, notebook_id)
        if not nb:
            raise HTTPException(status_code=404, detail="Notebook not found")

        # Check if plan already exists
        existing = await db.execute(select(KinestheticPlan).where(KinestheticPlan.notebook_id == notebook_id))
        plan_record = existing.scalar_one_or_none()
        if plan_record:
            return json.loads(plan_record.plan_json)

    # Get text from source
    text = ""
    if nb.source_type == "article" and nb.source_ref:
        # For articles, try scraping the URL
        try:
            from backend.scraper import scrape_article
            text = scrape_article(nb.source_ref)
        except Exception:
            pass
    elif nb.source_ref:
        # For slides/PDFs
        pdf_path = SAMPLE_DIR / nb.source_ref
        if not pdf_path.exists():
            pdf_path = SAMPLE_DIR / Path(nb.source_ref).name
        if pdf_path.exists():
            text = extract_full_text(str(pdf_path))

    if not text.strip():
        # Fallback: use the stored note_blocks text
        from backend.database import NoteBlock
        from sqlalchemy import select as sel
        async with AsyncSessionLocal() as db:
            result = await db.execute(sel(NoteBlock).where(NoteBlock.notebook_id == notebook_id))
            blocks = result.scalars().all()
            parts = []
            for b in blocks:
                data = json.loads(b.block_json)
                if data.get("concept_box"):
                    cb = data["concept_box"]
                    parts.append(f"{cb.get('term', '')}: {cb.get('definition', '')}")
                if data.get("semantic_blocks"):
                    for sb in data["semantic_blocks"]:
                        parts.append(sb.get("text", ""))
            text = "\n".join(parts)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract content for quiz generation")

    client = _get_openai_client()
    plan = generate_kinesthetic_plan(client, text)

    # Save generated plan to DB
    async with AsyncSessionLocal() as db:
        new_plan = KinestheticPlan(notebook_id=notebook_id, plan_json=json.dumps(plan))
        db.add(new_plan)
        await db.commit()

    return plan


@router.post("/grade")
async def grade_quiz(payload: GradeRequest = Body(...)):
    """
    Grade a completed quiz submission and return scores.
    """
    from kinesthetics import compute_kms

    result = compute_kms(
        payload.plan,
        payload.completed_activity_ids,
        payload.quiz_answers,
    )
    return result
