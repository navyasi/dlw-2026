"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Course } from "@/lib/api";

const BASE = "http://localhost:8000";

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<"loading" | "seeding" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const checkReady = async () => {
      try {
        const res = await fetch(`${BASE}/ready`);
        if (!res.ok) throw new Error("backend not ready");
        const { ready } = await res.json();
        if (!ready) {
          setStatus("seeding");
          timer = setTimeout(checkReady, 3000); // poll every 3s
          return;
        }
        // Seeding done — load courses
        const c = await api.listCourses();
        setCourses(c);
        setStatus("ready");
      } catch (e: any) {
        if (e.message?.includes("Failed to fetch") || e.message?.includes("backend not ready")) {
          setStatus("seeding");
          timer = setTimeout(checkReady, 3000);
        } else {
          setError(e.message);
          setStatus("error");
        }
      }
    };

    checkReady();
    return () => clearTimeout(timer);
  }, [router]);

  if (status === "loading" || status === "seeding") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)", gap: 20 }}>
        <div className="spinner" style={{ marginTop: 0 }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {status === "loading" ? "Connecting…" : "Processing your materials with AI…"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380 }}>
            {status === "seeding"
              ? "The backend is generating visual notes from your PDFs and article. This takes 2–4 minutes on first boot. The page will update automatically."
              : "Connecting to the backend…"}
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <h3>Could not connect to the backend</h3>
        <p>Make sure the FastAPI server is running on <code>http://localhost:8000</code>.</p>
        <p style={{ fontSize: 12, marginTop: 8, color: "#EF4444" }}>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Multiple courses
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 6, letterSpacing: -0.5 }}>Your Courses</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>Select a course to start studying.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {courses.map((c) => (
          <a key={c.id} href={`/course/${c.id}`} style={{ textDecoration: "none" }}>
            <div className="notebook-card" style={{ padding: "20px 24px" }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>{c.description}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="badge badge-slides">{c.lecture_count} Lectures</span>
                {c.tutorial_count > 0 && <span className="badge badge-tutorial">{c.tutorial_count} Tutorial{c.tutorial_count !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
