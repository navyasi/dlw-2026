"""
demo_integration.py — Full end-to-end integration demo.

Shows the complete study loop:
  1. Student completes kinesthetic activities   (Sia's /generate-kinesthetic + /grade-kinesthetic)
  2. topic_mastery scores fed back into MasteryEngine via bridge  (P1 ← P4)
  3. MasteryEngine outputs mastery state                          (P1)
  4. Bridge converts mastery → Sia's Concept payload              (bridge)
  5. generate_weekly_report() produces analytics + score forecast (P4)
  6. TimetableEngine generates a 7-day Pomodoro schedule          (P3)

Run:
    source .venv/bin/activate
    python demo_integration.py
"""

import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model import MasteryEngine
from scheduler import AvailabilityWindow, TimetableEngine
from bridge import (
    build_knowledge_graph,
    grade_to_quiz_responses,
    load_curriculum_meta,
    load_exam_weights,
    load_topic_mastery,
    mastery_to_concepts_payload,
)
from insights import generate_weekly_report

# ─────────────────────────────────────────────────────────────────────────────
# 0. Setup
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 65)
print("INTEGRATION DEMO — Learning Model + Analytics + Scheduler")
print("=" * 65)

kg = build_knowledge_graph()

engine = MasteryEngine(
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    openai_model="gpt-4o-mini",
)

STUDENT = "stu_001"
SUBJECT = "computer_security"

exam_weights    = load_exam_weights()
curriculum_meta = load_curriculum_meta()

# ─────────────────────────────────────────────────────────────────────────────
# 1. Load Sia's topic mastery from CSV (replaces /grade-kinesthetic output)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 1: Topic mastery scores (loaded from topic_mastery.csv) ──")

topic_mastery_from_sia = load_topic_mastery(STUDENT, SUBJECT)

for concept, score in topic_mastery_from_sia.items():
    bar = "█" * int(score * 20)
    print(f"  {concept:<35} {score:.0%}  {bar}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. Bridge: topic_mastery → QuizResponse → MasteryEngine
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 2: Feeding kinesthetic results into MasteryEngine ──")

quiz_responses = grade_to_quiz_responses(topic_mastery_from_sia, STUDENT, SUBJECT)
engine.update_from_quiz(quiz_responses)
print(f"  Updated mastery engine with {len(quiz_responses)} responses.")

# ─────────────────────────────────────────────────────────────────────────────
# 3. Get updated mastery state (with forgetting decay)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 3: Mastery state after BKT update ──")

mastery_state = engine.get_mastery_state(STUDENT, SUBJECT)
print(f"  Overall mastery: {mastery_state.overall_mastery():.0%}")
print(f"  Concepts tracked: {len(mastery_state.concepts)}")
print()
for cid, cm in sorted(mastery_state.concepts.items(), key=lambda x: x[1].p_mastery):
    bar = "█" * int(cm.p_mastery * 20)
    flag = "  ← WEAK" if cm.p_mastery < 0.5 else ""
    print(f"  {cid:<35} p_mastery={cm.p_mastery:.3f}  {bar}{flag}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. Bridge: MasteryState → Sia's Concept payload → Weekly report
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 4: Generating weekly analytics report (Sia's engine) ──")

concepts_payload = mastery_to_concepts_payload(mastery_state, exam_weights, curriculum_meta)
weekly_report = generate_weekly_report(
    concepts_raw=concepts_payload,
    current_weekly_minutes=240,
)

score_model = weekly_report["predicted_score_model"]
print(f"  Base expected score:      {score_model['base_expected']}%")
print(f"  At current pace (240min): {score_model['simulation_current_pace']['expected_score']}%")
print(f"  With recommended plan:    {score_model['simulation_recommended_plan']['expected_score']}%")

print("\n  Top priority concepts:")
for c in weekly_report["priority_ranking"]["top_concepts"][:5]:
    print(
        f"    {c['concept_name']:<35} "
        f"mastery={c['mastery']:.0%}  "
        f"priority={c['priority_score']:.4f}  "
        f"forgetting_risk={c['forgetting_risk']:.0%}"
    )

print("\n  Prescriptive recommendations:")
for rec in weekly_report["prescriptive_analysis"]["recommendations"][:4]:
    print(f"    [{rec['action_type'].upper():8s}] {rec['concept_name']} — {rec['minutes']} min")
    print(f"             {rec['rationale']}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. Scheduler: generate 7-day Pomodoro study plan
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 5: Generating 7-day study plan (Chavi's scheduler) ──")

timetable = TimetableEngine(
    mastery_engine=engine,
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
)

availability = [
    AvailabilityWindow(day_of_week=0, available_hours=3.0),   # Mon
    AvailabilityWindow(day_of_week=1, available_hours=3.0),   # Tue
    AvailabilityWindow(day_of_week=2, available_hours=3.0),   # Wed
    AvailabilityWindow(day_of_week=3, available_hours=3.0),   # Thu
    AvailabilityWindow(day_of_week=4, available_hours=2.5),   # Fri
    AvailabilityWindow(day_of_week=5, available_hours=4.0),   # Sat
    AvailabilityWindow(day_of_week=6, available_hours=4.0),   # Sun
]

exam_date = date.today() + timedelta(days=14)

plan = timetable.generate_plan(
    student_id=STUDENT,
    subjects=[SUBJECT],
    exam_weights_by_subject={SUBJECT: exam_weights},
    exam_date=exam_date,
    availability=availability,
)

print(f"\n  7-day plan  (exam: {exam_date})")
for sched in plan.days[:7]:
    work_blocks = [b for b in sched.blocks if b.block_type in ("work", "review")]
    concepts = ", ".join(cid for b in work_blocks for cid in b.concept_ids)
    print(
        f"  {sched.date}  ({sched.date.strftime('%a')})  "
        f"{sched.total_study_minutes:3d} min  |  {len(work_blocks)} work blocks"
    )
    if concepts:
        print(f"    Focus: {concepts}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. Today's detailed Pomodoro schedule
# ─────────────────────────────────────────────────────────────────────────────
today_schedule = timetable.get_todays_schedule(STUDENT, plan)
print(f"\n── Step 6: Today's Pomodoro schedule ({today_schedule.date}) ──")

ICONS  = {"work": "🔵", "review": "🟡", "short_break": "🟢", "long_break": "🔴"}
LABELS = {"work": "WORK", "review": "REVIEW", "short_break": "SHORT BREAK", "long_break": "LONG BREAK"}

clock = datetime.combine(today_schedule.date, datetime.min.time()).replace(hour=9)
for block in today_schedule.blocks:
    start = clock.strftime("%H:%M")
    end   = (clock + timedelta(minutes=block.duration_minutes)).strftime("%H:%M")
    icon  = ICONS.get(block.block_type, "⬜")
    label = LABELS.get(block.block_type, block.block_type.upper())
    if block.block_type in ("work", "review"):
        concepts = ", ".join(block.concept_ids) if block.concept_ids else "—"
        print(f"  {icon} {start}–{end}  [{label:11s}] {concepts}")
    else:
        print(f"  {icon} {start}–{end}  [{label}]")
    clock += timedelta(minutes=block.duration_minutes)

# ─────────────────────────────────────────────────────────────────────────────
# 7. Simulate next quiz cycle (loop closes)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Step 7: After one study session — next quiz cycle ──")
print("  (simulating improved scores after studying buffer_overflow & reference_monitor)")

next_quiz_results = {
    "buffer_overflow":      0.62,   # improved from 0.41 → 0.62
    "reference_monitor":    0.55,   # improved from 0.35 → 0.55
    "integer_overflow":     0.51,   # slight improvement
}

new_responses = grade_to_quiz_responses(next_quiz_results, STUDENT, SUBJECT)
engine.update_from_quiz(new_responses)

updated_state = engine.get_mastery_state(STUDENT, SUBJECT)
print(f"  Updated overall mastery: {updated_state.overall_mastery():.0%}  (was {mastery_state.overall_mastery():.0%})")
for cid in ["buffer_overflow", "reference_monitor", "integer_overflow"]:
    if cid in updated_state.concepts:
        print(f"  {cid:<35} new p_mastery = {updated_state.concepts[cid].p_mastery:.3f}")

print("\n" + "=" * 65)
print("Integration demo complete.")
print("=" * 65)
print()
print("API endpoint ready at:  POST /integrated-weekly")
print("Example curl:")
print("""  curl -s -X POST http://localhost:8000/integrated-weekly \\
    -H 'Content-Type: application/json' \\
    -d '{
      "student_id": "stu_001",
      "subject": "computer_security",
      "days_until_exam": 14,
      "current_weekly_minutes": 240
    }' | python -m json.tool""")
