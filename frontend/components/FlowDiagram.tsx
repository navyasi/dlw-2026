"use client";
import { useEffect, useRef } from "react";

interface Props {
    mermaidString: string;
    id: string;
}

export default function FlowDiagram({ mermaidString, id }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current || !mermaidString) return;

        import("mermaid").then((m) => {
            m.default.initialize({
                startOnLoad: false,
                theme: "base",
                themeVariables: {
                    primaryColor: "#EEF2FF",
                    primaryBorderColor: "#6366F1",
                    primaryTextColor: "#1E293B",
                    lineColor: "#94A3B8",
                    fontSize: "14px",
                },
            });

            const el = ref.current!;
            el.innerHTML = "";
            // mermaid v10+ API
            m.default.render(`mermaid-${id}`, mermaidString).then(({ svg }) => {
                el.innerHTML = svg;
            }).catch((err) => {
                el.innerHTML = `<pre style="font-size:12px;color:#94A3B8">${mermaidString}</pre>`;
                console.warn("Mermaid render error:", err);
            });
        });
    }, [mermaidString, id]);

    return (
        <div className="flow-diagram-card">
            <h4>Flow Diagram</h4>
            <div ref={ref} />
        </div>
    );
}
