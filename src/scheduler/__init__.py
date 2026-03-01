"""
Scheduler Module — public API.

Import these in your code:
    from scheduler import TimetableEngine, CognitiveLoadTracker
    from scheduler import StudyPlan, DailySchedule, StudyBlock
    from scheduler import SessionEvent, SessionStats, AvailabilityWindow, LockInStatus
"""

from .cognitive_load import CognitiveLoadTracker
from .models import (
    AvailabilityWindow,
    DailySchedule,
    LockInStatus,
    SessionEvent,
    SessionStats,
    StudyBlock,
    StudyPlan,
)
from .timetable import TimetableEngine

__all__ = [
    "TimetableEngine",
    "CognitiveLoadTracker",
    "StudyPlan",
    "DailySchedule",
    "StudyBlock",
    "SessionEvent",
    "SessionStats",
    "AvailabilityWindow",
    "LockInStatus",
]
