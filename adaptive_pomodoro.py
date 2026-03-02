"""
adaptive_pomodoro.py

Adaptive Pomodoro recommendation engine.

Inputs:
    - CursorTracker result (attention + VARK type)
    - MasteryState (BKT probabilities)
    - Exam weights

Output:
    Structured Pomodoro recommendation dict

Designed to plug into:
    TimetableEngine.generate_plan()
"""
from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))



from typing import Dict, Any, Optional
from statistics import mean

from learning_model.models import MasteryState


# ---------------------------------------------------------------------------
# Utility: compute mastery volatility proxy
# ---------------------------------------------------------------------------

def _compute_mastery_volatility(state: MasteryState) -> float:
    """
    Simple volatility proxy:
        Mean distance from stable mastery (0.75)

    High volatility = many weak or unstable concepts
    """
    if not state.concepts:
        return 0.0

    distances = [abs(cm.p_mastery - 0.75) for cm in state.concepts.values()]
    return mean(distances)


# ---------------------------------------------------------------------------
# Utility: compute cognitive load
# ---------------------------------------------------------------------------

def _compute_cognitive_load(
    state: MasteryState,
    exam_weights: Dict[str, float],
) -> float:
    """
    Weighted cognitive load score:
        High if:
            - mastery low
            - exam weight high
    """

    loads = []

    for concept_id, cm in state.concepts.items():
        weight = exam_weights.get(concept_id, 1.0)
        weakness = 1.0 - cm.p_mastery
        loads.append(weight * weakness)

    if not loads:
        return 0.0

    return mean(loads)


# ---------------------------------------------------------------------------
# Core Decision Engine
# ---------------------------------------------------------------------------

def suggest_pomodoro(
    mastery_state: MasteryState,
    exam_weights: Dict[str, float],
    attention: float,
    vark_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main adaptive decision function.

    Returns:
        {
            work_duration: int (minutes),
            break_duration: int (minutes),
            cycles_before_long_break: int,
            pomodoro_type: str,
            strategy: str
        }
    """

    volatility = _compute_mastery_volatility(mastery_state)
    cognitive_load = _compute_cognitive_load(mastery_state, exam_weights)

    # -------------------------------------------------------------------
    # Attention-based base template
    # -------------------------------------------------------------------

    if attention >= 0.75:
        base = {"work": 50, "break": 10, "type": "Deep Focus"}
    elif attention >= 0.5:
        base = {"work": 25, "break": 5, "type": "Classic"}
    elif attention >= 0.3:
        base = {"work": 15, "break": 3, "type": "Short Burst"}
    else:
        base = {"work": 10, "break": 5, "type": "Recovery Mode"}

    # -------------------------------------------------------------------
    # Cognitive Load Adjustments
    # -------------------------------------------------------------------

    # If high cognitive load, shorten work blocks slightly
    if cognitive_load > 0.6:
        base["work"] = max(10, base["work"] - 5)
        base["type"] += " (High Cognitive Load)"

    # If mastery stable and attention high → allow longer focus
    if volatility < 0.15 and attention > 0.75:
        base["work"] = min(60, base["work"] + 10)
        base["type"] = "Extended Deep Focus"

    # -------------------------------------------------------------------
    # Strategy Layer (VARK-informed)
    # -------------------------------------------------------------------

    strategy = "Standard focused study blocks."

    if vark_type == "R":
        strategy = (
            "Use written active recall. "
            "During breaks, summarise concepts in your own words."
        )

    # If attention low → encourage micro-goals
    if attention < 0.5:
        strategy += " Set one micro-goal per session."

    # -------------------------------------------------------------------
    # Final Structure
    # -------------------------------------------------------------------

    return {
        "pomodoro_type": base["type"],
        "work_duration": base["work"],
        "break_duration": base["break"],
        "cycles_before_long_break": 4,
        "strategy": strategy,
        "attention_score": round(attention, 3),
        "cognitive_load": round(cognitive_load, 3),
        "mastery_volatility": round(volatility, 3),
    }