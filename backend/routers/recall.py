"""
Recall router: grade user's spoken answer against expected key points.
"""
from __future__ import annotations

import json

from fastapi import APIRouter
from pydantic import BaseModel

from backend.llm import client, MODEL

router = APIRouter(prefix="/recall", tags=["recall"])


class GradeRecallRequest(BaseModel):
    question: str
    expected_key_points: list[str]
    transcript: str


class GradeRecallResponse(BaseModel):
    label: str          # "correct" | "partial" | "incorrect"
    confidence: float   # 0-1
    missing_points: list[str]
    suggestion: str


GRADING_SYSTEM = (
    "You grade a student's spoken answer to a recall question. "
    "Output ONLY valid JSON — no markdown fences, no prose outside the JSON object."
)

GRADING_USER_TEMPLATE = """\
Question: {question}

Expected key points the answer should cover:
{key_points}

Student's spoken answer (transcribed):
"{transcript}"

Grade the answer. Produce a JSON object:
{{
  "label": "<correct|partial|incorrect>",
  "confidence": <0.0-1.0>,
  "missing_points": ["<point the student missed>"],
  "suggestion": "<1-2 sentence supportive feedback with what to add or correct>"
}}

Rules:
- "correct" = covers all or nearly all key points.
- "partial" = covers some key points but misses important ones.
- "incorrect" = fundamentally wrong or misses the main idea.
- Be supportive and specific in the suggestion.
- If the student is mostly right but used different wording, that's still correct.
- missing_points should only list genuinely missing concepts, not phrasing differences.
"""


@router.post("/grade", response_model=GradeRecallResponse)
async def grade_recall(payload: GradeRecallRequest):
    key_points_str = "\n".join(f"- {kp}" for kp in payload.expected_key_points)

    response = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": GRADING_SYSTEM},
            {"role": "user", "content": GRADING_USER_TEMPLATE.format(
                question=payload.question,
                key_points=key_points_str,
                transcript=payload.transcript[:2000],
            )},
        ],
        temperature=0.2,
    )

    result = json.loads(response.choices[0].message.content)
    return GradeRecallResponse(
        label=result.get("label", "incorrect"),
        confidence=result.get("confidence", 0.5),
        missing_points=result.get("missing_points", []),
        suggestion=result.get("suggestion", ""),
    )
