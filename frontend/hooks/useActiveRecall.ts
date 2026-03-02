"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/* ────────────────────────────────────────────────────────────────────── */
/*  Types                                                                */
/* ────────────────────────────────────────────────────────────────────── */

export interface SlideChunk {
    pageNum: number;
    term: string;
    definition: string;
    keyPoints: string[];
}

export interface PromptEvent {
    id: string;
    slidePageNum: number;
    timestamp: number;
    question: string;
    expectedKeyPoints: string[];
    transcript: string | null;
    grade: "correct" | "partial" | "incorrect" | null;
    feedback: string | null;
    missingPoints: string[];
    acknowledged: boolean;
}

export type RecallState =
    | "idle"
    | "playing"
    | "paused_for_prompt"
    | "recording"
    | "transcribing"
    | "grading"
    | "feedback";

/* ────────────────────────────────────────────────────────────────────── */
/*  Question templates                                                   */
/* ────────────────────────────────────────────────────────────────────── */

const QUESTION_TEMPLATES = [
    (term: string) => `What is ${term}?`,
    (term: string) => `Explain ${term} in your own words.`,
    (term: string) => `Why does ${term} matter?`,
    (term: string) => `Describe the key idea behind ${term}.`,
    (term: string) => `What would happen without ${term}?`,
];

function generateQuestion(chunk: SlideChunk, usedQuestions: Set<string>): { question: string; expectedKeyPoints: string[] } {
    // Pick a template that hasn't been used for this term
    for (const tpl of QUESTION_TEMPLATES) {
        const q = tpl(chunk.term);
        const key = `${chunk.pageNum}:${q}`;
        if (!usedQuestions.has(key)) {
            usedQuestions.add(key);
            return { question: q, expectedKeyPoints: chunk.keyPoints };
        }
    }
    // Fallback
    const q = `Explain ${chunk.term} in your own words.`;
    return { question: q, expectedKeyPoints: chunk.keyPoints };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Pause-point detector (heuristic)                                     */
/* ────────────────────────────────────────────────────────────────────── */

// Minimum seconds before first recall prompt
const MIN_FIRST_PROMPT_DELAY = 45;
// Skip the first N chunks (title slides, intro material)
const SKIP_FIRST_CHUNKS = 3;

export function computePausePoints(chunks: SlideChunk[], audioDuration: number): { timestamp: number; chunkIndex: number }[] {
    if (chunks.length <= 1 || audioDuration <= 0) return [];
    const interval = audioDuration / chunks.length;
    const points: { timestamp: number; chunkIndex: number }[] = [];
    // Start from SKIP_FIRST_CHUNKS, and only after MIN_FIRST_PROMPT_DELAY seconds
    for (let i = SKIP_FIRST_CHUNKS; i < chunks.length - 1; i++) {
        const t = (i + 1) * interval;
        if (t >= MIN_FIRST_PROMPT_DELAY) {
            points.push({ timestamp: t, chunkIndex: i });
        }
    }
    return points;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Web Speech API helper                                                */
/* ────────────────────────────────────────────────────────────────────── */

function createSpeechRecognition(): any | null {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    return recognition;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Hook                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

interface UseActiveRecallOptions {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    chunks: SlideChunk[];
    enabled: boolean;
}

export function useActiveRecall({ audioRef, chunks, enabled }: UseActiveRecallOptions) {
    const [state, setState] = useState<RecallState>("idle");
    const [currentPrompt, setCurrentPrompt] = useState<PromptEvent | null>(null);
    const [history, setHistory] = useState<PromptEvent[]>([]);
    const [transcript, setTranscript] = useState("");

    const pausePointsRef = useRef<{ timestamp: number; chunkIndex: number }[]>([]);
    const triggeredRef = useRef<Set<number>>(new Set());
    const usedQuestionsRef = useRef<Set<string>>(new Set());
    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef<string>(""); // Always-current transcript for stopRecording
    const currentPromptRef = useRef<PromptEvent | null>(null);

    // Keep refs in sync with state
    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
    useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);

    // Compute pause points when audio metadata loads
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !enabled) return;

        const onLoadedMetadata = () => {
            pausePointsRef.current = computePausePoints(chunks, audio.duration);
            triggeredRef.current = new Set();
        };

        if (audio.duration) onLoadedMetadata();
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        return () => audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    }, [audioRef, chunks, enabled]);

    // Handle time updates to trigger pauses
    const handleTimeUpdate = useCallback((currentTime: number) => {
        if (!enabled || state !== "playing") return;

        for (const pp of pausePointsRef.current) {
            if (triggeredRef.current.has(pp.chunkIndex)) continue;
            // Trigger if within 1 second of the pause point
            if (Math.abs(currentTime - pp.timestamp) < 1.0) {
                triggeredRef.current.add(pp.chunkIndex);
                const chunk = chunks[pp.chunkIndex];
                if (!chunk) continue;

                // Pause audio
                audioRef.current?.pause();

                // Generate question
                const { question, expectedKeyPoints } = generateQuestion(chunk, usedQuestionsRef.current);
                const prompt: PromptEvent = {
                    id: `${pp.chunkIndex}-${Date.now()}`,
                    slidePageNum: chunk.pageNum,
                    timestamp: currentTime,
                    question,
                    expectedKeyPoints,
                    transcript: null,
                    grade: null,
                    feedback: null,
                    missingPoints: [],
                    acknowledged: false,
                };
                setCurrentPrompt(prompt);
                setState("paused_for_prompt");
                break;
            }
        }
    }, [enabled, state, chunks, audioRef]);

    // Start recording
    const startRecording = useCallback(() => {
        setTranscript("");
        const recognition = createSpeechRecognition();
        if (!recognition) {
            setTranscript("[Speech recognition not supported in this browser]");
            setState("feedback");
            return;
        }

        recognitionRef.current = recognition;

        let finalTranscript = "";
        recognition.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + " ";
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTranscript(finalTranscript + interim);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === "not-allowed") {
                setTranscript("[Microphone permission denied. Please allow access and try again.]");
            }
        };

        recognition.start();
        setState("recording");
    }, []);

    // Stop recording and submit
    const stopRecording = useCallback(async () => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;

        // Use ref for latest transcript value (React state may be stale in closure)
        const finalTranscript = transcriptRef.current.trim();
        const prompt = currentPromptRef.current;
        if (!finalTranscript || !prompt) {
            setState("paused_for_prompt");
            return;
        }

        setState("grading");

        try {
            const result = await api.gradeRecall({
                question: prompt.question,
                expected_key_points: prompt.expectedKeyPoints,
                transcript: finalTranscript,
            });

            const updatedPrompt: PromptEvent = {
                ...prompt,
                transcript: finalTranscript,
                grade: result.label as any,
                feedback: result.suggestion,
                missingPoints: result.missing_points,
                acknowledged: false,
            };
            setCurrentPrompt(updatedPrompt);
            setState("feedback");
        } catch (e: any) {
            // Fallback: skip grading on error
            const updatedPrompt: PromptEvent = {
                ...prompt,
                transcript: finalTranscript,
                grade: null,
                feedback: "Could not grade answer. Moving on.",
                missingPoints: [],
                acknowledged: false,
            };
            setCurrentPrompt(updatedPrompt);
            setState("feedback");
        }
    }, []); // No dependencies — uses refs for latest values

    // Acknowledge and resume
    const acknowledge = useCallback(() => {
        if (currentPrompt) {
            const finished = { ...currentPrompt, acknowledged: true };
            setHistory((prev) => [...prev, finished]);

            // Save mastery to localStorage
            try {
                const masteryKey = `recall_mastery_${currentPrompt.slidePageNum}`;
                const existing = JSON.parse(localStorage.getItem(masteryKey) || '{"score":0,"attempts":0,"correct":0}');
                existing.attempts += 1;
                if (currentPrompt.grade === "correct") existing.correct += 1;
                existing.score = Math.round((existing.correct / existing.attempts) * 100);
                existing.lastSeen = Date.now();
                localStorage.setItem(masteryKey, JSON.stringify(existing));
            } catch { /* ignore */ }
        }
        setCurrentPrompt(null);
        setTranscript("");
        setState("playing");

        // Resume audio
        audioRef.current?.play();
    }, [currentPrompt, audioRef]);

    // Skip question
    const skipQuestion = useCallback(() => {
        setCurrentPrompt(null);
        setTranscript("");
        setState("playing");
        audioRef.current?.play();
    }, [audioRef]);

    // Track playing state — if user hits play while a prompt is showing, skip it
    const onPlay = useCallback(() => {
        if (!enabled) return;
        if (state === "paused_for_prompt") {
            // User clicked play button = skip
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            setCurrentPrompt(null);
            setTranscript("");
        }
        setState("playing");
    }, [enabled, state]);
    const onPause = useCallback(() => {
        // Don't change state if paused by recall system
    }, []);

    return {
        state,
        currentPrompt,
        history,
        transcript,
        handleTimeUpdate,
        startRecording,
        stopRecording,
        acknowledge,
        skipQuestion,
        onPlay,
        onPause,
    };
}
