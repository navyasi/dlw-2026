// "use client";
// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import dynamic from "next/dynamic";
// import Link from "next/link";
// import { api, type CourseDetail, type CourseSection, type NotebookDetail, type TutorialQuestion } from "@/lib/api";
// import ConceptBox from "@/components/ConceptBox";
// import ComparisonTable from "@/components/ComparisonTable";
// import WorkedExamples from "@/components/WorkedExamples";
// import SemanticBlocks from "@/components/SemanticBlocks";
// import TutorialFlow from "@/components/TutorialFlow";
// import ChatPanel from "@/components/ChatPanel";
// import AudioPlayer from "@/components/AudioPlayer";
// import QuizPanel from "@/components/QuizPanel";
// import type { SlideChunk } from "@/hooks/useActiveRecall";

// const FlowDiagram = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });
// const ConceptMap = dynamic(() => import("@/components/ConceptMap"), { ssr: false });

// interface Props { params: Promise<{ id: string }> }
// type MainView = "notes" | "concept-map" | "tutorial";
// // type ContentMode = "visual" | "audio" | "quiz";
// type ContentMode = "visual" | "audio" | "kinesthetics" | "quiz";
// const SOURCE_LABEL: Record<string, string> = {
//     slides: "Lecture",
//     article: "Website",
//     tutorial: "Tutorial",
// };

// export default function CoursePage({ params }: Props) {
//     const [courseId, setCourseId] = useState<number | null>(null);
//     const [course, setCourse] = useState<CourseDetail | null>(null);
//     const [activeSection, setActiveSection] = useState<CourseSection | null>(null);
//     const [activeTab, setActiveTab] = useState<"lectures" | "tutorials">("lectures");
//     const [mainView, setMainView] = useState<MainView>("notes");
//     const [contentMode, setContentMode] = useState<ContentMode>("visual");
//     const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
//     const [tutorialQuestions, setTutorialQuestions] = useState<TutorialQuestion[] | null>(null);
//     const [conceptMapData, setConceptMapData] = useState<any>(null);
//     const [chatOpen, setChatOpen] = useState(false);
//     const [sidebarOpen, setSidebarOpen] = useState(true);
//     const [loading, setLoading] = useState(true);
//     const [sectionLoading, setSectionLoading] = useState(false);
//     // Audio cache: keyed by notebookId so switching tabs doesn't re-generate
//     const [audioCache, setAudioCache] = useState<Record<number, string>>({});

//     // ── Drag-resize: use CSS variable via ref, no React state during drag ──
//     const splitRef = useRef<HTMLDivElement>(null);
//     const leftPaneRef = useRef<HTMLDivElement>(null);
//     const isDragging = useRef(false);

//     const startDrag = useCallback((e: React.MouseEvent) => {
//         e.preventDefault();
//         isDragging.current = true;
//         document.body.style.cursor = "col-resize";
//         document.body.style.userSelect = "none";
//     }, []);

//     useEffect(() => {
//         const onMove = (e: MouseEvent) => {
//             if (!isDragging.current || !splitRef.current || !leftPaneRef.current) return;
//             const rect = splitRef.current.getBoundingClientRect();
//             const pct = Math.max(20, Math.min(55, ((e.clientX - rect.left) / rect.width) * 100));
//             // Update width directly on the DOM — no React re-render during drag
//             leftPaneRef.current.style.width = `${pct}%`;
//         };
//         const onUp = () => {
//             isDragging.current = false;
//             document.body.style.cursor = "";
//             document.body.style.userSelect = "";
//         };
//         window.addEventListener("mousemove", onMove);
//         window.addEventListener("mouseup", onUp);
//         return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
//     }, []);

//     const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
//     const scrollRef = useRef<HTMLDivElement>(null);
//     const [activeSlide, setActiveSlide] = useState(0);

//     useEffect(() => {
//         params.then((p) => setCourseId(parseInt(p.id)));
//     }, [params]);

//     useEffect(() => {
//         if (!courseId) return;
//         setLoading(true);
//         api.getCourse(courseId)
//             .then((c) => {
//                 setCourse(c);
//                 if (c.lectures.length > 0) setActiveSection(c.lectures[0]);
//             })
//             .finally(() => setLoading(false));
//     }, [courseId]);

//     useEffect(() => {
//         if (!activeSection) return;
//         setSectionLoading(true);
//         setNotebook(null);
//         setTutorialQuestions(null);
//         if (activeSection.source_type === "tutorial") {
//             setMainView("tutorial");
//             api.getTutorialFlow(activeSection.id)
//                 .then((r) => setTutorialQuestions(r.questions))
//                 .finally(() => setSectionLoading(false));
//         } else {
//             setMainView("notes");
//             api.getNotebook(activeSection.id)
//                 .then(setNotebook)
//                 .finally(() => setSectionLoading(false));
//         }
//     }, [activeSection]);

//     const loadConceptMap = () => {
//         if (!courseId) return;
//         api.getCourseConceptMap(courseId).then(setConceptMapData);
//     };

//     useEffect(() => {
//         if (mainView === "concept-map" && courseId) loadConceptMap();
//     }, [mainView, courseId]);

//     const handleScroll = () => {
//         if (!scrollRef.current) return;
//         const container = scrollRef.current;
//         const containerTop = container.getBoundingClientRect().top;
//         let currentIdx = activeSlide;

//         for (let i = 0; i < slideRefs.current.length; i++) {
//             const ref = slideRefs.current[i];
//             if (!ref) continue;
//             const rect = ref.getBoundingClientRect();
//             // if top of this card is above the middle of the container, it's the current one
//             if (rect.top <= containerTop + container.clientHeight * 0.4) {
//                 currentIdx = i;
//             }
//         }
//         if (currentIdx !== activeSlide) setActiveSlide(currentIdx);
//     };

//     // Auto-track mastery when viewing slides
//     useEffect(() => {
//         if (!notebook || mainView !== "notes" || !conceptMapData) return;
//         const currentBlock = notebook.note_blocks[activeSlide];
//         if (currentBlock?.block?.concept_box?.term) {
//             const term = currentBlock.block.concept_box.term.toLowerCase();
//             const node = conceptMapData.nodes.find((n: any) => n.label.toLowerCase() === term);
//             if (node && node.mastery < 0.5) {
//                 const idNum = parseInt(node.id);
//                 fetch(`http://localhost:8000/concept-map/0/mastery/${idNum}`, {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     body: JSON.stringify({ mastery: 0.5 }),
//                 }).then(() => {
//                     if (courseId) api.getCourseConceptMap(courseId).then(setConceptMapData);
//                 }).catch(() => { });
//             }
//         }
//     }, [activeSlide, notebook, conceptMapData, courseId, mainView]);

//     const selectSection = (s: CourseSection) => {
//         setActiveSection(s);
//         setActiveSlide(0);
//         slideRefs.current = [];
//     };

//     const scrollToSlide = (idx: number) => {
//         // We don't set activeSlide here; the IntersectionObserver will automatically update it when the slide scrolls into view.
//         slideRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
//     };

//     if (loading) return <div className="spinner" />;
//     if (!course) return <div className="empty-state"><h3>Course not found</h3></div>;

//     const allSections = activeTab === "lectures" ? course.lectures : course.tutorials;

//     return (
//         <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
//             {/* Top Toolbar */}
//             <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "white", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
//                 <Link href="/" style={{ color: "var(--text-muted)", fontSize: 12 }}>← Courses</Link>
//                 <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
//                 <button
//                     onClick={() => setSidebarOpen((v) => !v)}
//                     className="btn btn-ghost"
//                     style={{ fontSize: 12, padding: "5px 10px", color: "var(--text-muted)" }}
//                     title={sidebarOpen ? "Hide panel" : "Show panel"}
//                 >
//                     {sidebarOpen ? "◀Hide Sidebar" : "▶ Show Sidebar"}
//                 </button>
//                 <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
//                 <span style={{ fontWeight: 700, fontSize: 15 }}>{course.title}</span>

//                 <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
//                     {activeSection?.source_type !== "tutorial" && (
//                         <>
//                             <button className={`btn ${mainView === "notes" ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setMainView("notes")}>Notes</button>
//                             <button className={`btn ${mainView === "concept-map" ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setMainView("concept-map")}>Concept Map</button>
//                         </>
//                     )}
//                     <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
//                     <button
//                         className={`btn ${chatOpen ? "btn-primary" : "btn-secondary"}`}
//                         style={{ fontSize: 12, padding: "5px 12px" }}
//                         onClick={() => setChatOpen((v) => !v)}
//                     >
//                         Ask AI
//                     </button>
//                 </div>
//             </div>

//             {/* Body */}
//             <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

//                 {/* ── LEFT SIDEBAR ── */}
//                 {sidebarOpen && (
//                     <div style={{
//                         width: 210, flexShrink: 0,
//                         borderRight: "1px solid var(--border)", background: "#FAFAFC",
//                         display: "flex", flexDirection: "column", overflow: "hidden",
//                     }}>
//                         {/* Tab switcher */}
//                         <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
//                             {(["lectures", "tutorials"] as const).map((tab) => (
//                                 <button
//                                     key={tab}
//                                     onClick={() => {
//                                         setActiveTab(tab);
//                                         const sections = tab === "lectures" ? course.lectures : course.tutorials;
//                                         if (sections.length > 0) selectSection(sections[0]);
//                                     }}
//                                     style={{
//                                         flex: 1, padding: "9px 4px", fontSize: 11, fontWeight: 700,
//                                         textTransform: "capitalize", background: activeTab === tab ? "white" : "transparent",
//                                         borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
//                                         color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
//                                         border: "none", cursor: "pointer",
//                                     }}
//                                 >
//                                     {tab === "lectures" ? "Lectures" : "Tutorials"} ({tab === "lectures" ? course.lecture_count : course.tutorial_count})
//                                 </button>
//                             ))}
//                         </div>

//                         {/* Section list */}
//                         <div style={{ flex: 1, overflowY: "auto" }}>
//                             {allSections.length === 0 && (
//                                 <div style={{ padding: "20px 12px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
//                                     No {activeTab} yet
//                                 </div>
//                             )}
//                             {allSections.map((s) => {
//                                 const isActive = activeSection?.id === s.id;
//                                 const typeLabel = SOURCE_LABEL[s.source_type] ?? s.source_type;
//                                 return (
//                                     <button
//                                         key={s.id}
//                                         onClick={() => selectSection(s)}
//                                         style={{
//                                             width: "100%", textAlign: "left", padding: "10px 12px",
//                                             background: isActive ? "var(--accent-light)" : "transparent",
//                                             borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
//                                             borderBottom: "1px solid var(--border)", borderTop: "none", borderRight: "none",
//                                             cursor: "pointer",
//                                         }}
//                                     >
//                                         <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 2 }}>
//                                             {typeLabel}
//                                         </div>
//                                         <div style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--accent)" : "var(--text)", lineHeight: 1.4 }}>
//                                             {s.title}
//                                         </div>
//                                         <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
//                                             {s.page_count} {s.source_type === "tutorial" ? "question(s)" : "slides"}
//                                         </div>
//                                     </button>
//                                 );
//                             })}
//                         </div>
//                     </div>
//                 )}

//                 {/* ── MAIN AREA ── */}
//                 <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

//                     {/* Content mode sub-header tab bar */}
//                     {activeSection && activeSection.source_type !== "tutorial" && (
//                         <div style={{
//                             display: "flex", gap: 0, borderBottom: "1px solid var(--border)",
//                             background: "#FAFAFC", flexShrink: 0,
//                         }}>
//                             {/* {(["visual", "audio", "quiz"] as ContentMode[]).map((mode) => ( */}
//                             {(["visual", "audio", "kinesthetics", "quiz"] as ContentMode[]).map((mode) => (
//                                 <button
//                                     key={mode}
//                                     onClick={() => setContentMode(mode)}
//                                     style={{
//                                         padding: "8px 20px", fontSize: 12, fontWeight: 600,
//                                         textTransform: "capitalize", cursor: "pointer",
//                                         background: contentMode === mode ? "white" : "transparent",
//                                         borderBottom: contentMode === mode ? "2px solid var(--accent)" : "2px solid transparent",
//                                         color: contentMode === mode ? "var(--accent)" : "var(--text-muted)",
//                                         border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
//                                         borderBottomColor: contentMode === mode ? "var(--accent)" : "transparent",
//                                     }}
//                                 >
//                                     {/* {mode === "visual" ? "Visual" : mode === "audio" ? "Audio" : "Quiz"} */}
//                                     {mode === "visual" ? "Visual" : mode === "audio" ? "Audio" : mode === "kinesthetics" ? "Kinesthetics" : "Quiz"}
//                                 </button>
//                             ))}
//                         </div>
//                     )}

//                     {/* Content area based on contentMode */}
//                     {contentMode === "audio" && activeSection && activeSection.source_type !== "tutorial" ? (
//                         <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
//                             {/* PDF pane (same as visual) */}
//                             {activeSection.source_type === "slides" && notebook?.source_ref && (
//                                 <>
//                                     <div style={{ width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
//                                         <div style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "white", flexShrink: 0 }}>
//                                             Source
//                                         </div>
//                                         <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
//                                             <iframe
//                                                 src={`http://localhost:8000/pdf/${encodeURIComponent((notebook.source_ref || "").split("/").pop() || "")}`}
//                                                 style={{ width: "100%", height: "100%", border: "none" }}
//                                                 title="PDF"
//                                             />
//                                         </div>
//                                     </div>
//                                     <div style={{ width: 5, background: "var(--border)", flexShrink: 0 }} />
//                                 </>
//                             )}
//                             <div style={{ flex: 1, overflowY: "auto" }}>
//                                 <AudioPlayer
//                                     notebookId={activeSection.id}
//                                     cachedAudioUrl={audioCache[activeSection.id] ?? null}
//                                     onAudioGenerated={(url) => setAudioCache(prev => ({ ...prev, [activeSection!.id]: url }))}
//                                     slideChunks={notebook ? notebook.note_blocks.map(b => ({
//                                         pageNum: b.page_num,
//                                         term: b.block.concept_box?.term || `Slide ${b.page_num}`,
//                                         definition: b.block.concept_box?.definition || "",
//                                         keyPoints: [
//                                             b.block.concept_box?.definition,
//                                             b.block.concept_box?.intuition,
//                                             b.block.concept_box?.why_it_matters,
//                                             ...(b.block.semantic_blocks || []).map(sb => sb.text),
//                                         ].filter(Boolean) as string[],
//                                     })) : []}
//                                 />
//                             </div>
//                         </div>
//                     ) : contentMode === "quiz" && activeSection && activeSection.source_type !== "tutorial" ? (
//                         <div style={{ flex: 1, overflowY: "auto" }}>
//                             <QuizPanel notebookId={activeSection.id} />
//                         </div>
//                     ) : sectionLoading ? (
//                         <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
//                             <div className="spinner" />
//                         </div>
//                     ) : mainView === "concept-map" ? (
//                         <ConceptMapView courseId={courseId!} data={conceptMapData} onRegenerate={() => {
//                             api.generateCourseConceptMap(courseId!).then(loadConceptMap);
//                         }} />
//                     ) : mainView === "tutorial" && tutorialQuestions ? (
//                         <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 60px" }}>
//                             <TutorialFlow
//                                 questions={tutorialQuestions}
//                                 notebookId={activeSection!.id}
//                                 onFlag={async (nbId, stepNum) => {
//                                     const res = await api.flagStep(nbId, stepNum);
//                                     return res.hint;
//                                 }}
//                             />
//                         </div>
//                     ) : notebook ? (
//                         /* Split-pane notes view — DOM-direct drag, no re-render lag */
//                         activeSection?.source_type === "article" ? (
//                             /* Article / Website: just notes, no PDF panel */
//                             <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 40px" }}>
//                                 <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
//                                     <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
//                                         Website Notes — {notebook.note_blocks.length} sections
//                                     </div>
//                                     {notebook.source_ref && (
//                                         <a href={notebook.source_ref} target="_blank" rel="noopener noreferrer"
//                                             style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", background: "var(--accent-light)", padding: "2px 10px", borderRadius: 99, border: "1px solid var(--accent)" }}>
//                                             Open website
//                                         </a>
//                                     )}
//                                 </div>
//                                 {renderNoteBlocks(notebook, activeSlide, slideRefs)}
//                             </div>
//                         ) : (
//                             /* Slides: split pane with draggable divider */
//                             <div ref={splitRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
//                                 {/* PDF pane */}
//                                 <div ref={leftPaneRef} style={{ width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
//                                     <div style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "white", flexShrink: 0 }}>
//                                         Source
//                                     </div>
//                                     <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
//                                         {notebook.source_ref ? (
//                                             <iframe
//                                                 src={`http://localhost:8000/pdf/${encodeURIComponent(notebook.source_ref.split("/").pop() || "")}`}
//                                                 style={{ width: "100%", height: "100%", border: "none" }}
//                                                 title="PDF"
//                                             />
//                                         ) : (
//                                             <div className="empty-state"><p>No preview</p></div>
//                                         )}
//                                     </div>
//                                 </div>

//                                 {/* Drag handle */}
//                                 <div
//                                     onMouseDown={startDrag}
//                                     style={{
//                                         width: 5, cursor: "col-resize", flexShrink: 0,
//                                         background: "var(--border)", transition: "background 0.15s",
//                                     }}
//                                     onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
//                                     onMouseLeave={(e) => { if (!isDragging.current) e.currentTarget.style.background = "var(--border)"; }}
//                                 />

//                                 {/* Notes pane */}
//                                 <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
//                                     {notebook.note_blocks.length > 1 && (
//                                         <div className="slide-index">
//                                             {notebook.note_blocks.map((b, i) => (
//                                                 <button key={b.id} className={`slide-index-btn ${activeSlide === i ? "active" : ""}`} onClick={() => scrollToSlide(i)} title={`Slide ${b.page_num}`}>
//                                                     {b.page_num}
//                                                 </button>
//                                             ))}
//                                         </div>
//                                     )}
//                                     <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 40px" }}>
//                                         <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12 }}>
//                                             AI Notes — {notebook.note_blocks.length} slides
//                                         </div>
//                                         {renderNoteBlocks(notebook, activeSlide, slideRefs)}
//                                     </div>
//                                 </div>
//                             </div>
//                         )
//                     ) : (
//                         <div className="empty-state"><p>Select a section from the left.</p></div>
//                     )}
//                 </div>{/* end MAIN AREA wrapper */}
//             </div>

//             <ChatPanel
//                 notebookId={activeSection?.source_type !== "tutorial" ? activeSection?.id : undefined}
//                 courseId={courseId ?? undefined}
//                 open={chatOpen}
//                 onClose={() => setChatOpen(false)}
//             />
//         </div>
//     );
// }

// /** Renders note blocks into card divs — shared between article and slides pane */
// function renderNoteBlocks(
//     notebook: NotebookDetail,
//     activeSlide: number,
//     slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
// ) {
//     return (
//         <>
//             {notebook.note_blocks.map((entry, i) => {
//                 const { block } = entry;
//                 const isActive = activeSlide === i;
//                 return (
//                     <div
//                         key={entry.id}
//                         ref={(el) => { slideRefs.current[i] = el; }}
//                         style={{
//                             marginBottom: 16,
//                             border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
//                             borderRadius: 10, background: "white", overflow: "hidden",
//                             boxShadow: isActive ? "0 0 0 3px var(--accent-light)" : "var(--shadow-card)",
//                             transition: "box-shadow 0.2s, border-color 0.2s",
//                         }}
//                     >
//                         <div style={{ padding: "7px 12px", background: isActive ? "var(--accent-light)" : "#F8FAFC", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
//                             <span style={{ fontWeight: 700, fontSize: 12, color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
//                                 {entry.page_num > 1 ? `Slide ${entry.page_num}` : `Section ${entry.page_num}`}
//                             </span>
//                             <span style={{ fontSize: 10, color: "var(--text-muted)", background: "white", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 7px" }}>{block.content_type}</span>
//                             <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>density {block.visual_density_score}</span>
//                         </div>
//                         <div style={{ padding: "12px" }}>
//                             {block.concept_box && <ConceptBox data={block.concept_box} />}
//                             {block.flow_diagram && <FlowDiagram mermaidString={block.flow_diagram} id={`nb-${entry.id}`} />}
//                             {block.comparison_table && <ComparisonTable data={block.comparison_table} />}
//                             {block.worked_examples && block.worked_examples.length > 0 && <WorkedExamples examples={block.worked_examples} />}
//                             {block.semantic_blocks && block.semantic_blocks.length > 0 && <SemanticBlocks blocks={block.semantic_blocks} />}
//                         </div>
//                     </div>
//                 );
//             })}
//         </>
//     );
// }

// function ConceptMapView({ courseId, data, onRegenerate }: { courseId: number; data: any; onRegenerate: () => void }) {
//     return (
//         <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
//             <div style={{ padding: "8px 18px", background: "#FAFAFC", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
//                 <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Course Concept Map</span>
//                 {[["#CBD5E1", "Not started"], ["#93C5FD", "Learning"], ["#34D399", "Mastered"]].map(([color, label]) => (
//                     <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
//                         <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, border: "1.5px solid #94A3B8", display: "inline-block" }} />
//                         {label}
//                     </span>
//                 ))}
//                 <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>— click nodes to track</span>
//                 <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
//                     {data ? `${data.nodes.length} concepts · ${data.edges.length} connections` : ""}
//                 </span>
//                 <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={onRegenerate}>Regenerate</button>
//             </div>
//             <div style={{ flex: 1, overflow: "hidden" }}>
//                 {!data || data.nodes.length === 0 ? (
//                     <div className="empty-state">
//                         <h3>No concept map yet</h3>
//                         <p>Click Regenerate to build a holistic view across all lectures.</p>
//                         <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRegenerate}>Generate</button>
//                     </div>
//                 ) : (
//                     <ConceptMap data={data} onMasteryChange={(nodeId, mastery) => {
//                         const idNum = parseInt(nodeId);
//                         if (!isNaN(idNum)) {
//                             fetch(`http://localhost:8000/concept-map/0/mastery/${idNum}`, {
//                                 method: "POST",
//                                 headers: { "Content-Type": "application/json" },
//                                 body: JSON.stringify({ mastery }),
//                             }).catch(() => { });
//                         }
//                     }} />
//                 )}
//             </div>
//         </div>
//     );
// }

// // End of file

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  api,
  type CourseDetail,
  type CourseSection,
  type NotebookDetail,
  type TutorialQuestion,
} from "@/lib/api";
import ConceptBox from "@/components/ConceptBox";
import ComparisonTable from "@/components/ComparisonTable";
import WorkedExamples from "@/components/WorkedExamples";
import SemanticBlocks from "@/components/SemanticBlocks";
import TutorialFlow from "@/components/TutorialFlow";
import ChatPanel from "@/components/ChatPanel";
import AudioPlayer from "@/components/AudioPlayer";
import QuizPanel from "@/components/QuizPanel";

const FlowDiagram = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });
const ConceptMap = dynamic(() => import("@/components/ConceptMap"), { ssr: false });

interface Props {
  params: Promise<{ id: string }>;
}
type MainView = "notes" | "concept-map" | "tutorial";
type ContentMode = "visual" | "audio" | "kinesthetics" | "quiz";

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
      leftPaneRef.current.style.width = `${pct}%`;
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
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
    api
      .getCourse(courseId)
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
      api
        .getTutorialFlow(activeSection.id)
        .then((r) => setTutorialQuestions(r.questions))
        .finally(() => setSectionLoading(false));
    } else {
      setMainView("notes");
      api
        .getNotebook(activeSection.id)
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
      if (rect.top <= containerTop + container.clientHeight * 0.4) currentIdx = i;
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
        })
          .then(() => {
            if (courseId) api.getCourseConceptMap(courseId).then(setConceptMapData);
          })
          .catch(() => {});
      }
    }
  }, [activeSlide, notebook, conceptMapData, courseId, mainView]);

  const selectSection = (s: CourseSection) => {
    setActiveSection(s);
    setActiveSlide(0);
    slideRefs.current = [];
  };

  const scrollToSlide = (idx: number) => {
    slideRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <div className="spinner" />;
  if (!course) return <div className="empty-state"><h3>Course not found</h3></div>;

  const allSections = activeTab === "lectures" ? course.lectures : course.tutorials;

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {/* Top Toolbar */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          ← Courses
        </Link>
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
            <>
              <button
                className={`btn ${mainView === "notes" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => setMainView("notes")}
              >
                Notes
              </button>
              <button
                className={`btn ${mainView === "concept-map" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => setMainView("concept-map")}
              >
                Concept Map
              </button>
            </>
          )}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <button
            className={`btn ${chatOpen ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setChatOpen((v) => !v)}
          >
            Ask AI
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── LEFT SIDEBAR ── */}
        {sidebarOpen && (
          <div
            style={{
              width: 210,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              background: "#FAFAFC",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Tab switcher */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              {(["lectures", "tutorials"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    const sections = tab === "lectures" ? course.lectures : course.tutorials;
                    if (sections.length > 0) selectSection(sections[0]);
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "capitalize",
                    background: activeTab === tab ? "white" : "transparent",
                    borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                    color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {tab === "lectures" ? "Lectures" : "Tutorials"} (
                  {tab === "lectures" ? course.lecture_count : course.tutorial_count})
                </button>
              ))}
            </div>

            {/* Section list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {allSections.length === 0 && (
                <div style={{ padding: "20px 12px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                  No {activeTab} yet
                </div>
              )}
              {allSections.map((s) => {
                const isActive = activeSection?.id === s.id;
                const typeLabel = SOURCE_LABEL[s.source_type] ?? s.source_type;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectSection(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      background: isActive ? "var(--accent-light)" : "transparent",
                      borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                      borderBottom: "1px solid var(--border)",
                      borderTop: "none",
                      borderRight: "none",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-muted)",
                        marginBottom: 2,
                      }}
                    >
                      {typeLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "var(--accent)" : "var(--text)",
                        lineHeight: 1.4,
                      }}
                    >
                      {s.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {s.page_count} {s.source_type === "tutorial" ? "question(s)" : "slides"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Content mode sub-header tab bar */}
          {activeSection && activeSection.source_type !== "tutorial" && (
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid var(--border)",
                background: "#FAFAFC",
                flexShrink: 0,
              }}
            >
              {(["visual", "audio", "kinesthetics", "quiz"] as ContentMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setContentMode(mode)}
                  style={{
                    padding: "8px 20px",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    background: contentMode === mode ? "white" : "transparent",
                    color: contentMode === mode ? "var(--accent)" : "var(--text-muted)",
                    border: "none",
                    borderBottomWidth: 2,
                    borderBottomStyle: "solid",
                    borderBottomColor: contentMode === mode ? "var(--accent)" : "transparent",
                  }}
                >
                  {mode === "visual"
                    ? "Visual"
                    : mode === "audio"
                      ? "Audio"
                      : mode === "kinesthetics"
                        ? "Kinesthetics"
                        : "Quiz"}
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
                  <div style={{ width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "white", flexShrink: 0 }}>
                      Source
                    </div>
                    <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
                      <iframe
                        src={`http://localhost:8000/pdf/${encodeURIComponent((notebook.source_ref || "").split("/").pop() || "")}`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        title="PDF"
                      />
                    </div>
                  </div>
                  <div style={{ width: 5, background: "var(--border)", flexShrink: 0 }} />
                </>
              )}
              <div style={{ flex: 1, overflowY: "auto" }}>
                <AudioPlayer
                  notebookId={activeSection.id}
                  cachedAudioUrl={audioCache[activeSection.id] ?? null}
                  onAudioGenerated={(url) => setAudioCache((prev) => ({ ...prev, [activeSection!.id]: url }))}
                  slideChunks={
                    notebook
                      ? notebook.note_blocks.map((b) => ({
                          pageNum: b.page_num,
                          term: b.block.concept_box?.term || `Slide ${b.page_num}`,
                          definition: b.block.concept_box?.definition || "",
                          keyPoints: [
                            b.block.concept_box?.definition,
                            b.block.concept_box?.intuition,
                            b.block.concept_box?.why_it_matters,
                            ...(b.block.semantic_blocks || []).map((sb) => sb.text),
                          ].filter(Boolean) as string[],
                        }))
                      : []
                  }
                />
              </div>
            </div>
          ) : (contentMode === "kinesthetics" || contentMode === "quiz") &&
            activeSection &&
            activeSection.source_type !== "tutorial" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <QuizPanel
                notebookId={activeSection.id}
                view={contentMode === "kinesthetics" ? "activities" : "quiz"}
              />
            </div>
          ) : sectionLoading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" />
            </div>
          ) : mainView === "concept-map" ? (
            <ConceptMapView
              courseId={courseId!}
              data={conceptMapData}
              onRegenerate={() => {
                api.generateCourseConceptMap(courseId!).then(loadConceptMap);
              }}
            />
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
            activeSection?.source_type === "article" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 40px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                    Website Notes — {notebook.note_blocks.length} sections
                  </div>
                  {notebook.source_ref && (
                    <a
                      href={notebook.source_ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "var(--accent)",
                        textDecoration: "none",
                        background: "var(--accent-light)",
                        padding: "2px 10px",
                        borderRadius: 99,
                        border: "1px solid var(--accent)",
                      }}
                    >
                      Open website
                    </a>
                  )}
                </div>
                {renderNoteBlocks(notebook, activeSlide, slideRefs)}
              </div>
            ) : (
              <div ref={splitRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* PDF pane */}
                <div ref={leftPaneRef} style={{ width: "36%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "white", flexShrink: 0 }}>
                    Source
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

                {/* Drag handle */}
                <div
                  onMouseDown={startDrag}
                  style={{ width: 5, cursor: "col-resize", flexShrink: 0, background: "var(--border)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
                  onMouseLeave={(e) => {
                    if (!isDragging.current) e.currentTarget.style.background = "var(--border)";
                  }}
                />

                {/* Notes pane */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                  {notebook.note_blocks.length > 1 && (
                    <div className="slide-index">
                      {notebook.note_blocks.map((b, i) => (
                        <button
                          key={b.id}
                          className={`slide-index-btn ${activeSlide === i ? "active" : ""}`}
                          onClick={() => scrollToSlide(i)}
                          title={`Slide ${b.page_num}`}
                        >
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
        </div>
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
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            style={{
              marginBottom: 16,
              border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: 10,
              background: "white",
              overflow: "hidden",
              boxShadow: isActive ? "0 0 0 3px var(--accent-light)" : "var(--shadow-card)",
              transition: "box-shadow 0.2s, border-color 0.2s",
            }}
          >
            <div
              style={{
                padding: "7px 12px",
                background: isActive ? "var(--accent-light)" : "#F8FAFC",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                {entry.page_num > 1 ? `Slide ${entry.page_num}` : `Section ${entry.page_num}`}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "white", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 7px" }}>
                {block.content_type}
              </span>
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
      <div
        style={{
          padding: "8px 18px",
          background: "#FAFAFC",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Course Concept Map
        </span>
        {[
          ["#CBD5E1", "Not started"],
          ["#93C5FD", "Learning"],
          ["#34D399", "Mastered"],
        ].map(([color, label]) => (
          <span key={label as string} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: color as string, border: "1.5px solid #94A3B8", display: "inline-block" }} />
            {label as string}
          </span>
        ))}
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>— click nodes to track</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          {data ? `${data.nodes.length} concepts · ${data.edges.length} connections` : ""}
        </span>
        <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={onRegenerate}>
          Regenerate
        </button>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {!data || data.nodes.length === 0 ? (
          <div className="empty-state">
            <h3>No concept map yet</h3>
            <p>Click Regenerate to build a holistic view across all lectures.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRegenerate}>
              Generate
            </button>
          </div>
        ) : (
          <ConceptMap
            data={data}
            onMasteryChange={(nodeId, mastery) => {
              const idNum = parseInt(nodeId);
              if (!isNaN(idNum)) {
                fetch(`http://localhost:8000/concept-map/0/mastery/${idNum}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mastery }),
                }).catch(() => {});
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// End of file