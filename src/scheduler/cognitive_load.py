"""
Cognitive Load Tracker

Tracks study session events and computes efficiency metrics based on:
  - Accuracy drift between first and second halves of a session
  - Response time drift (positive = slowing down)
  - Burnout detection using the above signals

Burnout thresholds (from spec):
  - accuracy_drift < -0.20  (accuracy dropped more than 20 pp in the second half)
  - OR time_drift > 0.50 * first_half_avg_time  (responses 50%+ slower in second half)

Cognitive efficiency formula:
  CogEff = accuracy / (avg_response_time_seconds / 30.0)
  (normalised so that 30 s avg response time at full accuracy = 1.0)
"""

from datetime import datetime

from .models import SessionEvent, SessionStats


class CognitiveLoadTracker:
    """
    Accumulates SessionEvents for one student's study session and
    computes burnout / efficiency metrics on demand.

    Usage:
        tracker = CognitiveLoadTracker("student_42")
        tracker.add_event(event)
        stats = tracker.get_stats()
        if tracker.should_take_break():
            minutes = tracker.recommended_break_duration()
    """

    def __init__(self, student_id: str) -> None:
        self.student_id = student_id
        self._events: list[SessionEvent] = []

    # ------------------------------------------------------------------
    # Event ingestion
    # ------------------------------------------------------------------

    def add_event(self, event: SessionEvent) -> None:
        """Record one interaction event from a study session."""
        self._events.append(event)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self) -> SessionStats:
        """
        Compute and return cognitive load metrics for the current session.
        Returns a SessionStats with all zeroes / False if fewer than 2 events.
        """
        events = self._events
        now = datetime.now()

        if not events:
            return SessionStats(
                student_id=self.student_id,
                session_start=now,
                session_end=now,
                cognitive_efficiency=0.0,
                accuracy_drift=0.0,
                time_drift=0.0,
                burnout_detected=False,
                optimal_remaining_minutes=25,
            )

        session_start = min(e.timestamp for e in events)
        session_end = max(e.timestamp for e in events)

        # Split into first and second halves
        mid = max(1, len(events) // 2)
        first_half = events[:mid]
        second_half = events[mid:] if len(events) > mid else events

        def _accuracy(evts: list[SessionEvent]) -> float:
            return sum(1 for e in evts if e.correct) / len(evts)

        def _avg_time(evts: list[SessionEvent]) -> float:
            return sum(e.response_time_seconds for e in evts) / len(evts)

        acc_first = _accuracy(first_half)
        acc_second = _accuracy(second_half)
        time_first = _avg_time(first_half)
        time_second = _avg_time(second_half)

        accuracy_drift = acc_second - acc_first         # negative = declining
        time_drift = time_second - time_first           # positive = slowing

        # Burnout: significant accuracy drop OR significant slowdown
        burnout = (accuracy_drift < -0.20) or (
            time_first > 0 and time_drift > 0.50 * time_first
        )

        # Overall cognitive efficiency
        overall_accuracy = _accuracy(events)
        overall_avg_time = _avg_time(events)
        # Avoid division by zero; 30 s is the "baseline" response time
        cog_eff = (
            overall_accuracy / (overall_avg_time / 30.0)
            if overall_avg_time > 0
            else 0.0
        )

        # Optimal remaining minutes: estimate from Pomodoro position
        elapsed_minutes = (session_end - session_start).total_seconds() / 60.0
        if burnout:
            optimal_remaining = 0
        else:
            pomodoro_position = elapsed_minutes % 25.0
            optimal_remaining = max(0, int(25.0 - pomodoro_position))

        return SessionStats(
            student_id=self.student_id,
            session_start=session_start,
            session_end=session_end,
            cognitive_efficiency=round(cog_eff, 3),
            accuracy_drift=round(accuracy_drift, 3),
            time_drift=round(time_drift, 3),
            burnout_detected=burnout,
            optimal_remaining_minutes=optimal_remaining,
        )

    # ------------------------------------------------------------------
    # Break recommendations
    # ------------------------------------------------------------------

    def should_take_break(self) -> bool:
        """Return True if the session data indicates burnout is approaching."""
        if len(self._events) < 2:
            return False
        return self.get_stats().burnout_detected

    def recommended_break_duration(self) -> int:
        """
        Return recommended break length in minutes.
        - 15 min (long break) if 4+ pomodoros have elapsed
        - 5 min (short break) otherwise
        """
        if not self._events:
            return 5
        session_start = min(e.timestamp for e in self._events)
        session_end = max(e.timestamp for e in self._events)
        elapsed_minutes = (session_end - session_start).total_seconds() / 60.0
        pomodoros_done = int(elapsed_minutes / 25)
        return 15 if pomodoros_done >= 4 else 5

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Clear all events (start a new session)."""
        self._events.clear()

    @property
    def event_count(self) -> int:
        return len(self._events)
