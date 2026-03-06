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

import csv
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from learning_model.models import MasteryState, QuizResponse


# ---------------------------------------------------------------------------
# CSV-backed SessionEvent model
# ---------------------------------------------------------------------------

@dataclass
class SessionEvent:
    student_id: str
    concept_id: str
    subject: str
    correct: bool
    response_time_seconds: float
    timestamp: datetime


# ---------------------------------------------------------------------------
# Curriculum metadata loader
# ---------------------------------------------------------------------------

def load_curriculum_meta(
    path: str = "bridge_data/curriculum_meta.csv",
) -> Dict[str, Dict[str, Any]]:
    """
    Load curriculum metadata from CSV and return a flat dict keyed by concept_id:
        { concept_id: { name, prerequisites: [str], difficulty, subject } }

    Expected CSV columns:
        concept_id,name,subject,difficulty,prerequisites
    """
    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    meta: Dict[str, Dict[str, Any]] = {}
    with open(full_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            prereqs_raw = (row.get("prerequisites") or "").strip()
            prereq_ids = [p.strip() for p in prereqs_raw.split("|") if p.strip()]

            concept_id = row["concept_id"].strip()
            meta[concept_id] = {
                "name": (row.get("name") or concept_id.replace("_", " ").title()).strip(),
                "prerequisites": prereq_ids,
                "difficulty": (row.get("difficulty") or "medium").strip(),
                "subject": (row.get("subject") or "").strip(),
            }

    return meta


def load_exam_weights(
    path: str = "bridge_data/exam_weights.csv",
) -> Dict[str, float]:
    """
    Load exam weights from CSV and return:
        { concept_id: exam_weight }

    Expected CSV columns:
        concept_id,exam_weight
    """
    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    weights: Dict[str, float] = {}
    with open(full_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            weights[row["concept_id"].strip()] = float(row["exam_weight"])

    return weights


def load_topic_mastery(
    student_id: str,
    subject: Optional[str] = None,
    path: str = "bridge_data/topic_mastery.csv",
) -> Dict[str, float]:
    """
    Load one student's topic mastery from CSV and return:
        { concept_id: mastery_score }

    Expected CSV columns:
        student_id,subject,concept_id,mastery_score
    """
    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    mastery: Dict[str, float] = {}
    with open(full_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["student_id"].strip() != student_id:
                continue
            if subject is not None and row["subject"].strip() != subject:
                continue

            mastery[row["concept_id"].strip()] = float(row["mastery_score"])

    return mastery


def load_session_events(
    path: str = "bridge_data/session_events.csv",
) -> List[SessionEvent]:
    """
    Load session events from CSV and return a list of SessionEvent objects.

    Expected CSV columns:
        student_id,concept_id,subject,correct,response_time_seconds,timestamp
    """
    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    events: List[SessionEvent] = []
    with open(full_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(
                SessionEvent(
                    student_id=row["student_id"].strip(),
                    concept_id=row["concept_id"].strip(),
                    subject=row["subject"].strip(),
                    correct=row["correct"].strip().lower() == "true",
                    response_time_seconds=float(row["response_time_seconds"]),
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                )
            )

    return events


# ---------------------------------------------------------------------------
# KnowledgeGraph builder from CSV
# ---------------------------------------------------------------------------

def build_knowledge_graph(
    path: str = "bridge_data/curriculum_meta.csv",
) -> Any:
    """
    Build and return a KnowledgeGraph loaded from curriculum_meta.csv.

    Groups concepts by subject and calls kg.load_curriculum() for each.
    """
    from learning_model import KnowledgeGraph

    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    subjects: Dict[str, list] = {}
    with open(full_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            subj = row["subject"].strip()
            if subj not in subjects:
                subjects[subj] = []
            prereqs_raw = (row.get("prerequisites") or "").strip()
            prereqs = [
                {"id": p.strip(), "weight": 0.7}
                for p in prereqs_raw.split("|") if p.strip()
            ]
            subjects[subj].append({
                "id": row["concept_id"].strip(),
                "label": row["name"].strip(),
                "prerequisites": prereqs,
            })

    kg = KnowledgeGraph()
    for subject, concepts in subjects.items():
        kg.load_curriculum({"subject": subject, "concepts": concepts})
    return kg


# ---------------------------------------------------------------------------
# MasteryState  ->  Sia's Concept payload
# ---------------------------------------------------------------------------

def mastery_to_concepts_payload(
    mastery_state: MasteryState,
    exam_weights: Optional[Dict[str, float]] = None,
    curriculum_meta: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Convert MasteryEngine's MasteryState into the List[Concept dicts] format
    that insights.generate_weekly_report() expects.

    Args:
        mastery_state:   from engine.get_mastery_state(student_id, subject)
        exam_weights:    {concept_id: float 0..1}; if None, loaded from CSV
        curriculum_meta: from load_curriculum_meta() — provides human names,
                         prerequisite lists, and difficulty levels; if None,
                         loaded from CSV

    Returns:
        List of dicts matching insights.Concept schema.
    """
    exam_weights = exam_weights or load_exam_weights()
    meta = curriculum_meta or load_curriculum_meta()

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
    topic_mastery: Optional[Dict[str, float]] = None,
    student_id: str = "",
    subject: str = "",
) -> List[QuizResponse]:
    """
    Convert kinesthetic/quiz topic mastery scores (the output of
    compute_topic_mastery() from kinesthetics.py) back into QuizResponse
    objects that engine.update_from_quiz() can process.

    If topic_mastery is None, it will be loaded from CSV using student_id/subject.

    A mastery_score in [0, 1] is treated as performance probability:
      correct    = True  if mastery_score >= 0.5
      error_depth = 1 - mastery_score  (0 = near-perfect, 1 = fundamental gap)

    The BKT update inside engine will shift p_mastery up or down accordingly.
    """
    if topic_mastery is None:
        if not student_id:
            raise ValueError("student_id is required when topic_mastery is None")
        topic_mastery = load_topic_mastery(student_id=student_id, subject=subject or None)

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


# ---------------------------------------------------------------------------
# SessionEvent list  ->  QuizResponse list
# ---------------------------------------------------------------------------

def session_event_to_quiz_responses(
    events: Optional[List[SessionEvent]] = None,
    subject: Optional[str] = None,
) -> List[QuizResponse]:
    """
    Convert SessionEvent objects into QuizResponse objects so that
    study-session interactions can update BKT mastery.

    If events is None, they will be loaded from CSV.

    error_depth defaults to 0.0 because SessionEvent doesn't carry that field.
    """
    if events is None:
        events = load_session_events()

    responses: List[QuizResponse] = []
    for e in events:
        responses.append(
            QuizResponse(
                student_id=e.student_id,
                concept_id=e.concept_id,
                subject=subject if subject is not None else e.subject,
                correct=e.correct,
                response_time_seconds=float(e.response_time_seconds),
                timestamp=e.timestamp,
                error_depth=0.0,
            )
        )
    return responses


def load_quiz_results(
    path: str = "quiz_results.csv",
) -> List[SessionEvent]:
    """
    Load quiz_results.csv and convert each question attempt into a SessionEvent.
    """

    full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)

    events: List[SessionEvent] = []

    if not os.path.exists(full_path):
        return events

    with open(full_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                events.append(
                    SessionEvent(
                        student_id=row["student_id"].strip(),
                        concept_id=row.get("concept", "unknown").strip(),
                        subject="computer_security",   # can be dynamic if stored
                        correct=row["is_correct"].strip() == "1",
                        response_time_seconds=60.0,
                        timestamp=datetime.now(),
                    )
                )
            except Exception:
                continue

    return events

def quiz_results_to_quiz_responses(
    events: Optional[List[SessionEvent]] = None,
    subject: str = "computer_security",
) -> List[QuizResponse]:
    """
    Convert quiz_results.csv attempts into QuizResponse objects for BKT updates.
    """

    if events is None:
        events = load_quiz_results()

    responses: List[QuizResponse] = []

    for e in events:
        responses.append(
            QuizResponse(
                student_id=e.student_id,
                concept_id=e.concept_id,
                subject=subject,
                correct=e.correct,
                response_time_seconds=e.response_time_seconds,
                timestamp=e.timestamp,
                error_depth=0.0,
            )
        )

    return responses