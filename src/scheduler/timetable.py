"""
Timetable Engine — Adaptive Study Plan Generator

Consumes MasteryEngine outputs to build a personalised multi-day study plan
with Pomodoro structure, difficulty sequencing, and lock-in enforcement.

Algorithm overview (per day):
  1. Get priority_ranking across all subjects from MasteryEngine
  2. Filter out concepts where prerequisite_coverage < 0.4 (not ready)
  3. Sequence: WARM-UP (1 pomodoro, lowest priority) → HARD (top 60%) → REVIEW (bottom 40%)
  4. Wrap all work blocks in Pomodoro structure:
       25 min work → 5 min short break → repeat 4× → 15 min long break
  5. For high-forgetting-risk concepts (risk > 0.7): force review even if mastery > threshold

Lock-in enforcement:
  - completion_rate = completed_work_blocks / total_work_blocks
  - Warning triggered if rate < 0.5 AND ≥ 70% of blocks have been attempted
"""

import os
from datetime import date, datetime, timedelta
from typing import Optional

from openai import OpenAI

# These imports resolve at runtime when `src/` is on sys.path
# (as set up by demo_scheduler.py, analogous to demo_learning_model.py)
from learning_model.forgetting import compute_forgetting_risks
from learning_model.knowledge_graph import KnowledgeGraph
from learning_model.mastery_engine import MasteryEngine

from .models import (
    AvailabilityWindow,
    DailySchedule,
    LockInStatus,
    StudyBlock,
    StudyPlan,
)

# Prereq coverage threshold: below this, a concept is "not ready" to study
PREREQ_COVERAGE_THRESHOLD = 0.4

# Forgetting risk threshold: above this, force a review block even if mastery is high
HIGH_FORGETTING_RISK = 0.7

# Fraction of daily hard-block time vs review time
HARD_TIME_FRACTION = 0.60
REVIEW_TIME_FRACTION = 0.40

# Pomodoro constants (minutes)
POMODORO_WORK = 25
POMODORO_SHORT_BREAK = 5
POMODORO_LONG_BREAK = 15
POMODOROS_BEFORE_LONG_BREAK = 4


class TimetableEngine:
    """
    Builds adaptive study plans and enforces daily accountability.

    Usage:
        engine = TimetableEngine(mastery_engine=me, knowledge_graph=kg)
        plan = engine.generate_plan(student_id, subjects, exam_weights, exam_date, availability)
        today = engine.get_todays_schedule(student_id, plan)
        status = engine.check_lock_in(student_id, today)
    """

    def __init__(
        self,
        mastery_engine: MasteryEngine,
        knowledge_graph: KnowledgeGraph,
        openai_api_key: Optional[str] = None,
    ) -> None:
        self._engine = mastery_engine
        self._kg = knowledge_graph
        self._openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self._client: Optional[OpenAI] = None  # lazy-initialised

    # ------------------------------------------------------------------
    # Plan generation
    # ------------------------------------------------------------------

    def generate_plan(
        self,
        student_id: str,
        subjects: list[str],
        exam_weights_by_subject: dict[str, dict[str, float]],
        exam_date: date,
        availability: list[AvailabilityWindow],
    ) -> StudyPlan:
        """
        Build a full multi-day study plan from today until exam_date.

        Parameters
        ----------
        student_id : str
        subjects : list of subject names
        exam_weights_by_subject : {subject: {concept_id: weight}}
        exam_date : the exam date (exclusive — plan covers days before it)
        availability : per-day-of-week available hours
        """
        today = date.today()
        days_until_exam = (exam_date - today).days
        if days_until_exam <= 0:
            return StudyPlan(
                student_id=student_id,
                generated_at=datetime.now(),
                exam_date=exam_date,
                days=[],
                subjects=subjects,
            )

        avail_map = {w.day_of_week: w.available_hours for w in availability}
        daily_schedules: list[DailySchedule] = []

        for day_offset in range(days_until_exam):
            current_date = today + timedelta(days=day_offset)
            avail_hours = avail_map.get(current_date.weekday(), 0.0)
            if avail_hours <= 0:
                continue

            available_minutes = avail_hours * 60.0
            remaining_days = max(1, days_until_exam - day_offset)

            schedule = self._build_daily_schedule(
                student_id=student_id,
                subjects=subjects,
                exam_weights_by_subject=exam_weights_by_subject,
                current_date=current_date,
                available_minutes=available_minutes,
                remaining_days=remaining_days,
            )
            daily_schedules.append(schedule)

        return StudyPlan(
            student_id=student_id,
            generated_at=datetime.now(),
            exam_date=exam_date,
            days=daily_schedules,
            subjects=subjects,
        )

    def _build_daily_schedule(
        self,
        student_id: str,
        subjects: list[str],
        exam_weights_by_subject: dict[str, dict[str, float]],
        current_date: date,
        available_minutes: float,
        remaining_days: int,
    ) -> DailySchedule:
        """Build one day's DailySchedule."""

        # Fetch mastery states and priority rankings for all subjects
        mastery_states = {
            s: self._engine.get_mastery_state(student_id, s) for s in subjects
        }
        all_priorities = []
        for s in subjects:
            weights = exam_weights_by_subject.get(s, {})
            priorities = self._engine.get_priority_ranking(
                student_id, s, weights, remaining_days
            )
            all_priorities.extend(priorities)

        # Compute forgetting risks across all subjects
        forgetting_risks: dict[str, float] = {}
        for s in subjects:
            risks = compute_forgetting_risks(mastery_states[s], remaining_days)
            forgetting_risks.update(risks)

        # Filter by prerequisite coverage
        eligible: list[tuple] = []  # list of (PriorityScore, coverage)
        for p in all_priorities:
            state = mastery_states[p.subject]
            coverage = self._kg.prerequisite_coverage(p.concept_id, state)
            if coverage >= PREREQ_COVERAGE_THRESHOLD:
                eligible.append((p, coverage))

        if not eligible:
            eligible = [(p, 1.0) for p in all_priorities]

        # Sort descending by priority score
        eligible.sort(key=lambda x: x[0].score, reverse=True)

        # --- Sequence: WARM-UP → HARD → REVIEW ---

        # Warm-up: 1 pomodoro on the lowest-priority non-blocked concept
        warm_up_pair = eligible[-1] if eligible else None
        remaining_pairs = eligible[:-1] if len(eligible) > 1 else []

        # Hard: top 60% of remaining by count
        hard_count = max(1, int(len(remaining_pairs) * HARD_TIME_FRACTION)) if remaining_pairs else 0
        hard_pairs = remaining_pairs[:hard_count]
        review_pairs = list(remaining_pairs[hard_count:])

        # Append high-forgetting-risk concepts to review if not already included
        already_scheduled_ids = {p.concept_id for p, _ in hard_pairs}
        if warm_up_pair:
            already_scheduled_ids.add(warm_up_pair[0].concept_id)
        for p, cov in eligible:
            if (
                forgetting_risks.get(p.concept_id, 0.0) > HIGH_FORGETTING_RISK
                and p.concept_id not in already_scheduled_ids
                and (p, cov) not in review_pairs
            ):
                review_pairs.append((p, cov))

        # --- Time allocation ---
        warm_up_minutes = POMODORO_WORK if warm_up_pair else 0
        time_for_blocks = max(0.0, available_minutes - warm_up_minutes)
        hard_time = time_for_blocks * HARD_TIME_FRACTION
        review_time = time_for_blocks * REVIEW_TIME_FRACTION

        hard_score_total = sum(p.score for p, _ in hard_pairs) or 1.0
        review_score_total = sum(p.score for p, _ in review_pairs) or 1.0

        # --- Build raw concept list ---
        concept_list: list[dict] = []

        if warm_up_pair:
            p, cov = warm_up_pair
            concept_list.append({
                "concept_id": p.concept_id,
                "subject": p.subject,
                "duration": POMODORO_WORK,
                "difficulty": max(0.0, 1.0 - p.mastery),
                "priority": p.score,
                "prereq_coverage": cov,
                "block_type": "work",
            })

        for p, cov in hard_pairs:
            allocated = max(POMODORO_WORK, int((p.score / hard_score_total) * hard_time))
            concept_list.append({
                "concept_id": p.concept_id,
                "subject": p.subject,
                "duration": allocated,
                "difficulty": max(0.0, 1.0 - p.mastery),
                "priority": p.score,
                "prereq_coverage": cov,
                "block_type": "work",
            })

        for p, cov in review_pairs:
            allocated = max(POMODORO_WORK, int((p.score / review_score_total) * review_time))
            concept_list.append({
                "concept_id": p.concept_id,
                "subject": p.subject,
                "duration": allocated,
                "difficulty": max(0.0, 1.0 - p.mastery),
                "priority": p.score,
                "prereq_coverage": cov,
                "block_type": "review",
            })

        # --- Wrap in Pomodoro structure ---
        blocks = self._wrap_pomodoro(concept_list)
        total_study = sum(
            b.duration_minutes for b in blocks if b.block_type in ("work", "review")
        )
        subjects_covered = list({b.subject for b in blocks if b.subject})

        return DailySchedule(
            student_id=student_id,
            date=current_date,
            blocks=blocks,
            total_study_minutes=total_study,
            subjects_covered=subjects_covered,
            completion_rate=0.0,
        )

    def _wrap_pomodoro(self, concept_list: list[dict]) -> list[StudyBlock]:
        """
        Convert a flat list of concept descriptors into Pomodoro-structured StudyBlocks.

        Rules:
          - Work block = 25 min per pomodoro
          - Concepts needing >25 min are split across multiple pomodoros
          - After each pomodoro (except the last): 5 min short break
          - After every 4 pomodoros: 15 min long break (replaces the short break)
        """
        # Expand concepts into 25-min (or shorter final) pomodoro chunks
        chunks: list[dict] = []
        for item in concept_list:
            remaining = item["duration"]
            while remaining > 0:
                chunk_duration = min(POMODORO_WORK, remaining)
                chunks.append({**item, "duration": chunk_duration})
                remaining -= chunk_duration

        blocks: list[StudyBlock] = []
        pomodoro_count = 0

        for i, chunk in enumerate(chunks):
            blocks.append(StudyBlock(
                subject=chunk["subject"],
                concept_ids=[chunk["concept_id"]],
                duration_minutes=chunk["duration"],
                block_type=chunk["block_type"],
                difficulty=chunk["difficulty"],
                priority_score=chunk["priority"],
                prereq_coverage=chunk["prereq_coverage"],
            ))
            pomodoro_count += 1

            # Insert break after every work block except the last
            if i < len(chunks) - 1:
                if pomodoro_count % POMODOROS_BEFORE_LONG_BREAK == 0:
                    blocks.append(StudyBlock(
                        subject="",
                        concept_ids=[],
                        duration_minutes=POMODORO_LONG_BREAK,
                        block_type="long_break",
                        difficulty=0.0,
                        priority_score=0.0,
                        prereq_coverage=1.0,
                    ))
                else:
                    blocks.append(StudyBlock(
                        subject="",
                        concept_ids=[],
                        duration_minutes=POMODORO_SHORT_BREAK,
                        block_type="short_break",
                        difficulty=0.0,
                        priority_score=0.0,
                        prereq_coverage=1.0,
                    ))

        return blocks

    # ------------------------------------------------------------------
    # Schedule access
    # ------------------------------------------------------------------

    def get_todays_schedule(self, student_id: str, plan: StudyPlan) -> DailySchedule:
        """Return today's DailySchedule from the plan, or an empty schedule if not found."""
        today = date.today()
        for schedule in plan.days:
            if schedule.date == today:
                return schedule
        # Fallback: return first available day
        if plan.days:
            return plan.days[0]
        return DailySchedule(
            student_id=student_id,
            date=today,
            blocks=[],
            total_study_minutes=0,
            subjects_covered=[],
            completion_rate=0.0,
        )

    # ------------------------------------------------------------------
    # Block tracking
    # ------------------------------------------------------------------

    def mark_block_complete(self, block: StudyBlock) -> None:
        block.completed = True

    def mark_block_skipped(self, block: StudyBlock) -> None:
        block.skipped = True

    # ------------------------------------------------------------------
    # Lock-in / enforcement
    # ------------------------------------------------------------------

    def check_lock_in(self, student_id: str, schedule: DailySchedule) -> LockInStatus:
        """
        Compute accountability status for the day.

        Warning triggered if:
          - completion_rate < 0.5  (less than half of work blocks done)
          - AND at least 70% of blocks have been attempted (completed or skipped)
        """
        work_blocks = [b for b in schedule.blocks if b.block_type in ("work", "review")]
        completed = sum(1 for b in work_blocks if b.completed)
        skipped = sum(1 for b in work_blocks if b.skipped)
        total = len(work_blocks)

        completion_rate = completed / total if total > 0 else 1.0
        attempted_rate = (completed + skipped) / total if total > 0 else 0.0

        # Warning: low completion AND enough of the day has been attempted
        warning = completion_rate < 0.5 and attempted_rate >= 0.7

        if warning:
            score_drop = skipped * 2  # rough heuristic: 2% per skipped block
            msg = (
                f"You've skipped {skipped} high-priority block(s). "
                f"Your predicted score may drop by ~{score_drop}%."
            )
        else:
            msg = "On track! Keep up the good work."

        schedule.completion_rate = completion_rate

        return LockInStatus(
            student_id=student_id,
            date=schedule.date,
            completed_blocks=completed,
            skipped_blocks=skipped,
            warning_triggered=warning,
            warning_message=msg,
        )

    # ------------------------------------------------------------------
    # Replan
    # ------------------------------------------------------------------

    def replan(
        self,
        student_id: str,
        plan: StudyPlan,
        exam_weights_by_subject: dict[str, dict[str, float]],
        availability: list[AvailabilityWindow],
    ) -> StudyPlan:
        """
        Regenerate the study plan from today onwards, preserving completed past days.
        Call this after marking blocks complete/skipped to get an updated plan.
        """
        today = date.today()
        new_plan = self.generate_plan(
            student_id=student_id,
            subjects=plan.subjects,
            exam_weights_by_subject=exam_weights_by_subject,
            exam_date=plan.exam_date,
            availability=availability,
        )
        # Keep historical completed days
        completed_days = [d for d in plan.days if d.date < today]
        future_days = [d for d in new_plan.days if d.date >= today]
        new_plan.days = completed_days + future_days
        return new_plan

    # ------------------------------------------------------------------
    # AI schedule insight (optional)
    # ------------------------------------------------------------------

    def get_schedule_insight(self, student_id: str, plan: StudyPlan) -> str:
        """
        Generate a natural-language explanation of the study plan using OpenAI.
        Returns a placeholder string if OPENAI_API_KEY is not set.
        """
        if not self._openai_api_key:
            return "[Schedule insight unavailable — set OPENAI_API_KEY]"

        if self._client is None:
            self._client = OpenAI(api_key=self._openai_api_key)

        total_days = len(plan.days)
        total_work_blocks = sum(
            sum(1 for b in d.blocks if b.block_type in ("work", "review"))
            for d in plan.days
        )
        days_until_exam = (plan.exam_date - date.today()).days

        # Summarise top concepts across the plan
        concept_counts: dict[str, int] = {}
        for d in plan.days:
            for b in d.blocks:
                if b.block_type in ("work", "review"):
                    for cid in b.concept_ids:
                        concept_counts[cid] = concept_counts.get(cid, 0) + 1
        top_concepts = sorted(concept_counts, key=lambda c: -concept_counts[c])[:5]

        prompt = f"""You are a personalised AI study coach embedded in a student learning platform.

Student: {student_id}
Subjects: {', '.join(plan.subjects)}
Days until exam: {days_until_exam}
Study days planned: {total_days}
Total study sessions: {total_work_blocks}
Most-scheduled concepts: {', '.join(top_concepts)}

Give the student a short (3-4 sentences), PRESCRIPTIVE response:
- Explain why these concepts are scheduled most heavily
- Tell them what to focus on this week
- End with one practical tip for staying consistent
"""
        response = self._client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
