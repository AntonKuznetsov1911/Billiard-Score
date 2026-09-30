import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants.js";

const WHEEL_ITEM_H = 52;
const WHEEL_ROWS = 5;
const WHEEL_MAX = 150;

export function ScoreWheel({ label, value, onChange, onClose }) {
  const boxH = WHEEL_ITEM_H * WHEEL_ROWS;
  const padY = (boxH - WHEEL_ITEM_H) / 2;
  const listRef = useRef(null);
  const scrollTimer = useRef(null);
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = value * WHEEL_ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (v) => {
    setCurrent(v);
    onChange(v);
  };

  const handleScroll = () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!listRef.current) return;
      const idx = Math.round(listRef.current.scrollTop / WHEEL_ITEM_H);
      settle(Math.max(0, Math.min(WHEEL_MAX, idx)));
    }, 90);
  };

  const jumpTo = (v) => {
    if (listRef.current) listRef.current.scrollTo({ top: v * WHEEL_ITEM_H, behavior: "smooth" });
  };

  return (
    <div style={wheelStyles.overlay} onClick={onClose}>
      <div style={wheelStyles.card} onClick={(e) => e.stopPropagation()}>
        <p style={wheelStyles.label}>{label}</p>
        <div style={{ position: "relative", height: boxH }}>
          <div style={{ ...wheelStyles.centerBand, top: padY, height: WHEEL_ITEM_H }} />
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="wheel-scroll"
            style={{ ...wheelStyles.list, height: boxH, paddingTop: padY, paddingBottom: padY }}
          >
            {Array.from({ length: WHEEL_MAX + 1 }, (_, n) => (
              <div key={n} onClick={() => jumpTo(n)} style={{ ...wheelStyles.item, height: WHEEL_ITEM_H, ...(n === current ? wheelStyles.itemActive : {}) }}>
                {n}
              </div>
            ))}
          </div>
        </div>
        <button style={wheelStyles.doneBtn} onClick={onClose}>
          Готово
        </button>
      </div>
    </div>
  );
}

const wheelStyles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 60 },
  card: { background: "#1C1D18", borderRadius: "18px", padding: "18px", width: "220px", boxShadow: "0 10px 30px rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)" },
  label: { color: "#E7DCC0", fontSize: "13px", fontWeight: 600, textAlign: "center", margin: "0 0 10px" },
  centerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: "10px",
    background: "rgba(192,138,62,0.18)",
    border: "1px solid rgba(231,206,147,0.4)",
    pointerEvents: "none",
  },
  list: { overflowY: "scroll", scrollSnapType: "y mandatory", overscrollBehavior: "contain" },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    scrollSnapAlign: "center",
    scrollSnapStop: "always",
    fontFamily: "'Space Mono', monospace",
    fontSize: "18px",
    fontWeight: 600,
    color: "rgba(241,233,210,0.45)",
    cursor: "pointer",
  },
  itemActive: { color: "#F8E7B8", fontSize: "24px", fontWeight: 700 },
  doneBtn: {
    marginTop: "12px",
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: COLORS.brass,
    color: "#2C1D08",
    fontWeight: 700,
    fontSize: "13px",
  },
};
