"use client";

import { useState, useMemo } from "react";
import type { WeekSchedule, BusyBlock } from "@/lib/calendarMock";
import { getMonday, getWeekDates, getDayName } from "@/lib/calendarMock";
import TimeGrid from "./TimeGrid";
import CalendarLegend from "./CalendarLegend";
import AddBusyModal from "./AddBusyModal";

interface Props {
    schedule: WeekSchedule;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarWeekView({ schedule }: Props) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>(schedule.busy_blocks || []);
    const [addModal, setAddModal] = useState<{ day: string; hour: number } | null>(null);

    const today = useMemo(() => new Date(), []);
    const monday = useMemo(() => {
        const m = getMonday(today);
        m.setDate(m.getDate() + weekOffset * 7);
        return m;
    }, [today, weekOffset]);

    const weekDates = useMemo(() => getWeekDates(monday), [monday]);
    const dayNames = weekDates.map((d) => getDayName(d));
    const todayStr = getDayName(today);

    // Header title: "March 2026" or "Feb – Mar 2026" if week spans months
    const firstMonth = weekDates[0].getMonth();
    const lastMonth = weekDates[6].getMonth();
    const year = weekDates[0].getFullYear();
    const monthTitle =
        firstMonth === lastMonth
            ? `${SHORT_MONTHS[firstMonth]} ${year}`
            : `${SHORT_MONTHS[firstMonth]} – ${SHORT_MONTHS[lastMonth]} ${year}`;

    return (
        <div className="cal-week" role="region" aria-label="Weekly calendar view">
            {/* Header bar */}
            <div className="cal-week__header">
                <h1 className="cal-week__title">{monthTitle}</h1>
                <div className="cal-week__nav">
                    <button
                        className="cal-week__nav-btn"
                        onClick={() => setWeekOffset((o) => o - 1)}
                        aria-label="Previous week"
                    >
                        ‹
                    </button>
                    <button
                        className="cal-week__nav-btn cal-week__nav-btn--today"
                        onClick={() => setWeekOffset(0)}
                    >
                        Today
                    </button>
                    <button
                        className="cal-week__nav-btn"
                        onClick={() => setWeekOffset((o) => o + 1)}
                        aria-label="Next week"
                    >
                        ›
                    </button>
                </div>
            </div>

            {/* Day column headers */}
            <div className="cal-week__days">
                <div className="cal-week__days-spacer" /> {/* Aligns with hour labels */}
                {weekDates.map((date, i) => {
                    const isToday = getDayName(date) === todayStr && weekOffset === 0;
                    return (
                        <div key={i} className={`cal-week__day-header ${isToday ? "cal-week__day-header--today" : ""}`}>
                            <span className="cal-week__day-name">{SHORT_DAYS[i]}</span>
                            <span className={`cal-week__day-num ${isToday ? "cal-week__day-num--today" : ""}`}>
                                {date.getDate()}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Scrollable grid area */}
            <div className="cal-week__scroll">
                <TimeGrid
                    days={dayNames}
                    classes={schedule.classes}
                    studySessions={schedule.study_sessions}
                    busyBlocks={busyBlocks}
                    onAddBusy={(day, hour) => setAddModal({ day, hour })}
                />
            </div>

            {/* Legend */}
            <CalendarLegend />

            {/* Add Busy Block Modal */}
            {addModal && (
                <AddBusyModal
                    day={addModal.day}
                    startHour={addModal.hour}
                    onClose={() => setAddModal(null)}
                    onSave={(title, start, end, tags) => {
                        const newBlock: BusyBlock = {
                            id: `b-${Date.now()}`,
                            title,
                            day: addModal.day,
                            start,
                            end,
                            tags
                        };
                        setBusyBlocks([...busyBlocks, newBlock]);
                        setAddModal(null);
                    }}
                />
            )}
        </div>
    );
}
