"""
MasteryEngine — Main API for the Learning State Engine.

This is the single entry point that the rest of the team uses:
  - Person 3 (Scheduler/Timetable): uses get_priority_ranking, get_mastery_state
  - Person 4 (Analytics/Dashboard): uses get_mastery_state, get_insight, predict_exam_score
  - Person 2 (VARK/Content): feeds quiz responses via update_from_quiz
  - Person 5 (Platform): wires the data pipeline to this engine

The engine maintains an in-memory store keyed by (student_id, subject).
For a real backend, swap the store dict for a DB layer.
"""

import os
from datetime import datetime
from typing import Optional

from openai import OpenAI

from .bkt import initialize_concept_mastery, update_mastery
from .forgetting import apply_daily_decay_to_state, compute_forgetting_risks
from .knowledge_graph import KnowledgeGraph
from .models import (
    ConceptMastery,
    MasteryState,
    PriorityScore,
    QuizResponse,
)


class MasteryEngine:
    """
    Central hub for the learning state model.

    Usage:
        engine = MasteryEngine(knowledge_graph=kg, openai_api_key="sk-...")
        engine.update_from_quiz(responses)
        state = engine.get_mastery_state("student_42", "mathematics")
        priorities = engine.get_priority_ranking("student_42", "mathematics", exam_weights, days_until_exam=14)
        insight = engine.get_insight("student_42", "mathematics")
    """

    def __init__(
        self,
        knowledge_graph: KnowledgeGraph,
        openai_api_key: Optional[str] = None,
        openai_model: str = "gpt-4o-mini",
    ) -> None:
        self._kg = knowledge_graph
        self._store: dict[tuple[str, str], MasteryState] = {}
        self._openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self._openai_model = openai_model
        self._client: Optional[OpenAI] = None  # lazy-initialized

    # ------------------------------------------------------------------
    # Core: update mastery from quiz responses
    # ------------------------------------------------------------------

    def update_from_quiz(self, responses: list[QuizResponse]) -> None:
        """
        Process a batch of quiz responses and update all affected mastery states.
        Called by Person 2 / Person 5 after a quiz session.
        """
        for response in responses:
            state = self._get_or_create_state(response.student_id, response.subject)
            if response.concept_id not in state.concepts:
                state.concepts[response.concept_id] = initialize_concept_mastery(
                    response.student_id, response.concept_id, response.subject
                )
            state.concepts[response.concept_id] = update_mastery(
                state.concepts[response.concept_id], response
            )
            state.last_updated = datetime.now()

    # ------------------------------------------------------------------
    # Read: mastery state
    # ------------------------------------------------------------------

    def get_mastery_state(
        self,
        student_id: str,
        subject: str,
        apply_decay: bool = True,
    ) -> MasteryState:
        """
        Return the current mastery state for a student/subject.
        Optionally applies time-based forgetting decay before returning.
        """
        state = self._get_or_create_state(student_id, subject)
        if apply_decay:
            state = apply_daily_decay_to_state(state)
        # Refresh causal weakness map
        state.causal_weaknesses = self._kg.trace_causal_weaknesses(state)
        return state

    def get_weak_concepts(
        self,
        student_id: str,
        subject: str,
        threshold: float = 0.6,
    ) -> list[str]:
        """Return concept IDs where mastery < threshold."""
        state = self.get_mastery_state(student_id, subject)
        return state.weak_concepts(threshold)

    # ------------------------------------------------------------------
    # Priority ranking (for Person 3 — Scheduler)
    # ------------------------------------------------------------------

    def get_priority_ranking(
        self,
        student_id: str,
        subject: str,
        exam_weights: dict[str, float],  # {concept_id: weight 0-1}
        days_until_exam: float = 14.0,
        mastery_threshold: float = 0.6,
    ) -> list[PriorityScore]:
        """
        Rank concepts by how urgently they need study time.

        Formula (from spec):
            PriorityScore = ExamWeightage × (1 − Mastery) × ForgettingRisk

        Returns sorted descending (highest priority first).
        Called by Person 3 to populate the daily timetable.
        """
        state = self.get_mastery_state(student_id, subject)
        risks = compute_forgetting_risks(state, days_until_exam, mastery_threshold)

        scores: list[PriorityScore] = []
        for concept_id, cm in state.concepts.items():
            weightage = exam_weights.get(concept_id, 0.1)
            mastery = cm.p_mastery
            risk = risks.get(concept_id, 0.0)
            score = weightage * (1 - mastery) * max(risk, 0.1)  # floor risk to avoid zeroing out

            scores.append(PriorityScore(
                concept_id=concept_id,
                subject=subject,
                score=score,
                mastery=mastery,
                forgetting_risk=risk,
                exam_weightage=weightage,
                reason=self._kg.format_causal_explanation(
                    concept_id,
                    state.causal_weaknesses.get(concept_id, []),
                ),
            ))

        scores.sort(key=lambda x: x.score, reverse=True)
        return scores

    # ------------------------------------------------------------------
    # Predicted exam score (for Person 4 — Analytics)
    # ------------------------------------------------------------------

    def predict_exam_score(
        self,
        student_id: str,
        subject: str,
        exam_weights: dict[str, float],  # {concept_id: weight 0-1}
    ) -> dict[str, float]:
        """
        Returns two predicted exam scores:
            "current_pace": if student continues as-is (with decay applied)
            "recommended_plan": if student follows the priority plan (optimistic projection)

        Formula:
            ExpectedScore = Σ (ExamWeightage × MasteryProbability)

        Called by Person 4 for the analytics dashboard.
        """
        state = self.get_mastery_state(student_id, subject, apply_decay=True)

        current_score = sum(
            exam_weights.get(cid, 0.1) * cm.p_mastery
            for cid, cm in state.concepts.items()
        )
        # Normalize to 0-100
        total_weight = sum(exam_weights.get(cid, 0.1) for cid in state.concepts)
        current_pct = (current_score / total_weight * 100) if total_weight > 0 else 0.0

        # Recommended plan: assume weak concepts improve to 0.75 mastery
        improved = {}
        for cid, cm in state.concepts.items():
            improved_mastery = max(cm.p_mastery, 0.75) if cm.p_mastery < 0.6 else cm.p_mastery
            improved[cid] = improved_mastery

        recommended_score = sum(
            exam_weights.get(cid, 0.1) * m for cid, m in improved.items()
        )
        recommended_pct = (recommended_score / total_weight * 100) if total_weight > 0 else 0.0

        return {
            "current_pace": round(current_pct, 1),
            "recommended_plan": round(recommended_pct, 1),
        }

    # ------------------------------------------------------------------
    # LLM insight generation (OpenAI)
    # ------------------------------------------------------------------

    def get_insight(
        self,
        student_id: str,
        subject: str,
        exam_weights: Optional[dict[str, float]] = None,
        days_until_exam: float = 14.0,
    ) -> str:
        """
        Generate a prescriptive AI insight for the student using OpenAI.

        Returns a natural language explanation of:
        - What the student's biggest weaknesses are
        - Why those weaknesses exist (causal, from knowledge graph)
        - What to do next (prescriptive, not just descriptive)

        Called by Person 4 (analytics) and Person 2 (study buddy chatbot).
        """
        state = self.get_mastery_state(student_id, subject)
        priorities = (
            self.get_priority_ranking(student_id, subject, exam_weights or {}, days_until_exam)
            if exam_weights
            else []
        )

        # Build context summary for the LLM
        weak_summary = "\n".join(
            f"- {p.concept_id}: mastery={p.mastery:.0%}, forgetting risk={p.forgetting_risk:.0%}, "
            f"exam weight={p.exam_weightage:.0%}. {p.reason}"
            for p in priorities[:5]
        ) or "No weak concepts identified yet."

        overall = state.overall_mastery()

        prompt = f"""You are a personalized AI study coach embedded in a student learning platform.

Student ID: {student_id}
Subject: {subject}
Overall mastery: {overall:.0%}
Days until exam: {days_until_exam}

Top priority gaps:
{weak_summary}

Give the student a short (3-5 sentences), PRESCRIPTIVE (not descriptive) response:
- Explain WHY they're struggling with specific concepts (causal reasoning)
- Tell them EXACTLY what to study next and in what order
- Be direct and motivating, not generic
- Do NOT just say "study more" — give specific concept-level advice
"""

        if self._client is None:
            if not self._openai_api_key:
                return "[AI insight unavailable — set OPENAI_API_KEY]"
            self._client = OpenAI(api_key=self._openai_api_key)

        response = self._client.chat.completions.create(
            model=self._openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_state(self, student_id: str, subject: str) -> MasteryState:
        key = (student_id, subject)
        if key not in self._store:
            self._store[key] = MasteryState(student_id=student_id, subject=subject)
        return self._store[key]
