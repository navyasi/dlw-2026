"use client";
import { useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

interface TutorialStep {
    step_num: number;
    description: string;
    formula?: string | null;
}

interface TutorialQuestion {
    question_num: number;
    question_text: string;
    summary?: string;
    steps: TutorialStep[];
    full_answer?: string;
    mermaid_flow?: string;
    error_hints?: Record<string, string>;
}

interface Props {
    questions: TutorialQuestion[];
    onFlag: (notebookId: number, stepNum: number) => Promise<string | null>;
    notebookId: number;
}

export default function TutorialFlow({ questions, onFlag, notebookId }: Props) {
    const [expandedQ, setExpandedQ] = useState<number>(0);
    const [shownAnswers, setShownAnswers] = useState<Set<number>>(new Set());
    const [errorSteps, setErrorSteps] = useState<Record<number, number>>({});
    const [hints, setHints] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<string | null>(null);

    const toggleAnswer = (qNum: number) => {
        setShownAnswers((prev) => {
            const next = new Set(prev);
            if (next.has(qNum)) next.delete(qNum);
            else next.add(qNum);
            return next;
        });
    };

    const handleFlag = async (qNum: number, stepNum: number) => {
        const key = `${qNum}-${stepNum}`;
        setLoading(key);
        setErrorSteps((prev) => ({ ...prev, [qNum]: stepNum }));
        const hint = await onFlag(notebookId, stepNum);
        if (hint) setHints((prev) => ({ ...prev, [key]: hint }));
        setLoading(null);
    };

    if (!questions || questions.length === 0) {
        return <div className="empty-state"><p>No questions found in this tutorial.</p></div>;
    }

    return (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {questions.map((q, qi) => {
                const isOpen = expandedQ === qi;
                const answerShown = shownAnswers.has(q.question_num);

                return (
                    <div key={q.question_num} style={{
                        marginBottom: 14, border: `1.5px solid ${isOpen ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 12, background: "white", overflow: "hidden",
                        boxShadow: isOpen ? "0 4px 20px rgba(99,102,241,0.1)" : "var(--shadow-card)",
                    }}>
                        {/* Question header */}
                        <button
                            onClick={() => setExpandedQ(isOpen ? -1 : qi)}
                            style={{
                                width: "100%", textAlign: "left", padding: "14px 18px",
                                background: isOpen ? "var(--accent-light)" : "white",
                                border: "none", borderBottom: isOpen ? "1px solid var(--border)" : "none",
                                cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
                            }}
                        >
                            <span style={{
                                width: 28, height: 28, borderRadius: "50%", background: "var(--accent)",
                                color: "white", fontWeight: 700, fontSize: 13, display: "flex",
                                alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                            }}>
                                {q.question_num}
                            </span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: isOpen ? "var(--accent)" : "var(--text)", marginBottom: 2 }}>
                                    {q.summary || `Question ${q.question_num}`}
                                </div>
                                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                                    {q.question_text?.slice(0, 140)}{(q.question_text?.length ?? 0) > 140 ? "…" : ""}
                                </div>
                            </div>
                            <span style={{ fontSize: 16, color: "var(--text-muted)", marginLeft: 8, lineHeight: 1, paddingTop: 2 }}>
                                {isOpen ? "▲" : "▼"}
                            </span>
                        </button>

                        {isOpen && (
                            <div style={{ padding: "16px 18px 20px" }}>
                                {/* Full question text */}
                                <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 18, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid var(--border)" }}>
                                    {q.question_text}
                                </div>

                                {/* Steps */}
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 10 }}>
                                    Solution Steps — click a step if you're stuck
                                </div>

                                {q.steps.map((step, idx) => {
                                    const errored = errorSteps[q.question_num] === step.step_num;
                                    const hintKey = `${q.question_num}-${step.step_num}`;
                                    return (
                                        <div key={step.step_num}>
                                            <div
                                                className={`tutorial-step ${errored ? "error" : ""}`}
                                                onClick={() => handleFlag(q.question_num, step.step_num)}
                                                title="Click to flag if stuck"
                                            >
                                                <div className="step-num">{loading === hintKey ? "…" : step.step_num}</div>
                                                <div className="step-body">
                                                    <div className="step-desc">{step.description}</div>
                                                    {step.formula && <div className="step-formula">{step.formula}</div>}
                                                    {errored && hints[hintKey] && (
                                                        <div className="hint-bubble">{hints[hintKey]}</div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: errored ? "#EF4444" : "var(--text-muted)", whiteSpace: "nowrap", paddingTop: 2, marginLeft: "auto" }}>
                                                    {errored ? "Flagged" : "Flag"}
                                                </div>
                                            </div>
                                            {idx < q.steps.length - 1 && <div className="step-connector" />}
                                        </div>
                                    );
                                })}

                                {/* Full Answer */}
                                {q.full_answer && (
                                    <div style={{ marginTop: 20 }}>
                                        <button
                                            onClick={() => toggleAnswer(q.question_num)}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 13, width: "100%", justifyContent: "center", borderRadius: 10 }}
                                        >
                                            {answerShown ? "Hide Full Answer" : "Show Full Answer"}
                                        </button>
                                        {answerShown && (
                                            <div style={{
                                                marginTop: 12, padding: "18px 20px",
                                                background: "white", border: "1px solid var(--border)",
                                                borderRadius: 10, boxShadow: "var(--shadow-card)",
                                            }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#16A34A", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
                                                    Full Solution
                                                </div>
                                                <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--text)" }}
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(q.full_answer) }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
