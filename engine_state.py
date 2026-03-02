"""
engine_state.py — module-level singleton for KnowledgeGraph + MasteryEngine.

Import get_shared_engine() anywhere in the process to get the same engine
instance, preserving student mastery state across HTTP requests.

Usage:
    from engine_state import get_shared_engine
    engine, kg = get_shared_engine()
"""
from __future__ import annotations

import json
import os
import sys
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from learning_model import KnowledgeGraph, MasteryEngine  # type: ignore

_engine: Optional[MasteryEngine] = None
_kg: Optional[KnowledgeGraph] = None


def get_shared_engine() -> tuple[MasteryEngine, KnowledgeGraph]:
    """Return the process-level MasteryEngine + KnowledgeGraph singleton.

    Creates them on first call by loading data/sample_curriculum.json.
    Subsequent calls return the cached instances (preserving all mastery state).
    """
    global _engine, _kg
    if _engine is None or _kg is None:
        curriculum_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "data", "sample_curriculum.json"
        )
        with open(curriculum_path) as f:
            curricula = json.load(f)

        _kg = KnowledgeGraph()
        for curriculum in curricula:
            _kg.load_curriculum(curriculum)

        _engine = MasteryEngine(
            knowledge_graph=_kg,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model="gpt-4o-mini",
        )

    return _engine, _kg
