# import os
# import math
# import re
# from io import BytesIO
# from typing import List

# from fastapi import FastAPI, UploadFile, File
# from fastapi.responses import StreamingResponse
# from pypdf import PdfReader

# from openai import OpenAI

# app = FastAPI()
# import os
# from fastapi import HTTPException
# def get_client():
#     api_key = os.getenv("OPENAI_API_KEY")
#     if not api_key:
#         raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
#     return OpenAI(api_key=api_key)
# TEXT_MODEL = "gpt-4o-mini"
# TTS_MODEL = "gpt-4o-mini-tts"
# VOICE = "alloy"

# @app.post("/generate-lecture")
# async def generate_lecture(file: UploadFile = File(...)):

#     client = get_client()   # 👈 ADD THIS LINE HERE

#     pdf_bytes = await file.read()
#     pdf_text = extract_pdf_text(pdf_bytes)
#     script = generate_lecture_script(client, pdf_text)
#     mp3_audio = text_to_speech(client, script)

#     return StreamingResponse(
#         BytesIO(mp3_audio),
#         media_type="audio/mpeg",
#         headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
#     )
# # -------------------------
# # Utilities
# # -------------------------
# def text_to_speech(script: str) -> bytes:
#     chunks = chunk_text(script)
#     final_audio = b""

#     for chunk in chunks:
#         audio_resp = client.audio.speech.create(
#             model=TTS_MODEL,
#             voice=VOICE,
#             input=chunk,
#             format="mp3",
#         )

#         audio_bytes = audio_resp.read() if hasattr(audio_resp, "read") else audio_resp
#         final_audio += audio_bytes

#     return final_audio
# def extract_pdf_text(pdf_bytes: bytes) -> str:
#     reader = PdfReader(BytesIO(pdf_bytes))
#     text_chunks = []

#     for i, page in enumerate(reader.pages, start=1):
#         text = page.extract_text() or ""
#         text_chunks.append(f"\n--- Page {i} ---\n{text}")

#     return "\n".join(text_chunks)


# def chunk_text(text: str, max_chars=3500) -> List[str]:
#     chunks = []
#     while len(text) > max_chars:
#         chunks.append(text[:max_chars])
#         text = text[max_chars:]
#     chunks.append(text)
#     return chunks


# def generate_lecture_script(pdf_text: str) -> str:
#     system = (
#         "You are an expert professor. Convert the notes into a detailed lecture script. "
#         "Explain step-by-step, use intuition first, then formal definitions. "
#         "Keep it spoken-friendly."
#     )

#     response = client.responses.create(
#         model=TEXT_MODEL,
#         input=[
#             {"role": "system", "content": system},
#             {"role": "user", "content": pdf_text},
#         ],
#     )

#     return response.output_text


# def text_to_speech(script: str) -> bytes:
#     chunks = chunk_text(script)

#     combined = AudioSegment.empty()

#     for chunk in chunks:
#         audio_resp = client.audio.speech.create(
#             model=TTS_MODEL,
#             voice=VOICE,
#             input=chunk,
#             format="mp3",
#         )

#         audio_bytes = audio_resp.read() if hasattr(audio_resp, "read") else audio_resp
#         segment = AudioSegment.from_file(BytesIO(audio_bytes), format="mp3")
#         combined += segment

#     output = BytesIO()
#     combined.export(output, format="mp3")
#     return output.getvalue()


# # -------------------------
# # API Endpoint
# # -------------------------

# @app.post("/generate-lecture")
# async def generate_lecture(file: UploadFile = File(...)):

#     pdf_bytes = await file.read()

#     pdf_text = extract_pdf_text(pdf_bytes)
#     script = generate_lecture_script(pdf_text)
#     mp3_audio = text_to_speech(script)

#     return StreamingResponse(
#         BytesIO(mp3_audio),
#         media_type="audio/mpeg",
#         headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
#     )

###working one
# import os
# from io import BytesIO
# from typing import List
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi import FastAPI, UploadFile, File, HTTPException
# from fastapi.responses import StreamingResponse
# from pypdf import PdfReader
# from openai import OpenAI

# # Optional: load from .env if you use it
# try:
#     from dotenv import load_dotenv
#     load_dotenv()
# except Exception:
#     pass

# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# TEXT_MODEL = "gpt-4o-mini"
# TTS_MODEL = "gpt-4o-mini-tts"
# VOICE = "alloy"


# def get_client() -> OpenAI:
#     api_key = os.getenv("OPENAI_API_KEY")
#     if not api_key:
#         raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
#     return OpenAI(api_key=api_key)


# # -------------------------
# # Utilities
# # -------------------------
# def extract_pdf_text(pdf_bytes: bytes) -> str:
#     reader = PdfReader(BytesIO(pdf_bytes))
#     text_chunks = []

#     for i, page in enumerate(reader.pages, start=1):
#         text = page.extract_text() or ""
#         text = text.strip()
#         if text:
#             text_chunks.append(f"\n--- Page {i} ---\n{text}")

#     return "\n".join(text_chunks).strip()


# def chunk_text(text: str, max_chars: int = 3500) -> List[str]:
#     chunks = []
#     text = text.strip()

#     while len(text) > max_chars:
#         # Try to split at a newline for nicer breaks
#         cut = text.rfind("\n", 0, max_chars)
#         if cut == -1 or cut < max_chars * 0.6:
#             cut = max_chars
#         chunks.append(text[:cut].strip())
#         text = text[cut:].strip()

#     if text:
#         chunks.append(text)
#     return chunks


# def generate_lecture_script(client: OpenAI, pdf_text: str) -> str:
#     system = (
#         "You are an expert professor. Convert the notes into a detailed lecture script. "
#         "Explain step-by-step, use intuition first, then formal definitions. "
#         "Keep it spoken-friendly. Avoid markdown. Speak naturally."
#     )

#     response = client.responses.create(
#         model=TEXT_MODEL,
#         input=[
#             {"role": "system", "content": system},
#             {"role": "user", "content": pdf_text},
#         ],
#     )

#     return response.output_text.strip()


# def text_to_speech(client: OpenAI, script: str) -> bytes:
#     """
#     No pydub, no ffmpeg. We generate multiple MP3 chunks and concatenate bytes.
#     In practice this works well for most players.
#     """
#     chunks = chunk_text(script, max_chars=3500)
#     final_audio = b""

#     for chunk in chunks:
#         audio_resp = client.audio.speech.create(
#     model=TTS_MODEL,
#     voice=VOICE,
#     input=chunk,
# )
#         audio_bytes = audio_resp.read() if hasattr(audio_resp, "read") else audio_resp
#         final_audio += audio_bytes

#     return final_audio


# # -------------------------
# # API Endpoint
# # -------------------------
# @app.post("/generate-lecture")
# async def generate_lecture(file: UploadFile = File(...)):
#     client = get_client()

#     pdf_bytes = await file.read()
#     pdf_text = extract_pdf_text(pdf_bytes)

#     if not pdf_text:
#         raise HTTPException(
#             status_code=400,
#             detail="Could not extract text from PDF. If it's scanned, run OCR first.",
#         )

#     script = generate_lecture_script(client, pdf_text)
#     mp3_audio = text_to_speech(client, script)
#     with open("generated_lecture.mp3", "wb") as f:
#         f.write(mp3_audio)
#     return StreamingResponse(
#         BytesIO(mp3_audio),
#         media_type="audio/mpeg",
#         headers={"Content-Disposition": "attachment; filename=lecture.mp3"},
#     )


###after spitting nto multiple files

import os
from io import BytesIO
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pypdf import PdfReader
from openai import OpenAI
from lecture import generate_lecture_script, text_to_speech_mp3
from kinesthetics import generate_kinesthetic_plan, compute_kms
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

TEXT_MODEL = "gpt-4o-mini"
TTS_MODEL = "gpt-4o-mini-tts"
VOICE = "alloy"


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


@app.post("/grade-kinesthetic")
async def grade_kinesthetic(payload: KinestheticSubmission = Body(...)):
    result = compute_kms(
        payload.plan,
        payload.completed_activity_ids,
        payload.quiz_answers
    )
    return result
# -------------------------
# Utilities
# -------------------------
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
