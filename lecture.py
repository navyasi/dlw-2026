from typing import List
from openai import OpenAI

TEXT_MODEL = "gpt-4o-mini"
TTS_MODEL = "gpt-4o-mini-tts"
VOICE = "alloy"


def chunk_text(text: str, max_chars: int = 3500) -> List[str]:
    """
    Splits text into chunks for TTS limits. Tries to break at newline for clean audio.
    """
    text = (text or "").strip()
    chunks = []

    while len(text) > max_chars:
        cut = text.rfind("\n", 0, max_chars)
        if cut == -1 or cut < max_chars * 0.6:
            cut = max_chars
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()

    if text:
        chunks.append(text)
    return chunks


def generate_lecture_script(client: OpenAI, pdf_text: str) -> str:
    """
    Creates a detailed, spoken-friendly lecture script from extracted PDF text.
    """
    system = (
        "You are an expert professor. Convert the notes into a detailed lecture script.\n"
        "Rules:\n"
        "- Explain step-by-step like teaching students.\n"
        "- Start with intuition, then definitions/formulas.\n"
        "- Use small examples and quick recaps.\n"
        "- Keep it spoken-friendly (no markdown, no tables).\n"
        "- If notes are unclear, make reasonable assumptions and say so briefly.\n"
    )

    resp = client.responses.create(
        model=TEXT_MODEL,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": pdf_text},
        ],
    )

    return (resp.output_text or "").strip()


def text_to_speech_mp3(client: OpenAI, script: str, voice: str = VOICE) -> bytes:
    """
    Converts script to MP3 audio bytes.
    Note: We concatenate MP3 bytes (no pydub/ffmpeg).
    """
    chunks = chunk_text(script, max_chars=3500)
    final_audio = b""

    for chunk in chunks:
        # IMPORTANT: Some SDK versions don't accept "format"
        audio_resp = client.audio.speech.create(
            model=TTS_MODEL,
            voice=voice,
            input=chunk,
        )

        audio_bytes = audio_resp.read() if hasattr(audio_resp, "read") else audio_resp
        final_audio += audio_bytes

    return final_audio


def generate_audio_lecture_mp3(client: OpenAI, pdf_text: str, voice: str = VOICE) -> bytes:
    """
    Convenience: PDF text -> lecture script -> MP3 bytes
    """
    script = generate_lecture_script(client, pdf_text)
    return text_to_speech_mp3(client, script, voice=voice)