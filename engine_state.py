"""
engine_state.py — module-level singleton for KnowledgeGraph + MasteryEngine.

Import get_shared_engine() anywhere in the process to get the same engine
instance, preserving student mastery state across HTTP requests.

Usage:
    from engine_state import get_shared_engine
    engine, kg = get_shared_engine()
"""
from __future__ import annotations

import os
import sys
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from learning_model import MasteryEngine  # type: ignore

_engine: Optional[MasteryEngine] = None
_kg = None


def get_shared_engine() -> tuple[MasteryEngine, object]:
    """Return the process-level MasteryEngine + KnowledgeGraph singleton.

    Creates them on first call by loading bridge_data/curriculum_meta.csv.
    Subsequent calls return the cached instances (preserving all mastery state).
    """
    global _engine, _kg
    if _engine is None or _kg is None:
        from bridge import build_knowledge_graph

        _kg = build_knowledge_graph()

        _engine = MasteryEngine(
            knowledge_graph=_kg,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model="gpt-4o-mini",
        )

    return _engine, _kg
