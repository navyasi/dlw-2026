"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type TutorialQuestion } from "@/lib/api";
import TutorialFlow from "@/components/TutorialFlow";

interface Props { params: { id: string } }

export default function TutorialPage({ params }: Props) {
    const notebookId = parseInt(params.id);
    const [questions, setQuestions] = useState<TutorialQuestion[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getTutorialFlow(notebookId)
            .then((res) => setQuestions(res.questions))
            .finally(() => setLoading(false));
    }, [notebookId]);

    return (
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 24px 60px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <Link href="/" style={{ color: "var(--text-muted)", fontSize: 13 }}>← Courses</Link>
                <span style={{ fontWeight: 700, fontSize: 18 }}>Tutorial Practice</span>
            </div>

            {loading && <div className="spinner" />}
            {!loading && !questions && (
                <div className="empty-state">
                    <h3>Tutorial flow not available</h3>
                    <p>The backend may still be processing. Refresh in a moment.</p>
                </div>
            )}
            {questions && (
                <TutorialFlow questions={questions} notebookId={notebookId} onFlag={async (_nbId, stepNum) => {
                    const res = await api.flagStep(notebookId, stepNum);
                    return res.hint;
                }} />
            )}
        </div>
    );
}
