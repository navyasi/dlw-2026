from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Any
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/{student_id}/{subject}")
async def get_course_analytics(student_id: str, subject: str):
    from engine_state import get_shared_engine
    from bridge import mastery_to_concepts_payload, load_exam_weights, load_curriculum_meta

    try:
        engine, _ = get_shared_engine()

        exam_weights = load_exam_weights()
        curriculum_meta = load_curriculum_meta()

        state = engine.get_mastery_state(student_id, subject)
        concepts = mastery_to_concepts_payload(
            state,
            exam_weights=exam_weights,
            curriculum_meta=curriculum_meta,
        )

        priorities = engine.get_priority_ranking(
            student_id,
            subject,
            exam_weights,
            days_until_exam=14,
        )

        scores = engine.predict_exam_score(student_id, subject, exam_weights)

        weak_concepts = []
        flagged_concepts = []
        roadmap = []

        for c in concepts:
            mastery = float(c.get("mastery", 0.0))
            item = {
                "id": c["id"],
                "name": c["name"],
                "mastery": mastery,
                "difficulty": c.get("difficulty", "medium"),
                "exam_weightage": c.get("exam_weightage", 1.0),
                "prerequisites": c.get("prerequisites", []),
                "last_practiced_at": c.get("last_practiced_at"),
            }

            if mastery < 0.5:
                weak_concepts.append(item)

            if mastery < 0.4:
                flagged_concepts.append(item)

        for i, p in enumerate(priorities, 1):
            roadmap.append({
                "rank": i,
                "concept_id": p.concept_id,
                "score": round(float(p.score), 3),
                "mastery": round(float(p.mastery), 3),
                "forgetting_risk": round(float(p.forgetting_risk), 3),
            })

        readiness_score = round(state.overall_mastery() * 100)

        quick_insights = []
        if weak_concepts:
            weakest = sorted(weak_concepts, key=lambda x: x["mastery"])[:3]
            quick_insights.append(
                "Weakest areas: " + ", ".join(w["name"] for w in weakest)
            )
        if roadmap:
            quick_insights.append(
                f"Start with {roadmap[0]['concept_id']} for maximum score gain."
            )
        if not weak_concepts:
            quick_insights.append("No major weak concepts detected right now.")

        return {
            "readiness_score": readiness_score,
            "predicted_score": scores.get("current_pace", 0),
            "recommended_score": scores.get("recommended_plan", 0),
            "requires_attention": len(flagged_concepts),
            "weak_concepts": weak_concepts,
            "flagged_concepts": flagged_concepts,
            "roadmap": roadmap,
            "concepts": concepts,
            "quick_insights": quick_insights,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))