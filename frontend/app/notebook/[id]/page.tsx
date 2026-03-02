"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type NotebookDetail, type NoteBlockEntry } from "@/lib/api";
import ConceptBox from "@/components/ConceptBox";
import FlowDiagram from "@/components/FlowDiagram";
import ComparisonTable from "@/components/ComparisonTable";
import WorkedExamples from "@/components/WorkedExamples";
import SemanticBlocks from "@/components/SemanticBlocks";
import Link from "next/link";
import dynamic from "next/dynamic";

const FlowDiagramDynamic = dynamic(() => import("@/components/FlowDiagram"), { ssr: false });

interface Props { params: Promise<{ id: string }> }

// --- Custom drag-to-resize split pane ---
function useSplitPane(initialLeft = 45) {
    const [leftPct, setLeftPct] = useState(initialLeft);
    const dragging = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const onMouseDown = useCallback(() => { dragging.current = true; }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setLeftPct(Math.max(20, Math.min(75, pct)));
        };
        const onUp = () => { dragging.current = false; };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
    }, []);

    return { leftPct, containerRef, onMouseDown };
}

export default function NotebookPage({ params }: Props) {
    const [notebookId, setNotebookId] = useState<number | null>(null);
    const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSlide, setActiveSlide] = useState(0);
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const { leftPct, containerRef, onMouseDown } = useSplitPane(45);

    useEffect(() => {
        params.then((p) => setNotebookId(parseInt(p.id)));
    }, [params]);

    useEffect(() => {
        if (notebookId == null) return;
        api.getNotebook(notebookId)
            .then(setNotebook)
            .finally(() => setLoading(false));
    }, [notebookId]);

    const scrollToSlide = (idx: number) => {
        setActiveSlide(idx);
        slideRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (loading) return <div className="spinner" />;
    if (!notebook) return <div className="empty-state"><h3>Notebook not found</h3></div>;

    const blocks = notebook.note_blocks;
    const sourceRef = notebook.source_ref;

    return (
        <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
            {/* Toolbar */}
            <div style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", background: "white", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13 }}>← Courses</Link>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{notebook.title}</span>
                <span className={`badge badge-${notebook.source_type}`}>{notebook.source_type}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    {notebookId && (
                        <Link href={`/concept-map/${notebookId}`} className="btn btn-secondary" style={{ fontSize: 13 }}>
                            View Concept Map
                        </Link>
                    )}
                </div>
            </div>

            {/* Split pane */}
            <div ref={containerRef} style={{ flex: 1, display: "flex", overflow: "hidden", userSelect: "none" }}>
                {/* LEFT: Source viewer */}
                <div style={{ width: `${leftPct}%`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
                    <div style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "#FAFAFC", flexShrink: 0 }}>
                        Source Material
                    </div>
                    <div style={{ flex: 1, overflow: "hidden", background: "#F1F5F9" }}>
                        {notebook.source_type === "article" && sourceRef ? (
                            <iframe src={sourceRef} style={{ width: "100%", height: "100%", border: "none" }} title="Article" />
                        ) : sourceRef ? (
                            <iframe src={`http://localhost:8000/pdf/${encodeURIComponent(sourceRef)}`} style={{ width: "100%", height: "100%", border: "none" }} title="PDF" />
                        ) : (
                            <div className="empty-state"><p>No preview</p></div>
                        )}
                    </div>
                </div>

                {/* DRAG HANDLE */}
                <div
                    onMouseDown={onMouseDown}
                    style={{
                        width: 6,
                        cursor: "col-resize",
                        background: "var(--border)",
                        flexShrink: 0,
                        position: "relative",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--border)")}
                />

                {/* RIGHT: AI Notes */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                    {/* Slide index sidebar */}
                    {blocks.length > 1 && (
                        <div className="slide-index">
                            {blocks.map((b, i) => (
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

                    {/* Notes scroll area */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 40px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 16 }}>
                            AI Visual Notes — {blocks.length} {blocks.length === 1 ? "section" : "slides"}
                        </div>
                        {blocks.map((entry, i) => (
                            <NoteCard
                                key={entry.id}
                                entry={entry}
                                refFn={(el) => { slideRefs.current[i] = el; }}
                                isActive={activeSlide === i}
                                onVisible={() => setActiveSlide(i)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoteCard({ entry, refFn, isActive, onVisible }: {
    entry: NoteBlockEntry;
    refFn: (el: HTMLDivElement | null) => void;
    isActive: boolean;
    onVisible: () => void;
}) {
    const { block } = entry;
    const localRef = useRef<HTMLDivElement>(null);

    const setRef = (el: HTMLDivElement | null) => {
        (localRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        refFn(el);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) onVisible(); },
            { threshold: 0.4 }
        );
        if (localRef.current) observer.observe(localRef.current);
        return () => observer.disconnect();
    }, [onVisible]);

    return (
        <div
            ref={setRef}
            style={{
                marginBottom: 28,
                border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 12,
                background: "white",
                overflow: "hidden",
                boxShadow: isActive ? "0 0 0 4px var(--accent-light)" : "var(--shadow-card)",
                transition: "box-shadow 0.2s, border-color 0.2s",
            }}
        >
            <div style={{ padding: "12px 20px", background: isActive ? "var(--accent-light)" : "#F8FAFC", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                    Slide {entry.page_num}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", background: "white", border: "1px solid var(--border)", borderRadius: 99, padding: "2px 8px" }}>
                    {block.content_type}
                </span>
                <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                    Visual density: {block.visual_density_score}/100
                </div>
            </div>
            <div style={{ padding: "20px" }}>
                {block.concept_box && <ConceptBox data={block.concept_box} />}
                {block.flow_diagram && (
                    <FlowDiagramDynamic mermaidString={block.flow_diagram} id={`nb-${entry.id}`} />
                )}
                {block.comparison_table && <ComparisonTable data={block.comparison_table} />}
                {block.worked_examples && block.worked_examples.length > 0 && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>Worked Examples</div>
                        <WorkedExamples examples={block.worked_examples} />
                    </>
                )}
                {block.semantic_blocks && block.semantic_blocks.length > 0 && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10, marginTop: 4 }}>Key Concepts</div>
                        <SemanticBlocks blocks={block.semantic_blocks} />
                    </>
                )}
            </div>
        </div>
    );
}
