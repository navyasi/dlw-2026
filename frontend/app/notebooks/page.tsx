"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Notebook } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
    slides: "Lecture Slides",
    article: "Article",
    tutorial: "Tutorial",
};



export default function NotebooksPage() {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.listNotebooks()
            .then(setNotebooks)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner" />;
    if (error) return (
        <div className="empty-state"><h3>Backend not reachable</h3><p>{error}</p></div>
    );

    const lectures = notebooks.filter(n => n.source_type !== "tutorial");
    const tutorials = notebooks.filter(n => n.source_type === "tutorial");

    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }}>
            <div style={{ marginBottom: 28 }}>
                <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Courses</Link>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, marginTop: 8 }}>All Notebooks</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Every lecture, article, and tutorial in the system</p>
            </div>

            {lectures.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                        Lectures &amp; Articles ({lectures.length})
                    </div>
                    <div className="home-grid" style={{ padding: 0 }}>
                        {lectures.map((nb) => (
                            <NotebookCard key={nb.id} notebook={nb} />
                        ))}
                    </div>
                </section>
            )}

            {tutorials.length > 0 && (
                <section>
                    <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                        Tutorials ({tutorials.length})
                    </div>
                    <div className="home-grid" style={{ padding: 0 }}>
                        {tutorials.map((nb) => (
                            <NotebookCard key={nb.id} notebook={nb} />
                        ))}
                    </div>
                </section>
            )}

            {notebooks.length === 0 && (
                <div className="empty-state">
                    <h3>No notebooks yet</h3>
                    <p>They will appear here once the backend has finished seeding.</p>
                </div>
            )}
        </main>
    );
}

function NotebookCard({ notebook }: { notebook: Notebook }) {
    const label = SOURCE_LABELS[notebook.source_type] ?? notebook.source_type;

    return (
        <Link href={notebook.course_id ? `/course/${notebook.course_id}` : `/notebook/${notebook.id}`} style={{ textDecoration: "none" }}>
            <div className="notebook-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span className={`badge badge-${notebook.source_type}`}>{label}</span>
                </div>
                <div className="nb-title">{notebook.title}</div>
                {notebook.page_count != null && (
                    <div className="nb-meta">{notebook.page_count} {notebook.source_type === "tutorial" ? "question(s)" : "slides"}</div>
                )}
                <div className="nb-actions">
                    <span className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }}>Open Notes</span>
                    {notebook.source_type !== "tutorial" && (
                        <span className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}>Concept Map</span>
                    )}
                </div>
            </div>
        </Link>
    );
}
