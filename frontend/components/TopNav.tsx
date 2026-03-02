"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DyslexiaToggle from "./DyslexiaToggle";

export default function TopNav() {
    const path = usePathname();
    return (
        <header className="topnav">
            <span className="logo">StudyMode</span>
            <nav>
                <Link href="/" className={path === "/" ? "active" : ""}>Courses</Link>
                <Link href="/notebooks" className={path.startsWith("/notebook") ? "active" : ""}>Notebooks</Link>
            </nav>
            <DyslexiaToggle />
        </header>
    );
}
