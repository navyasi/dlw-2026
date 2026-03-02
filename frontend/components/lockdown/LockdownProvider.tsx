// "use client";

// import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// type LockdownContextType = {
//   enabled: boolean;
//   timerRunning: boolean;
//   durationMin: number;
//   secondsLeft: number;
//   violations: { ts: string; msg: string }[];
//   start: (mins?: number) => Promise<void>;
//   stop: () => Promise<void>;
//   toggle: () => Promise<void>;
//   setDurationMin: (m: number) => void;
//   setTimerRunning: (v: boolean) => void;
// };

// const LockdownContext = createContext<LockdownContextType | null>(null);

// function isFullscreen() {
//   return !!document.fullscreenElement;
// }

// async function enterFullscreen() {
//   const el = document.documentElement;
//   if (el.requestFullscreen) await el.requestFullscreen();
// }

// async function exitFullscreen() {
//   if (document.exitFullscreen) await document.exitFullscreen();
// }

// function fmtTime(secs: number) {
//   const m = Math.floor(secs / 60);
//   const s = secs % 60;
//   return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
// }

// // Block common in-page escape keys (cannot block OS shortcuts like Alt+Tab/Cmd+Tab)
// function shouldBlockKey(e: KeyboardEvent) {
//   const k = (e.key || "").toLowerCase();
//   const ctrl = e.ctrlKey || e.metaKey;

//   if (k === "escape") return true;
//   if (ctrl && ["w", "t", "l", "r", "n", "p", "o", "s", "d"].includes(k)) return true;

//   // function keys (some browsers ignore preventDefault)
//   if (k.startsWith("f") && k.length <= 3) return true;

//   return false;
// }

// export function LockdownProvider({ children }: { children: React.ReactNode }) {
    
//     const [enabled, setEnabled] = useState(false);

//   const [durationMin, setDurationMin] = useState(25);
//   const [secondsLeft, setSecondsLeft] = useState(25 * 60);
//   const [timerRunning, setTimerRunning] = useState(false);

//   const [violations, setViolations] = useState<{ ts: string; msg: string }[]>([]);
//   const [holdExit, setHoldExit] = useState(false);

//   const logViolation = (msg: string) => {
//     setViolations((prev) => {
//       const next = [{ ts: new Date().toISOString(), msg }, ...prev];
//       return next.slice(0, 10);
//     });
//   };

//   const start = async (mins: number = durationMin) => {
//     try {
//       setDurationMin(mins);
//       setSecondsLeft(mins * 60);
//       setViolations([]);

//       await enterFullscreen();

//       setEnabled(true);
//       setTimerRunning(true);
//     } catch (e) {
//       console.error(e);
//       alert("Fullscreen was blocked. Click again or allow fullscreen permission.");
//       setEnabled(false);
//       setTimerRunning(false);
//     }
//   };

//   const stop = async () => {
//     setTimerRunning(false);
//     setEnabled(false);
//     setHoldExit(false);
//     try {
//       await exitFullscreen();
//     } catch (e) {
//       console.error(e);
//     }
//   };

//   const toggle = async () => {
//     if (enabled) await stop();
//     else await start(durationMin);
//   };

//   // Timer tick
//   useEffect(() => {
//     if (!enabled || !timerRunning) return;

//     const t = window.setInterval(() => {
//       setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
//     }, 1000);

//     return () => window.clearInterval(t);
//   }, [enabled, timerRunning]);

//   // On finish
//   useEffect(() => {
//     if (!enabled) return;
//     if (secondsLeft === 0) {
//       setTimerRunning(false);
//       alert("Session complete!");
//     }
//   }, [secondsLeft, enabled]);

//   // Violations: tab switch / blur / fullscreen exit + key blocking
//   useEffect(() => {
//     if (!enabled) return;

//     const onKeyDown = (e: KeyboardEvent) => {
//       if (!enabled) return;
//       if (shouldBlockKey(e)) {
//         e.preventDefault();
//         e.stopPropagation();
//         logViolation(`Blocked key: ${e.key}`);
//       }
//     };

//     const onContextMenu = (e: MouseEvent) => {
//       e.preventDefault();
//       logViolation("Blocked context menu");
//     };

//     const onVisibility = () => {
//       if (document.hidden) {
//         logViolation("Tab switched / page hidden (timer paused)");
//         setTimerRunning(false);
//       }
//     };

//     const onBlur = () => {
//       logViolation("Window lost focus (timer paused)");
//       setTimerRunning(false);
//     };

//     const onFullscreenChange = () => {
//       if (enabled && !isFullscreen()) {
//         logViolation("Exited fullscreen (timer paused)");
//         setTimerRunning(false);
//       }
//     };

//     window.addEventListener("keydown", onKeyDown, true);
//     window.addEventListener("contextmenu", onContextMenu, true);
//     document.addEventListener("visibilitychange", onVisibility);
//     window.addEventListener("blur", onBlur);
//     document.addEventListener("fullscreenchange", onFullscreenChange);

//     return () => {
//       window.removeEventListener("keydown", onKeyDown, true);
//       window.removeEventListener("contextmenu", onContextMenu, true);
//       document.removeEventListener("visibilitychange", onVisibility);
//       window.removeEventListener("blur", onBlur);
//       document.removeEventListener("fullscreenchange", onFullscreenChange);
//     };
//   }, [enabled]);

//   // Hold-to-exit: hold button for 2 seconds
//   useEffect(() => {
//     if (!enabled || !holdExit) return;

//     const startedAt = Date.now();
//     const timer = window.setInterval(() => {
//       const elapsed = Date.now() - startedAt;
//       if (elapsed >= 2000) {
//         window.clearInterval(timer);
//         stop();
//       }
//     }, 50);

//     return () => window.clearInterval(timer);
//   }, [enabled, holdExit]);

//   const value = useMemo<LockdownContextType>(
//     () => ({
//       enabled,
//       timerRunning,
//       durationMin,
//       secondsLeft,
//       violations,
//       start,
//       stop,
//       toggle,
//       setDurationMin,
//       setTimerRunning,
//     }),
//     [enabled, timerRunning, durationMin, secondsLeft, violations]
//   );

//   return (
//     <LockdownContext.Provider value={value}>
//       {/* Render the REAL app UI always (so you see actual units) */}
//       {children}

//       {/* Overlay shell only when enabled */}
//       {enabled && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             zIndex: 999999,
//             pointerEvents: "none", // important: let your app still be clickable by default
//           }}
//         >
//           {/* Top bar */}
//           <div
//             style={{
//               pointerEvents: "auto",
//               background: "#0b0b0b",
//               color: "#fff",
//               borderBottom: "1px solid #222",
//               padding: 12,
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "space-between",
//               gap: 12,
//             }}
//           >
//             <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
//               <div style={{ fontWeight: 800 }}>Lockdown — {durationMin} min</div>
//               <div style={{ fontSize: 12, opacity: 0.75 }}>
//                 Switching tabs/leaving fullscreen pauses timer. Hold 2s to exit.
//               </div>
//             </div>

//             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//               <select
//                 value={durationMin}
//                 onChange={(e) => {
//                   const m = Number(e.target.value);
//                   setDurationMin(m);
//                   setSecondsLeft(m * 60);
//                 }}
//                 style={{
//                   pointerEvents: "auto",
//                   background: "#111",
//                   color: "#fff",
//                   border: "1px solid #333",
//                   borderRadius: 8,
//                   padding: "8px 10px",
//                 }}
//               >
//                 <option value={25}>25 min</option>
//                 <option value={50}>50 min</option>
//               </select>

//               <div style={{ fontSize: 26, fontWeight: 900, minWidth: 92, textAlign: "right" }}>
//                 {fmtTime(secondsLeft)}
//               </div>

//               {!timerRunning ? (
//                 <button
//                   onClick={async () => {
//                     if (!isFullscreen()) {
//                       try {
//                         await enterFullscreen();
//                       } catch (e) {
//                         console.error(e);
//                         alert("Cannot re-enter fullscreen. Click anywhere then try again.");
//                         return;
//                       }
//                     }
//                     setTimerRunning(true);
//                   }}
//                   style={{ padding: "10px 14px", borderRadius: 10 }}
//                 >
//                   Resume
//                 </button>
//               ) : (
//                 <button
//                   onClick={() => setTimerRunning(false)}
//                   style={{ padding: "10px 14px", borderRadius: 10 }}
//                 >
//                   Pause
//                 </button>
//               )}

//               <button
//                 onMouseDown={() => setHoldExit(true)}
//                 onMouseUp={() => setHoldExit(false)}
//                 onMouseLeave={() => setHoldExit(false)}
//                 onTouchStart={() => setHoldExit(true)}
//                 onTouchEnd={() => setHoldExit(false)}
//                 style={{
//                   padding: "10px 14px",
//                   borderRadius: 10,
//                   border: "1px solid rgba(255,255,255,0.25)",
//                   background: "rgba(255,255,255,0.08)",
//                   color: "#fff",
//                   cursor: "pointer",
//                 }}
//               >
//                 Hold 2s to Exit
//               </button>
//             </div>
//           </div>

//           {/* Bottom violations strip */}
//           <div
//             style={{
//               pointerEvents: "auto",
//               position: "fixed",
//               left: 0,
//               right: 0,
//               bottom: 0,
//               background: "#0b0b0b",
//               color: "#fff",
//               borderTop: "1px solid #222",
//               padding: 10,
//               fontSize: 12,
//             }}
//           >
//             <b>Violations:</b> {violations.length === 0 ? "None" : violations[0]?.msg}
//           </div>
//         </div>
//       )}
//     </LockdownContext.Provider>
//   );
// }

// export function useLockdown() {
//   const ctx = useContext(LockdownContext);
//   if (!ctx) throw new Error("useLockdown must be used within LockdownProvider");
//   return ctx;
// }


"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type LockdownContextType = {
  enabled: boolean;
  timerRunning: boolean;
  durationMin: number;
  secondsLeft: number;
  violations: { ts: string; msg: string }[];
  start: (mins?: number) => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  setDurationMin: (m: number) => void;
  setTimerRunning: (v: boolean) => void;
};

const LockdownContext = createContext<LockdownContextType | null>(null);

function isFullscreen() {
  return !!document.fullscreenElement;
}

async function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) await el.requestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
}

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Block common in-page escape keys (cannot block OS shortcuts like Alt+Tab/Cmd+Tab)
function shouldBlockKey(e: KeyboardEvent) {
  const k = (e.key || "").toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;

  if (k === "escape") return true;
  if (ctrl && ["w", "t", "l", "r", "n", "p", "o", "s", "d"].includes(k)) return true;

  // function keys (some browsers ignore preventDefault)
  if (k.startsWith("f") && k.length <= 3) return true;

  return false;
}

export function LockdownProvider({ children }: { children: React.ReactNode }) {
  // ===== Overlay heights (used to push the page so it doesn't get covered) =====
  const TOP_H = 64; // px
  const BOTTOM_H = 40; // px

  const [enabled, setEnabled] = useState(false);

  const [durationMin, setDurationMin] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [violations, setViolations] = useState<{ ts: string; msg: string }[]>([]);
  const [holdExit, setHoldExit] = useState(false);

  const logViolation = (msg: string) => {
    setViolations((prev) => {
      const next = [{ ts: new Date().toISOString(), msg }, ...prev];
      return next.slice(0, 10);
    });
  };

  const start = async (mins: number = durationMin) => {
    try {
      setDurationMin(mins);
      setSecondsLeft(mins * 60);
      setViolations([]);

      await enterFullscreen();

      setEnabled(true);
      setTimerRunning(true);
    } catch (e) {
      console.error(e);
      alert("Fullscreen was blocked. Click again or allow fullscreen permission.");
      setEnabled(false);
      setTimerRunning(false);
    }
  };

  const stop = async () => {
    setTimerRunning(false);
    setEnabled(false);
    setHoldExit(false);
    try {
      await exitFullscreen();
    } catch (e) {
      console.error(e);
    }
  };

  const toggle = async () => {
    if (enabled) await stop();
    else await start(durationMin);
  };

  // ✅ Push the actual app content down/up so top/bottom bars don't hide UI
  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove("lockdown-on");
      document.body.style.removeProperty("--lockdown-top");
      document.body.style.removeProperty("--lockdown-bottom");
      return;
    }

    document.body.classList.add("lockdown-on");
    document.body.style.setProperty("--lockdown-top", `${TOP_H}px`);
    document.body.style.setProperty("--lockdown-bottom", `${BOTTOM_H}px`);

    return () => {
      document.body.classList.remove("lockdown-on");
      document.body.style.removeProperty("--lockdown-top");
      document.body.style.removeProperty("--lockdown-bottom");
    };
  }, [enabled]);

  // Timer tick
  useEffect(() => {
    if (!enabled || !timerRunning) return;

    const t = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(t);
  }, [enabled, timerRunning]);

  // On finish
  useEffect(() => {
    if (!enabled) return;
    if (secondsLeft === 0) {
      setTimerRunning(false);
      alert("Session complete!");
    }
  }, [secondsLeft, enabled]);

  // Violations: tab switch / blur / fullscreen exit + key blocking
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (shouldBlockKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        logViolation(`Blocked key: ${e.key}`);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation("Blocked context menu");
    };

    const onVisibility = () => {
      if (document.hidden) {
        logViolation("Tab switched / page hidden (timer paused)");
        setTimerRunning(false);
      }
    };

    const onBlur = () => {
      logViolation("Window lost focus (timer paused)");
      setTimerRunning(false);
    };

    const onFullscreenChange = () => {
      if (enabled && !isFullscreen()) {
        logViolation("Exited fullscreen (timer paused)");
        setTimerRunning(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [enabled]);

  // Hold-to-exit: hold button for 2 seconds
  useEffect(() => {
    if (!enabled || !holdExit) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 2000) {
        window.clearInterval(timer);
        stop();
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [enabled, holdExit]);

  const value = useMemo<LockdownContextType>(
    () => ({
      enabled,
      timerRunning,
      durationMin,
      secondsLeft,
      violations,
      start,
      stop,
      toggle,
      setDurationMin,
      setTimerRunning,
    }),
    [enabled, timerRunning, durationMin, secondsLeft, violations]
  );

  return (
    <LockdownContext.Provider value={value}>
      {/* Render the REAL app UI always (so you see actual units) */}
      {children}

      {/* Overlay shell only when enabled */}
      {enabled && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            pointerEvents: "none", // let app remain usable
          }}
        >
          {/* TOP BAR */}
          <div
            style={{
              pointerEvents: "auto",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: TOP_H,
              background: "#0b0b0b",
              color: "#fff",
              borderBottom: "1px solid #222",
              padding: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontWeight: 800 }}>Lockdown — {durationMin} min</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Switching tabs/leaving fullscreen pauses timer. Hold 2s to exit.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select
                value={durationMin}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setDurationMin(m);
                  setSecondsLeft(m * 60);
                }}
                style={{
                  pointerEvents: "auto",
                  background: "#111",
                  color: "#fff",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <option value={25}>25 min</option>
                <option value={50}>50 min</option>
              </select>

              <div style={{ fontSize: 26, fontWeight: 900, minWidth: 92, textAlign: "right" }}>
                {fmtTime(secondsLeft)}
              </div>

              {!timerRunning ? (
                <button
                  onClick={async () => {
                    if (!isFullscreen()) {
                      try {
                        await enterFullscreen();
                      } catch (e) {
                        console.error(e);
                        alert("Cannot re-enter fullscreen. Click anywhere then try again.");
                        return;
                      }
                    }
                    setTimerRunning(true);
                  }}
                  style={{ padding: "10px 14px", borderRadius: 10 }}
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={() => setTimerRunning(false)}
                  style={{ padding: "10px 14px", borderRadius: 10 }}
                >
                  Pause
                </button>
              )}

              <button
                onMouseDown={() => setHoldExit(true)}
                onMouseUp={() => setHoldExit(false)}
                onMouseLeave={() => setHoldExit(false)}
                onTouchStart={() => setHoldExit(true)}
                onTouchEnd={() => setHoldExit(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Hold 2s to Exit
              </button>
            </div>
          </div>

          {/* BOTTOM VIOLATIONS STRIP */}
          <div
            style={{
              pointerEvents: "auto",
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              height: BOTTOM_H,
              background: "#0b0b0b",
              color: "#fff",
              borderTop: "1px solid #222",
              padding: 10,
              fontSize: 12,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
            }}
          >
            <b style={{ marginRight: 6 }}>Violations:</b>{" "}
            {violations.length === 0 ? "None" : violations[0]?.msg}
          </div>
        </div>
      )}
    </LockdownContext.Provider>
  );
}

export function useLockdown() {
  const ctx = useContext(LockdownContext);
  if (!ctx) throw new Error("useLockdown must be used within LockdownProvider");
  return ctx;
}