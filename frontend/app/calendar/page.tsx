"use client";

import { useState, useEffect } from "react";
import { getWeekSchedule, type WeekSchedule } from "@/lib/calendarMock";
import CalendarWeekView from "@/components/calendar/CalendarWeekView";

export default function CalendarPage() {
    const [schedule, setSchedule] = useState<WeekSchedule | null>(null);

    useEffect(() => {
        // TODO: Replace with api.getCalendarWeek() once backend is ready
        const data = getWeekSchedule();
        setSchedule(data);
    }, []);

    if (!schedule) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
            <CalendarWeekView schedule={schedule} />
        </main>
    );
}
