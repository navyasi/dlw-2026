"""
Integration bridge: MasteryEngine (Yajie/P1) <-> insights.py (Sia/P4)

Two core transforms:
  mastery_to_concepts_payload()  MasteryState      -> List[Concept dicts]  for generate_weekly_report()
  grade_to_quiz_responses()      topic_mastery     -> List[QuizResponse]   for engine.update_from_quiz()

The full weekly loop:
  1. Student completes kinesthetic/quiz session  (Sia's /grade-kinesthetic)
  2. grade_to_quiz_responses(topic_mastery) -> QuizResponse list
  3. engine.update_from_quiz(responses)            (P1 — updates BKT mastery)
  4. engine.get_mastery_state()                    (P1)
  5. mastery_to_concepts_payload(state, weights)   (bridge)
  6. generate_weekly_report(concepts_payload)      (Sia — analytics & score prediction)
  7. TimetableEngine.generate_plan()               (Chavi — Pomodoro schedule)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model.models import MasteryState, QuizResponse


# ---------------------------------------------------------------------------
# Curriculum metadata loader
# ---------------------------------------------------------------------------

def load_curriculum_meta(
    path: str = "data/sample_curriculum.json",
) -> Dict[str, Dict[str, Any]]:
    """
    Load curriculum JSON and return a flat dict keyed by concept_id:
        { concept_id: { name, prerequisites: [str], difficulty, subject } }
    """
    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
    with open(full_path) as f:
        data = json.load(f)

    meta: Dict[str, Dict[str, Any]] = {}
    for subject_block in data:
        subject = subject_block["subject"]
        for c in subject_block.get("concepts", []):
            prereq_ids = [p["id"] for p in c.get("prerequisites", [])]
            meta[c["id"]] = {
                "name": c.get("label", c["id"].replace("_", " ").title()),
                "prerequisites": prereq_ids,
                "difficulty": c.get("difficulty", "medium"),
                "subject": subject,
            }
    return meta


# ---------------------------------------------------------------------------
# MasteryState  ->  Sia's Concept payload
# ---------------------------------------------------------------------------

def mastery_to_concepts_payload(
    mastery_state: MasteryState,
    exam_weights: Dict[str, float],
    curriculum_meta: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Convert MasteryEngine's MasteryState into the List[Concept dicts] format
    that insights.generate_weekly_report() expects.

    Args:
        mastery_state:   from engine.get_mastery_state(student_id, subject)
        exam_weights:    {concept_id: float 0..1}
        curriculum_meta: from load_curriculum_meta() — provides human names,
                         prerequisite lists, and difficulty levels

    Returns:
        List of dicts matching insights.Concept schema.
    """
    meta = curriculum_meta or {}
    concepts: List[Dict[str, Any]] = []

    for concept_id, cm in mastery_state.concepts.items():
        m = meta.get(concept_id, {})

        # Convert last_seen (datetime | None) -> ISO string with Z suffix
        last_practiced: Optional[str] = None
        if cm.last_seen:
            dt = cm.last_seen
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            last_practiced = dt.isoformat().replace("+00:00", "Z")

        concepts.append({
            "id": concept_id,
            "name": m.get("name", concept_id.replace("_", " ").title()),
            "exam_weightage": float(exam_weights.get(concept_id, 1.0)),
            "mastery": round(float(cm.p_mastery), 4),
            "last_practiced_at": last_practiced,
            "prerequisites": m.get("prerequisites", []),
            "difficulty": m.get("difficulty", "medium"),
        })

    # Include concepts from exam_weights that aren't yet in mastery state
    # (engine initialises lazily, so unseen concepts are absent)
    tracked = {c["id"] for c in concepts}
    for concept_id, weightage in exam_weights.items():
        if concept_id not in tracked:
            m = meta.get(concept_id, {})
            concepts.append({
                "id": concept_id,
                "name": m.get("name", concept_id.replace("_", " ").title()),
                "exam_weightage": float(weightage),
                "mastery": 0.1,          # BKT prior — not seen yet
                "last_practiced_at": None,
                "prerequisites": m.get("prerequisites", []),
                "difficulty": m.get("difficulty", "medium"),
            })

    return concepts


# ---------------------------------------------------------------------------
# Sia's topic_mastery dict  ->  QuizResponse list
# ---------------------------------------------------------------------------

def grade_to_quiz_responses(
    topic_mastery: Dict[str, float],
    student_id: str,
    subject: str,
) -> List[QuizResponse]:
    """
    Convert kinesthetic/quiz topic mastery scores (the output of
    compute_topic_mastery() from kinesthetics.py) back into QuizResponse
    objects that engine.update_from_quiz() can process.

    A mastery_score in [0, 1] is treated as performance probability:
      correct    = True  if mastery_score >= 0.5
      error_depth = 1 - mastery_score  (0 = near-perfect, 1 = fundamental gap)

    The BKT update inside engine will shift p_mastery up or down accordingly.
    """
    responses: List[QuizResponse] = []
    now = datetime.now()

    for topic_id, mastery_score in topic_mastery.items():
        score = float(min(1.0, max(0.0, mastery_score)))
        responses.append(
            QuizResponse(
                student_id=student_id,
                concept_id=topic_id,
                subject=subject,
                correct=(score >= 0.5),
                response_time_seconds=60.0,   # neutral default
                timestamp=now,
                error_depth=round(1.0 - score, 3),
            )
        )

    return responses
