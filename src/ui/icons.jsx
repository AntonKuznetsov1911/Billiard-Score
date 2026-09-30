// Small SVG icons and glyphs used across the app.
import React from "react";
import { COLORS, DICE_PIP_POS, DICE_LAYOUTS } from "../constants.js";

export function Die({ value = 1, size = 46 }) {
  const pips = DICE_LAYOUTS[value] || DICE_LAYOUTS[1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <defs>
        <linearGradient id="dieFaceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="55%" stopColor="#EDE0C8" />
          <stop offset="100%" stopColor="#C9B98F" />
        </linearGradient>
      </defs>
      <rect x="7" y="10" width="86" height="86" rx="17" fill="#00000038" />
      <rect x="4" y="5" width="86" height="86" rx="17" fill="url(#dieFaceGrad)" stroke="#00000025" strokeWidth="1.5" />
      <rect x="4" y="5" width="86" height="30" rx="17" fill="#ffffff30" />
      <rect x="4" y="5" width="86" height="86" rx="17" fill="none" stroke="#ffffff40" strokeWidth="1" />
      {pips.map((key, i) => {
        const [cx, cy] = DICE_PIP_POS[key];
        return (
          <g key={i}>
            <circle cx={cx + 0.8} cy={cy + 1.2} r="7.6" fill="#00000030" />
            <circle cx={cx} cy={cy} r="7.6" fill="#241A10" />
            <circle cx={cx - 2.2} cy={cy - 2.2} r="1.6" fill="#ffffff55" />
          </g>
        );
      })}
    </svg>
  );
}

export function PyramidMini({ size = 16 }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.9)}
      viewBox="0 0 20 18"
      style={{ display: "inline-block", verticalAlign: "-2px" }}
      aria-hidden="true"
    >
      <circle cx="10" cy="4.2" r="3.5" fill="#EDE0C8" stroke="#00000033" strokeWidth="0.4" />
      <circle cx="6" cy="11" r="3.5" fill="#EDE0C8" stroke="#00000033" strokeWidth="0.4" />
      <circle cx="14" cy="11" r="3.5" fill="#EDE0C8" stroke="#00000033" strokeWidth="0.4" />
    </svg>
  );
}

export function GameIcon({ type, size = 16 }) {
  if (type === "pool") return <span>🎱</span>;
  return <PyramidMini size={size} />;
}

export function NavCue({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <radialGradient id="navBallG" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="60%" stopColor="#EDE0C8" />
          <stop offset="100%" stopColor="#C9B98F" />
        </radialGradient>
      </defs>
      <ellipse cx="13" cy="20.4" rx="7.4" ry="2.2" fill="#00000028" />
      <circle cx="12" cy="11.6" r="8.8" fill="url(#navBallG)" stroke="#00000033" strokeWidth="0.6" />
      <circle cx="9" cy="8.4" r="2.6" fill="#ffffffaa" />
      <text
        x="12"
        y="15"
        fontSize="9.5"
        fontFamily="'Space Mono', monospace"
        fontWeight="700"
        textAnchor="middle"
        fill="#241A10"
      >
        1
      </text>
    </svg>
  );
}

export function NavTrophy({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id="navTroG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C989" />
          <stop offset="100%" stopColor="#A06E28" />
        </linearGradient>
      </defs>
      <path d="M7 4 h10 v5 a5 5 0 0 1 -10 0 Z" fill="url(#navTroG)" stroke="#00000022" strokeWidth="0.6" />
      <path d="M7 5.5 H4.4 a0.4 0.4 0 0 0 -0.4 0.4 c0 2.6 1.6 4.3 3.4 4.7" fill="none" stroke="url(#navTroG)" strokeWidth="1.6" />
      <path d="M17 5.5 h2.6 a0.4 0.4 0 0 1 0.4 0.4 c0 2.6 -1.6 4.3 -3.4 4.7" fill="none" stroke="url(#navTroG)" strokeWidth="1.6" />
      <rect x="10.8" y="13.6" width="2.4" height="3" fill="url(#navTroG)" />
      <rect x="8" y="16.6" width="8" height="2.6" rx="1" fill="url(#navTroG)" stroke="#00000022" strokeWidth="0.5" />
      <circle cx="10" cy="6.6" r="1.2" fill="#ffffff55" />
    </svg>
  );
}

export function NavClock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <radialGradient id="navClkG" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="60%" stopColor="#EDE0C8" />
          <stop offset="100%" stopColor="#C9B98F" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#navClkG)" stroke="#A06E28" strokeWidth="1.6" />
      <line x1="12" y1="12" x2="12" y2="6.6" stroke="#5A3821" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="12" x2="15.8" y2="13.8" stroke="#A06E28" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.2" fill="#5A3821" />
      <circle cx="9" cy="8.4" r="1.4" fill="#ffffff66" />
    </svg>
  );
}

export function NavGear({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id="navGearG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C989" />
          <stop offset="100%" stopColor="#8A5A24" />
        </linearGradient>
      </defs>
      <g fill="url(#navGearG)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="10.7" y="2.2" width="2.6" height="4.4" rx="1" transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="6" fill="url(#navGearG)" stroke="#00000022" strokeWidth="0.6" />
      <circle cx="12" cy="12" r="2.6" fill="#0E1A14" opacity="0.85" />
      <circle cx="10" cy="9.6" r="1.2" fill="#ffffff44" />
    </svg>
  );
}

export function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0", opacity: 0.8 }}>
      <PyramidMini size={38} />
      <p style={{ margin: "8px 0 0", fontSize: "13px", fontStyle: "italic" }}>{text}</p>
    </div>
  );
}

export function PlayerBall({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color} stroke="#00000033" strokeWidth="0.6" />
      <circle cx="5.6" cy="5.6" r="2" fill="#ffffff88" />
    </svg>
  );
}

export function IconTrophy({ size = 14, color = COLORS.brass }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <path d="M7 4 h10 v5 a5 5 0 0 1 -10 0 Z" fill={color} stroke="#00000022" strokeWidth="0.6" />
      <path d="M7 5.5 H4.4 a0.4 0.4 0 0 0 -0.4 0.4 c0 2.6 1.6 4.3 3.4 4.7" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M17 5.5 h2.6 a0.4 0.4 0 0 1 0.4 0.4 c0 2.6 -1.6 4.3 -3.4 4.7" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="10.8" y="13.6" width="2.4" height="3" fill={color} />
      <rect x="8" y="16.6" width="8" height="2.6" rx="1" fill={color} stroke="#00000022" strokeWidth="0.5" />
    </svg>
  );
}

export function IconTarget({ size = 14, color = COLORS.brass }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill={color} />
    </svg>
  );
}

export function IconDice({ size = 14, color = COLORS.chalk }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="8" cy="8" r="1.6" fill={color} />
      <circle cx="16" cy="8" r="1.6" fill={color} />
      <circle cx="8" cy="16" r="1.6" fill={color} />
      <circle cx="16" cy="16" r="1.6" fill={color} />
      <circle cx="12" cy="12" r="1.6" fill={color} />
    </svg>
  );
}
