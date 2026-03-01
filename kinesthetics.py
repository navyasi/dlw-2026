import json
import re
from openai import OpenAI


TEXT_MODEL = "gpt-4o-mini"


def generate_kinesthetic_plan(client: OpenAI, pdf_text: str) -> dict:
    system = (
        "You are an expert teacher creating a kinesthetic learning module.\n"
        "Return ONLY valid JSON. No markdown. No explanation.\n\n"
        "STRICT REQUIREMENTS:\n"
        "- Exactly 5 MCQ questions\n"
        "- Exactly 5 Short answer questions\n"
        "- MCQ must have exactly 4 options\n"
        "- Each question must have unique ID\n"
        "- Follow the structure exactly\n\n"
        "Output structure:\n"
        "{\n"
        "  \"title\": str,\n"
        "  \"activities\": [\n"
        "    {\n"
        "      \"id\": str,\n"
        "      \"name\": str,\n"
        "      \"concept\": str,\n"
        "      \"steps\": [str],\n"
        "      \"difficulty\": \"easy\"|\"medium\"|\"hard\",\n"
        "      \"estimated_minutes\": int\n"
        "    }\n"
        "  ],\n"
        "  \"quiz\": {\n"
        "    \"mcq\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"type\": \"mcq\",\n"
        "        \"question\": str,\n"
        "        \"options\": [str, str, str, str],\n"
        "        \"answer\": str\n"
        "      }\n"
        "    ],\n"
        "    \"short\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"type\": \"short\",\n"
        "        \"question\": str,\n"
        "        \"answer\": str\n"
        "      }\n"
        "    ]\n"
        "  }\n"
        "}\n"
    )

    user = (
        "Create kinesthetic activities and quiz based strictly on these notes:\n\n"
        f"{pdf_text}"
    )

    response = client.responses.create(
        model=TEXT_MODEL,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    return json.loads(response.output_text)

def compute_kms(plan: dict, completed_ids: list, quiz_answers: dict) -> dict:
    activities = plan.get("activities", [])
    quiz = plan.get("quiz", {})

    mcqs = quiz.get("mcq", [])
    shorts = quiz.get("short", [])

    # Completion Score
    completion_score = (len(completed_ids) / max(1, len(activities))) * 100

    # MCQ Scoring (exact match)
    correct_mcq = 0
    for q in mcqs:
        qid = q["id"]
        if quiz_answers.get(qid, "").strip().lower() == q["answer"].strip().lower():
            correct_mcq += 1

    mcq_score = (correct_mcq / 5) * 100

    # Short Answer (exact match OR partial logic)
    correct_short = 0
    for q in shorts:
        qid = q["id"]
        if q["answer"].strip().lower() in quiz_answers.get(qid, "").strip().lower():
            correct_short += 1

    short_score = (correct_short / 5) * 100

    quiz_score = (mcq_score * 0.5) + (short_score * 0.5)

    kms = 0.4 * completion_score + 0.6 * quiz_score

    return {
        "completion_score": round(completion_score, 2),
        "mcq_score": round(mcq_score, 2),
        "short_score": round(short_score, 2),
        "quiz_score": round(quiz_score, 2),
        "kinesthetic_mastery_score": round(kms, 2),
    }