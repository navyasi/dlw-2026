"""
End-to-end demo of the Scheduler Module (Person 3 — Chavi).
Run: python demo_scheduler.py

Builds on top of the Learning State Engine (Person 1 — Yajie) to produce:
  1. A 14-day adaptive study plan
  2. Today's Pomodoro-structured schedule
  3. Cognitive load stats from a simulated study session
  4. Lock-in accountability status with warning
  5. Predicted exam scores (current pace vs recommended plan)
"""

import json
import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model import KnowledgeGraph, MasteryEngine, QuizResponse
from scheduler import (
    AvailabilityWindow,
    CognitiveLoadTracker,
    SessionEvent,
    TimetableEngine,
)

# ──────────────────────────────────────────────────────────────────────
# 1. Load curriculum → knowledge graph
# ──────────────────────────────────────────────────────────────────────
with open("data/sample_curriculum.json") as f:
    curricula = json.load(f)

kg = KnowledgeGraph()
for curriculum in curricula:
    kg.load_curriculum(curriculum)

print("=" * 60)
print("SCHEDULER DEMO — Adaptive Timetable Engine")
print("=" * 60)
print(f"\nKnowledge graph loaded.  Concepts: {kg.get_concepts()}\n")

# ──────────────────────────────────────────────────────────────────────
# 2. Initialize MasteryEngine and simulate quiz responses
# ──────────────────────────────────────────────────────────────────────
engine = MasteryEngine(
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    openai_model="gpt-4o-mini",
)

STUDENT = "student_42"
SUBJECT = "deep_learning"

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
    # Calculus: weak root cause for chain_rule
    QuizResponse(STUDENT, "calculus", SUBJECT, correct=False, response_time_seconds=70.0, error_depth=0.7),
    QuizResponse(STUDENT, "calculus", SUBJECT, correct=True,  response_time_seconds=50.0),
]

engine.update_from_quiz(responses)
print(f"Processed {len(responses)} quiz responses.\n")

# ──────────────────────────────────────────────────────────────────────
# 3. Build TimetableEngine and generate 14-day plan
# ──────────────────────────────────────────────────────────────────────
timetable = TimetableEngine(
    mastery_engine=engine,
    knowledge_graph=kg,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
)

exam_weights = {
    "linear_algebra":   0.15,
    "calculus":         0.10,
    "chain_rule":       0.20,
    "gradient_descent": 0.15,
    "backprop":         0.25,
    "cnn":              0.10,
    "transformers":     0.05,
}

exam_date = date.today() + timedelta(days=14)

# Student is available Mon–Fri 3 h, weekends 4 h
availability = [
    AvailabilityWindow(day_of_week=0, available_hours=3.0),  # Mon
    AvailabilityWindow(day_of_week=1, available_hours=3.0),  # Tue
    AvailabilityWindow(day_of_week=2, available_hours=3.0),  # Wed
    AvailabilityWindow(day_of_week=3, available_hours=3.0),  # Thu
    AvailabilityWindow(day_of_week=4, available_hours=2.5),  # Fri
    AvailabilityWindow(day_of_week=5, available_hours=4.0),  # Sat
    AvailabilityWindow(day_of_week=6, available_hours=4.0),  # Sun
]

plan = timetable.generate_plan(
    student_id=STUDENT,
    subjects=[SUBJECT],
    exam_weights_by_subject={SUBJECT: exam_weights},
    exam_date=exam_date,
    availability=availability,
)

print(f"=== 14-Day Study Plan  (exam: {exam_date}) ===")
print(f"Days with study sessions: {len(plan.days)}\n")

for sched in plan.days:
    work_blocks = [b for b in sched.blocks if b.block_type in ("work", "review")]
    n_breaks = len([b for b in sched.blocks if "break" in b.block_type])
    concepts = ", ".join(cid for b in work_blocks for cid in b.concept_ids)
    print(
        f"  {sched.date}  ({sched.date.strftime('%a')})  "
        f"{sched.total_study_minutes} min  |  {len(work_blocks)} blocks  |  {n_breaks} breaks"
    )
    if concepts:
        print(f"    Concepts: {concepts}")

# ──────────────────────────────────────────────────────────────────────
# 4. Print today's Pomodoro schedule with clock times
# ──────────────────────────────────────────────────────────────────────
today_schedule = timetable.get_todays_schedule(STUDENT, plan)

print(f"\n=== Today's Pomodoro Schedule  ({today_schedule.date}) ===")
BLOCK_ICONS = {
    "work":        "🔵",
    "review":      "🟡",
    "short_break": "🟢",
    "long_break":  "🔴",
}
BLOCK_LABELS = {
    "work":        "WORK",
    "review":      "REVIEW",
    "short_break": "SHORT BREAK",
    "long_break":  "LONG BREAK",
}

clock = datetime.combine(today_schedule.date, datetime.min.time()).replace(hour=9)
for block in today_schedule.blocks:
    start_str = clock.strftime("%H:%M")
    end_clock = clock + timedelta(minutes=block.duration_minutes)
    end_str = end_clock.strftime("%H:%M")
    icon = BLOCK_ICONS.get(block.block_type, "⬜")
    label = BLOCK_LABELS.get(block.block_type, block.block_type.upper())
    concepts_str = (
        ", ".join(block.concept_ids) if block.concept_ids else "—"
    )
    if block.block_type in ("work", "review"):
        print(
            f"  {icon} {start_str}–{end_str}  [{label:11s}] "
            f"{concepts_str}  "
            f"(priority={block.priority_score:.3f}, diff={block.difficulty:.2f})"
        )
    else:
        print(f"  {icon} {start_str}–{end_str}  [{label}]")
    clock = end_clock

# ──────────────────────────────────────────────────────────────────────
# 5. Simulate a cognitive load session → burnout detection
# ──────────────────────────────────────────────────────────────────────
print(f"\n=== Cognitive Load Simulation ===")

tracker = CognitiveLoadTracker(student_id=STUDENT)

# Simulate a session: first half decent, second half fatigued
base_time = datetime.now()
session_events = [
    # First half — reasonable performance
    SessionEvent(STUDENT, "chain_rule",      SUBJECT, correct=True,  response_time_seconds=28.0,
                 timestamp=base_time + timedelta(minutes=0)),
    SessionEvent(STUDENT, "chain_rule",      SUBJECT, correct=True,  response_time_seconds=32.0,
                 timestamp=base_time + timedelta(minutes=3)),
    SessionEvent(STUDENT, "calculus",        SUBJECT, correct=True,  response_time_seconds=25.0,
                 timestamp=base_time + timedelta(minutes=6)),
    SessionEvent(STUDENT, "calculus",        SUBJECT, correct=False, response_time_seconds=40.0,
                 timestamp=base_time + timedelta(minutes=9)),
    # Second half — accuracy drops, response time climbs (fatigue)
    SessionEvent(STUDENT, "backprop",        SUBJECT, correct=False, response_time_seconds=65.0,
                 timestamp=base_time + timedelta(minutes=30)),
    SessionEvent(STUDENT, "backprop",        SUBJECT, correct=False, response_time_seconds=72.0,
                 timestamp=base_time + timedelta(minutes=33)),
    SessionEvent(STUDENT, "gradient_descent",SUBJECT, correct=False, response_time_seconds=80.0,
                 timestamp=base_time + timedelta(minutes=36)),
    SessionEvent(STUDENT, "gradient_descent",SUBJECT, correct=False, response_time_seconds=88.0,
                 timestamp=base_time + timedelta(minutes=39)),
]

for ev in session_events:
    tracker.add_event(ev)

stats = tracker.get_stats()
print(f"  Events recorded    : {tracker.event_count}")
print(f"  Session duration   : {(stats.session_end - stats.session_start).seconds // 60} min")
print(f"  Cognitive efficiency : {stats.cognitive_efficiency:.3f}  (1.0 = ideal at 30 s avg)")
print(f"  Accuracy drift     : {stats.accuracy_drift:+.3f}  (negative = declining)")
print(f"  Time drift         : {stats.time_drift:+.1f} s  (positive = slowing)")
print(f"  Burnout detected   : {stats.burnout_detected}")
print(f"  Optimal remaining  : {stats.optimal_remaining_minutes} min")

if tracker.should_take_break():
    break_len = tracker.recommended_break_duration()
    print(f"\n  ⚠️  RECOMMENDATION: Take a {break_len}-minute break now!")
else:
    print(f"\n  ✅ Keep going — no burnout detected.")

# ──────────────────────────────────────────────────────────────────────
# 6. Mark some blocks → lock-in warning
# ──────────────────────────────────────────────────────────────────────
print(f"\n=== Lock-In Enforcement ===")

work_blocks = [b for b in today_schedule.blocks if b.block_type in ("work", "review")]

# Simulate: first 2 blocks complete, then most skipped to trigger warning
# (attempted 80%+ of the day but completed < 50% → lock-in alert)
for i, block in enumerate(work_blocks):
    if i < 2:
        timetable.mark_block_complete(block)
    elif i < int(len(work_blocks) * 0.8):
        timetable.mark_block_skipped(block)

status = timetable.check_lock_in(STUDENT, today_schedule)
print(f"  Completed blocks : {status.completed_blocks}")
print(f"  Skipped blocks   : {status.skipped_blocks}")
print(f"  Completion rate  : {today_schedule.completion_rate:.0%}")
print(f"  Warning triggered: {status.warning_triggered}")
print(f"  Message          : {status.warning_message}")

# ──────────────────────────────────────────────────────────────────────
# 7. Predicted exam scores
# ──────────────────────────────────────────────────────────────────────
print(f"\n=== Predicted Exam Scores ===")
scores = engine.predict_exam_score(STUDENT, SUBJECT, exam_weights)
print(f"  If current pace continues    : {scores['current_pace']}%")
print(f"  If recommended plan followed : {scores['recommended_plan']}%")
gain = scores["recommended_plan"] - scores["current_pace"]
print(f"  Potential gain from plan     : +{gain:.1f}%")

# ──────────────────────────────────────────────────────────────────────
# 8. AI schedule insight (optional)
# ──────────────────────────────────────────────────────────────────────
if os.getenv("OPENAI_API_KEY"):
    print(f"\n=== AI Schedule Insight ===")
    insight = timetable.get_schedule_insight(STUDENT, plan)
    print(insight)
else:
    print("\n[Skipping AI schedule insight — set OPENAI_API_KEY to enable]")

print("\n" + "=" * 60)
print("Demo complete.")
print("=" * 60)
