import json
import re
from openai import OpenAI


TEXT_MODEL = "gpt-4o-mini"

def generate_kinesthetic_plan(client: OpenAI, pdf_text: str) -> dict:
    system = (
        "You are an expert teacher creating a kinesthetic learning module.\n"
        "Return ONLY valid JSON. No markdown. No explanation.\n\n"
        "STRICT REQUIREMENTS:\n"
        "- Exactly 5 hands-on activities with HIGHLY DETAILED step-by-step instructions\n"
        "- Exactly 5 MCQ questions\n"
        "- Exactly 5 Short answer questions\n"
        "- Each MCQ must have exactly 4 options\n"
        "- Each question must have a unique ID\n"
        "- Each activity must have a unique ID\n\n"
        "ACTIVITY DETAIL REQUIREMENTS (CRITICAL):\n"
        "- step_by_step: MINIMUM 8 steps per activity. Each step must be 3-5 sentences long.\n"
        "  Each step must include: WHAT to do, HOW to do it (exact commands/actions), and WHY it matters.\n"
        "  Steps must be written as if guiding a complete beginner — no assumptions about prior knowledge.\n"
        "  Include exact terminal commands, expected outputs, and what to look for.\n"
        "- objective: Write as a full paragraph (4-6 sentences). Explain what the student will do,\n"
        "  what concept they will observe, and what they should understand by the end.\n"
        "- setup: Write as a full paragraph (3-5 sentences). Describe the environment, prerequisites,\n"
        "  and any configuration needed before starting.\n"
        "- expected_observations: At least 4 items. Each must be 2-3 sentences describing exactly\n"
        "  what the student should see, hear, or measure at that stage.\n"
        "- common_mistakes: At least 4 items. Each must describe the mistake AND how to fix it.\n"
        "- time_breakdown: List each phase with an estimated time (e.g. 'Setup (5 min): ...').\n\n"
        "JSON OUTPUT STRUCTURE (follow exactly):\n"
        "{\n"
        "  \"title\": str,\n"
        "  \"topics\": [\n"
        "    {\"topic_id\": str, \"topic_name\": str, \"exam_weightage\": float}\n"
        "  ],\n"
        "  \"activities\": [\n"
        "    {\n"
        "      \"id\": str,\n"
        "      \"topic_id\": str,\n"
        "      \"name\": str,\n"
        "      \"concept\": str,\n"
        "      \"objective\": str,\n"
        "      \"setup\": str,\n"
        "      \"materials\": [str],\n"
        "      \"step_by_step\": [str],\n"
        "      \"time_breakdown\": [str],\n"
        "      \"expected_observations\": [str],\n"
        "      \"common_mistakes\": [str],\n"
        "      \"self_check\": [str],\n"
        "      \"success_criteria\": [str],\n"
        "      \"difficulty\": \"easy\"|\"medium\"|\"hard\",\n"
        "      \"estimated_minutes\": int\n"
        "    }\n"
        "  ],\n"
        "  \"quiz\": {\n"
        "    \"mcq\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"topic_id\": str,\n"
        "        \"type\": \"mcq\",\n"
        "        \"question\": str,\n"
        "        \"options\": [str, str, str, str],\n"
        "        \"answer\": str,\n"
        "        \"explanation\": str\n"
        "      }\n"
        "    ],\n"
        "    \"short\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"topic_id\": str,\n"
        "        \"type\": \"short\",\n"
        "        \"question\": str,\n"
        "        \"answer\": str,\n"
        "        \"key_points\": [str]\n"
        "      }\n"
        "    ]\n"
        "  }\n"
        "}\n"
    )

    user = (
        "Create a kinesthetic learning plan and quiz based strictly on these notes.\n\n"
        "ACTIVITY INSTRUCTIONS:\n"
        "- Each activity must have AT LEAST 8 step_by_step entries.\n"
        "- Every step must be 3-5 sentences: explain what to do, the exact command or action,\n"
        "  and what the student should observe or verify before moving on.\n"
        "- Include real terminal commands, expected output snippets, and error-checking steps.\n"
        "- Write objective and setup as full paragraphs (minimum 4 sentences each).\n"
        "- Assume the student has never done this before — be explicit and leave nothing implicit.\n"
        "- common_mistakes must explain both the mistake and its fix.\n"
        "- expected_observations must describe exactly what the student will see at each stage.\n\n"
        f"NOTES:\n{pdf_text}"
)

    resp = client.responses.create(
        model=TEXT_MODEL,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    # The model returns raw JSON text
    return json.loads(resp.output_text)



def compute_topic_mastery(plan: dict, quiz_answers: dict) -> dict:
    """
    Returns topic_mastery in [0,1] using per-topic quiz accuracy.
    MCQ exact match; Short answer uses substring match (you can replace with LLM grading later).
    """
    quiz = plan.get("quiz", {})
    mcq = quiz.get("mcq", []) or []
    short = quiz.get("short", []) or []

    topic_correct = {}
    topic_total = {}

    def add_result(topic_id: str, correct: bool):
        topic_total[topic_id] = topic_total.get(topic_id, 0) + 1
        topic_correct[topic_id] = topic_correct.get(topic_id, 0) + (1 if correct else 0)

    # MCQ
    for q in mcq:
        tid = q.get("topic_id", "unknown")
        user_ans = (quiz_answers.get(q["id"]) or "").strip().lower()
        gold = (q.get("answer") or "").strip().lower()
        add_result(tid, user_ans == gold)

    # Short answer (simple)
    for q in short:
        tid = q.get("topic_id", "unknown")
        user_ans = (quiz_answers.get(q["id"]) or "").strip().lower()
        gold = (q.get("answer") or "").strip().lower()
        # very simple check; replace with rubric/LLM later
        add_result(tid, gold != "" and gold in user_ans)

    topic_mastery = {}
    for tid, tot in topic_total.items():
        acc = topic_correct.get(tid, 0) / max(1, tot)
        topic_mastery[tid] = round(float(acc), 3)

    return topic_mastery
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