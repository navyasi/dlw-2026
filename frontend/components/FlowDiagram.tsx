"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
    mermaidString: string;
    id: string;
}

let renderCounter = 0;

/**
 * Normalize LLM-generated Mermaid syntax:
 * - Replace semicolons with newlines (LLMs often use ; as separator)
 * - Escape parentheses inside square bracket labels (Mermaid treats them as special)
 * - Trim whitespace
 */
function normalizeMermaid(raw: string): string {
    // Replace semicolons with newlines
    let normalized = raw.replace(/;\s*/g, "\n");
    // Ensure newline after graph declaration
    normalized = normalized.replace(/^(graph\s+(?:TD|TB|BT|RL|LR|))(\s)/im, "$1\n");
    // Escape parentheses inside square brackets: A[text (with parens)] -> A["text (with parens)"]
    // This prevents Mermaid from interpreting () as rounded node syntax
    normalized = normalized.replace(/\[([^\]]*\([^\]]*)\]/g, (_match, content) => {
        return `["${content}"]`;
    });
    // Remove empty lines
    normalized = normalized
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join("\n");
    return normalized;
}

export default function FlowDiagram({ mermaidString, id }: Props) {
    const [svgContent, setSvgContent] = useState<string>("");
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!mermaidString) return;
        setError(false);
        setSvgContent("");

        const renderDiagram = async () => {
            try {
                const m = await import("mermaid");
                const mermaid = m.default;

                mermaid.initialize({
                    startOnLoad: false,
                    theme: "base",
                    suppressErrorRendering: true,
                    securityLevel: "loose",
                    themeVariables: {
                        primaryColor: "#EEF2FF",
                        primaryBorderColor: "#6366F1",
                        primaryTextColor: "#1E293B",
                        lineColor: "#94A3B8",
                        fontSize: "14px",
                    },
                });

                const normalized = normalizeMermaid(mermaidString);

                // Create a temporary container attached to body for Mermaid v11
                const tempDiv = document.createElement("div");
                tempDiv.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;width:800px;";
                document.body.appendChild(tempDiv);

                const uniqueId = `mflow-${++renderCounter}`;

                try {
                    const { svg } = await mermaid.render(uniqueId, normalized, tempDiv);
                    setSvgContent(svg);
                } finally {
                    tempDiv.remove();
                    // Clean up any leftover mermaid render artifacts
                    document.getElementById(uniqueId)?.remove();
                    document.querySelectorAll(`[id^="d${uniqueId}"]`).forEach((el) => el.remove());
                }
            } catch (err) {
                console.warn("Mermaid render error:", err);
                setError(true);
            }
        };

        renderDiagram();
    }, [mermaidString, id]);

    return (
        <div className="flow-diagram-card" role="figure" aria-label="Flow diagram">
            <h4>Flow Diagram</h4>
            {svgContent ? (
                <div
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                    style={{ width: "100%", overflow: "auto" }}
                />
            ) : error ? (
                <>
                    <pre
                        style={{
                            fontSize: 12,
                            color: "#64748B",
                            background: "#F8FAFC",
                            padding: 12,
                            borderRadius: 8,
                            overflowX: "auto",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {mermaidString}
                    </pre>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Diagram could not be rendered — showing raw definition above
                    </div>
                </>
            ) : (
                <div style={{ minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                </div>
            )}
        </div>
    );
}
