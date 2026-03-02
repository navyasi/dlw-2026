"use client";
import type { PromptEvent, RecallState } from "@/hooks/useActiveRecall";

interface Props {
    state: RecallState;
    prompt: PromptEvent;
    transcript: string;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onAcknowledge: () => void;
    onSkip: () => void;
}

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    correct: { bg: "#F0FDF4", border: "#86EFAC", text: "#166534", label: "Correct" },
    partial: { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E", label: "Partially Correct" },
    incorrect: { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B", label: "Incorrect" },
};

export default function RecallModal({ state, prompt, transcript, onStartRecording, onStopRecording, onAcknowledge, onSkip }: Props) {
    const gradeInfo = prompt.grade ? GRADE_COLORS[prompt.grade] : null;

    return (
        /* Bottom-right inline card — NOT a centered overlay */
        <div style={{
            background: "white", borderRadius: 14, padding: 22,
            border: "1px solid var(--border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            marginTop: 16,
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
                    Active Recall — Slide {prompt.slidePageNum}
                </div>
                <button
                    onClick={onSkip}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 12, color: "var(--text-muted)", padding: "4px 8px",
                    }}
                >
                    Skip
                </button>
            </div>

            {/* Question */}
            <div style={{
                fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginBottom: 16,
                color: "var(--text)", padding: "10px 14px", background: "#F8FAFC",
                borderRadius: 8, border: "1px solid var(--border)",
            }}>
                {prompt.question}
            </div>

            {/* PAUSED_FOR_PROMPT: show mic button */}
            {state === "paused_for_prompt" && (
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        Speak your answer aloud.
                    </p>
                    <button
                        onClick={onStartRecording}
                        style={{
                            width: 52, height: 52, borderRadius: "50%",
                            background: "var(--accent)", border: "none", cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
                            transition: "transform 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </button>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Tap to start</p>
                </div>
            )}

            {/* RECORDING: show live transcript + stop button */}
            {state === "recording" && (
                <div>
                    <div style={{
                        minHeight: 60, padding: 12, borderRadius: 8,
                        border: "2px solid var(--accent)", background: "#F5F3FF",
                        fontSize: 13, lineHeight: 1.5, color: "var(--text)",
                        marginBottom: 12,
                    }}>
                        {transcript || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Listening...</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                        <button
                            onClick={onStopRecording}
                            className="btn btn-primary"
                            style={{
                                padding: "8px 22px", fontSize: 12,
                                background: "#EF4444",
                                display: "flex", alignItems: "center", gap: 6,
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <rect x="4" y="4" width="16" height="16" rx="2" />
                            </svg>
                            Stop & Submit
                        </button>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 6 }}>
                        <div style={{
                            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                            background: "#EF4444", animation: "pulse 1s infinite",
                        }} />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 5 }}>Recording</span>
                    </div>
                </div>
            )}

            {/* GRADING: spinner */}
            {state === "grading" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 0" }}>
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Checking your answer...</span>
                </div>
            )}

            {/* FEEDBACK: grade + suggestions */}
            {state === "feedback" && (
                <div>
                    {/* Your answer */}
                    {prompt.transcript && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>
                                Your Answer
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text)", padding: "8px 12px", background: "#F8F9FA", borderRadius: 6 }}>
                                {prompt.transcript}
                            </div>
                        </div>
                    )}

                    {/* Grade badge */}
                    {gradeInfo && (
                        <div style={{
                            display: "inline-block", padding: "3px 12px", borderRadius: 99,
                            background: gradeInfo.bg, border: `1px solid ${gradeInfo.border}`,
                            color: gradeInfo.text, fontSize: 12, fontWeight: 700,
                            marginBottom: 10,
                        }}>
                            {gradeInfo.label}
                        </div>
                    )}

                    {/* Feedback text */}
                    {prompt.feedback && (
                        <div style={{
                            fontSize: 12, lineHeight: 1.5, color: "var(--text)",
                            padding: "10px 14px", background: "#F8FAFC",
                            borderRadius: 8, border: "1px solid var(--border)",
                            marginBottom: 10,
                        }}>
                            {prompt.feedback}
                        </div>
                    )}

                    {/* Missing points */}
                    {prompt.missingPoints.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>
                                Missing Points
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5, color: "var(--text)" }}>
                                {prompt.missingPoints.map((mp, i) => (
                                    <li key={i}>{mp}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Continue button */}
                    <button
                        onClick={onAcknowledge}
                        className="btn btn-primary"
                        style={{ padding: "8px 22px", width: "100%", fontSize: 12 }}
                    >
                        Continue Listening
                    </button>
                </div>
            )}
        </div>
    );
}
