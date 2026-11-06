import React, { lazy, Suspense, useState } from "react";
import BilliardsTracker from "./BilliardsTracker.jsx";
const Classic = lazy(() => import("./BilliardsTrackerClassic.jsx"));
export default function DesignShell() {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem("billiards-design-mode") || "modern"; } catch { return "modern"; } });
  const switchMode = value => { try { localStorage.setItem("billiards-design-mode", value); } catch { /* Session-only mode still works. */ } setMode(value); };
  return <Suspense fallback={<div style={{ padding: 40, background: "#0c1713", color: "#f4f1e8" }}>Открываем интерфейс…</div>}>
    {mode === "classic" ? <Classic onDesignModeChange={switchMode} /> : <BilliardsTracker onDesignModeChange={switchMode} />}
  </Suspense>;
}
