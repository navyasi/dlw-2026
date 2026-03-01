"""
Knowledge Graph Engine

Concepts are nodes; prerequisites are directed edges (A → B means A is a prerequisite of B).
Edge weights represent how strongly A's mastery affects B's performance.

Key operations:
- Add subjects/concepts with prerequisite relationships
- Trace causal weaknesses: given a weak concept, find the root cause prerequisite
- Compute "prerequisite mastery coverage" — how much prerequisite groundwork a student has
"""

import networkx as nx

from .models import ConceptMastery, MasteryState


class KnowledgeGraph:
    """
    Directed prerequisite graph for a subject's concepts.

    Node attributes:
      - label: human-readable name
      - subject: subject this concept belongs to

    Edge attributes:
      - weight: 0-1, how strongly the prerequisite affects the dependent (default 0.7)
    """

    def __init__(self) -> None:
        self._graph = nx.DiGraph()

    # ------------------------------------------------------------------
    # Graph construction
    # ------------------------------------------------------------------

    def add_concept(self, concept_id: str, label: str, subject: str) -> None:
        self._graph.add_node(concept_id, label=label, subject=subject)

    def add_prerequisite(
        self,
        prerequisite_id: str,
        concept_id: str,
        weight: float = 0.7,
    ) -> None:
        """
        prerequisite_id → concept_id
        i.e. you need prerequisite_id before you can master concept_id
        """
        self._graph.add_edge(prerequisite_id, concept_id, weight=weight)

    def load_curriculum(self, curriculum: dict) -> None:
        """
        Load from a dict structure:
        {
          "subject": "mathematics",
          "concepts": [
            {"id": "chain_rule", "label": "Chain Rule", "prerequisites": []},
            {"id": "backprop",   "label": "Backpropagation", "prerequisites": [
              {"id": "chain_rule", "weight": 0.9}
            ]}
          ]
        }
        """
        subject = curriculum["subject"]
        for concept in curriculum["concepts"]:
            self.add_concept(concept["id"], concept["label"], subject)
            for prereq in concept.get("prerequisites", []):
                self.add_prerequisite(
                    prereq["id"],
                    concept["id"],
                    prereq.get("weight", 0.7),
                )

    # ------------------------------------------------------------------
    # Weakness tracing
    # ------------------------------------------------------------------

    def get_prerequisites(self, concept_id: str, depth: int = 3) -> list[str]:
        """Return all prerequisite concept IDs up to `depth` levels back."""
        if concept_id not in self._graph:
            return []
        prereqs = set()
        frontier = [concept_id]
        for _ in range(depth):
            next_frontier = []
            for node in frontier:
                parents = list(self._graph.predecessors(node))
                prereqs.update(parents)
                next_frontier.extend(parents)
            frontier = next_frontier
            if not frontier:
                break
        return list(prereqs)

    def trace_causal_weaknesses(
        self,
        mastery_state: MasteryState,
        weakness_threshold: float = 0.6,
    ) -> dict[str, list[str]]:
        """
        For each weak concept, find which prerequisite concepts are also weak
        and are likely causing the weakness.

        Returns: { weak_concept_id: [root_cause_concept_id, ...] }

        Uses a weighted score: prerequisite is a root cause if:
          - It is itself weak (mastery < threshold)
          - AND it has a high edge weight to the weak concept
        """
        weak = mastery_state.weak_concepts(weakness_threshold)
        causal_map: dict[str, list[str]] = {}

        for concept_id in weak:
            prereqs = self.get_prerequisites(concept_id, depth=3)
            root_causes = []
            for prereq_id in prereqs:
                if prereq_id not in mastery_state.concepts:
                    continue
                prereq_mastery = mastery_state.concepts[prereq_id].p_mastery
                if prereq_mastery < weakness_threshold:
                    # Weight the causal strength by edge weight
                    edge_weight = self._graph.get_edge_data(
                        prereq_id, concept_id, default={}
                    ).get("weight", 0.0)
                    # Also check transitive paths
                    if edge_weight == 0.0:
                        edge_weight = self._transitive_weight(prereq_id, concept_id)
                    if edge_weight >= 0.5:
                        root_causes.append(prereq_id)

            causal_map[concept_id] = root_causes

        return causal_map

    def _transitive_weight(self, source: str, target: str) -> float:
        """Estimate path strength through intermediate nodes."""
        try:
            paths = list(nx.all_simple_paths(self._graph, source, target, cutoff=3))
        except (nx.NodeNotFound, nx.NetworkXNoPath):
            return 0.0

        if not paths:
            return 0.0

        best = 0.0
        for path in paths:
            weight = 1.0
            for i in range(len(path) - 1):
                edge = self._graph.get_edge_data(path[i], path[i + 1], default={})
                weight *= edge.get("weight", 0.7)
            best = max(best, weight)
        return best

    def prerequisite_coverage(
        self,
        concept_id: str,
        mastery_state: MasteryState,
    ) -> float:
        """
        Weighted average mastery of all prerequisites for a concept.
        Gives Person 3 (scheduler) a readiness signal before assigning the concept.
        """
        prereqs = self.get_prerequisites(concept_id)
        if not prereqs:
            return 1.0  # No prerequisites — can attempt freely

        total_weight = 0.0
        weighted_mastery = 0.0
        for prereq_id in prereqs:
            edge_w = self._graph.get_edge_data(prereq_id, concept_id, default={}).get("weight", 0.7)
            prereq_mastery = mastery_state.concepts.get(
                prereq_id, type("", (), {"p_mastery": 0.1})()
            ).p_mastery
            weighted_mastery += edge_w * prereq_mastery
            total_weight += edge_w

        return weighted_mastery / total_weight if total_weight > 0 else 0.0

    def format_causal_explanation(
        self,
        concept_id: str,
        root_causes: list[str],
    ) -> str:
        """Human-readable explanation of causal weakness chain."""
        if not root_causes:
            return f"Weakness in '{self._label(concept_id)}' appears isolated — no prerequisite gaps found."

        cause_labels = [self._label(c) for c in root_causes]
        causes_str = " and ".join(f"'{c}'" for c in cause_labels)
        return (
            f"Your weakness in '{self._label(concept_id)}' likely stems from "
            f"gaps in {causes_str}. Addressing those first will unblock this concept."
        )

    def _label(self, concept_id: str) -> str:
        return self._graph.nodes.get(concept_id, {}).get("label", concept_id)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def get_concepts(self) -> list[str]:
        return list(self._graph.nodes)

    def get_dependents(self, concept_id: str) -> list[str]:
        """Concepts that depend on this concept (forward direction)."""
        return list(self._graph.successors(concept_id))
