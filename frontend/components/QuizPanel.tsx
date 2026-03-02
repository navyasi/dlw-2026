"use client";
import { useState } from "react";
import { api } from "@/lib/api";

/** Lenient short-answer scoring: word overlap + key concept matching */
function scoreShortAnswer(userAnswer: string, expected: string): { score: number; label: string } {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const ua = normalize(userAnswer);
    const ex = normalize(expected);
    if (!ua) return { score: 0, label: "No answer" };
    // Exact or near-exact match
    if (ua === ex || ex.includes(ua) || ua.includes(ex)) return { score: 1, label: "Correct" };
    // Word overlap scoring
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "it", "in", "of", "to", "and", "or", "for", "that", "this", "with", "by", "on", "at", "from", "as", "be", "has", "have", "had", "do", "does", "not", "can", "will", "but", "so", "if", "its", "they", "them", "their", "which", "what", "when", "where", "how", "all", "each", "no", "any", "into"]);
    const userWords = ua.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const expectedWords = ex.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    if (expectedWords.length === 0) return { score: 0.5, label: "Partial" };
    let matched = 0;
    for (const ew of expectedWords) {
        if (userWords.some(uw => uw.includes(ew) || ew.includes(uw))) matched++;
    }
    const score = matched / expectedWords.length;
    if (score >= 0.6) return { score, label: "Mostly correct" };
    if (score >= 0.3) return { score, label: "Partial" };
    if (score > 0) return { score, label: "Partially relevant" };
    return { score: 0, label: "Incorrect" };
}

interface Props {
    notebookId: number;
}

interface MCQ {
    id: string;
    type: "mcq";
    question: string;
    options: string[];
    answer: string;
}

interface Short {
    id: string;
    type: "short";
    question: string;
    answer: string;
}

interface QuizPlan {
    title: string;
    activities: any[];
    quiz: {
        mcq: MCQ[];
        short: Short[];
    };
}

interface Scores {
    completion_score: number;
    mcq_score: number;
    short_score: number;
    quiz_score: number;
    kinesthetic_mastery_score: number;
}

export default function QuizPanel({ notebookId }: Props) {
    const [plan, setPlan] = useState<QuizPlan | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [completedActivities, setCompletedActivities] = useState<string[]>([]);
    const [scores, setScores] = useState<Scores | null>(null);
    const [grading, setGrading] = useState(false);

    const generate = async () => {
        setLoading(true);
        setError(null);
        setScores(null);
        setAnswers({});
        try {
            const data = await api.generateQuiz(notebookId);
            setPlan(data);
        } catch (e: any) {
            setError(e.message || "Failed to generate quiz");
        } finally {
            setLoading(false);
        }
    };

    const submit = async () => {
        if (!plan) return;
        setGrading(true);
        try {
            const result = await api.gradeQuiz({
                plan,
                completed_activity_ids: completedActivities,
                quiz_answers: answers,
            });
            setScores(result);
        } catch (e: any) {
            setError(e.message || "Failed to grade quiz");
        } finally {
            setGrading(false);
        }
    };

    const resetAnswerProgress = () => {
        setScores(null);
        setAnswers({});
        setCompletedActivities([]);
    };

    const setAnswer = (id: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
    };

    if (!plan && !loading) {
        return (
            <div style={{ padding: 24 }} role="region" aria-label="Practice quiz">
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
                    Practice Quiz
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                    Generate interactive quiz questions from this material to test your understanding.
                </p>
                {error && (
                    <div style={{ color: "#EF4444", fontSize: 13, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA", marginBottom: 12 }}>
                        {error}
                    </div>
                )}
                <button className="btn btn-primary" style={{ padding: "10px 24px" }} onClick={generate}>
                    Generate Quiz
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 80 }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Generating quiz questions...</span>
            </div>
        );
    }

    if (!plan) return null;

    return (
        <div style={{ padding: 24, overflowY: "auto", maxHeight: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>
                {plan.activities?.length || 0} activities • {plan.quiz.mcq.length} multiple choice • {plan.quiz.short.length} short answer
            </div>

            {/* Activities Section */}
            {plan.activities && plan.activities.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", marginBottom: 16 }}>
                        Kinesthetic Activities
                    </div>
                    {plan.activities.map((act, i) => {
                        const isChecked = completedActivities.includes(act.id);
                        return (
                            <div key={act.id} className="card" style={{ marginBottom: 14, padding: 16 }}>
                                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: scores ? "default" : "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                            if (scores) return;
                                            if (e.target.checked) {
                                                setCompletedActivities(prev => [...prev, act.id]);
                                            } else {
                                                setCompletedActivities(prev => prev.filter(id => id !== act.id));
                                            }
                                        }}
                                        disabled={!!scores}
                                        style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--accent)" }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                                            {i + 1}. {act.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "flex", gap: 8 }}>
                                            <span style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>Time: {act.estimated_minutes} min</span>
                                            <span style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>Diff: {act.difficulty}</span>
                                        </div>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <strong>Concept:</strong> {act.concept}
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                            <strong>Steps:</strong>
                                            <ul style={{ paddingLeft: 20, marginTop: 4, marginBottom: 0 }}>
                                                {act.steps.map((s: string, si: number) => (
                                                    <li key={si} style={{ marginBottom: 2 }}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MCQ Section */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", marginBottom: 16 }}>
                    Multiple Choice
                </div>
                {plan.quiz.mcq.map((q, qi) => (
                    <div key={q.id} className="card" style={{ marginBottom: 14, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                            {qi + 1}. {q.question}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {q.options.map((opt, oi) => {
                                const isSelected = answers[q.id] === opt;
                                const isCorrect = scores && opt === q.answer;
                                const isWrong = scores && isSelected && opt !== q.answer;
                                return (
                                    <label
                                        key={oi}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "6px 10px", borderRadius: 6, cursor: scores ? "default" : "pointer",
                                            border: `1px solid ${isCorrect ? "#34D399" : isWrong ? "#EF4444" : isSelected ? "var(--accent)" : "var(--border)"}`,
                                            background: isCorrect ? "#F0FDF4" : isWrong ? "#FEF2F2" : isSelected ? "var(--accent-light)" : "white",
                                            fontSize: 13,
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name={q.id}
                                            checked={isSelected}
                                            onChange={() => !scores && setAnswer(q.id, opt)}
                                            disabled={!!scores}
                                            style={{ accentColor: "var(--accent)" }}
                                        />
                                        {opt}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Short Answer Section */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", marginBottom: 16 }}>
                    Short Answer
                </div>
                {plan.quiz.short.map((q, qi) => {
                    const userAns = answers[q.id] || "";
                    const result = scores ? scoreShortAnswer(userAns, q.answer) : null;
                    const borderColor = result
                        ? result.score >= 0.6 ? "#34D399" : result.score >= 0.3 ? "#F59E0B" : "#EF4444"
                        : "var(--border)";
                    const bgColor = result
                        ? result.score >= 0.6 ? "#F0FDF4" : result.score >= 0.3 ? "#FFFBEB" : "#FEF2F2"
                        : "white";
                    return (
                        <div key={q.id} className="card" style={{ marginBottom: 14, padding: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                                {qi + 1}. {q.question}
                            </div>
                            <input
                                type="text"
                                placeholder="Type your answer..."
                                value={userAns}
                                onChange={(e) => !scores && setAnswer(q.id, e.target.value)}
                                disabled={!!scores}
                                style={{
                                    width: "100%", padding: "8px 12px", borderRadius: 6, fontSize: 13,
                                    border: `1px solid ${borderColor}`,
                                    background: bgColor,
                                }}
                            />
                            {scores && result && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        Expected: <strong>{q.answer}</strong>
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                                        background: result.score >= 0.6 ? "#ECFDF5" : result.score >= 0.3 ? "#FEF3C7" : "#FEE2E2",
                                        color: result.score >= 0.6 ? "#059669" : result.score >= 0.3 ? "#D97706" : "#DC2626",
                                    }}>
                                        {result.label}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Submit / Scores */}
            {!scores ? (
                <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-primary" style={{ padding: "10px 24px" }} onClick={submit} disabled={grading}>
                        {grading ? "Grading..." : "Submit Answers"}
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "10px 16px", fontSize: 12 }} onClick={resetAnswerProgress}>
                        Reset Progress
                    </button>
                </div>
            ) : (
                <div className="card" style={{ padding: 20, background: "#FAFAFC" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Results</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                        {[
                            ["MCQ Score", scores.mcq_score],
                            ["Short Answer Score", scores.short_score],
                            ["Quiz Score", scores.quiz_score],
                            ["Mastery Score", scores.kinesthetic_mastery_score],
                        ].map(([label, val]) => (
                            <div key={label as string} style={{ padding: "10px 14px", background: "white", borderRadius: 8, border: "1px solid var(--border)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label as string}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: (val as number) >= 70 ? "#34D399" : (val as number) >= 40 ? "#F59E0B" : "#EF4444" }}>
                                    {val as number}%
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="btn btn-primary" style={{ padding: "10px 24px" }} onClick={resetAnswerProgress}>
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
