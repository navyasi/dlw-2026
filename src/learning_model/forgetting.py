"""
Forgetting Curve & Decay Model

Based on Ebbinghaus's forgetting curve:
    R(t) = e^(-t / S)

Where:
    R = retention (0-1)
    t = time since last review (in days)
    S = stability (how resistant this memory is to forgetting)

The stability S is derived from the concept's Stability Index.
Higher stability → slower decay.

We also implement a daily mastery decay update and compute
"forgetting risk" — the probability that mastery will drop
below a threshold by exam day.
"""

import math
from datetime import datetime

from .models import ConceptMastery, MasteryState


# Stability range: maps stability_index (0-1) → S in days
# stability_index=0.0 → S=1 day (forgets very fast)
# stability_index=1.0 → S=30 days (very robust memory)
MIN_STABILITY_DAYS = 1.0
MAX_STABILITY_DAYS = 30.0


def _stability_days(stability_index: float) -> float:
    """Map stability index (0-1) to Ebbinghaus stability S in days."""
    return MIN_STABILITY_DAYS + stability_index * (MAX_STABILITY_DAYS - MIN_STABILITY_DAYS)


def retention(stability_index: float, days_since_review: float) -> float:
    """
    Ebbinghaus retention after `days_since_review` days.
    Returns value in [0, 1].
    """
    S = _stability_days(stability_index)
    return math.exp(-days_since_review / S)


def apply_decay(mastery: ConceptMastery, now: datetime | None = None) -> ConceptMastery:
    """
    Decay the mastery score based on time since last review.

    If the student hasn't been seen for N days, their mastery
    is multiplied by the retention factor for that period.
    """
    if mastery.last_seen is None:
        return mastery  # Never seen — no decay to apply

    now = now or datetime.now()
    days_elapsed = (now - mastery.last_seen).total_seconds() / 86400.0

    if days_elapsed < 0.1:  # Less than ~2.5 hours — skip decay
        return mastery

    r = retention(mastery.stability_index, days_elapsed)
    mastery.p_mastery = max(0.0, mastery.p_mastery * r)

    # Stability also erodes slightly if not reviewed
    mastery.stability_index = max(0.0, mastery.stability_index * (0.95 ** days_elapsed))

    return mastery


def forgetting_risk(
    mastery: ConceptMastery,
    days_until_exam: float,
    mastery_threshold: float = 0.6,
) -> float:
    """
    Probability that mastery will drop below `mastery_threshold`
    by exam day, given current mastery and stability.

    Returns 0-1 (0 = safe, 1 = certain to drop below threshold).
    """
    if days_until_exam <= 0:
        return 0.0 if mastery.p_mastery >= mastery_threshold else 1.0

    projected = mastery.p_mastery * retention(mastery.stability_index, days_until_exam)
    if projected >= mastery_threshold:
        return 0.0

    # How far below threshold will they be?
    gap = mastery_threshold - projected
    # Normalise: a gap of 0.3 or more = certain risk
    return min(1.0, gap / 0.3)


def apply_daily_decay_to_state(
    state: MasteryState,
    now: datetime | None = None,
) -> MasteryState:
    """Apply decay to all concepts in a MasteryState."""
    for concept_id, concept_mastery in state.concepts.items():
        state.concepts[concept_id] = apply_decay(concept_mastery, now)
    state.last_updated = now or datetime.now()
    return state


def compute_forgetting_risks(
    state: MasteryState,
    days_until_exam: float,
    mastery_threshold: float = 0.6,
) -> dict[str, float]:
    """
    Return {concept_id: forgetting_risk} for all concepts in the state.
    Used by Person 3 (scheduler) and Person 4 (analytics/priority ranking).
    """
    return {
        concept_id: forgetting_risk(cm, days_until_exam, mastery_threshold)
        for concept_id, cm in state.concepts.items()
    }
