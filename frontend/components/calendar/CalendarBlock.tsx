"use client";

import type { CalendarClass, StudySession, BusyBlock } from "@/lib/calendarMock";
import { BookOpen, Users, FlaskConical, Brain, Lock } from "lucide-react";

export type BlockData =
    | { kind: "class"; data: CalendarClass }
    | { kind: "study"; data: StudySession }
    | { kind: "busy"; data: BusyBlock };

interface Props {
    block: BlockData;
    style: React.CSSProperties;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    lecture: { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF", accent: "#3B82F6" },
    tutorial: { bg: "#EDE9FE", border: "#8B5CF6", text: "#5B21B6", accent: "#8B5CF6" },
    lab: { bg: "#CCFBF1", border: "#14B8A6", text: "#0F766E", accent: "#14B8A6" },
    study: { bg: "#DCFCE7", border: "#22C55E", text: "#166534", accent: "#22C55E" },
    "study-high": { bg: "#BBF7D0", border: "#16A34A", text: "#14532D", accent: "#16A34A" },
    busy: { bg: "#F1F5F9", border: "#94A3B8", text: "#334155", accent: "#475569" },
};

const TYPE_LABELS: Record<string, string> = {
    revision: "Revision",
    practice: "Practice",
    concept: "Concept",
};

export default function CalendarBlock({ block, style }: Props) {
    let typeKey: string;
    let title: string;
    let subtitle: string = "";
    let timeRange: string;
    let badge: string | null = null;
    let missed = false;
    let Icon = BookOpen;

    if (block.kind === "class") {
        const c = block.data;
        typeKey = c.type;
        title = c.course;
        subtitle = c.room ?? "";
        timeRange = `${c.start} – ${c.end}`;
        badge = c.type.charAt(0).toUpperCase() + c.type.slice(1);

        if (c.type === "tutorial") Icon = Users;
        else if (c.type === "lab") Icon = FlaskConical;
    } else if (block.kind === "study") {
        const s = block.data;
        const isHigh = s.priority === "high";
        typeKey = isHigh ? "study-high" : "study";
        title = s.topic;
        subtitle = s.course;
        timeRange = `${s.start} – ${s.end}`;
        badge = TYPE_LABELS[s.type] || s.type;
        missed = s.missed ?? false;
        Icon = Brain;
    } else {
        const b = block.data;
        typeKey = "busy";
        title = b.title;
        timeRange = `${b.start} – ${b.end}`;
        badge = b.tags && b.tags.length > 0 ? b.tags[0] : null;
        Icon = Lock;
    }

    const colors = TYPE_STYLES[typeKey] || TYPE_STYLES.study;
    const isBusy = block.kind === "busy";

    return (
        <div
            className={`cal-block ${missed ? "cal-block--missed" : ""} ${isBusy ? "cal-block--busy" : ""}`}
            role="article"
            aria-label={`${title}, ${timeRange}`}
            style={{
                ...style,
                background: missed ? "rgba(254,226,226,0.5)" : colors.bg,
                borderLeft: `3px solid ${missed ? "#EF4444" : colors.border}`,
                borderStyle: missed ? "dashed" : isBusy ? "dashed" : undefined,
                color: missed ? "#991B1B" : colors.text,
            }}
        >
            <div className="cal-block__header">
                <Icon size={12} style={{ opacity: 0.8 }} />
                <span className="cal-block__time">{timeRange}</span>
            </div>
            <div className="cal-block__title" style={{ marginTop: isBusy ? 4 : 0 }}>{title}</div>
            {subtitle && <div className="cal-block__sub">{subtitle}</div>}

            {(badge || isBusy) && (
                <div className="cal-block__tags">
                    {badge && (
                        <span
                            className="cal-block__badge"
                            style={{
                                background: missed ? "#FEE2E2" : `${colors.accent}18`,
                                color: missed ? "#DC2626" : colors.accent,
                                border: `1px solid ${missed ? "#FCA5A5" : colors.accent}40`,
                            }}
                        >
                            {missed ? "Missed" : badge}
                        </span>
                    )}
                    {isBusy && block.data.tags?.slice(1).map(tag => (
                        <span key={tag} className="cal-block__badge" style={{ background: `${colors.accent}10`, color: colors.accent, border: `1px solid ${colors.accent}30` }}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
