"""
Tutorial router: get tutorial solution flow and handle step flagging.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import Attempt, Notebook, TutorialFlow, get_db
from backend.models import CheckAnswerRequest, CheckAnswerResponse, FlagStepRequest

router = APIRouter(prefix="/tutorial", tags=["tutorial"])


@router.get("/{notebook_id}/flow")
async def get_tutorial_flow(notebook_id: int, db: AsyncSession = Depends(get_db)):
    nb = await db.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if nb.source_type != "tutorial":
        raise HTTPException(status_code=400, detail="This notebook is not a tutorial")

    from sqlalchemy import select
    result = await db.execute(
        select(TutorialFlow).where(TutorialFlow.notebook_id == notebook_id)
    )
    flow = result.scalars().first()

    if not flow:
        raise HTTPException(status_code=404, detail="Tutorial flow not generated yet")

    data = json.loads(flow.flow_json)

    # Normalize to multi-question format
    if "questions" not in data:
        # Legacy single-question format — wrap it
        data = {
            "questions": [
                {
                    "question_num": 1,
                    "question_text": data.get("question_summary", ""),
                    "summary": data.get("question_summary", ""),
                    "steps": data.get("steps", []),
                    "full_answer": "",
                    "mermaid_flow": data.get("mermaid_flow", ""),
                    "error_hints": data.get("error_hints", {}),
                }
            ]
        }

    return {"notebook_id": notebook_id, "questions": data["questions"]}


@router.post("/{notebook_id}/flag")
async def flag_step(
    notebook_id: int,
    payload: FlagStepRequest,
    db: AsyncSession = Depends(get_db),
):
    """User clicks 'I'm stuck at step N'"""
    attempt = Attempt(
        notebook_id=notebook_id,
        flagged_step=payload.step_num,
    )
    db.add(attempt)
    await db.commit()

    # Return the error hint for that step
    from sqlalchemy import select
    result = await db.execute(
        select(TutorialFlow).where(TutorialFlow.notebook_id == notebook_id)
    )
    flow = result.scalars().first()
    hint = None
    if flow:
        flow_data = json.loads(flow.flow_json)
        hint = flow_data.get("error_hints", {}).get(str(payload.step_num))

    return {
        "flagged_step": payload.step_num,
        "hint": hint or "No hint available for this step.",
    }


@router.post("/check", response_model=CheckAnswerResponse)
async def check_answer(
    payload: CheckAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Compare user's answer against the solution flow.
    Uses a simple LLM call to identify which step contains the error.
    """
    from sqlalchemy import select
    from backend.llm import client, MODEL
    import os

    result = await db.execute(
        select(TutorialFlow).where(TutorialFlow.notebook_id == payload.notebook_id)
    )
    flow = result.scalars().first()
    if not flow:
        raise HTTPException(status_code=404, detail="Tutorial flow not found")

    flow_data = json.loads(flow.flow_json)

    # Ask LLM to identify error step
    steps_text = "\n".join(
        f"Step {s['step_num']}: {s['description']}"
        for s in flow_data.get("steps", [])
    )
    prompt = (
        f"Correct solution steps:\n{steps_text}\n\n"
        f"Student's answer:\n{payload.user_answer}\n\n"
        "Identify which step number (integer) contains the student's first error. "
        "If the answer is correct, return 0. "
        "Output JSON: {\"error_step\": <int>, \"correct\": <bool>, \"hint\": \"<string>\"}"
    )

    resp = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a tutor grading a student answer. Output only JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )
    result_data = json.loads(resp.choices[0].message.content)
    error_step = result_data.get("error_step") or None
    if error_step == 0:
        error_step = None

    attempt = Attempt(
        notebook_id=payload.notebook_id,
        question_text=payload.question_text,
        user_answer=payload.user_answer,
        error_step=error_step,
    )
    db.add(attempt)
    await db.commit()

    return CheckAnswerResponse(
        error_step=error_step,
        hint=result_data.get("hint"),
        correct=result_data.get("correct", False),
    )
