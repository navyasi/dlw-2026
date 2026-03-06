"""
End-to-end demo of the Learning State Engine.
Run: python demo_learning_model.py

Simulates a student going through quizzes in "computer_security",
then shows mastery state, priority ranking, predicted scores, and AI insight.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model import MasteryEngine
from bridge import (
    build_knowledge_graph,
    load_exam_weights,
    load_session_events,
    session_event_to_quiz_responses,
)

# ------------------------------------------------------------------
# 1. Load curriculum into knowledge graph
# ------------------------------------------------------------------
kg = build_knowledge_graph()

print("Knowledge graph loaded.")
print(f"Concepts: {kg.get_concepts()}\n")

# ------------------------------------------------------------------
# 2. Initialize engine
# ------------------------------------------------------------------
engine = MasteryEngine(
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    openai_model="gpt-4o-mini",
)

STUDENT = "stu_001"
SUBJECT = "computer_security"

# ------------------------------------------------------------------
# 3. Load quiz responses from session_events.csv
# ------------------------------------------------------------------
all_events = load_session_events()
student_events = [e for e in all_events if e.student_id == STUDENT]
responses = session_event_to_quiz_responses(student_events, subject=SUBJECT)

engine.update_from_quiz(responses)
print(f"Processed {len(responses)} quiz responses (from session_events.csv).\n")

# ------------------------------------------------------------------
# 4. Mastery state
# ------------------------------------------------------------------
state = engine.get_mastery_state(STUDENT, SUBJECT)
print(f"=== Mastery State — {SUBJECT} ===")
print(f"Overall mastery: {state.overall_mastery():.0%}\n")

for cid, cm in sorted(state.concepts.items(), key=lambda x: x[1].p_mastery):
    bar = "█" * int(cm.p_mastery * 10) + "░" * (10 - int(cm.p_mastery * 10))
    print(f"  {cid:35s} [{bar}] {cm.p_mastery:.0%}  stability={cm.stability_index:.2f}")

# ------------------------------------------------------------------
# 5. Causal weakness tracing
# ------------------------------------------------------------------
print("\n=== Causal Weakness Analysis ===")
for concept_id, causes in state.causal_weaknesses.items():
    print(kg.format_causal_explanation(concept_id, causes))

# ------------------------------------------------------------------
# 6. Priority ranking (for scheduler)
# ------------------------------------------------------------------
exam_weights = load_exam_weights()

print("\n=== Priority Ranking (for Chavi's Scheduler) ===")
priorities = engine.get_priority_ranking(STUDENT, SUBJECT, exam_weights, days_until_exam=14)
for i, p in enumerate(priorities, 1):
    print(f"  #{i} {p.concept_id:35s} score={p.score:.3f}  mastery={p.mastery:.0%}  risk={p.forgetting_risk:.0%}")

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
