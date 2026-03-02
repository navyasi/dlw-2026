"use client";
import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";

interface Props {
    notebookId?: number;
    courseId?: number;
    open: boolean;
    onClose: () => void;
}

export default function ChatPanel({ notebookId, courseId, open, onClose }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;
        const userMsg: ChatMessage = { role: "user", content: text };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput("");
        setLoading(true);
        try {
            const res = await api.chat({
                notebook_id: notebookId,
                course_id: courseId,
                messages: next,
            });
            setMessages([...next, { role: "assistant", content: res.reply }]);
        } catch {
            setMessages([...next, { role: "assistant", content: "Sorry, I couldn't reach the AI. Is the backend running?" }]);
        }
        setLoading(false);
    };

    if (!open) return null;

    return (
        <div style={{
            position: "fixed", right: 0, top: 56, bottom: 0, width: 380,
            background: "white", borderLeft: "1px solid var(--border)",
            display: "flex", flexDirection: "column", zIndex: 50,
            boxShadow: "-4px 0 24px rgba(0,0,0,0.07)",
        }}>
            {/* Header */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399", display: "inline-block" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Study Assistant</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--accent-light)", borderRadius: 99, padding: "2px 8px", marginLeft: 4 }}>
                    {notebookId ? "This section" : "Full course"}
                </span>
                <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>×</button>
            </div>

            {/* Message history */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Ask anything about this material</div>
                        <div style={{ fontSize: 12 }}>The AI has context from your study notes.</div>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{
                        marginBottom: 14,
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    }}>
                        {m.role === "user" ? (
                            <div style={{
                                maxWidth: "82%", padding: "10px 14px",
                                borderRadius: "18px 18px 4px 18px",
                                background: "var(--accent)", color: "white",
                                fontSize: 13, lineHeight: 1.6,
                            }}>
                                {m.content}
                            </div>
                        ) : (
                            <div style={{
                                maxWidth: "92%", padding: "12px 14px",
                                borderRadius: "18px 18px 18px 4px",
                                background: "#F1F5F9", color: "var(--text)",
                                fontSize: 13, lineHeight: 1.65,
                            }}
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                            />
                        )}
                    </div>
                ))}
                {loading && (
                    <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>
                        {[0, 1, 2].map((i) => (
                            <span key={i} style={{
                                width: 7, height: 7, borderRadius: "50%",
                                background: "var(--accent-light)",
                                border: "2px solid var(--accent)",
                                animation: `bounce 0.8s ${i * 0.15}s infinite`,
                                display: "inline-block",
                            }} />
                        ))}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask about this material… (Enter to send)"
                    rows={2}
                    style={{
                        flex: 1, resize: "none", border: "1.5px solid var(--border)", borderRadius: 10,
                        padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
                        outline: "none", lineHeight: 1.5, color: "var(--text)",
                        background: "#FAFAFC",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
                <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="btn btn-primary"
                    style={{ padding: "9px 16px", fontSize: 13, borderRadius: 10, alignSelf: "stretch" }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}
