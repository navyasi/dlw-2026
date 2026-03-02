"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type ConceptMapData } from "@/lib/api";

const ConceptMap = dynamic(() => import("@/components/ConceptMap"), { ssr: false });

interface Props { params: Promise<{ id: string }> }

export default function ConceptMapPage({ params }: Props) {
    const [notebookId, setNotebookId] = useState<number | null>(null);
    const [mapData, setMapData] = useState<ConceptMapData | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => {
        params.then((p) => setNotebookId(parseInt(p.id)));
    }, [params]);

    const load = () => {
        if (notebookId == null) return;
        setLoading(true);
        api.getConceptMap(notebookId)
            .then(setMapData)
            .catch(() => setMapData(null))
            .finally(() => setLoading(false));
    };

    useEffect(load, [notebookId]);

    const regenerate = async () => {
        if (notebookId == null) return;
        setRegenerating(true);
        await fetch(`http://localhost:8000/concept-map/${notebookId}/generate`, { method: "POST" });
        setRegenerating(false);
        load();
    };

    return (
        <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
            {/* Toolbar */}
            <div style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", background: "white", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13 }}>← Courses</Link>
                <Link href={`/notebook/${notebookId}`} style={{ color: "var(--text-muted)", fontSize: 13 }}>Visual Notes</Link>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Concept Map</span>
                <div style={{ marginLeft: "auto" }}>
                    <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={regenerate} disabled={regenerating}>
                        {regenerating ? "Regenerating…" : "↺ Regenerate"}
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ padding: "8px 24px", background: "#FAFAFC", borderBottom: "1px solid var(--border)", display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mastery</span>
                {[["#CBD5E1", "Not started"], ["#93C5FD", "Learning"], ["#34D399", "Mastered"]].map(([color, label]) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: color, border: "1.5px solid #94A3B8", display: "inline-block" }} />
                        {label}
                    </span>
                ))}
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {mapData ? `${mapData.nodes.length} concepts · ${mapData.edges.length} connections` : ""}
                </span>
            </div>

            {/* Map */}
            <div style={{ flex: 1, overflow: "hidden" }}>
                {loading && <div className="spinner" />}
                {!loading && (!mapData || mapData.nodes.length === 0) && (
                    <div className="empty-state">
                        <h3>No concept map yet</h3>
                        <p>Click Regenerate to extract concepts from this notebook.</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={regenerate}>
                            Generate Concept Map
                        </button>
                    </div>
                )}
                {!loading && mapData && mapData.nodes.length > 0 && (
                    <ConceptMap data={mapData} />
                )}
            </div>
        </div>
    );
}
