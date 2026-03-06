# import json
# import re
# from openai import OpenAI


# TEXT_MODEL = "gpt-4o-mini"

# def generate_kinesthetic_plan(client: OpenAI, pdf_text: str) -> dict:
#     system = (
#         "You are an expert teacher creating a kinesthetic learning module.\n"
#         "Return ONLY valid JSON. No markdown. No explanation.\n\n"
#         "STRICT REQUIREMENTS:\n"
#         "- Exactly 5 MCQ questions\n"
#         "- Exactly 5 Short answer questions\n"
#         "- MCQ must have exactly 4 options\n"
#         "- Each question must have unique ID\n"
#         "- Follow the structure exactly\n\n"
#         "Output structure:\n"
#         "{\n"
#         "  \"title\": str,\n"
#         "  \"activities\": [\n"
#         "    {\n"
#         "      \"id\": str,\n"
#         "      \"name\": str,\n"
#         "      \"concept\": str,\n"
#         "      \"steps\": [str],\n"
#         "      \"difficulty\": \"easy\"|\"medium\"|\"hard\",\n"
#         "      \"estimated_minutes\": int\n"
#         "    }\n"
#         "  ],\n"
#         "  \"quiz\": {\n"
#         "    \"mcq\": [\n"
#         "      {\n"
#         "        \"id\": str,\n"
#         "        \"type\": \"mcq\",\n"
#         "        \"question\": str,\n"
#         "        \"options\": [str, str, str, str],\n"
#         "        \"answer\": str\n"
#         "      }\n"
#         "    ],\n"
#         "    \"short\": [\n"
#         "      {\n"
#         "        \"id\": str,\n"
#         "        \"type\": \"short\",\n"
#         "        \"question\": str,\n"
#         "        \"answer\": str\n"
#         "      }\n"
#         "    ]\n"
#         "  }\n"
#         "}\n"
#     )

#     user = (
#         "Create kinesthetic activities and quiz based strictly on these notes:\n\n"
#         f"{pdf_text}"
#     )

#     response = client.responses.create(
#         model=TEXT_MODEL,
#         input=[
#             {"role": "system", "content": system},
#             {"role": "user", "content": user},
#         ],
#     )

#     return json.loads(response.output_text)

# def compute_kms(plan: dict, completed_ids: list, quiz_answers: dict) -> dict:
#     activities = plan.get("activities", [])
#     quiz = plan.get("quiz", {})

#     mcqs = quiz.get("mcq", [])
#     shorts = quiz.get("short", [])

#     # Completion Score
#     completion_score = (len(completed_ids) / max(1, len(activities))) * 100

#     # MCQ Scoring (exact match)
#     correct_mcq = 0
#     for q in mcqs:
#         qid = q["id"]
#         if quiz_answers.get(qid, "").strip().lower() == q["answer"].strip().lower():
#             correct_mcq += 1

#     mcq_score = (correct_mcq / 5) * 100

#     # Short Answer (exact match OR partial logic)
#     correct_short = 0
#     for q in shorts:
#         qid = q["id"]
#         if q["answer"].strip().lower() in quiz_answers.get(qid, "").strip().lower():
#             correct_short += 1

#     short_score = (correct_short / 5) * 100

#     quiz_score = (mcq_score * 0.5) + (short_score * 0.5)

#     kms = 0.4 * completion_score + 0.6 * quiz_score

#     return {
#         "completion_score": round(completion_score, 2),
#         "mcq_score": round(mcq_score, 2),
#         "short_score": round(short_score, 2),
#         "quiz_score": round(quiz_score, 2),
#         "kinesthetic_mastery_score": round(kms, 2),
#     }

# def compute_topic_mastery(plan: dict, quiz_answers: dict) -> dict:
#     """
#     Returns {concept: mastery_score (0-1)} for each concept in the plan's activities.
#     Score is derived from overall quiz accuracy (MCQ + short answer).
#     """
#     activities = plan.get("activities", [])
#     quiz = plan.get("quiz", {})
#     mcqs = quiz.get("mcq", [])
#     shorts = quiz.get("short", [])

#     correct_mcq = sum(
#         1 for q in mcqs
#         if quiz_answers.get(q["id"], "").strip().lower() == q["answer"].strip().lower()
#     )
#     correct_short = sum(
#         1 for q in shorts
#         if q["answer"].strip().lower() in quiz_answers.get(q["id"], "").strip().lower()
#     )

#     total = len(mcqs) + len(shorts)
#     accuracy = (correct_mcq + correct_short) / max(1, total)

#     concepts = list({a["concept"] for a in activities if "concept" in a})
#     return {concept: round(accuracy, 3) for concept in concepts}


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
        "    \"mcq\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"type\": \"mcq\",\n"
        "        \"concept\": str,\n"
        "        \"question\": str,\n"
        "        \"options\": [str, str, str, str],\n"
        "        \"answer\": str\n"
        "      }\n"
        "    ],\n"
        "    \"short\": [\n"
        "      {\n"
        "        \"id\": str,\n"
        "        \"type\": \"short\",\n"
        "        \"concept\": str,\n"
        "        \"question\": str,\n"
        "        \"answer\": str\n"
        "      }\n"
        "    ]\n"
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
import csv
import os


def save_quiz_results_to_csv(plan: dict, quiz_answers: dict, csv_file: str = "quiz_results.csv", student_id: str = "student_1") -> None:
    quiz = plan.get("quiz", {})
    mcqs = quiz.get("mcq", [])
    shorts = quiz.get("short", [])

    file_exists = os.path.isfile(csv_file)

    with open(csv_file, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        if not file_exists:
            writer.writerow([
                "student_id",
                "question_id",
                "question_type",
                "concept",
                "question",
                "student_answer",
                "correct_answer",
                "is_correct"
            ])

        for q in mcqs + shorts:
            qid = q["id"]
            qtype = q["type"]
            concept = q.get("concept", "Unknown")
            question = q["question"]
            correct_answer = q["answer"].strip()
            student_answer = quiz_answers.get(qid, "").strip()

            if qtype == "mcq":
                is_correct = student_answer.lower() == correct_answer.lower()
            else:
                is_correct = correct_answer.lower() in student_answer.lower()

            writer.writerow([
                student_id,
                qid,
                qtype,
                concept,
                question,
                student_answer,
                correct_answer,
                int(is_correct)
            ])


from collections import defaultdict


def read_weakness_from_csv(csv_file: str = "quiz_results.csv", student_id: str = "student_1", weakness_threshold: float = 0.6) -> dict:
    concept_stats = defaultdict(lambda: {"correct": 0, "total": 0})

    with open(csv_file, mode="r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            if row["student_id"] != student_id:
                continue

            concept = row["concept"]
            is_correct = int(row["is_correct"])

            concept_stats[concept]["total"] += 1
            concept_stats[concept]["correct"] += is_correct

    concept_accuracy = {}
    weak_concepts = {}

    for concept, stats in concept_stats.items():
        total = stats["total"]
        correct = stats["correct"]
        accuracy = correct / total if total > 0 else 0.0
        concept_accuracy[concept] = round(accuracy, 3)

        if accuracy < weakness_threshold:
            weak_concepts[concept] = round(accuracy, 3)

    return {
        "concept_accuracy": concept_accuracy,
        "weak_concepts": weak_concepts
    }

def print_student_weaknesses(csv_file: str = "quiz_results.csv", student_id: str = "student_1") -> None:
    results = read_weakness_from_csv(csv_file=csv_file, student_id=student_id)

    print(f"\nConcept Accuracy for {student_id}:")
    for concept, acc in results["concept_accuracy"].items():
        print(f"- {concept}: {acc * 100:.1f}%")

    print(f"\nWeak Concepts for {student_id}:")
    if not results["weak_concepts"]:
        print("No major weaknesses detected.")
    else:
        for concept, acc in results["weak_concepts"].items():
            print(f"- {concept}: {acc * 100:.1f}%")

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

# def compute_topic_mastery(plan: dict, quiz_answers: dict) -> dict:
#     """
#     Returns {concept: mastery_score (0-1)} for each concept in the plan's activities.
#     Score is derived from overall quiz accuracy (MCQ + short answer).
#     """
#     activities = plan.get("activities", [])
#     quiz = plan.get("quiz", {})
#     mcqs = quiz.get("mcq", [])
#     shorts = quiz.get("short", [])

#     correct_mcq = sum(
#         1 for q in mcqs
#         if quiz_answers.get(q["id"], "").strip().lower() == q["answer"].strip().lower()
#     )
#     correct_short = sum(
#         1 for q in shorts
#         if q["answer"].strip().lower() in quiz_answers.get(q["id"], "").strip().lower()
#     )

#     total = len(mcqs) + len(shorts)
#     accuracy = (correct_mcq + correct_short) / max(1, total)

#     concepts = list({a["concept"] for a in activities if "concept" in a})
#     return {concept: round(accuracy, 3) for concept in concepts}
def compute_topic_mastery(plan: dict, quiz_answers: dict) -> dict:
    quiz = plan.get("quiz", {})
    mcqs = quiz.get("mcq", [])
    shorts = quiz.get("short", [])

    concept_stats = {}

    for q in mcqs + shorts:
        raw_concept = normalize_concept_id(q.get("concept", "Unknown"))
        concept = normalize_concept_id(raw_concept)
        concept_stats.setdefault(concept, {"correct": 0, "total": 0})

        student_answer = quiz_answers.get(q["id"], "").strip()
        correct_answer = q["answer"].strip()

        if q["type"] == "mcq":
            is_correct = student_answer.lower() == correct_answer.lower()
        else:
            is_correct = correct_answer.lower() in student_answer.lower()

        concept_stats[concept]["total"] += 1
        if is_correct:
            concept_stats[concept]["correct"] += 1

    return {
        concept: round(stats["correct"] / stats["total"], 3)
        for concept, stats in concept_stats.items()
    }
# def compute_topic_mastery(plan: dict, quiz_answers: dict) -> dict:
#     """
#     Returns {concept: mastery_score (0-1)} based on question-level correctness per concept.
#     """
#     quiz = plan.get("quiz", {})
#     mcqs = quiz.get("mcq", [])
#     shorts = quiz.get("short", [])

#     concept_stats = {}

#     for q in mcqs + shorts:
#         concept = q.get("concept", "Unknown")
#         concept_stats.setdefault(concept, {"correct": 0, "total": 0})

#         student_answer = quiz_answers.get(q["id"], "").strip()
#         correct_answer = q["answer"].strip()

#         if q["type"] == "mcq":
#             is_correct = student_answer.lower() == correct_answer.lower()
#         else:
#             is_correct = correct_answer.lower() in student_answer.lower()

#         concept_stats[concept]["total"] += 1
#         if is_correct:
#             concept_stats[concept]["correct"] += 1

#     return {
#         concept: round(stats["correct"] / stats["total"], 3)
#         for concept, stats in concept_stats.items()
#     }
def normalize_concept_id(concept: str) -> str:
    return (
        concept.strip()
        .lower()
        .replace("&", "and")
        .replace("/", " ")
        .replace("-", " ")
        .replace("  ", " ")
        .replace(" ", "_")
    )
# def normalize_concept_id(concept: str) -> str:
#     return (
#         concept.strip()
#         .lower()
#         .replace("&", "and")
#         .replace("/", " ")
#         .replace("-", " ")
#         .replace("  ", " ")
#         .replace(" ", "_")
#     )
# # Save one quiz attempt
# save_quiz_results_to_csv(plan, quiz_answers, csv_file="quiz_results.csv", student_id="student_1")

# # Print weaknesses
# print_student_weaknesses(csv_file="quiz_results.csv", student_id="student_1")