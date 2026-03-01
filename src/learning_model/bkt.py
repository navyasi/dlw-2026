"""
Bayesian Knowledge Tracing (BKT)

Classic 4-parameter BKT model:
  P(L0) — prior: probability student already knows the concept
  P(T)  — transition: probability of learning after each attempt
  P(S)  — slip: probability of wrong answer even if learned
  P(G)  — guess: probability of right answer even if not learned

After each observation (correct/incorrect), we do a Bayesian update
on P(L|n) — the probability the student has mastered the concept
given n observations.

Reference: Corbett & Anderson (1994)
"""

from dataclasses import dataclass

from .models import ConceptMastery, QuizResponse


@dataclass
class BKTParams:
    """BKT parameters per concept (or use defaults if not calibrated)."""
    p_l0: float = 0.1   # Prior mastery
    p_t: float = 0.2    # Learning rate per attempt
    p_s: float = 0.1    # Slip rate
    p_g: float = 0.2    # Guess rate


# Default params — can be overridden per concept/subject
DEFAULT_PARAMS = BKTParams()

# Subject-specific calibrations (tweak as you gather data)
SUBJECT_PARAMS: dict[str, BKTParams] = {
    "mathematics": BKTParams(p_l0=0.15, p_t=0.18, p_s=0.08, p_g=0.15),
    "programming":  BKTParams(p_l0=0.10, p_t=0.22, p_s=0.12, p_g=0.18),
    "science":      BKTParams(p_l0=0.12, p_t=0.20, p_s=0.10, p_g=0.20),
}


def _get_params(subject: str) -> BKTParams:
    return SUBJECT_PARAMS.get(subject.lower(), DEFAULT_PARAMS)


def _p_correct_given_learned(params: BKTParams) -> float:
    """P(correct | learned) = 1 - P(slip)"""
    return 1.0 - params.p_s


def _p_correct_given_not_learned(params: BKTParams) -> float:
    """P(correct | not learned) = P(guess)"""
    return params.p_g


def update_mastery(mastery: ConceptMastery, response: QuizResponse) -> ConceptMastery:
    """
    Perform a full BKT update cycle given a quiz response.

    Steps:
    1. Bayesian update: condition on the observation
    2. Learning opportunity: apply transition probability
    3. Update tracking stats (attempts, streak, avg response time)
    """
    params = _get_params(mastery.subject)
    p_l = mastery.p_mastery

    # --- Step 1: Bayesian update ---
    # P(correct | L) and P(correct | ~L)
    p_c_l  = _p_correct_given_learned(params)
    p_c_nl = _p_correct_given_not_learned(params)

    if response.correct:
        # P(L | correct) via Bayes
        numerator = p_c_l * p_l
        denominator = p_c_l * p_l + p_c_nl * (1 - p_l)
    else:
        # P(L | incorrect) via Bayes
        p_i_l  = params.p_s          # P(incorrect | learned)  = slip
        p_i_nl = 1.0 - params.p_g   # P(incorrect | not learned)
        numerator = p_i_l * p_l
        denominator = p_i_l * p_l + p_i_nl * (1 - p_l)

    p_l_given_obs = numerator / denominator if denominator > 0 else p_l

    # --- Step 2: Learning opportunity (transition) ---
    p_l_new = p_l_given_obs + (1 - p_l_given_obs) * params.p_t

    # Clamp to valid probability range
    p_l_new = max(0.0, min(1.0, p_l_new))

    # --- Step 3: Update tracking stats ---
    mastery.p_mastery = p_l_new
    mastery.attempts += 1

    if response.correct:
        mastery.correct_streak += 1
    else:
        mastery.correct_streak = 0

    # Exponential moving average for response time
    alpha = 0.3
    mastery.avg_response_time = (
        alpha * response.response_time_seconds
        + (1 - alpha) * mastery.avg_response_time
    )

    # Update stability: longer streaks and fast responses = more stable
    mastery.stability_index = _compute_stability(mastery, response)
    mastery.last_seen = response.timestamp

    return mastery


def _compute_stability(mastery: ConceptMastery, response: QuizResponse) -> float:
    """
    Stability Index (0-1): how resistant this mastery is to forgetting.

    Increases with:
    - Higher mastery probability
    - Longer correct streaks
    - Faster (confident) response times
    - Low error depth on wrong answers
    """
    # Normalise response time (assume 30s is "confident", >120s is struggling)
    time_score = max(0.0, 1.0 - (mastery.avg_response_time / 120.0))

    streak_score = min(1.0, mastery.correct_streak / 5.0)

    error_penalty = response.error_depth if not response.correct else 0.0

    stability = (
        0.4 * mastery.p_mastery
        + 0.3 * streak_score
        + 0.2 * time_score
        - 0.1 * error_penalty
    )
    return max(0.0, min(1.0, stability))


def initialize_concept_mastery(
    student_id: str,
    concept_id: str,
    subject: str,
) -> ConceptMastery:
    """Create a fresh ConceptMastery using the subject's prior P(L0)."""
    params = _get_params(subject)
    return ConceptMastery(
        student_id=student_id,
        concept_id=concept_id,
        subject=subject,
        p_mastery=params.p_l0,
        stability_index=0.3,
    )
