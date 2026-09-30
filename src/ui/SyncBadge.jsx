import React from "react";

const SYNC_LOOK = {
  synced: { color: "#5BC98A", label: "Синхронизировано", short: "✓" },
  pending: { color: "#E8B75A", label: "Отправляем…", short: "…" },
  offline: { color: "#A8A294", label: "Нет сети — сохранено на телефоне", short: "офлайн" },
  error: { color: "#E0705F", label: "Не дошло — повторим", short: "!" },
};

// Small club-sync indicator: does everyone else already see my changes?
export function SyncBadge({ status, compact, dotOnly }) {
  const look = SYNC_LOOK[status] || SYNC_LOOK.synced;
  const dot = (
    <span
      style={{
        width: "8px",
        height: "8px",
        flexShrink: 0,
        borderRadius: "50%",
        background: look.color,
        boxShadow: `0 0 6px ${look.color}`,
        animation: status === "pending" ? "syncPulse 1s ease-in-out infinite" : "none",
      }}
    />
  );
  if (dotOnly) {
    return (
      <span role="status" aria-label={`Клуб: ${look.label}`} title={`Клуб: ${look.label}`} style={{ display: "inline-flex", padding: "0 4px" }}>
        {dot}
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-live="polite"
      title={`Клуб: ${look.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: compact ? "4px 8px" : "4px 10px",
        borderRadius: "999px",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "#F1E9D2",
        fontSize: "11px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {dot}
      {compact ? `Клуб ${look.short}` : `Клуб · ${look.label}`}
    </span>
  );
}
