# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dlweek** — AI-driven adaptive learning engine for a Blackboard "Study Mode" (Microsoft track hackathon).

The system models a student's evolving learning state and outputs personalized study plans, priority rankings, and prescriptive insights.

## Environment Setup

```bash
source .venv/bin/activate     # Python 3.13 venv
pip install -r requirements.txt
cp .env.example .env          # add your OPENAI_API_KEY
```

## Run the Demo

```bash
source .venv/bin/activate
python demo_learning_model.py
```

## Architecture

```
src/learning_model/           ← Person 1 (Yajie) — core AI engine
  models.py                   ← shared dataclasses: QuizResponse, ConceptMastery, MasteryState, PriorityScore
  bkt.py                      ← Bayesian Knowledge Tracing (4-param: L0, T, S, G)
  knowledge_graph.py          ← networkx prerequisite graph, causal weakness tracing
  forgetting.py               ← Ebbinghaus decay, forgetting risk, daily decay
  mastery_engine.py           ← main API — combines BKT + graph + forgetting + OpenAI insights

data/sample_curriculum.json   ← concept definitions with prerequisite edges
demo_learning_model.py        ← end-to-end demo / integration test
```

### Team module boundaries

| Person | Module | Consumes from P1 |
|--------|--------|-----------------|
| P3 – Scheduler (Chavi) | timetable + cognitive load AI | `get_priority_ranking()`, `get_mastery_state()` |
| P4 – Analytics (Sia?) | dashboard + predicted scores | `predict_exam_score()`, `get_insight()`, `get_mastery_state()` |
| P2 – VARK/Content | chatbot + interaction layer | `update_from_quiz()`, `get_insight()` |
| P5 – Platform | Blackboard UI + data pipeline | wires all APIs |

### MasteryEngine API (key methods)

```python
engine = MasteryEngine(knowledge_graph=kg, openai_model="gpt-4o-mini")

engine.update_from_quiz(responses: list[QuizResponse])           # after each quiz
engine.get_mastery_state(student_id, subject) -> MasteryState    # current mastery per concept
engine.get_weak_concepts(student_id, subject) -> list[str]       # concepts below threshold
engine.get_priority_ranking(student_id, subject, exam_weights, days_until_exam) -> list[PriorityScore]
engine.predict_exam_score(student_id, subject, exam_weights) -> {"current_pace": %, "recommended_plan": %}
engine.get_insight(student_id, subject, exam_weights) -> str     # OpenAI prescriptive text
```

### Core formulas

- **BKT update**: Bayesian posterior after each attempt → apply transition P(T)
- **Forgetting**: `R(t) = e^(-t/S)` where S ∈ [1, 30] days mapped from `stability_index`
- **Priority score**: `ExamWeightage × (1 − Mastery) × ForgettingRisk`
- **Expected exam score**: `Σ (ExamWeightage × MasteryProbability)` across concepts

### Adding a new subject/curriculum

Edit `data/sample_curriculum.json` — add a new object with `subject` and `concepts` (each concept has an `id`, `label`, and `prerequisites` list with `weight`).

### Extending BKT parameters per subject

In `bkt.py`, add an entry to `SUBJECT_PARAMS` with calibrated `p_l0`, `p_t`, `p_s`, `p_g` values.
