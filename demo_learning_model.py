"""
End-to-end demo of the Learning State Engine.
Run: python demo_learning_model.py

Simulates a student going through quizzes in "deep_learning",
then shows mastery state, priority ranking, predicted scores, and AI insight.
"""

import json
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model import KnowledgeGraph, MasteryEngine, QuizResponse

# ------------------------------------------------------------------
# 1. Load curriculum into knowledge graph
# ------------------------------------------------------------------
with open("data/sample_curriculum.json") as f:
    curricula = json.load(f)

kg = KnowledgeGraph()
for curriculum in curricula:
    kg.load_curriculum(curriculum)

print("Knowledge graph loaded.")
print(f"Concepts: {kg.get_concepts()}\n")

# ------------------------------------------------------------------
# 2. Initialize engine
# ------------------------------------------------------------------
engine = MasteryEngine(
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),  # set in .env or environment
    openai_model="gpt-4o-mini",
)

STUDENT = "student_42"
SUBJECT = "deep_learning"

# ------------------------------------------------------------------
# 3. Simulate quiz responses (some correct, some wrong)
# ------------------------------------------------------------------
responses = [
    # Strong on linear algebra
    QuizResponse(STUDENT, "linear_algebra", SUBJECT, correct=True,  response_time_seconds=12.0),
    QuizResponse(STUDENT, "linear_algebra", SUBJECT, correct=True,  response_time_seconds=10.0),
    QuizResponse(STUDENT, "linear_algebra", SUBJECT, correct=True,  response_time_seconds=11.0),
    # Weak on chain_rule
    QuizResponse(STUDENT, "chain_rule", SUBJECT, correct=False, response_time_seconds=55.0, error_depth=0.8),
    QuizResponse(STUDENT, "chain_rule", SUBJECT, correct=False, response_time_seconds=62.0, error_depth=0.9),
    # Weak on backprop (downstream of chain_rule)
    QuizResponse(STUDENT, "backprop", SUBJECT, correct=False, response_time_seconds=90.0, error_depth=0.9),
    QuizResponse(STUDENT, "backprop", SUBJECT, correct=False, response_time_seconds=85.0, error_depth=0.8),
    # Moderate on gradient_descent
    QuizResponse(STUDENT, "gradient_descent", SUBJECT, correct=True,  response_time_seconds=30.0),
    QuizResponse(STUDENT, "gradient_descent", SUBJECT, correct=False, response_time_seconds=45.0, error_depth=0.4),
    # Calculus: also weak (root cause for chain_rule)
    QuizResponse(STUDENT, "calculus", SUBJECT, correct=False, response_time_seconds=70.0, error_depth=0.7),
    QuizResponse(STUDENT, "calculus", SUBJECT, correct=True,  response_time_seconds=50.0),
]

engine.update_from_quiz(responses)
print(f"Processed {len(responses)} quiz responses.\n")

# ------------------------------------------------------------------
# 4. Mastery state
# ------------------------------------------------------------------
state = engine.get_mastery_state(STUDENT, SUBJECT)
print(f"=== Mastery State — {SUBJECT} ===")
print(f"Overall mastery: {state.overall_mastery():.0%}\n")

for cid, cm in sorted(state.concepts.items(), key=lambda x: x[1].p_mastery):
    bar = "█" * int(cm.p_mastery * 10) + "░" * (10 - int(cm.p_mastery * 10))
    print(f"  {cid:20s} [{bar}] {cm.p_mastery:.0%}  stability={cm.stability_index:.2f}")

# ------------------------------------------------------------------
# 5. Causal weakness tracing
# ------------------------------------------------------------------
print("\n=== Causal Weakness Analysis ===")
for concept_id, causes in state.causal_weaknesses.items():
    print(kg.format_causal_explanation(concept_id, causes))

# ------------------------------------------------------------------
# 6. Priority ranking (for scheduler)
# ------------------------------------------------------------------
exam_weights = {
    "linear_algebra":  0.15,
    "calculus":        0.10,
    "chain_rule":      0.20,
    "gradient_descent":0.15,
    "backprop":        0.25,
    "cnn":             0.10,
    "transformers":    0.05,
}

print("\n=== Priority Ranking (for Chavi's Scheduler) ===")
priorities = engine.get_priority_ranking(STUDENT, SUBJECT, exam_weights, days_until_exam=14)
for i, p in enumerate(priorities, 1):
    print(f"  #{i} {p.concept_id:20s} score={p.score:.3f}  mastery={p.mastery:.0%}  risk={p.forgetting_risk:.0%}")

# ------------------------------------------------------------------
# 7. Predicted exam scores
# ------------------------------------------------------------------
print("\n=== Predicted Exam Scores ===")
scores = engine.predict_exam_score(STUDENT, SUBJECT, exam_weights)
print(f"  If current pace continues:    {scores['current_pace']}%")
print(f"  If recommended plan followed: {scores['recommended_plan']}%")

# ------------------------------------------------------------------
# 8. AI insight (requires OPENAI_API_KEY)
# ------------------------------------------------------------------
if os.getenv("OPENAI_API_KEY"):
    print("\n=== AI Insight ===")
    insight = engine.get_insight(STUDENT, SUBJECT, exam_weights, days_until_exam=14)
    print(insight)
else:
    print("\n[Skipping AI insight — set OPENAI_API_KEY to enable]")
