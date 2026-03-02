"use client";
import { useEffect, useState } from "react";

export default function DyslexiaToggle() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("dyslexia") === "1";
        setOn(saved);
        document.documentElement.classList.toggle("dyslexia", saved);
    }, []);

    const toggle = () => {
        const next = !on;
        setOn(next);
        document.documentElement.classList.toggle("dyslexia", next);
        localStorage.setItem("dyslexia", next ? "1" : "0");
    };

    return (
        <label className="toggle-wrapper" onClick={toggle}>
            <div className={`toggle ${on ? "on" : ""}`} />
            Dyslexia Mode
        </label>
    );
}
