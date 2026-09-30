import React, { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

// Shows "new version available" instead of silently waiting for the app to be
// closed and reopened. Checks for updates on start, every 30 minutes and
// whenever the app comes back to the foreground.
export default function UpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef(null);

  useEffect(() => {
    let timer = null;
    let reg = null;
    const check = () => {
      if (reg && navigator.onLine !== false) reg.update().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    updateRef.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_url, registration) {
        reg = registration;
        if (!registration) return;
        timer = setInterval(check, 30 * 60 * 1000);
        document.addEventListener("visibilitychange", onVisible);
      },
    });
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="no-print"
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "calc(86px + env(safe-area-inset-bottom))",
        zIndex: 65,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "12px",
        background: "#16352A",
        border: "1px solid rgba(217,163,84,0.7)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        color: "#FDF6E3",
        fontFamily: "'Inter', sans-serif",
        fontSize: "13px",
      }}
    >
      <span style={{ flex: 1 }}>Доступна новая версия приложения</span>
      <button
        onClick={() => setNeedRefresh(false)}
        style={{ background: "transparent", border: "none", color: "#E3D9BC", fontSize: "12px", padding: "6px" }}
      >
        Позже
      </button>
      <button
        onClick={() => {
          if (updateRef.current) updateRef.current(true);
          // The library reloads once the new worker takes control; if that
          // signal never comes (page not yet controlled), reload anyway.
          setTimeout(() => window.location.reload(), 2500);
        }}
        style={{
          background: "#C08A3E",
          border: "none",
          borderRadius: "8px",
          color: "#241705",
          fontWeight: 700,
          fontSize: "13px",
          padding: "8px 12px",
        }}
      >
        Обновить
      </button>
    </div>
  );
}
