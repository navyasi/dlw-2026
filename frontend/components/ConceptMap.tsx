"use client";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useEdgesState,
    useNodesState,
    type Node,
    type Edge as FlowEdge,
    type Connection,
    type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ConceptMapData } from "@/lib/api";

interface Props {
    data: ConceptMapData;
    onMasteryChange?: (nodeId: string, mastery: number) => void;
}

function masteryColor(mastery: number): string {
    if (mastery >= 0.7) return "#34D399";   // green — mastered
    if (mastery >= 0.35) return "#93C5FD";  // blue — learning
    return "#CBD5E1";                        // grey — not started
}

function buildNodes(data: ConceptMapData, masteryOverrides: Record<string, number>): Node[] {
    return data.nodes.map((n, i) => {
        const mastery = masteryOverrides[n.id] ?? n.mastery;
        const color = masteryColor(mastery);
        return {
            id: n.id,
            data: { label: n.label, mastery },
            position: {
                x: 200 * (i % 4) + 60,
                y: Math.floor(i / 4) * 160 + 60,
            },
            style: {
                background: color,
                border: `2px solid ${mastery >= 0.35 ? "#6366F1" : "#94A3B8"}`,
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#1E293B",
                minWidth: 140,
                textAlign: "center" as const,
                boxShadow: mastery >= 0.35 ? "0 0 0 3px rgba(99,102,241,0.15)" : "0 2px 8px rgba(0,0,0,0.07)",
                cursor: "pointer",
                transition: "all 0.25s ease",
            },
        };
    });
}

function buildEdges(data: ConceptMapData): FlowEdge[] {
    return data.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        label: e.label,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#94A3B8", strokeDasharray: "5 4" },
        labelStyle: { fontSize: 11, fill: "#64748B" },
        labelBgStyle: { fill: "white", fillOpacity: 0.85 },
    }));
}

export default function ConceptMap({ data, onMasteryChange }: Props) {
    const [masteryOverrides, setMasteryOverrides] = useState<Record<string, number>>({});
    const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(data, {}));
    const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(data));
    const [tooltip, setTooltip] = useState<string | null>(null);

    useEffect(() => {
        setMasteryOverrides({});
        setNodes(buildNodes(data, {}));
        setEdges(buildEdges(data));
    }, [data]);

    useEffect(() => {
        setNodes(buildNodes(data, masteryOverrides));
    }, [masteryOverrides]);

    const onConnect = useCallback(
        (c: Connection) => setEdges((ed) => addEdge(c, ed)),
        [setEdges],
    );

    // Click a node → cycle mastery: not started → learning → mastered → not started
    const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
        const current = masteryOverrides[node.id] ?? (data.nodes.find(n => n.id === node.id)?.mastery ?? 0);
        let next: number;
        if (current < 0.35) next = 0.5;       // → learning (blue)
        else if (current < 0.7) next = 1.0;   // → mastered (green)
        else next = 0.0;                       // → not started (grey)

        setMasteryOverrides((prev) => ({ ...prev, [node.id]: next }));

        const label = next >= 0.7 ? "Mastered ✓" : next >= 0.35 ? "Learning…" : "Not started";
        setTooltip(`${node.data.label}: ${label}`);
        setTimeout(() => setTooltip(null), 2000);

        onMasteryChange?.(node.id, next);
    }, [data, masteryOverrides, onMasteryChange]);

    return (
        <div style={{ width: "100%", height: "100%", minHeight: 420, position: "relative" }}>
            {tooltip && (
                <div style={{
                    position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                    background: "var(--accent)", color: "white", borderRadius: 8,
                    padding: "6px 16px", fontSize: 13, fontWeight: 600, zIndex: 50,
                    boxShadow: "0 4px 16px rgba(99,102,241,0.3)", pointerEvents: "none",
                    animation: "fadeUp 0.2s ease",
                }}>
                    {tooltip}
                </div>
            )}
            <div style={{ position: "absolute", top: 10, right: 12, zIndex: 10, fontSize: 11.5, color: "var(--text-muted)", background: "rgba(255,255,255,0.9)", borderRadius: 6, padding: "4px 10px", border: "1px solid var(--border)" }}>
                Click any node to track mastery
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                fitView
                attributionPosition="bottom-right"
            >
                <Background color="#CBD5E1" gap={24} size={1} />
                <Controls />
                <MiniMap
                    nodeColor={(n) => (n.style?.background as string) || "#CBD5E1"}
                    maskColor="rgba(246,248,252,0.85)"
                />
            </ReactFlow>
        </div>
    );
}
