"""
Core data models for the Learning State Engine.
These are the shared data structures used across BKT, Knowledge Graph,
Forgetting Curve, and MasteryEngine.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class QuizResponse:
    """A single student response to a quiz question."""
    student_id: str
    concept_id: str
    subject: str
    correct: bool
    response_time_seconds: float
    timestamp: datetime = field(default_factory=datetime.now)
    # 0-1 scale: how deep the error was (0 = shallow mistake, 1 = fundamental misunderstanding)
    error_depth: float = 0.0


@dataclass
class ConceptMastery:
    """Mastery state for a single concept for a single student."""
    student_id: str
    concept_id: str
    subject: str

    # Core BKT probability: P(student has mastered this concept)
    p_mastery: float = 0.1

    # Stability: how resistant to forgetting (0-1, higher = more stable)
    stability_index: float = 0.5

    # Raw tracking
    attempts: int = 0
    correct_streak: int = 0
    avg_response_time: float = 0.0

    last_seen: Optional[datetime] = None
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class MasteryState:
    """Full mastery state for a student across all concepts in a subject."""
    student_id: str
    subject: str
    concepts: dict[str, ConceptMastery] = field(default_factory=dict)
    # Map concept_id -> list of root cause concept_ids explaining the weakness
    causal_weaknesses: dict[str, list[str]] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.now)

    def overall_mastery(self) -> float:
        """Mean mastery across all tracked concepts."""
        if not self.concepts:
            return 0.0
        return sum(c.p_mastery for c in self.concepts.values()) / len(self.concepts)

    def weak_concepts(self, threshold: float = 0.6) -> list[str]:
        """Return concept IDs where mastery is below threshold."""
        return [cid for cid, c in self.concepts.items() if c.p_mastery < threshold]


@dataclass
class PriorityScore:
    """Priority ranking for a concept — used by Person 3 (Scheduler)."""
    concept_id: str
    subject: str
    score: float          # Higher = needs more attention
    mastery: float
    forgetting_risk: float
    exam_weightage: float
    reason: str = ""
