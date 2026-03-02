"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useActiveRecall, type SlideChunk } from "@/hooks/useActiveRecall";
import RecallModal from "@/components/RecallModal";

interface Props {
    notebookId: number;
    /** Pre-cached audio blob URL from parent (survives tab switches) */
    cachedAudioUrl?: string | null;
    /** Callback when audio is generated — parent should cache the URL */
    onAudioGenerated?: (url: string) => void;
    /** Slide chunks extracted from note_blocks for Active Recall */
    slideChunks?: SlideChunk[];
}

export default function AudioPlayer({
    notebookId,
    cachedAudioUrl,
    onAudioGenerated,
    slideChunks = [],
}: Props) {
    const [audioUrl, setAudioUrl] = useState<string | null>(cachedAudioUrl ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recallEnabled, setRecallEnabled] = useState(false);
    const [isCached, setIsCached] = useState(!!cachedAudioUrl);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Sync with parent cache if it changes
    useEffect(() => {
        if (cachedAudioUrl) {
            setAudioUrl(cachedAudioUrl);
            setIsCached(true);
        }
    }, [cachedAudioUrl]);

    // Active Recall hook
    const recall = useActiveRecall({
        audioRef,
        chunks: slideChunks,
        enabled: recallEnabled && !!audioUrl,
    });

    const generate = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = await api.generateAudio(notebookId);
            setAudioUrl(url);
            setIsCached(true);
            onAudioGenerated?.(url);
        } catch (e: any) {
            setError(e.message || "Failed to generate audio");
        } finally {
            setLoading(false);
        }
    };

    const regenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = await api.regenerateAudio(notebookId);
            setAudioUrl(url);
            setIsCached(false);
            onAudioGenerated?.(url);
        } catch (e: any) {
            setError(e.message || "Failed to regenerate audio");
        } finally {
            setLoading(false);
        }
    };

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            recall.handleTimeUpdate(audioRef.current.currentTime);
        }
    }, [recall.handleTimeUpdate]);

    return (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }} role="region" aria-label="Audio lecture player">
            <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
                    Audio Lecture
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                    Generate a spoken lecture from the slide content using AI text-to-speech.
                    This may take 30–60 seconds.
                </p>
            </div>

            {!audioUrl && !loading && (
                <button className="btn btn-primary" style={{ alignSelf: "flex-start", padding: "10px 24px" }} onClick={generate}>
                    Generate Audio Lecture
                </button>
            )}

            {loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "60px 0" }}>
                    <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                    <span style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Generating audio lecture... this takes about a minute</span>
                </div>
            )}

            {error && (
                <div style={{ color: "#EF4444", fontSize: 13, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA" }}>
                    {error}
                    <button className="btn btn-ghost" style={{ marginLeft: 12, fontSize: 12 }} onClick={generate}>Retry</button>
                </div>
            )}

            {audioUrl && (
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                                Lecture Audio Ready
                            </div>
                            {isCached && (
                                <span style={{
                                    fontSize: 10, fontWeight: 600, padding: "2px 8px",
                                    background: "#ECFDF5", color: "#059669", borderRadius: 99,
                                    border: "1px solid #A7F3D0",
                                }}>
                                    Using cached audio
                                </span>
                            )}
                        </div>
                        {slideChunks.length > 0 && (
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, userSelect: "none" }}>
                                <input
                                    type="checkbox"
                                    checked={recallEnabled}
                                    onChange={() => setRecallEnabled(!recallEnabled)}
                                    style={{ accentColor: "var(--accent)" }}
                                />
                                <span style={{ color: recallEnabled ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>
                                    Active Recall
                                </span>
                            </label>
                        )}
                    </div>
                    <audio
                        ref={audioRef}
                        controls
                        src={audioUrl}
                        style={{ width: "100%" }}
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={recall.onPlay}
                        onPause={recall.onPause}
                        aria-label="Lecture audio playback"
                    >
                        Your browser does not support the audio element.
                    </audio>

                    {recallEnabled && recall.history.length > 0 && (
                        <div style={{ marginTop: 14, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 6 }}>
                                Recall Progress — {recall.history.filter(h => h.grade === "correct").length}/{recall.history.length} correct
                            </div>
                            <div style={{ display: "flex", gap: 4.5, flexWrap: "wrap" }}>
                                {recall.history.map((h) => (
                                    <div
                                        key={h.id}
                                        title={`Slide ${h.slidePageNum}: ${h.question}`}
                                        style={{
                                            width: 22, height: 22, borderRadius: 4, fontSize: 10,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: 700,
                                            background: h.grade === "correct" ? "#D1FAE5" : h.grade === "partial" ? "#FEF3C7" : "#FEE2E2",
                                            color: h.grade === "correct" ? "#065F46" : h.grade === "partial" ? "#92400E" : "#991B1B",
                                            border: `1px solid ${h.grade === "correct" ? "#6EE7B7" : h.grade === "partial" ? "#FCD34D" : "#FCA5A5"}`,
                                        }}
                                    >
                                        {h.slidePageNum}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <a href={audioUrl} download={`lecture_${notebookId}.mp3`} className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 14px", textDecoration: "none" }}>
                            Download MP3
                        </a>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 14px" }} onClick={regenerate}>
                            Regenerate
                        </button>
                    </div>
                </div>
            )}

            {/* Active Recall Modal */}
            {recall.currentPrompt && (recall.state === "paused_for_prompt" || recall.state === "recording" || recall.state === "grading" || recall.state === "feedback") && (
                <RecallModal
                    state={recall.state}
                    prompt={recall.currentPrompt}
                    transcript={recall.transcript}
                    onStartRecording={recall.startRecording}
                    onStopRecording={recall.stopRecording}
                    onAcknowledge={recall.acknowledge}
                    onSkip={recall.skipQuestion}
                />
            )}
        </div>
    );
}
