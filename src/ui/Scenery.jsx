// Background scenery: the table photo, discipline gate and confetti.
import React, { useMemo } from "react";
import { COLORS } from "../constants.js";
import { GameIcon } from "./icons.jsx";
import tableRussianPhoto from "../assets/table-russian.jpg";
import tablePoolPhoto from "../assets/table-pool.jpg";
import tableOffPhoto from "../assets/table-off.jpg";

export function Confetti({ active }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 1.2 + Math.random() * 0.7,
        color: [COLORS.brass, "#8FD3A8", "#E4032E", "#3D6E8F", "#F3EBDA"][i % 5],
        rotate: Math.round(Math.random() * 360),
      })),
    [active]
  );
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-12px",
            left: `${p.left}%`,
            width: "8px",
            height: "13px",
            background: p.color,
            opacity: 0.9,
            borderRadius: "2px",
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
export function DisciplineGate({ onPick }) {
  return (
    <div style={gateStyles.wrap} className="no-print">
      <p style={gateStyles.prompt}>Во что будете играть?</p>
      <div style={gateStyles.options}>
        <button style={gateStyles.option} onClick={() => onPick("russian")}>
          <GameIcon type="russian" size={30} />
          <span>Русский бильярд</span>
        </button>
        <button style={gateStyles.option} onClick={() => onPick("pool")}>
          <GameIcon type="pool" size={30} />
          <span>Pool</span>
        </button>
      </div>
    </div>
  );
}

const gateStyles = {
  wrap: {
    minHeight: "calc(100vh - 40px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "22px",
    padding: "calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))",
    textAlign: "center",
  },
  prompt: {
    fontFamily: "'Fraunces', serif",
    fontStyle: "italic",
    fontSize: "22px",
    fontWeight: 600,
    color: "#F8F1DE",
    margin: 0,
    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
  },
  options: { display: "flex", flexDirection: "column", gap: "14px", width: "100%", maxWidth: "300px" },
  option: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "16px 20px",
    borderRadius: "14px",
    border: "1.5px solid rgba(241,233,210,0.55)",
    background: "rgba(20,22,18,0)",
    color: "#F1E9D2",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
  },
};

// Dark theme: the room is gone — only what the lamp lights stays visible
// (the shade itself and the pool of light on the cloth), fading into black.
const DARK_SPOT_MASK = [
  "radial-gradient(ellipse 30% 9% at 50% 29%, #000 45%, transparent 100%)",
  "radial-gradient(ellipse 60% 15% at 50% 59%, #000 45%, rgba(0,0,0,0.5) 75%, transparent 100%)",
  "radial-gradient(ellipse 20% 12% at 50% 40%, rgba(0,0,0,0.22) 30%, transparent 100%)",
].join(", ");

export function TableArt({ gameType, lit, dark }) {
  const isPool = gameType === "pool";
  // Light theme: the photo a touch brighter and livelier; dark theme: only
  // the lamp-lit spot shows. Transitions so switching themes is smooth.
  const photoFilter = dark ? "brightness(0.95) saturate(0.95)" : "brightness(1.12) saturate(1.12)";
  const layerStyle = {
    position: "absolute",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center 42%",
    transition: "opacity 0.6s ease, filter 0.5s ease",
    filter: photoFilter,
    animation: "tableKenBurns 22s ease-in-out infinite alternate",
  };
  const maskStyle = dark ? { maskImage: DARK_SPOT_MASK, WebkitMaskImage: DARK_SPOT_MASK } : {};

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: dark ? "#050505" : "transparent" }} aria-hidden="true">
      {/* real table photos: a dim "lights off" shot by default, cross-fading
          to the lit russian/pool shot once a discipline is picked */}
      <div style={{ position: "absolute", inset: 0, ...maskStyle }}>
        <div style={{ ...layerStyle, backgroundImage: `url(${tableOffPhoto})`, opacity: lit ? 0 : 1 }} />
        <div style={{ ...layerStyle, backgroundImage: `url(${tableRussianPhoto})`, opacity: lit && !isPool ? 1 : 0 }} />
        <div style={{ ...layerStyle, backgroundImage: `url(${tablePoolPhoto})`, opacity: lit && isPool ? 1 : 0 }} />
      </div>
      {dark && (
        // warm cone of light falling from the lamp onto the table
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(41% 30%, 59% 30%, 96% 70%, 4% 70%)",
            background: "linear-gradient(180deg, rgba(255,214,140,0.16) 0%, rgba(255,214,140,0.05) 60%, transparent 100%)",
            filter: "blur(18px)",
            opacity: lit ? 1 : 0,
            transition: "opacity 0.6s ease",
            pointerEvents: "none",
          }}
        />
      )}
      {/* vignette so header/cards stay legible over a busy photo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(4,10,7,0.55) 0%, rgba(4,10,7,0.15) 22%, rgba(4,10,7,0.10) 60%, rgba(4,10,7,0.6) 100%)",
        }}
      />
    </div>
  );
}
