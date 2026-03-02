"use client";

const ITEMS: { label: string; color: string; border?: string; dashed?: boolean }[] = [
    { label: "Lecture", color: "#DBEAFE", border: "#3B82F6" },
    { label: "Tutorial", color: "#EDE9FE", border: "#8B5CF6" },
    { label: "Lab", color: "#CCFBF1", border: "#14B8A6" },
    { label: "Study", color: "#DCFCE7", border: "#22C55E" },
    { label: "High Priority", color: "#BBF7D0", border: "#16A34A" },
    { label: "Missed", color: "#FEF2F2", border: "#EF4444", dashed: true },
];

export default function CalendarLegend() {
    return (
        <div className="cal-legend" role="region" aria-label="Calendar legend">
            {ITEMS.map((item) => (
                <div key={item.label} className="cal-legend__item">
                    <span
                        className="cal-legend__swatch"
                        style={{
                            background: item.color,
                            borderLeft: `3px solid ${item.border}`,
                            borderStyle: item.dashed ? "dashed" : "solid",
                        }}
                    />
                    <span className="cal-legend__label">{item.label}</span>
                </div>
            ))}
        </div>
    );
}
