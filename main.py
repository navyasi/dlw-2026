

###after spitting nto multiple files

import os
from io import BytesIO
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pypdf import PdfReader
from openai import OpenAI
from insights import generate_weekly_report
from lecture import generate_lecture_script, text_to_speech_mp3
from kinesthetics import generate_kinesthetic_plan, compute_kms,compute_topic_mastery
# Optional: load from .env if you use it
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from insights import Concept, ReportConfig, generate_weekly_report
from fastapi import Body

TEXT_MODEL = "gpt-4o-mini"
TTS_MODEL = "gpt-4o-mini-tts"
VOICE = "alloy"


# @app.post("/weekly-report")
# async def weekly_report(payload: dict = Body(...)):
#     """
#     payload example:
#     {
#       "concepts": [
#         {"id":"c1","name":"...","exam_weightage":0.1,"prerequisites":[],"mastery":0.6,"last_practiced_at":"2026-03-01T10:00:00Z","difficulty":"medium"}
#       ],
#       "current_weekly_minutes": 240
#     }
#     """
#     concepts = [Concept(**c) for c in payload.get("concepts", [])]
#     cfg = ReportConfig(
#         recommended_weekly_minutes=payload.get("recommended_weekly_minutes", 360),
#         normalize_weightages=payload.get("normalize_weightages", False),
#     )
#     report = generate_weekly_report(
#         concepts=concepts,
#         cfg=cfg,
#         current_weekly_minutes=payload.get("current_weekly_minutes", 240),
#     )
#     return report
from fastapi import Body, HTTPException
from insights import Concept, ReportConfig, generate_weekly_report
from fastapi import Body, HTTPException

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
from fastapi import Body, HTTPException
from insights import generate_weekly_report

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
# @app.post("/weekly-report")
# async def weekly_report(payload: dict = Body(...)):
#     try:
#         concepts_raw = payload.get("concepts", [])
#         if not isinstance(concepts_raw, list) or len(concepts_raw) == 0:
#             raise HTTPException(status_code=422, detail="concepts must be a non-empty list")

#         concepts = []
#         for c in concepts_raw:
#             c = dict(c)
#             c.setdefault("prerequisites", [])
#             c.setdefault("difficulty", "medium")
#             c.setdefault("notes", None)
#             c.setdefault("exam_weightage", 1.0)
#             c.setdefault("mastery", 0.4)
#             concepts.append(Concept(**c))

#         cfg = ReportConfig(
#             recommended_weekly_minutes=int(payload.get("recommended_weekly_minutes", 360)),
#             normalize_weightages=bool(payload.get("normalize_weightages", False)),
#         )

#         current_minutes = int(payload.get("current_weekly_minutes", 240))
#         return generate_weekly_report(concepts=concepts, cfg=cfg, current_weekly_minutes=current_minutes)

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)

from pydantic import BaseModel
from fastapi import Body

class KinestheticSubmission(BaseModel):
    plan: dict
    completed_activity_ids: list[str]
    quiz_answers: dict


@app.post("/generate-kinesthetic")
async def generate_kinesthetic(file: UploadFile = File(...)):
    client = get_client()
    pdf_bytes = await file.read()
    pdf_text = extract_pdf_text(pdf_bytes)

    plan = generate_kinesthetic_plan(client, pdf_text)
    return plan


# @app.post("/grade-kinesthetic")
# async def grade_kinesthetic(payload: KinestheticSubmission = Body(...)):
#     result = compute_kms(
#         payload.plan,
#         payload.completed_activity_ids,
#         payload.quiz_answers
#     )
#     topic_mastery = compute_topic_mastery(plan, quiz_answers)

#     return {
#     "completion_score": ...,
#     "mcq_score": ...,
#     "short_score": ...,
#     "quiz_score": ...,
#     "kinesthetic_mastery_score": ...,
#     "topic_mastery": topic_mastery
#     }
    # return result
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

    # Simple quiz score
    total_questions = (
        len(plan.get("quiz", {}).get("mcq", [])) +
        len(plan.get("quiz", {}).get("short", []))
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


def chunk_text(text: str, max_chars: int = 3500) -> List[str]:
    chunks = []
    text = text.strip()

    while len(text) > max_chars:
        # Try to split at a newline for nicer breaks
        cut = text.rfind("\n", 0, max_chars)
        if cut == -1 or cut < max_chars * 0.6:
            cut = max_chars
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()

    if text:
        chunks.append(text)
    return chunks


def generate_lecture_script(client: OpenAI, pdf_text: str) -> str:
    system = (
        "You are an expert professor. Convert the notes into a detailed lecture script. "
        "Explain step-by-step, use intuition first, then formal definitions. "
        "Keep it spoken-friendly. Avoid markdown. Speak naturally."
    )

    response = client.responses.create(
        model=TEXT_MODEL,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": pdf_text},
        ],
    )

    return response.output_text.strip()


def text_to_speech(client: OpenAI, script: str) -> bytes:
    """
    No pydub, no ffmpeg. We generate multiple MP3 chunks and concatenate bytes.
    In practice this works well for most players.
    """
    chunks = chunk_text(script, max_chars=3500)
    final_audio = b""

    for chunk in chunks:
        audio_resp = client.audio.speech.create(
    model=TTS_MODEL,
    voice=VOICE,
    input=chunk,
)
        audio_bytes = audio_resp.read() if hasattr(audio_resp, "read") else audio_resp
        final_audio += audio_bytes

    return final_audio
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

    script = generate_lecture_script(client, pdf_text)
    mp3_audio = text_to_speech(client, script)
    with open("generated_lecture.mp3", "wb") as f:
        f.write(mp3_audio)
    return StreamingResponse(
        BytesIO(mp3_audio),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
    )
