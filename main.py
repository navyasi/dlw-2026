

# ###after spitting nto multiple files

# import os
# import sys
# import json
# from datetime import date, timedelta
# from io import BytesIO
# from typing import Optional
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi import FastAPI, UploadFile, File, HTTPException
# from fastapi.responses import StreamingResponse
# from pypdf import PdfReader
# from openai import OpenAI
# from insights import Concept, ReportConfig, generate_weekly_report
# from lecture import generate_lecture_script, text_to_speech_mp3
# from kinesthetics import generate_kinesthetic_plan, compute_kms, compute_topic_mastery

# sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
# from learning_model import KnowledgeGraph, MasteryEngine, QuizResponse
# from scheduler import TimetableEngine, AvailabilityWindow
# from bridge import load_curriculum_meta, mastery_to_concepts_payload, grade_to_quiz_responses
# # Optional: load from .env if you use it
# try:
#     from dotenv import load_dotenv
#     load_dotenv()
# except Exception:
#     pass

# app = FastAPI()
# # app.add_middleware(
# #     CORSMiddleware,
# #     # allow_origins=[
# #     #     "http://localhost:3000", "http://127.0.0.1:3000",
# #     #     "http://localhost:5500", "http://127.0.0.1:5500",
# #     # ],
# #     allow_origins=[
# #         "http://localhost:3000", "http://127.0.0.1:3000",
# #         "http://localhost:5500", "http://127.0.0.1:5500",
# #         "http://localhost:8080", "http://127.0.0.1:8080",
# #     ],
# #     allow_credentials=True,
# #     allow_methods=["*"],
# #     allow_headers=["*"],
# # )
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000", "http://127.0.0.1:3000",
#         "http://localhost:5500", "http://127.0.0.1:5500",
#         "http://localhost:8080", "http://127.0.0.1:8080",
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# from fastapi import Body, HTTPException

# TEXT_MODEL = "gpt-4o-mini"
# TTS_MODEL = "gpt-4o-mini-tts"
# VOICE = "alloy"


# @app.post("/weekly-report")
# async def weekly_report(payload: dict = Body(...)):
#     try:
#         concepts_raw = payload.get("concepts", [])
#         current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
#         cfg = payload.get("config", None)  # optional dict
#         return generate_weekly_report(
#             concepts_raw=concepts_raw,
#             current_weekly_minutes=current_weekly_minutes,
#             cfg_dict=cfg,
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# # ─────────────────────────────────────────────────────────────────────────────
# # /integrated-weekly  — full loop: quiz results → mastery → report + timetable
# # ─────────────────────────────────────────────────────────────────────────────

# _CURRICULUM_META = None  # lazy-loaded once

# def _get_curriculum_meta():
#     global _CURRICULUM_META
#     if _CURRICULUM_META is None:
#         _CURRICULUM_META = load_curriculum_meta()
#     return _CURRICULUM_META


# @app.post("/integrated-weekly")
# async def integrated_weekly(payload: dict = Body(...)):
#     """
#     Full integration endpoint wiring Person 1 (mastery engine) +
#     Person 4 (Sia — weekly analytics) + Person 3 (Chavi — timetable).

#     Request body:
#     {
#       "student_id":             "stu_001",
#       "subject":                "computer_security",
#       "exam_weights":           {"buffer_overflow": 0.12, "reference_monitor": 0.06, ...},  // optional — defaults to CSV
#       "days_until_exam":        14,
#       "current_weekly_minutes": 240,       // optional, default 240
#       "topic_mastery":          {"backprop": 0.45, "chain_rule": 0.30, ...},  // optional — from /grade-kinesthetic
#       "quiz_responses": [       // optional — raw quiz history (overrides topic_mastery)
#         {"concept_id": "backprop", "correct": false, "response_time_seconds": 90, "error_depth": 0.8}
#       ],
#       "availability": [         // optional — defaults to Mon-Fri 3h, Sat-Sun 4h
#         {"day_of_week": 0, "available_hours": 3.0}, ...
#       ]
#     }

#     Response:
#     {
#       "weekly_report":   { ... },   // Sia's analytics
#       "study_plan":      { ... },   // Chavi's timetable (7 days)
#       "todays_schedule": { ... }    // today's Pomodoro blocks
#     }
#     """
#     try:
#         from bridge import load_exam_weights, load_topic_mastery

#         student_id = payload.get("student_id", "stu_001")
#         subject = payload.get("subject", "computer_security")
#         exam_weights: dict = payload.get("exam_weights") or load_exam_weights()
#         days_until_exam = int(payload.get("days_until_exam", 14))
#         current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
#         topic_mastery: dict = payload.get("topic_mastery", {})
#         raw_quiz_responses: list = payload.get("quiz_responses", [])

#         api_key = os.getenv("OPENAI_API_KEY")
#         from engine_state import get_shared_engine
#         engine, kg = get_shared_engine()

#         # 1. Ingest quiz results into the mastery engine
#         #    Priority: raw quiz_responses > topic_mastery from kinesthetic grader
#         if raw_quiz_responses:
#             responses = [
#                 QuizResponse(
#                     student_id=student_id,
#                     concept_id=r["concept_id"],
#                     subject=subject,
#                     correct=bool(r.get("correct", False)),
#                     response_time_seconds=float(r.get("response_time_seconds", 60.0)),
#                     error_depth=float(r.get("error_depth", 0.0)),
#                 )
#                 for r in raw_quiz_responses
#             ]
#             engine.update_from_quiz(responses)
#         elif topic_mastery:
#             # Convert Sia's topic_mastery output → QuizResponse objects
#             responses = grade_to_quiz_responses(topic_mastery, student_id, subject)
#             engine.update_from_quiz(responses)

#         # 2. Get current mastery state (with forgetting decay applied)
#         mastery_state = engine.get_mastery_state(student_id, subject)

#         # 3. Build Sia's concepts payload and run weekly analytics report
#         curriculum_meta = _get_curriculum_meta()
#         concepts_payload = mastery_to_concepts_payload(mastery_state, exam_weights, curriculum_meta)
#         weekly_report = generate_weekly_report(
#             concepts_raw=concepts_payload,
#             current_weekly_minutes=current_weekly_minutes,
#         )

#         # 4. Build timetable (Chavi's scheduler)
#         availability_raw = payload.get("availability", [])
#         if availability_raw:
#             availability = [
#                 AvailabilityWindow(
#                     day_of_week=int(a["day_of_week"]),
#                     available_hours=float(a["available_hours"]),
#                 )
#                 for a in availability_raw
#             ]
#         else:
#             # Sensible defaults: Mon-Fri 3h, Sat-Sun 4h
#             availability = [
#                 AvailabilityWindow(day_of_week=0, available_hours=3.0),
#                 AvailabilityWindow(day_of_week=1, available_hours=3.0),
#                 AvailabilityWindow(day_of_week=2, available_hours=3.0),
#                 AvailabilityWindow(day_of_week=3, available_hours=3.0),
#                 AvailabilityWindow(day_of_week=4, available_hours=2.5),
#                 AvailabilityWindow(day_of_week=5, available_hours=4.0),
#                 AvailabilityWindow(day_of_week=6, available_hours=4.0),
#             ]

#         timetable = TimetableEngine(
#             mastery_engine=engine,
#             knowledge_graph=kg,
#             openai_api_key=api_key,
#         )

#         exam_date = date.today() + timedelta(days=days_until_exam)
#         plan = timetable.generate_plan(
#             student_id=student_id,
#             subjects=[subject],
#             exam_weights_by_subject={subject: exam_weights},
#             exam_date=exam_date,
#             availability=availability,
#         )

#         todays_sched = timetable.get_todays_schedule(student_id, plan)

#         # 5. Serialise the study plan
#         def serialise_block(b) -> dict:
#             return {
#                 "block_type": b.block_type,
#                 "duration_minutes": b.duration_minutes,
#                 "concept_ids": list(b.concept_ids),
#                 "priority_score": round(float(b.priority_score), 4),
#                 "difficulty": round(float(b.difficulty), 3),
#             }

#         def serialise_day(d) -> dict:
#             return {
#                 "date": str(d.date),
#                 "day_of_week": d.date.strftime("%A"),
#                 "total_study_minutes": d.total_study_minutes,
#                 "blocks": [serialise_block(b) for b in d.blocks],
#             }

#         study_plan_out = {
#             "exam_date": str(exam_date),
#             "days_until_exam": days_until_exam,
#             "total_days": len(plan.days),
#             "days": [serialise_day(d) for d in plan.days],
#         }

#         todays_out = serialise_day(todays_sched) if todays_sched else None

#         return {
#             "student_id": student_id,
#             "subject": subject,
#             "weekly_report": weekly_report,
#             "study_plan": study_plan_out,
#             "todays_schedule": todays_out,
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# def get_client() -> OpenAI:
#     api_key = os.getenv("OPENAI_API_KEY")
#     if not api_key:
#         raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
#     return OpenAI(api_key=api_key)

# from fastapi import Body

# @app.post("/generate-kinesthetic")
# async def generate_kinesthetic(file: UploadFile = File(...)):
#     client = get_client()
#     pdf_bytes = await file.read()
#     pdf_text = extract_pdf_text(pdf_bytes)

#     plan = generate_kinesthetic_plan(client, pdf_text)
#     return plan


# # -------------------------
# # Utilities
# # -------------------------


# @app.post("/grade-kinesthetic")
# async def grade_kinesthetic(payload: dict = Body(...)):
#     plan = payload.get("plan", {})
#     completed_activity_ids = payload.get("completed_activity_ids", [])
#     quiz_answers = payload.get("quiz_answers", {})

#     # Compute topic mastery
#     topic_mastery = compute_topic_mastery(plan, quiz_answers)

#     # Example scoring (adjust to your logic)
#     completion_score = round(
#         100 * len(completed_activity_ids) / max(1, len(plan.get("activities", [])))
#     )

#     total_correct = 0
#     for topic, mastery in topic_mastery.items():
#         total_correct += mastery

#     quiz_score = round(100 * total_correct / max(1, len(topic_mastery)))

#     kinesthetic_mastery_score = round(
#         0.4 * completion_score + 0.6 * quiz_score
#     )

#     return {
#         "completion_score": completion_score,
#         "quiz_score": quiz_score,
#         "kinesthetic_mastery_score": kinesthetic_mastery_score,
#         "topic_mastery": topic_mastery
#     }

# def extract_pdf_text(pdf_bytes: bytes) -> str:
#     reader = PdfReader(BytesIO(pdf_bytes))
#     text_chunks = []

#     for i, page in enumerate(reader.pages, start=1):
#         text = page.extract_text() or ""
#         text = text.strip()
#         if text:
#             text_chunks.append(f"\n--- Page {i} ---\n{text}")

#     return "\n".join(text_chunks).strip()


# # -------------------------
# # API Endpoint
# # -------------------------
# @app.post("/generate-lecture")
# async def generate_lecture(file: UploadFile = File(...)):
#     client = get_client()

#     pdf_bytes = await file.read()
#     pdf_text = extract_pdf_text(pdf_bytes)

#     if not pdf_text:
#         raise HTTPException(status_code=400, detail="No text extracted from PDF (scanned PDF needs OCR).")

#     script = generate_lecture_script(client, pdf_text)
#     mp3_audio = text_to_speech_mp3(client, script)

#     return StreamingResponse(
#         BytesIO(mp3_audio),
#         media_type="audio/mpeg",
#         headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
#     )
# def main():
#     print("Hello from dlw-2026!")


# if __name__ == "__main__":
#     main()





###after spitting nto multiple files

import os
import sys
import json
from datetime import date, timedelta
from io import BytesIO
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pypdf import PdfReader
from openai import OpenAI
from insights import Concept, ReportConfig, generate_weekly_report
from lecture import generate_lecture_script, text_to_speech_mp3
from kinesthetics import generate_kinesthetic_plan, compute_kms, compute_topic_mastery

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from learning_model import KnowledgeGraph, MasteryEngine, QuizResponse
from scheduler import TimetableEngine, AvailabilityWindow
from bridge import load_curriculum_meta, mastery_to_concepts_payload, grade_to_quiz_responses
# Optional: load from .env if you use it
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:5500", "http://127.0.0.1:5500",
        "http://localhost:8080", "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Body, HTTPException

TEXT_MODEL = "gpt-4o-mini"
TTS_MODEL = "gpt-4o-mini-tts"
VOICE = "alloy"


@app.post("/weekly-report")
async def weekly_report(payload: dict = Body(...)):
    try:
        concepts_raw = payload.get("concepts", [])
        current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
        cfg = payload.get("config", None)  # optional dict
        return generate_weekly_report(
            concepts_raw=concepts_raw,
            current_weekly_minutes=current_weekly_minutes,
            cfg_dict=cfg,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# /integrated-weekly  — full loop: quiz results → mastery → report + timetable
# ─────────────────────────────────────────────────────────────────────────────

_CURRICULUM_META = None  # lazy-loaded once

def _get_curriculum_meta():
    global _CURRICULUM_META
    if _CURRICULUM_META is None:
        _CURRICULUM_META = load_curriculum_meta()
    return _CURRICULUM_META


@app.post("/integrated-weekly")
async def integrated_weekly(payload: dict = Body(...)):
    """
    Full integration endpoint wiring Person 1 (mastery engine) +
    Person 4 (Sia — weekly analytics) + Person 3 (Chavi — timetable).

    Request body:
    {
      "student_id":             "stu_001",
      "subject":                "computer_security",
      "exam_weights":           {"buffer_overflow": 0.12, "reference_monitor": 0.06, ...},  // optional — defaults to CSV
      "days_until_exam":        14,
      "current_weekly_minutes": 240,       // optional, default 240
      "topic_mastery":          {"backprop": 0.45, "chain_rule": 0.30, ...},  // optional — from /grade-kinesthetic
      "quiz_responses": [       // optional — raw quiz history (overrides topic_mastery)
        {"concept_id": "backprop", "correct": false, "response_time_seconds": 90, "error_depth": 0.8}
      ],
      "availability": [         // optional — defaults to Mon-Fri 3h, Sat-Sun 4h
        {"day_of_week": 0, "available_hours": 3.0}, ...
      ]
    }

    Response:
    {
      "weekly_report":   { ... },   // Sia's analytics
      "study_plan":      { ... },   // Chavi's timetable (7 days)
      "todays_schedule": { ... }    // today's Pomodoro blocks
    }
    """
    try:
        from bridge import load_exam_weights, load_topic_mastery

        student_id = payload.get("student_id", "stu_001")
        subject = payload.get("subject", "computer_security")
        exam_weights: dict = payload.get("exam_weights") or load_exam_weights()
        days_until_exam = int(payload.get("days_until_exam", 14))
        current_weekly_minutes = int(payload.get("current_weekly_minutes", 240))
        topic_mastery: dict = payload.get("topic_mastery", {})
        raw_quiz_responses: list = payload.get("quiz_responses", [])

        api_key = os.getenv("OPENAI_API_KEY")
        from engine_state import get_shared_engine
        engine, kg = get_shared_engine()

        # 1. Ingest quiz results into the mastery engine
        #    Priority: raw quiz_responses > topic_mastery from kinesthetic grader
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
            # Convert Sia's topic_mastery output → QuizResponse objects
            responses = grade_to_quiz_responses(topic_mastery, student_id, subject)
            engine.update_from_quiz(responses)

        # 2. Get current mastery state (with forgetting decay applied)
        mastery_state = engine.get_mastery_state(student_id, subject)

        # 3. Build Sia's concepts payload and run weekly analytics report
        curriculum_meta = _get_curriculum_meta()
        concepts_payload = mastery_to_concepts_payload(mastery_state, exam_weights, curriculum_meta)
        weekly_report = generate_weekly_report(
            concepts_raw=concepts_payload,
            current_weekly_minutes=current_weekly_minutes,
        )

        # 4. Build timetable (Chavi's scheduler)
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
            # Sensible defaults: Mon-Fri 3h, Sat-Sun 4h
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
            openai_api_key=api_key,
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

        # 5. Serialise the study plan
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

        todays_out = serialise_day(todays_sched) if todays_sched else None

        return {
            "student_id": student_id,
            "subject": subject,
            "weekly_report": weekly_report,
            "concepts_payload": concepts_payload,
            "study_plan": study_plan_out,
            "todays_schedule": todays_out,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)

from fastapi import Body

@app.post("/generate-kinesthetic")
async def generate_kinesthetic(file: UploadFile = File(...)):
    client = get_client()
    pdf_bytes = await file.read()
    pdf_text = extract_pdf_text(pdf_bytes)

    plan = generate_kinesthetic_plan(client, pdf_text)
    return plan


# -------------------------
# Utilities
# -------------------------


@app.post("/grade-kinesthetic")
async def grade_kinesthetic(payload: dict = Body(...)):
    plan = payload.get("plan", {})
    completed_activity_ids = payload.get("completed_activity_ids", [])
    quiz_answers = payload.get("quiz_answers", {})

    # Compute topic mastery
    topic_mastery = compute_topic_mastery(plan, quiz_answers)

    # Example scoring (adjust to your logic)
    completion_score = round(
        100 * len(completed_activity_ids) / max(1, len(plan.get("activities", [])))
    )

    total_correct = 0
    for topic, mastery in topic_mastery.items():
        total_correct += mastery

    quiz_score = round(100 * total_correct / max(1, len(topic_mastery)))

    kinesthetic_mastery_score = round(
        0.4 * completion_score + 0.6 * quiz_score
    )

    return {
        "completion_score": completion_score,
        "quiz_score": quiz_score,
        "kinesthetic_mastery_score": kinesthetic_mastery_score,
        "topic_mastery": topic_mastery
    }

def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    text_chunks = []

    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            text_chunks.append(f"\n--- Page {i} ---\n{text}")

    return "\n".join(text_chunks).strip()


# -------------------------
# API Endpoint
# -------------------------
@app.post("/generate-lecture")
async def generate_lecture(file: UploadFile = File(...)):
    client = get_client()

    pdf_bytes = await file.read()
    pdf_text = extract_pdf_text(pdf_bytes)

    if not pdf_text:
        raise HTTPException(status_code=400, detail="No text extracted from PDF (scanned PDF needs OCR).")

    script = generate_lecture_script(client, pdf_text)
    mp3_audio = text_to_speech_mp3(client, script)

    return StreamingResponse(
        BytesIO(mp3_audio),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
    )
def main():
    print("Hello from dlw-2026!")


if __name__ == "__main__":
    main()