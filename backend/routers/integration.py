"""
Integration router: AI analytics + timetable endpoints.

Moves the heavy ML endpoints out of root main.py into the FastAPI backend so
the Next.js frontend only needs to talk to one server (port 8000).

Endpoints:
  POST /weekly-report
  POST /integrated-weekly
  POST /generate-kinesthetic
  POST /grade-kinesthetic
  POST /generate-lecture
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

# Ensure src/ is on the path for learning_model / scheduler imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

router = APIRouter(tags=["integration"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_openai_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(pdf_bytes))
    chunks = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            chunks.append(f"\n--- Page {i} ---\n{text}")
    return "\n".join(chunks).strip()


# ---------------------------------------------------------------------------
# /weekly-report
# ---------------------------------------------------------------------------

@router.post("/weekly-report")
async def weekly_report(payload: dict = Body(...)):
    try:
        from insights import generate_weekly_report
        concepts_raw = payload.get("concepts", [])
        current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
        cfg = payload.get("config", None)
        return generate_weekly_report(
            concepts_raw=concepts_raw,
            current_weekly_minutes=current_weekly_minutes,
            cfg_dict=cfg,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# /integrated-weekly  — full loop: quiz results → mastery → report + timetable
# ---------------------------------------------------------------------------

_curriculum_meta = None


def _get_curriculum_meta():
    global _curriculum_meta
    if _curriculum_meta is None:
        from bridge import load_curriculum_meta
        _curriculum_meta = load_curriculum_meta()
    return _curriculum_meta


@router.post("/integrated-weekly")
async def integrated_weekly(payload: dict = Body(...)):
    try:
        from engine_state import get_shared_engine
        from bridge import mastery_to_concepts_payload, grade_to_quiz_responses
        from insights import generate_weekly_report
        from scheduler import TimetableEngine, AvailabilityWindow
        from learning_model import QuizResponse

        from bridge import load_exam_weights, load_topic_mastery

        student_id = payload.get("student_id", "stu_001")
        subject = payload.get("subject", "computer_security")
        exam_weights: dict = payload.get("exam_weights") or load_exam_weights()
        days_until_exam = int(payload.get("days_until_exam", 14))
        current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
        topic_mastery: dict = payload.get("topic_mastery", {})
        raw_quiz_responses: list = payload.get("quiz_responses", [])

        engine, kg = get_shared_engine()

        # 1. Ingest quiz results
        if raw_quiz_responses:
            responses = [
                QuizResponse(
                    student_id=student_id,
                    concept_id=r["concept_id"],
                    subject=subject,
                    correct=bool(r.get("correct", False)),
                    response_time_seconds=float(r.get("response_time_seconds", 60.0)),
                    error_depth=float(r.get("error_depth", 0.0)),
                )
                for r in raw_quiz_responses
            ]
            engine.update_from_quiz(responses)
        elif topic_mastery:
            responses = grade_to_quiz_responses(topic_mastery, student_id, subject)
            engine.update_from_quiz(responses)
        else:
            # Fall back to CSV mastery data for this student
            csv_mastery = load_topic_mastery(student_id=student_id, subject=subject)
            if csv_mastery:
                responses = grade_to_quiz_responses(csv_mastery, student_id, subject)
                engine.update_from_quiz(responses)

        # 2. Get mastery state
        mastery_state = engine.get_mastery_state(student_id, subject)

        # 3. Weekly analytics report
        curriculum_meta = _get_curriculum_meta()
        concepts_payload = mastery_to_concepts_payload(mastery_state, exam_weights, curriculum_meta)
        report = generate_weekly_report(
            concepts_raw=concepts_payload,
            current_weekly_minutes=current_weekly_minutes,
        )

        # 4. Build timetable
        availability_raw = payload.get("availability", [])
        if availability_raw:
            availability = [
                AvailabilityWindow(
                    day_of_week=int(a["day_of_week"]),
                    available_hours=float(a["available_hours"]),
                )
                for a in availability_raw
            ]
        else:
            availability = [
                AvailabilityWindow(day_of_week=0, available_hours=3.0),
                AvailabilityWindow(day_of_week=1, available_hours=3.0),
                AvailabilityWindow(day_of_week=2, available_hours=3.0),
                AvailabilityWindow(day_of_week=3, available_hours=3.0),
                AvailabilityWindow(day_of_week=4, available_hours=2.5),
                AvailabilityWindow(day_of_week=5, available_hours=4.0),
                AvailabilityWindow(day_of_week=6, available_hours=4.0),
            ]

        timetable = TimetableEngine(
            mastery_engine=engine,
            knowledge_graph=kg,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
        )
        exam_date = date.today() + timedelta(days=days_until_exam)
        plan = timetable.generate_plan(
            student_id=student_id,
            subjects=[subject],
            exam_weights_by_subject={subject: exam_weights},
            exam_date=exam_date,
            availability=availability,
        )
        todays_sched = timetable.get_todays_schedule(student_id, plan)

        def serialise_block(b) -> dict:
            return {
                "block_type": b.block_type,
                "duration_minutes": b.duration_minutes,
                "concept_ids": list(b.concept_ids),
                "priority_score": round(float(b.priority_score), 4),
                "difficulty": round(float(b.difficulty), 3),
            }

        def serialise_day(d) -> dict:
            return {
                "date": str(d.date),
                "day_of_week": d.date.strftime("%A"),
                "total_study_minutes": d.total_study_minutes,
                "blocks": [serialise_block(b) for b in d.blocks],
            }

        study_plan_out = {
            "exam_date": str(exam_date),
            "days_until_exam": days_until_exam,
            "total_days": len(plan.days),
            "days": [serialise_day(d) for d in plan.days],
        }

        return {
            "student_id": student_id,
            "subject": subject,
            "weekly_report": report,
            "study_plan": study_plan_out,
            "todays_schedule": serialise_day(todays_sched) if todays_sched else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# /generate-kinesthetic
# ---------------------------------------------------------------------------

@router.post("/generate-kinesthetic")
async def generate_kinesthetic(file: UploadFile = File(...)):
    from kinesthetics import generate_kinesthetic_plan
    client = _get_openai_client()
    pdf_bytes = await file.read()
    pdf_text = _extract_pdf_text(pdf_bytes)
    return generate_kinesthetic_plan(client, pdf_text)


# ---------------------------------------------------------------------------
# /grade-kinesthetic
# ---------------------------------------------------------------------------

@router.post("/grade-kinesthetic")
async def grade_kinesthetic(payload: dict = Body(...)):
    from kinesthetics import compute_topic_mastery
    plan = payload.get("plan", {})
    completed_activity_ids = payload.get("completed_activity_ids", [])
    quiz_answers = payload.get("quiz_answers", {})

    topic_mastery = compute_topic_mastery(plan, quiz_answers)

    completion_score = round(
        100 * len(completed_activity_ids) / max(1, len(plan.get("activities", [])))
    )
    quiz_score = round(100 * sum(topic_mastery.values()) / max(1, len(topic_mastery)))
    kinesthetic_mastery_score = round(0.4 * completion_score + 0.6 * quiz_score)

    return {
        "completion_score": completion_score,
        "quiz_score": quiz_score,
        "kinesthetic_mastery_score": kinesthetic_mastery_score,
        "topic_mastery": topic_mastery,
    }


# ---------------------------------------------------------------------------
# /generate-lecture
# ---------------------------------------------------------------------------

@router.post("/generate-lecture")
async def generate_lecture(file: UploadFile = File(...)):
    from lecture import generate_lecture_script, text_to_speech_mp3
    client = _get_openai_client()
    pdf_bytes = await file.read()
    pdf_text = _extract_pdf_text(pdf_bytes)
    if not pdf_text:
        raise HTTPException(status_code=400, detail="No text extracted from PDF.")
    script = generate_lecture_script(client, pdf_text)
    mp3_audio = text_to_speech_mp3(client, script)
    return StreamingResponse(
        BytesIO(mp3_audio),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
    )
