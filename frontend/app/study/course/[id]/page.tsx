"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type CourseDetail, type CourseSection, type NotebookDetail, type TutorialQuestion } from "@/lib/api";
import ConceptBox from "@/components/ConceptBox";
import ComparisonTable from "@/components/ComparisonTable";
import WorkedExamples from "@/components/WorkedExamples";
import SemanticBlocks from "@/components/SemanticBlocks";
import TutorialFlow from "@/components/TutorialFlow";
import ChatPanel from "@/components/ChatPanel";
import AudioPlayer from "@/components/AudioPlayer";
import QuizPanel from "@/components/QuizPanel";
import type { SlideChunk } from "@/hooks/useActiveRecall";

const FlowDiagram = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });
const ConceptMap = dynamic(() => import("@/components/ConceptMap"), { ssr: false });

interface Props { params: Promise<{ id: string }> }
type MainView = "notes" | "concept-map" | "tutorial";
type ContentMode = "visual" | "audio" | "kinesthetic" | "quiz" | "lectures" | "tutorials";

const SOURCE_LABEL: Record<string, string> = {
    slides: "Lecture",
    article: "Website",
    tutorial: "Tutorial",
};

export default function CoursePage({ params }: Props) {
    const [courseId, setCourseId] = useState<number | null>(null);
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [activeSection, setActiveSection] = useState<CourseSection | null>(null);
    const [activeTab, setActiveTab] = useState<"lectures" | "tutorials">("lectures");
    const [mainView, setMainView] = useState<MainView>("notes");
    const [contentMode, setContentMode] = useState<ContentMode>("visual");
    const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
    const [tutorialQuestions, setTutorialQuestions] = useState<TutorialQuestion[] | null>(null);
    const [conceptMapData, setConceptMapData] = useState<any>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [sectionLoading, setSectionLoading] = useState(false);
    // Audio cache: keyed by notebookId so switching tabs doesn't re-generate
    const [audioCache, setAudioCache] = useState<Record<number, string>>({});

    // ── Drag-resize: use CSS variable via ref, no React state during drag ──
    const splitRef = useRef<HTMLDivElement>(null);
    const leftPaneRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const startDrag = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current || !splitRef.current || !leftPaneRef.current) return;
            const rect = splitRef.current.getBoundingClientRect();
            const pct = Math.max(20, Math.min(55, ((e.clientX - rect.left) / rect.width) * 100));
            // Update width directly on the DOM — no React re-render during drag
            leftPaneRef.current.style.width = `${pct}%`;
        };
        const onUp = () => {
            isDragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, []);

    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        params.then((p) => setCourseId(parseInt(p.id)));
    }, [params]);

    useEffect(() => {
        if (!courseId) return;
        setLoading(true);
        api.getCourse(courseId)
            .then((c) => {
                setCourse(c);
                if (c.lectures.length > 0) setActiveSection(c.lectures[0]);
            })
            .finally(() => setLoading(false));
    }, [courseId]);

    useEffect(() => {
        if (!activeSection) return;
        setSectionLoading(true);
        setNotebook(null);
        setTutorialQuestions(null);
        if (activeSection.source_type === "tutorial") {
            setMainView("tutorial");
            api.getTutorialFlow(activeSection.id)
                .then((r) => setTutorialQuestions(r.questions))
                .finally(() => setSectionLoading(false));
        } else {
            setMainView("notes");
            api.getNotebook(activeSection.id)
                .then(setNotebook)
                .finally(() => setSectionLoading(false));
        }
    }, [activeSection]);

    const loadConceptMap = () => {
        if (!courseId) return;
        api.getCourseConceptMap(courseId).then(setConceptMapData);
    };

    useEffect(() => {
        if (mainView === "concept-map" && courseId) loadConceptMap();
    }, [mainView, courseId]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const containerTop = container.getBoundingClientRect().top;
        let currentIdx = activeSlide;

        for (let i = 0; i < slideRefs.current.length; i++) {
            const ref = slideRefs.current[i];
            if (!ref) continue;
            const rect = ref.getBoundingClientRect();
            // if top of this card is above the middle of the container, it's the current one
            if (rect.top <= containerTop + container.clientHeight * 0.4) {
                currentIdx = i;
            }
        }
        if (currentIdx !== activeSlide) setActiveSlide(currentIdx);
    };

    // Auto-track mastery when viewing slides
    useEffect(() => {
        if (!notebook || mainView !== "notes" || !conceptMapData) return;
        const currentBlock = notebook.note_blocks[activeSlide];
        if (currentBlock?.block?.concept_box?.term) {
            const term = currentBlock.block.concept_box.term.toLowerCase();
            const node = conceptMapData.nodes.find((n: any) => n.label.toLowerCase() === term);
            if (node && node.mastery < 0.5) {
                const idNum = parseInt(node.id);
                fetch(`http://localhost:8000/concept-map/0/mastery/${idNum}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mastery: 0.5 }),
                }).then(() => {
                    if (courseId) api.getCourseConceptMap(courseId).then(setConceptMapData);
                }).catch(() => { });
            }
        }
    }, [activeSlide, notebook, conceptMapData, courseId, mainView]);

    const selectSection = (s: CourseSection) => {
        setActiveSection(s);
        setActiveSlide(0);
        slideRefs.current = [];
    };

    const scrollToSlide = (idx: number) => {
        // We don't set activeSlide here; the IntersectionObserver will automatically update it when the slide scrolls into view.
        slideRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (loading) return <div className="spinner" />;
    if (!course) return <div className="empty-state"><h3>Course not found</h3></div>;

    const allSections = activeTab === "lectures" ? course.lectures : course.tutorials;

    return (
        <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
            {/* Top Toolbar */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "rgba(248, 247, 244, 0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <Link href="http://localhost:8080/study.html" style={{ color: "var(--text-muted)", fontSize: 12 }}>← Courses</Link>
                <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                <button
                    onClick={() => setSidebarOpen((v) => !v)}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px", color: "var(--text-muted)" }}
                    title={sidebarOpen ? "Hide panel" : "Show panel"}
                >
                    {sidebarOpen ? "◀Hide Sidebar" : "▶ Show Sidebar"}
                </button>
                <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{course.title}</span>

                <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                    {activeSection?.source_type !== "tutorial" && (
                        <div style={{ background: "white", borderRadius: "99px", padding: 4, display: "flex", gap: 4, border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <button
                                className="btn"
                                style={{
                                    fontSize: 12, padding: "5px 14px", borderRadius: "99px", border: "none",
                                    background: mainView === "notes" ? "var(--text)" : "transparent",
                                    color: mainView === "notes" ? "white" : "var(--text-muted)",
                                    fontWeight: mainView === "notes" ? 600 : 500,
                                    transition: "all 0.2s"
                                }}
                                onClick={() => setMainView("notes")}
                            >Notes</button>
                            <button
                                className="btn"
                                style={{
                                    fontSize: 12, padding: "5px 14px", borderRadius: "99px", border: "none",
                                    background: mainView === "concept-map" ? "var(--text)" : "transparent",
                                    color: mainView === "concept-map" ? "white" : "var(--text-muted)",
                                    fontWeight: mainView === "concept-map" ? 600 : 500,
                                    transition: "all 0.2s"
                                }}
                                onClick={() => setMainView("concept-map")}
                            >Concept Map</button>
                        </div>
                    )}
                    <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
                    <button
                        className="btn"
                        style={{
                            fontSize: 12, padding: "5px 14px", borderRadius: "99px",
                            background: chatOpen ? "var(--text)" : "white",
                            color: chatOpen ? "white" : "var(--text)",
                            border: "1px solid",
                            borderColor: chatOpen ? "var(--text)" : "var(--border)",
                            fontWeight: 600,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            transition: "all 0.2s"
                        }}
                        onClick={() => setChatOpen((v) => !v)}
                    >
                        Ask AI
                    </button>
                </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* ── LEFT SIDEBAR — matches photo 2: Start Session + Today's Subjects ── */}
                {sidebarOpen && (
                    <div style={{
                        width: 210, flexShrink: 0,
                        borderRight: "1px solid var(--border)", background: "#FFFFFF",
                        display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                        {/* Moved Session button to bottom */}

                        {/* Today's Subjects label */}
                        <div style={{ padding: "4px 14px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            TODAY'S SUBJECTS
                        </div>

                        {/* Timeline */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 16px", position: "relative", marginLeft: 6 }}>
                            {/* vertical line */}
                            <div style={{ position: "absolute", top: 6, bottom: 6, left: 18, width: 2, background: "#E2E8F0", zIndex: 0 }} />
                            {[
                                { time: "09:00 - 10:00", title: "SC3010: Software Security", active: true },
                                { time: "10:00 - 11:00", title: "SC2002: Polymorphism", active: false },
                                { time: "13:00 - 14:30", title: "SC2006: Design Patterns", active: false },
                            ].map((item, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, position: "relative", zIndex: 1, marginBottom: 20 }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                                        backgroundColor: "#94A3B8",
                                        border: "2px solid #FFFFFF",
                                    }} />
                                    <div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 2 }}>{item.time}</div>
                                        {item.title.split(': ').length > 1 ? (
                                            <>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.title.split(': ')[0]}</div>
                                                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginTop: 2 }}>{item.title.split(': ')[1]}</div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 13, fontWeight: item.active ? 700 : 500, color: "var(--text)" }}>{item.title}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* End Session button */}
                        <div style={{ padding: "0 12px 12px" }}>
                            <button
                                style={{
                                    width: "100%", padding: "10px 0", borderRadius: "12px",
                                    border: "1px solid var(--text)", background: "white",
                                    color: "var(--text)", fontWeight: 700, fontSize: 13,
                                    cursor: "pointer", display: "flex", alignItems: "center",
                                    justifyContent: "center", gap: 8,
                                    transition: "all 0.2s"
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <path d="M9 9h6v6H9z" fill="currentColor" />
                                </svg>
                                End Session
                            </button>
                        </div>

                        {/* Progress card at bottom */}
                        <div style={{ margin: "0 12px 12px", background: "#F8FAFC", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
                                <span>Today's Progress</span>
                                <span>42%</span>
                            </div>
                            <div style={{ height: 8, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ width: "42%", height: "100%", background: "#334155", borderRadius: 99 }} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>45 min left</div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
                            <button className="ns-icon-btn" title="Settings">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9" />
                                </svg>
                            </button>
                            <button className="ns-icon-btn" title="Collapse">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── MAIN AREA ── */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* Content mode sub-header tab bar — Visual / Audio / Quiz / Lectures / Tutorials */}
                    {activeSection && (
                        <div style={{
                            display: "flex", gap: 0, borderBottom: "1px solid var(--border)",
                            background: "#FAFAFC", flexShrink: 0,
                        }}>
                            {(["visual", "audio", "kinesthetic", "quiz", "lectures", "tutorials"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        if (mode === "lectures" || mode === "tutorials") {
                                            setActiveTab(mode);
                                            const sections = mode === "lectures" ? course.lectures : course.tutorials;
                                            if (sections.length > 0) selectSection(sections[0]);
                                        }
                                        setContentMode(mode);
                                    }}
                                    style={{
                                        padding: "10px 20px", fontSize: 13, fontWeight: contentMode === mode ? 700 : 500,
                                        textTransform: "capitalize", cursor: "pointer",
                                        background: "transparent",
                                        color: contentMode === mode ? "var(--text)" : "var(--text-muted)",
                                        border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
                                        borderBottomColor: contentMode === mode ? "var(--text)" : "transparent",
                                        transition: "color 0.2s, border-color 0.2s"
                                    }}
                                >
                                    {mode === "visual" ? "Visual" : mode === "audio" ? "Audio" : mode === "kinesthetic" ? "Kinesthetic" : mode === "quiz" ? "Quiz" : mode === "lectures" ? `Lectures (${course.lecture_count})` : `Tutorials (${course.tutorial_count})`}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Content area based on contentMode */}
                    {contentMode === "audio" && activeSection && activeSection.source_type !== "tutorial" ? (
                        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                            {/* PDF pane (same as visual) */}
                            {activeSection.source_type === "slides" && notebook?.source_ref && (
                                <>
                                    <div style={{
                                        width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden",
                                        margin: "14px 0 14px 14px", background: "white", borderRadius: "12px", border: "1px solid var(--border)",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                                    }}>
                                        <div style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text)", borderBottom: "1px solid var(--border)", background: "#F8FAFC", flexShrink: 0 }}>
                                            Source Document
                                        </div>
                                        <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
                                            <iframe
                                                src={`http://localhost:8000/pdf/${encodeURIComponent((notebook.source_ref || "").split("/").pop() || "")}`}
                                                style={{ width: "100%", height: "100%", border: "none" }}
                                                title="PDF"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ width: 14, flexShrink: 0 }} />
                                </>
                            )}
                            <div style={{ flex: 1, overflowY: "auto" }}>
                                <AudioPlayer
                                    notebookId={activeSection.id}
                                    cachedAudioUrl={audioCache[activeSection.id] ?? null}
                                    onAudioGenerated={(url) => setAudioCache(prev => ({ ...prev, [activeSection!.id]: url }))}
                                    slideChunks={notebook ? notebook.note_blocks.map(b => ({
                                        pageNum: b.page_num,
                                        term: b.block.concept_box?.term || `Slide ${b.page_num}`,
                                        definition: b.block.concept_box?.definition || "",
                                        keyPoints: [
                                            b.block.concept_box?.definition,
                                            b.block.concept_box?.intuition,
                                            b.block.concept_box?.why_it_matters,
                                            ...(b.block.semantic_blocks || []).map(sb => sb.text),
                                        ].filter(Boolean) as string[],
                                    })) : []}
                                />
                            </div>
                        </div>
                    ) : contentMode === "lectures" && activeSection ? (
                        /* Section list panel for lectures tab */
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            {course.lectures.map((s) => {
                                const isActive = activeSection?.id === s.id;
                                const typeLabel = SOURCE_LABEL[s.source_type] ?? s.source_type;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => selectSection(s)}
                                        style={{
                                            width: "100%", textAlign: "left", padding: "12px 20px",
                                            background: isActive ? "var(--accent-light)" : "transparent",
                                            borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                                            borderBottom: "1px solid var(--border)", borderTop: "none", borderRight: "none",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 2 }}>{typeLabel}</div>
                                        <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--accent)" : "var(--text)", lineHeight: 1.4 }}>{s.title}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.page_count} slides</div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : contentMode === "tutorials" && activeSection ? (
                        /* Tutorials: show tutorial content directly */
                        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 60px" }}>
                            {sectionLoading ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                    <div className="spinner" />
                                </div>
                            ) : tutorialQuestions ? (
                                <TutorialFlow
                                    questions={tutorialQuestions}
                                    notebookId={activeSection.id}
                                    onFlag={async (nbId, stepNum) => {
                                        const res = await api.flagStep(nbId, stepNum);
                                        return res.hint;
                                    }}
                                />
                            ) : (
                                <div className="empty-state"><p>No tutorial content available.</p></div>
                            )}
                        </div>
                    ) : contentMode === "kinesthetic" && activeSection && activeSection.source_type !== "tutorial" ? (
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            <QuizPanel notebookId={activeSection.id} view="activities" />
                        </div>
                    ) : contentMode === "quiz" && activeSection && activeSection.source_type !== "tutorial" ? (
                        <div style={{ flex: 1, overflowY: "auto" }}>
                            <QuizPanel notebookId={activeSection.id} view="quiz" />
                        </div>
                    ) : sectionLoading ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div className="spinner" />
                        </div>
                    ) : mainView === "concept-map" ? (
                        <ConceptMapView courseId={courseId!} data={conceptMapData} onRegenerate={() => {
                            api.generateCourseConceptMap(courseId!).then(loadConceptMap);
                        }} />
                    ) : mainView === "tutorial" && tutorialQuestions ? (
                        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 60px" }}>
                            <TutorialFlow
                                questions={tutorialQuestions}
                                notebookId={activeSection!.id}
                                onFlag={async (nbId, stepNum) => {
                                    const res = await api.flagStep(nbId, stepNum);
                                    return res.hint;
                                }}
                            />
                        </div>
                    ) : notebook ? (
                        /* Split-pane notes view — DOM-direct drag, no re-render lag */
                        activeSection?.source_type === "article" ? (
                            /* Article / Website: just notes, no PDF panel */
                            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 40px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                                        Website Notes — {notebook.note_blocks.length} sections
                                    </div>
                                    {notebook.source_ref && (
                                        <a href={notebook.source_ref} target="_blank" rel="noopener noreferrer"
                                            style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", background: "var(--accent-light)", padding: "2px 10px", borderRadius: 99, border: "1px solid var(--accent)" }}>
                                            Open website
                                        </a>
                                    )}
                                </div>
                                {renderNoteBlocks(notebook, activeSlide, slideRefs)}
                            </div>
                        ) : (
                            /* Slides: split pane with draggable divider */
                            <div ref={splitRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                                {/* PDF pane */}
                                <div ref={leftPaneRef} style={{
                                    width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden",
                                    margin: "14px 0 14px 14px", background: "white", borderRadius: "12px", border: "1px solid var(--border)",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                                }}>
                                    <div style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text)", borderBottom: "1px solid var(--border)", background: "#F8FAFC", flexShrink: 0 }}>
                                        Source Document
                                    </div>
                                    <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
                                        {notebook.source_ref ? (
                                            <iframe
                                                src={`http://localhost:8000/pdf/${encodeURIComponent(notebook.source_ref.split("/").pop() || "")}`}
                                                style={{ width: "100%", height: "100%", border: "none" }}
                                                title="PDF"
                                            />
                                        ) : (
                                            <div className="empty-state"><p>No preview</p></div>
                                        )}
                                    </div>
                                </div>

                                {/* Drag handle space */}
                                <div
                                    onMouseDown={startDrag}
                                    style={{
                                        width: 14, cursor: "col-resize", flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}
                                >
                                    <div style={{ width: 4, height: 24, borderRadius: 2, background: "var(--border)" }} />
                                </div>

                                {/* Notes pane */}
                                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                                    {notebook.note_blocks.length > 1 && (
                                        <div className="slide-index">
                                            {notebook.note_blocks.map((b, i) => (
                                                <button key={b.id} className={`slide-index-btn ${activeSlide === i ? "active" : ""}`} onClick={() => scrollToSlide(i)} title={`Slide ${b.page_num}`}>
                                                    {b.page_num}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 40px" }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
                                            AI Notes — {notebook.note_blocks.length} slides
                                        </div>
                                        {renderNoteBlocks(notebook, activeSlide, slideRefs)}
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="empty-state"><p>Select a section from the left.</p></div>
                    )}
                </div>{/* end MAIN AREA wrapper */}
            </div>

            <ChatPanel
                notebookId={activeSection?.source_type !== "tutorial" ? activeSection?.id : undefined}
                courseId={courseId ?? undefined}
                open={chatOpen}
                onClose={() => setChatOpen(false)}
            />
        </div>
    );
}

/** Renders note blocks into card divs — shared between article and slides pane */
function renderNoteBlocks(
    notebook: NotebookDetail,
    activeSlide: number,
    slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
) {
    return (
        <>
            {notebook.note_blocks.map((entry, i) => {
                const { block } = entry;
                const isActive = activeSlide === i;
                return (
                    <div
                        key={entry.id}
                        ref={(el) => { slideRefs.current[i] = el; }}
                        style={{
                            marginBottom: 16,
                            border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
                            borderRadius: 10, background: "white", overflow: "hidden",
                            boxShadow: isActive ? "0 0 0 3px var(--accent-light)" : "var(--shadow-card)",
                            transition: "box-shadow 0.2s, border-color 0.2s",
                        }}
                    >
                        <div style={{ padding: "7px 12px", background: isActive ? "var(--accent-light)" : "#F8FAFC", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                                {entry.page_num > 1 ? `Slide ${entry.page_num}` : `Section ${entry.page_num}`}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", background: "white", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 7px" }}>{block.content_type}</span>
                            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>density {block.visual_density_score}</span>
                        </div>
                        <div style={{ padding: "12px" }}>
                            {block.concept_box && <ConceptBox data={block.concept_box} />}
                            {block.flow_diagram && <FlowDiagram mermaidString={block.flow_diagram} id={`nb-${entry.id}`} />}
                            {block.comparison_table && <ComparisonTable data={block.comparison_table} />}
                            {block.worked_examples && block.worked_examples.length > 0 && <WorkedExamples examples={block.worked_examples} />}
                            {block.semantic_blocks && block.semantic_blocks.length > 0 && <SemanticBlocks blocks={block.semantic_blocks} />}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function ConceptMapView({ courseId, data, onRegenerate }: { courseId: number; data: any; onRegenerate: () => void }) {
    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 18px", background: "#FAFAFC", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Course Concept Map</span>
                {[["#CBD5E1", "Not started"], ["#93C5FD", "Learning"], ["#34D399", "Mastered"]].map(([color, label]) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                        <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, border: "1.5px solid #94A3B8", display: "inline-block" }} />
                        {label}
                    </span>
                ))}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>— click nodes to track</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                    {data ? `${data.nodes.length} concepts · ${data.edges.length} connections` : ""}
                </span>
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={onRegenerate}>Regenerate</button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
                {!data || data.nodes.length === 0 ? (
                    <div className="empty-state">
                        <h3>No concept map yet</h3>
                        <p>Click Regenerate to build a holistic view across all lectures.</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRegenerate}>Generate</button>
                    </div>
                ) : (
                    <ConceptMap data={data} onMasteryChange={(nodeId, mastery) => {
                        const idNum = parseInt(nodeId);
                        if (!isNaN(idNum)) {
                            fetch(`http://localhost:8000/concept-map/0/mastery/${idNum}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ mastery }),
                            }).catch(() => { });
                        }
                    }} />
                )}
            </div>
        </div>
    );
}

// End of file
