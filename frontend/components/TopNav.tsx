// "use client";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import DyslexiaToggle from "./DyslexiaToggle";

// export default function TopNav() {
//     const path = usePathname();
//     return (
//         <header className="topnav">
//             <span className="logo">StudyMode</span>
//             <nav>
//                 <Link href="/" className={path === "/" ? "active" : ""}>Courses</Link>
//                 <Link href="/calendar" className={path === "/calendar" ? "active" : ""}>Calendar</Link>
//                 <Link href="/notebooks" className={path.startsWith("/notebook") ? "active" : ""}>Notebooks</Link>
//             </nav>
//             <DyslexiaToggle />
//         </header>
//     );
// }


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DyslexiaToggle from "./DyslexiaToggle";
import LockdownToggle from "@/components/lockdown/LockdownToggle";

export default function TopNav() {
  const path = usePathname();

  return (
    <header className="topnav">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="logo">StudyMode</span>
        <LockdownToggle />
      </div>

      {/* Removed old navigation links as per design update */}
      <div></div>

      <DyslexiaToggle />
    </header>
  );
}