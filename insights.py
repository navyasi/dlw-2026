
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import math

from pydantic import BaseModel, Field


# -----------------------------
# Models
# -----------------------------

class Concept(BaseModel):
    id: str
    name: str

    # IMPORTANT: weightage can be marks, %points, or any positive number
    exam_weightage: float = 1.0

    # mastery in [0,1] (0 = bad, 1 = perfect)
    mastery: float = 0.4

    # ISO string like "2026-03-01T10:30:00Z"
    last_practiced_at: Optional[str] = None

    prerequisites: List[str] = Field(default_factory=list)
    difficulty: str = "medium"  # easy/medium/hard
    notes: Optional[str] = None


class ReportConfig(BaseModel):
    # Forgetting model time constants (days)
    tau_easy_days: float = 14.0
    tau_medium_days: float = 10.0
    tau_hard_days: float = 7.0

    # Mastery gain model saturation constants
    k_easy: float = 140.0
    k_medium: float = 180.0
    k_hard: float = 240.0

    recommended_weekly_minutes: int = 360

    # FORCE normalization so percentages are meaningful
    normalize_weightages: bool = True

    # How much to penalize weak mastery vs forgetting
    mastery_weight: float = 0.75
    forgetting_weight: float = 0.25


# -----------------------------
# Helpers
# -----------------------------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    s = dt_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

def _concepts_from_payload(concepts_raw: List[Dict[str, Any]]) -> List[Concept]:
    concepts: List[Concept] = []
    for c in concepts_raw or []:
        c = dict(c)
        c.setdefault("exam_weightage", 1.0)
        c.setdefault("mastery", 0.4)
        c.setdefault("last_practiced_at", None)
        c.setdefault("prerequisites", [])
        c.setdefault("difficulty", "medium")
        c.setdefault("notes", None)
        concepts.append(Concept(**c))
    return concepts

def normalize_exam_weightages(concepts: List[Concept]) -> List[Concept]:
    total = sum(max(0.0, c.exam_weightage) for c in concepts)
    if total <= 0:
        return concepts
    out = []
    for c in concepts:
        cc = c.model_copy(deep=True)
        cc.exam_weightage = max(0.0, c.exam_weightage) / total
        out.append(cc)
    return out


# -----------------------------
# Core models
# -----------------------------

def forgetting_risk(concept: Concept, cfg: ReportConfig, now: Optional[datetime] = None) -> float:
    """
    0..1 where 1 = highly likely to forget (not practiced recently).
    If never practiced -> risk = 1.
    """
    now = now or _now_utc()
    last = _parse_iso(concept.last_practiced_at)
    if last is None:
        return 1.0

    days = (now - last).total_seconds() / 86400.0
    days = max(0.0, days)

    if concept.difficulty == "easy":
        tau = cfg.tau_easy_days
    elif concept.difficulty == "hard":
        tau = cfg.tau_hard_days
    else:
        tau = cfg.tau_medium_days

    r = 1.0 - math.exp(-days / max(1e-6, tau))
    return float(min(1.0, max(0.0, r)))

def priority_score(concept: Concept, cfg: ReportConfig, now: Optional[datetime] = None) -> float:
    """
    Priority should increase when:
      - exam_weightage high
      - mastery low
      - forgetting risk high
    """
    now = now or _now_utc()
    w = max(0.0, float(concept.exam_weightage))
    m = float(min(1.0, max(0.0, concept.mastery)))
    fr = forgetting_risk(concept, cfg, now=now)

    # weighted blend (so it's not killed when fr is low)
    weakness = (cfg.mastery_weight * (1.0 - m)) + (cfg.forgetting_weight * fr)
    return w * weakness

def expected_score(concepts: List[Concept]) -> float:
    """
    ExpectedScore = Σ (ExamWeightage × MasteryProbability)
    If weights are normalized -> range [0,1]
    """
    return sum(max(0.0, c.exam_weightage) * float(min(1.0, max(0.0, c.mastery))) for c in concepts)

def simulate_mastery_gain(concept: Concept, minutes: int, cfg: ReportConfig) -> float:
    """
    mastery_next = mastery + (1 - mastery) * (1 - exp(-minutes/k))
    """
    m = float(min(1.0, max(0.0, concept.mastery)))
    minutes = max(0, int(minutes))

    if concept.difficulty == "easy":
        k = cfg.k_easy
    elif concept.difficulty == "hard":
        k = cfg.k_hard
    else:
        k = cfg.k_medium

    gain_fraction = 1.0 - math.exp(-minutes / max(1e-6, k))
    m_next = m + (1.0 - m) * gain_fraction
    return float(min(1.0, max(0.0, m_next)))


# -----------------------------
# Prescriptive layer
# -----------------------------

def build_prescriptive_plan(concepts: List[Concept], cfg: ReportConfig, now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Returns:
      - recommendations: list of actions
      - allocations: minutes per concept
      - diagnosis_top: why you're stuck
    """
    now = now or _now_utc()
    ranked = sorted(concepts, key=lambda c: priority_score(c, cfg, now=now), reverse=True)

    budget = cfg.recommended_weekly_minutes
    allocations: Dict[str, int] = {c.id: 0 for c in concepts}
    recommendations = []
    diagnosis_top = []

    # allocate time across top concepts
    for c in ranked:
        if budget <= 0:
            break

        ps = priority_score(c, cfg, now=now)
        if ps <= 0:
            continue

        # more time if mastery very low
        base = 45
        if c.mastery < 0.3:
            base = 75
        elif c.mastery < 0.5:
            base = 60

        minutes = min(base, budget)
        allocations[c.id] += minutes
        budget -= minutes

        fr = forgetting_risk(c, cfg, now=now)
        if c.mastery < 0.4:
            action_type = "practice"
            rationale = "Your mastery is low, so you need active problem-solving practice."
            steps = [
                "Read the concept summary once (5–8 min).",
                "Solve 8–12 targeted questions.",
                "Write down 3 most common mistakes you made.",
                "Re-attempt wrong questions after 24 hours."
            ]
        elif fr > 0.6:
            action_type = "revise"
            rationale = "You know it, but you’re likely to forget it soon. Quick revision stabilizes memory."
            steps = [
                "Skim notes (10–15 min).",
                "Do 3–5 quick questions.",
                "Make 8–10 flashcards / cues."
            ]
        else:
            action_type = "mixed"
            rationale = "Moderate mastery: mix revision + practice to push above 0.8."
            steps = [
                "10 min revision",
                "6 practice questions",
                "Summarize the trap cases / edge cases"
            ]

        recommendations.append({
            "concept_id": c.id,
            "concept_name": c.name,
            "minutes": minutes,
            "action_type": action_type,
            "rationale": rationale,
            "next_steps": steps
        })

        # diagnosis entry
        reasons = []
        if c.mastery < 0.4:
            reasons.append("Low mastery (not yet internalized).")
        if fr > 0.6:
            reasons.append("High forgetting risk (not reviewed recently).")
        if c.prerequisites:
            reasons.append(f"Has prerequisites ({len(c.prerequisites)}). Weak prereqs can block progress.")

        diagnosis_top.append({
            "concept_id": c.id,
            "concept_name": c.name,
            "mastery": round(float(c.mastery), 3),
            "forgetting_risk": round(float(fr), 3),
            "why": reasons,
            "what_to_do_next": [
                "Fix prerequisites first if you keep getting stuck.",
                "Do active recall: attempt without notes.",
                "Keep an error log and reattempt wrong ones tomorrow."
            ]
        })

        if len(diagnosis_top) >= 8:
            break

    return {
        "allocations": allocations,
        "recommendations": recommendations,
        "diagnosis_top": diagnosis_top
    }


def simulate_with_allocations(concepts: List[Concept], allocations: Dict[str, int], cfg: ReportConfig) -> List[Concept]:
    out = []
    for c in concepts:
        cc = c.model_copy(deep=True)
        minutes = int(allocations.get(c.id, 0))
        cc.mastery = simulate_mastery_gain(cc, minutes, cfg)
        out.append(cc)
    return out


# -----------------------------
# Weekly report
# -----------------------------

def generate_weekly_report(
    concepts_raw: List[Dict[str, Any]],
    current_weekly_minutes: int = 240,
    cfg_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cfg = ReportConfig(**(cfg_dict or {}))
    now = _now_utc()

    concepts = _concepts_from_payload(concepts_raw)

    # ALWAYS normalize unless you explicitly turn it off
    if cfg.normalize_weightages:
        concepts = normalize_exam_weightages(concepts)

    base_expected = expected_score(concepts)

    # simulate current pace: allocate time proportional to weakness
    ranked = sorted(concepts, key=lambda c: priority_score(c, cfg, now=now), reverse=True)
    denom = sum(priority_score(c, cfg, now=now) for c in ranked) or 1.0
    alloc_current = {c.id: int(round(current_weekly_minutes * priority_score(c, cfg, now=now) / denom)) for c in ranked}
    sim_a = simulate_with_allocations(concepts, alloc_current, cfg)
    expected_a = expected_score(sim_a)

    # recommended plan + simulation
    prescriptive = build_prescriptive_plan(concepts, cfg, now=now)
    sim_b = simulate_with_allocations(concepts, prescriptive["allocations"], cfg)
    expected_b = expected_score(sim_b)

    top_concepts = [{
        "concept_id": c.id,
        "concept_name": c.name,
        "exam_weightage": round(float(c.exam_weightage), 4),
        "mastery": round(float(c.mastery), 3),
        "forgetting_risk": round(float(forgetting_risk(c, cfg, now=now)), 3),
        "priority_score": round(float(priority_score(c, cfg, now=now)), 6),
    } for c in ranked[:10]]

    gap_bars = [{
        "label": c.name,
        "value": round(float(c.exam_weightage) * (1.0 - float(min(1.0, max(0.0, c.mastery)))), 4),
        "mastery": round(float(c.mastery), 3),
        "weightage": round(float(c.exam_weightage), 4),
    } for c in ranked[:12]]

    to_pct = lambda x: round(100.0 * x, 2)

    return {
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "predicted_score_model": {
            "formula": "ExpectedScore = Σ (ExamWeightage × MasteryProbability)",
            "base_expected": to_pct(base_expected),
            "simulation_current_pace": {
                "weekly_minutes": current_weekly_minutes,
                "expected_score": to_pct(expected_a),
            },
            "simulation_recommended_plan": {
                "weekly_minutes": cfg.recommended_weekly_minutes,
                "expected_score": to_pct(expected_b),
            },
        },
        "priority_ranking": {
            "formula": "PriorityScore = ExamWeightage × [0.75×(1−Mastery) + 0.25×ForgettingRisk]",
            "top_concepts": top_concepts,
        },
        "prescriptive_analysis": {
            "recommendations": prescriptive["recommendations"],
            "diagnosis_top": prescriptive["diagnosis_top"],
        },
        "visual_gap_motivation": {
            "gap_definition": "gap = ExamWeightage × (1 − Mastery)",
            "top_gaps": gap_bars,
        },
    }