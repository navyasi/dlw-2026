"use client";

import type { CalendarClass, StudySession, BusyBlock } from "@/lib/calendarMock";
import CalendarBlock, { type BlockData } from "./CalendarBlock";
import { Plus } from "lucide-react";

interface Props {
    days: string[];          // ["Monday", …]
    classes: CalendarClass[];
    studySessions: StudySession[];
    busyBlocks: BusyBlock[];
    onAddBusy: (day: string, hour: number) => void;
}

// Grid config
const START_HOUR = 6;   // 6 AM
const END_HOUR = 22;    // 10 PM
const TOTAL_HOURS = END_HOUR - START_HOUR;
const PX_PER_HOUR = 64; // height per hour row

/** Parse "HH:mm" → fractional hours since START_HOUR */
function timeToOffset(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h - START_HOUR + m / 60;
}

/** Format hour index as label */
function hourLabel(hour: number): string {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
}

export default function TimeGrid({ days, classes, studySessions, busyBlocks, onAddBusy }: Props) {
    // Build events per day
    const dayEvents: Record<string, BlockData[]> = {};
    for (const d of days) dayEvents[d] = [];

    for (const c of classes) {
        if (dayEvents[c.day]) {
            dayEvents[c.day].push({ kind: "class", data: c });
        }
    }
    for (const s of studySessions) {
        if (dayEvents[s.day]) {
            dayEvents[s.day].push({ kind: "study", data: s });
        }
    }
    for (const b of busyBlocks) {
        if (dayEvents[b.day]) {
            dayEvents[b.day].push({ kind: "busy", data: b });
        }
    }

    // Hour labels
    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

    return (
        <div className="cal-grid" role="grid" aria-label="Weekly schedule grid">
            {/* Hour labels column */}
            <div className="cal-grid__hours">
                {hours.map((h) => (
                    <div key={h} className="cal-grid__hour-label" style={{ height: PX_PER_HOUR }}>
                        {hourLabel(h)}
                    </div>
                ))}
            </div>

            {/* Day columns */}
            {days.map((day) => (
                <div key={day} className="cal-grid__day-col" role="gridcell" aria-label={day}>
                    {/* Interactive Background Grid (Hover to add busy block) */}
                    <div className="cal-grid__bg">
                        {hours.map((h) => (
                            <div
                                key={h}
                                className="cal-grid__slot"
                                style={{ height: PX_PER_HOUR }}
                                onClick={() => onAddBusy(day, h)}
                                role="button"
                                aria-label={`Add busy block at ${hourLabel(h)}`}
                            >
                                <div className="cal-grid__slot-hover">
                                    <Plus size={14} /> Add Event
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Event blocks */}
                    {dayEvents[day].map((block, i) => {
                        const start = block.data.start;
                        const end = block.data.end;
                        const top = timeToOffset(start) * PX_PER_HOUR;
                        const height = (timeToOffset(end) - timeToOffset(start)) * PX_PER_HOUR;

                        return (
                            <CalendarBlock
                                key={`${day}-${i}`}
                                block={block}
                                style={{
                                    position: "absolute",
                                    top,
                                    left: 2,
                                    right: 2,
                                    height: Math.max(height - 2, 24),
                                    zIndex: 2,
                                }}
                            />
                        );
                    })}

                    {/* Current time indicator */}
                    <CurrentTimeIndicator day={day} />
                </div>
            ))}
        </div>
    );
}

/** Red line showing current time on today's column */
function CurrentTimeIndicator({ day }: { day: string }) {
    const now = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[now.getDay()];

    if (day !== todayName) return null;

    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour < START_HOUR || currentHour > END_HOUR) return null;

    const top = (currentHour - START_HOUR) * PX_PER_HOUR;

    return (
        <div className="cal-grid__now" style={{ top }} aria-label="Current time">
            <div className="cal-grid__now-dot" />
            <div className="cal-grid__now-line" />
        </div>
    );
}
