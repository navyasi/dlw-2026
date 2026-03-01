"""
Scheduler-specific data models.

These dataclasses are consumed by TimetableEngine and CognitiveLoadTracker,
and are exposed to the rest of the team via the scheduler public API.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal


@dataclass
class SessionEvent:
    """A single student interaction event during a study session."""
    student_id: str
    concept_id: str
    subject: str
    correct: bool
    response_time_seconds: float
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class SessionStats:
    """Computed cognitive load metrics for a completed (or in-progress) session."""
    student_id: str
    session_start: datetime
    session_end: datetime
    cognitive_efficiency: float      # accuracy / (avg_response_time_s / 30.0), normalised at 30 s = 1.0
    accuracy_drift: float            # second_half_accuracy - first_half_accuracy (negative = declining)
    time_drift: float                # avg_time_second_half - avg_time_first_half (positive = slowing)
    burnout_detected: bool
    optimal_remaining_minutes: int   # estimated focus time left before burnout threshold


@dataclass
class StudyBlock:
    """A single timetable block — work, break, or review."""
    subject: str
    concept_ids: list[str]
    duration_minutes: int            # 25=work, 5=short break, 15=long break
    block_type: Literal["work", "short_break", "long_break", "review"]
    difficulty: float                # 0-1 (1 = very hard for this student)
    priority_score: float            # from PriorityScore.score
    prereq_coverage: float           # from kg.prerequisite_coverage()
    completed: bool = False
    skipped: bool = False


@dataclass
class DailySchedule:
    """One day's full timetable."""
    student_id: str
    date: date
    blocks: list[StudyBlock]
    total_study_minutes: int
    subjects_covered: list[str]
    completion_rate: float           # completed work blocks / total work blocks


@dataclass
class StudyPlan:
    """Multi-day study plan from today until the exam."""
    student_id: str
    generated_at: datetime
    exam_date: date
    days: list[DailySchedule]
    subjects: list[str]


@dataclass
class AvailabilityWindow:
    """How many hours a student is free on a given day of the week."""
    day_of_week: int                 # 0 = Monday ... 6 = Sunday
    available_hours: float           # e.g. 3.0


@dataclass
class LockInStatus:
    """Enforcement / accountability report for a day's schedule."""
    student_id: str
    date: date
    completed_blocks: int
    skipped_blocks: int
    warning_triggered: bool
    warning_message: str
