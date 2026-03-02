/**
 * Typed API client for the Study Mode backend.
 * All fetch calls go to http://localhost:8000.
 */

const BASE = "http://localhost:8000";

async function jsonFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        throw new Error(`API ${path} → ${res.status}`);
    }
    return res.json() as Promise<T>;
}

// ─── Data types ────────────────────────────────────────────────────────────

export interface Course {
    id: number;
    title: string;
    description: string | null;
    lecture_count: number;
    tutorial_count: number;
}

export interface CourseSection {
    id: number;
    title: string;
    source_type: "slides" | "article" | "tutorial";
    source_ref: string | null;
    section_order: number;
    page_count: number;
}

export interface CourseDetail {
    id: number;
    title: string;
    code?: string;
    description: string | null;
    lectures: CourseSection[];
    tutorials: CourseSection[];
    lecture_count: number;
    tutorial_count: number;
}

export interface Notebook {
    id: number;
    title: string;
    source_type: "slides" | "article" | "tutorial";
    source_ref: string | null;
    page_count?: number;
    course_id?: number | null;
}

export interface ConceptBoxData {
    term: string;
    definition: string;
    intuition?: string;
    why_it_matters?: string;
}

export interface ComparisonTableData {
    headers: string[];
    rows: string[][];
}

export interface WorkedExampleData {
    title: string;
    steps: string[];
    result: string;
}

export interface SemanticBlockData {
    tag: "Definition" | "Example" | "Exception" | "Trap";
    text: string;
}

export interface VisualBlock {
    page_num: number;
    content_type: string;
    visual_density_score: number;
    concept_box?: ConceptBoxData;
    flow_diagram?: string;
    comparison_table?: ComparisonTableData;
    worked_examples?: WorkedExampleData[];
    semantic_blocks?: SemanticBlockData[];
}

export interface NoteBlockEntry {
    id: number;
    notebook_id: number;
    page_num: number;
    block: VisualBlock;
}

export interface NotebookDetail {
    id: number;
    title: string;
    source_type: string;
    source_ref: string | null;
    note_blocks: NoteBlockEntry[];
}

export interface ConceptNode {
    id: string;
    label: string;
    mastery: number;
    notebook_title?: string;
}

export interface ConceptEdge {
    from: string;
    to: string;
    label: string;
}

export interface ConceptMapData {
    nodes: ConceptNode[];
    edges: ConceptEdge[];
}

export interface TutorialStep {
    step_num: number;
    description: string;
    formula?: string | null;
}

export interface TutorialQuestion {
    question_num: number;
    question_text: string;
    summary?: string;
    steps: TutorialStep[];
    full_answer?: string;
    mermaid_flow?: string;
    error_hints?: Record<string, string>;
}

export interface TutorialFlowData {
    question_summary: string;
    steps: TutorialStep[];
    mermaid_flow: string;
    error_hints: Record<string, string>;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

// Backward-compat aliases — components import these names
export type ConceptBox = ConceptBoxData;
export type ComparisonTable = ComparisonTableData;
export type SemanticBlock = SemanticBlockData;
export type WorkedExample = WorkedExampleData;

// ─── API calls ─────────────────────────────────────────────────────────────

export const api = {
    // Courses
    listCourses: () => jsonFetch<Course[]>("/courses/"),
    getCourse: (id: number) => jsonFetch<CourseDetail>(`/courses/${id}`),
    getCourseConceptMap: (courseId: number) =>
        jsonFetch<ConceptMapData>(`/courses/${courseId}/concept-map`),
    generateCourseConceptMap: (courseId: number) =>
        jsonFetch<{ ok: boolean }>(`/courses/${courseId}/concept-map/generate`, { method: "POST" }),

    // Notebooks (individual sections)
    listNotebooks: () => jsonFetch<Notebook[]>("/notebooks/"),
    getNotebook: (id: number) => jsonFetch<NotebookDetail>(`/notebooks/${id}`),

    // Concept maps (per-notebook, kept for backward compat)
    getConceptMap: (notebookId: number) =>
        jsonFetch<ConceptMapData>(`/concept-map/${notebookId}`),

    // Tutorial
    getTutorialFlow: (notebookId: number) =>
        jsonFetch<{ notebook_id: number; questions: TutorialQuestion[] }>(`/tutorial/${notebookId}/flow`),
    flagStep: (notebookId: number, stepNum: number) =>
        jsonFetch<{ hint: string | null }>(`/tutorial/${notebookId}/flag`, {
            method: "POST",
            body: JSON.stringify({ step_num: stepNum }),
        }),

    // Chat
    chat: (payload: { notebook_id?: number; course_id?: number; messages: ChatMessage[] }) =>
        jsonFetch<{ reply: string }>("/chat/", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    // Audio — with IndexedDB persistent cache + singleflight
    generateAudio: async (notebookId: number): Promise<string> => {
        // 1. Check IndexedDB cache first (survives page reload)
        const { getCachedAudioUrl, cacheAudioBlob } = await import("@/lib/audioCache");
        const cached = await getCachedAudioUrl(notebookId);
        if (cached) return cached;

        // 2. Singleflight: if a request is already in-flight, await it
        const key = `audio_inflight_${notebookId}`;
        if ((window as any)[key]) return (window as any)[key];

        const promise = (async () => {
            try {
                const res = await fetch(`${BASE}/audio/${notebookId}/generate`, { method: "POST" });
                if (!res.ok) throw new Error(`Audio generation failed: ${res.status}`);
                const blob = await res.blob();
                // Store in IndexedDB for persistence
                await cacheAudioBlob(notebookId, blob);
                return URL.createObjectURL(blob);
            } finally {
                delete (window as any)[key];
            }
        })();
        (window as any)[key] = promise;
        return promise;
    },

    /** Clear both backend + frontend cache, then regenerate fresh */
    regenerateAudio: async (notebookId: number): Promise<string> => {
        const { clearCachedAudio, cacheAudioBlob } = await import("@/lib/audioCache");
        // Clear frontend IndexedDB cache
        await clearCachedAudio(notebookId);
        // Clear backend disk cache
        await fetch(`${BASE}/audio/${notebookId}/cache`, { method: "DELETE" }).catch(() => { });
        // Generate fresh
        const res = await fetch(`${BASE}/audio/${notebookId}/generate`, { method: "POST" });
        if (!res.ok) throw new Error(`Audio regeneration failed: ${res.status}`);
        const blob = await res.blob();
        await cacheAudioBlob(notebookId, blob);
        return URL.createObjectURL(blob);
    },

    // Quiz
    generateQuiz: (notebookId: number) =>
        jsonFetch<any>(`/quiz/${notebookId}/generate`, { method: "POST" }),
    gradeQuiz: (payload: { plan: any; completed_activity_ids: string[]; quiz_answers: Record<string, string> }) =>
        jsonFetch<any>("/quiz/grade", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    // Active Recall
    gradeRecall: (payload: { question: string; expected_key_points: string[]; transcript: string }) =>
        jsonFetch<{ label: string; confidence: number; missing_points: string[]; suggestion: string }>("/recall/grade", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};
