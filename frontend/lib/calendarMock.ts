// Mock data for calendar — will be replaced by API calls to GET /calendar/week

export interface CalendarClass {
    course: string;
    type: "lecture" | "tutorial" | "lab";
    day: string;
    start: string; // "HH:mm"
    end: string;
    room?: string;
}

export interface StudySession {
    id: string;
    topic: string;
    course: string;
    day: string;
    start: string;
    end: string;
    priority: "normal" | "high";
    type: "revision" | "practice" | "concept";
    missed?: boolean;
}

export interface BusyBlock {
    id: string;
    title: string;
    day: string;
    start: string;
    end: string;
    tags: string[];
}

export interface WeekSchedule {
    classes: CalendarClass[];
    study_sessions: StudySession[];
    busy_blocks: BusyBlock[];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Get the Monday of the week containing the given date */
export function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

/** Get dates for Mon–Sun of a given week */
export function getWeekDates(monday: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d;
    });
}

export function getDayName(date: Date): string {
    return DAYS[((date.getDay() + 6) % 7)]; // 0=Mon
}

/** Mock schedule — hardcoded classes, sample study sessions */
export function getWeekSchedule(): WeekSchedule {
    return {
        classes: [
            // Computer Security — Lecture
            { course: "Computer Security", type: "lecture", day: "Monday", start: "10:00", end: "12:00", room: "LT-15" },
            { course: "Computer Security", type: "lecture", day: "Wednesday", start: "10:00", end: "12:00", room: "LT-15" },
            // Computer Security — Tutorial
            { course: "Computer Security", type: "tutorial", day: "Tuesday", start: "14:00", end: "15:00", room: "TR-3A" },
            // Computer Security — Lab
            { course: "Computer Security", type: "lab", day: "Thursday", start: "14:00", end: "16:00", room: "Lab 2" },
            // Greenhouse (Science) — Lecture
            { course: "Greenhouse Effect", type: "lecture", day: "Tuesday", start: "10:00", end: "11:00", room: "LT-8" },
            { course: "Greenhouse Effect", type: "lecture", day: "Friday", start: "09:00", end: "10:00", room: "LT-8" },
        ],
        study_sessions: [
            {
                id: "s1", topic: "Buffer Overflow Attacks", course: "Computer Security",
                day: "Monday", start: "14:00", end: "15:30", priority: "high", type: "concept",
            },
            {
                id: "s2", topic: "Stack Smashing Defenses", course: "Computer Security",
                day: "Monday", start: "16:00", end: "17:00", priority: "normal", type: "revision",
            },
            {
                id: "s3", topic: "Greenhouse Gas Emissions", course: "Greenhouse Effect",
                day: "Tuesday", start: "16:00", end: "17:30", priority: "normal", type: "concept",
            },
            {
                id: "s4", topic: "ASLR & DEP Review", course: "Computer Security",
                day: "Wednesday", start: "13:00", end: "14:30", priority: "high", type: "practice",
            },
            {
                id: "s5", topic: "Ozone Layer Depletion", course: "Greenhouse Effect",
                day: "Wednesday", start: "15:00", end: "16:00", priority: "normal", type: "concept",
            },
            {
                id: "s6", topic: "Fuzzing Techniques", course: "Computer Security",
                day: "Thursday", start: "10:00", end: "11:30", priority: "normal", type: "practice",
            },
            {
                id: "s7", topic: "Quiz Prep: Software Security", course: "Computer Security",
                day: "Friday", start: "13:00", end: "15:00", priority: "high", type: "revision",
            },
            {
                id: "s8", topic: "Carbon Footprint Calculations", course: "Greenhouse Effect",
                day: "Saturday", start: "10:00", end: "11:00", priority: "normal", type: "practice",
                missed: true,
            },
        ],
        busy_blocks: [
            {
                id: "b1", title: "Dentist Appointment", day: "Wednesday",
                start: "08:00", end: "09:00", tags: ["Health", "Personal"],
            },
            {
                id: "b2", title: "Hackathon Prep", day: "Saturday",
                start: "13:00", end: "18:00", tags: ["Project"],
            }
        ],
    };
}
