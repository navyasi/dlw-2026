"use client";

import React from "react";
import { useLockdown } from "./LockdownProvider";

export default function LockdownToggle() {
  const { enabled, toggle } = useLockdown();

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <span style={{ fontSize: 13, opacity: 0.85 }}>Lockdown</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: "1px solid #d0d0d0",
          background: enabled ? "#2563eb" : "#e5e7eb",
          position: "relative",
          padding: 0,
          cursor: "pointer",
        }}
        aria-pressed={enabled}
        aria-label="Toggle lockdown mode"
        title="Toggle Lockdown"
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: enabled ? 24 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 160ms ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        />
      </button>
    </label>
  );
}