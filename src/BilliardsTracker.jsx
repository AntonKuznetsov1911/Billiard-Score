import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

const STORAGE_KEY = "billiards-club-data";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
`;

const COLORS = {
  felt: "#0F3D2E",
  feltDark: "#0A2B20",
  wood: "#6B4226",
  woodLight: "#8A5A34",
  cream: "#F3EBDA",
  chalk: "#3D6E8F",
  brass: "#C08A3E",
  ink: "#1B1712",
  danger: "#B5473A",
};

const DICE_PIP_POS = {
  tl: [26, 26],
  tr: [74, 26],
  ml: [26, 50],
  mr: [74, 50],
  bl: [26, 74],
  br: [74, 74],
  c: [50, 50],
};

const DICE_LAYOUTS = {
  1: ["c"],
  2: ["tl", "br"],
  3: ["tl", "c", "br"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "c", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

function Die({ value = 1, size = 46 }) {
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

const POOL_PALETTE = [
  { c: "#FFD400", t: "#1B1712" },
  { c: "#0057B8", t: "#fff" },
  { c: "#E4032E", t: "#fff" },
  { c: "#5B2C82", t: "#fff" },
  { c: "#FF7F11", t: "#1B1712" },
  { c: "#0B7A3E", t: "#fff" },
  { c: "#7A1F2B", t: "#fff" },
  { c: "#111111", t: "#fff" },
  { c: "#FFD400", t: "#1B1712" },
  { c: "#0057B8", t: "#fff" },
  { c: "#E4032E", t: "#fff" },
  { c: "#5B2C82", t: "#fff" },
  { c: "#FF7F11", t: "#1B1712" },
  { c: "#0B7A3E", t: "#fff" },
  { c: "#7A1F2B", t: "#fff" },
];

const GAME_TYPES = {
  russian: { label: "Русский бильярд" },
  pool: { label: "Пул" },
};

const RUSSIAN_MODES = {
  free: {
    name: "Свободная пирамида",
    alias: "Американка",
    target: 8,
    unit: "шаров",
    rules: [
      "Играть можно любым шаром по любому шару.",
      "Засчитывается любой правильно забитый шар.",
      "Побеждает тот, кто первым забьёт 8 шаров.",
      "Самый популярный любительский вариант.",
    ],
  },
  combined: {
    name: "Комбинированная пирамида",
    alias: "Московская",
    target: 8,
    unit: "шаров",
    rules: [
      "Бить можно только битком.",
      "После каждого забитого шара игрок выставляет любой шар на отметку и продолжает серию.",
      "Требует более точной позиционной игры.",
      "Побеждает тот, кто первым забьёт 8 шаров.",
    ],
  },
  dynamic: {
    name: "Динамичная пирамида",
    alias: "Невская",
    target: 8,
    unit: "шаров",
    rules: [
      "После забитого шара игрок снимает его со стола и выставляет биток из дома.",
      "Игра более быстрая и атакующая.",
      "Побеждает тот, кто первым забьёт 8 шаров.",
    ],
  },
  classic: {
    name: "Классическая пирамида",
    alias: "71 очко",
    target: 71,
    unit: "очков",
    rules: [
      "Профессиональная дисциплина.",
      "Каждый шар имеет стоимость в очках.",
      "Для победы необходимо набрать 71 очко.",
      "Самая сложная разновидность русского бильярда.",
    ],
  },
  kolhoz: {
    name: "Колхоз",
    alias: "Колхоз",
    target: null,
    unit: "очков",
    minPlayers: 3,
    rules: [
      "Коллективная игра для 3 и более игроков — по итогу партии каждый рассчитывается с каждым.",
      "Забитый шар не выбывает из игры: очки записываются игроку, шар возвращается на стол.",
      "Отмечайте номинал забитого шара для того, кто его закатил.",
      "Точные номиналы шаров и штрафы отличаются от клуба к клубу — начните с любых значений и подстройте под свои правила игры.",
      "Партия завершается вручную, когда компания решает закончить, а не по достижении цели.",
      "По итогу партии для каждой пары игроков считается разница очков — это и есть результат между ними.",
    ],
  },
};

function CueExclamation({ height = 34 }) {
  const width = Math.round(height * 0.42);
  const shaftH = 15;
  const wrapH = 8;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 40"
      style={{ display: "inline-block", verticalAlign: "-5px", marginLeft: "3px", transform: "rotate(12deg)" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="excShaftGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF4E4" />
          <stop offset="100%" stopColor="#E4D2AE" />
        </linearGradient>
        <linearGradient id="excWrapGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6E2733" />
          <stop offset="100%" stopColor="#38121A" />
        </linearGradient>
        <radialGradient id="excBallGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="60%" stopColor="#EDE0C8" />
          <stop offset="100%" stopColor="#C9B98F" />
        </radialGradient>
      </defs>
      <rect x="6.4" y="0" width="3.2" height={shaftH} rx="1.4" fill="url(#excShaftGrad)" />
      <rect x="6" y={shaftH} width="4" height={wrapH} rx="1" fill="url(#excWrapGrad)" />
      {[1.6, 3.6, 5.6].map((dy) => (
        <React.Fragment key={dy}>
          <circle cx="7" cy={shaftH + dy} r="0.35" fill="#00000060" />
          <circle cx="8.6" cy={shaftH + dy + 1} r="0.35" fill="#00000060" />
        </React.Fragment>
      ))}
      <circle cx="8" cy="33" r="6.6" fill="url(#excBallGrad)" stroke="#00000033" strokeWidth="0.6" />
      <circle cx="6" cy="30.5" r="2" fill="#ffffffaa" />
    </svg>
  );
}

function PyramidMini({ size = 16 }) {
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

function GameIcon({ type, size = 16 }) {
  if (type === "pool") return <span>🎱</span>;
  return <PyramidMini size={size} />;
}

function NavCue({ size = 20 }) {
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

function NavTrophy({ size = 20 }) {
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

function NavClock({ size = 20 }) {
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

function NavGear({ size = 20 }) {
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

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0", opacity: 0.8 }}>
      <PyramidMini size={38} />
      <p style={{ margin: "8px 0 0", fontSize: "13px", fontStyle: "italic" }}>{text}</p>
    </div>
  );
}

const AVATAR_COLORS = ["#E4032E", "#0057B8", "#F0B429", "#5B2C82", "#0B7A3E", "#FF7F11", "#3D6E8F", "#7A1F2B", "#20B2AA", "#C08A3E"];

function PlayerBall({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color} stroke="#00000033" strokeWidth="0.6" />
      <circle cx="5.6" cy="5.6" r="2" fill="#ffffff88" />
    </svg>
  );
}

function buildKolhozSettlement(participants, scores) {
  const matrix = {};
  participants.forEach((a) => {
    matrix[a] = {};
    participants.forEach((b) => {
      if (a === b) return;
      matrix[a][b] = (scores[a] || 0) - (scores[b] || 0);
    });
  });
  return matrix;
}

const kolhozCellStyle = {
  border: "1px solid rgba(139,90,52,0.35)",
  padding: "6px 9px",
  textAlign: "center",
  whiteSpace: "nowrap",
  fontSize: "12px",
};

function KolhozTable({ participants, settlement, nameById, playerColor }) {
  if (!settlement) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: "10px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={kolhozCellStyle} />
            {participants.map((pid) => (
              <th key={pid} style={kolhozCellStyle}>
                <PlayerBall color={playerColor(pid)} size={10} /> {nameById(pid)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((a) => (
            <tr key={a}>
              <th style={kolhozCellStyle}>
                <PlayerBall color={playerColor(a)} size={10} /> {nameById(a)}
              </th>
              {participants.map((b) => {
                if (a === b) return <td key={b} style={kolhozCellStyle}>—</td>;
                const v = (settlement[a] && settlement[a][b]) || 0;
                return (
                  <td
                    key={b}
                    style={{
                      ...kolhozCellStyle,
                      fontWeight: 700,
                      color: v > 0 ? "#3E9B5C" : v < 0 ? "#B5473A" : undefined,
                    }}
                  >
                    {v > 0 ? `+${v}` : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: dark ? "rgba(24,26,21,0.96)" : "rgba(255,253,248,0.97)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "#E3D8BC"}`,
        borderRadius: "10px",
        padding: "8px 12px",
        fontSize: "12px",
        fontFamily: "'Inter', sans-serif",
        color: dark ? "#F1EAD8" : "#1B1712",
        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
          {String(p.dataKey).includes("%") ? "%" : ""}
        </div>
      ))}
    </div>
  );
}

function getTG() {
  try {
    if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp;
    }
  } catch (e) {
    // not inside Telegram
  }
  return null;
}

function haptic(type) {
  const tg = getTG();
  if (!tg || !tg.HapticFeedback) return;
  try {
    if (type === "success" || type === "error" || type === "warning") {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type || "light");
    }
  } catch (e) {
    // ignore
  }
}

function Confetti({ active }) {
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
function TableArt({ gameType }) {
  const isPool = gameType === "pool";
  const objectBallFill = isPool ? "url(#poolBallGrad)" : "url(#redBallGrad)";

  // Square canvas 900x900, top-down table. The shot (cue, both balls, target
  // pocket) lives in the central zone (x 260-660, y 250-650) which stays
  // visible under "slice" cropping on any screen aspect ratio.
  const felt = { x1: 262, y1: 72, x2: 638, y2: 828 };
  const midY = (felt.y1 + felt.y2) / 2; // 450

  // Shot: cue strikes red -> red rolls into white -> white drops into the
  // mid-right side pocket (dead center of the safe zone).
  const redStart = { x: 352, y: 598 };
  const whiteStart = { x: 522, y: 508 };

  const dx = whiteStart.x - redStart.x;
  const dy = whiteStart.y - redStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / dist;
  const uy = dy / dist;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const ballRadius = 13;
  const tipX = redStart.x - ux * (ballRadius + 3);
  const tipY = redStart.y - uy * (ballRadius + 3);

  // Correct real-table pocket layout: 4 corners + 2 side middles.
  // Centers sit slightly OUTSIDE the felt edge (cut into the rail),
  // like real pocket openings; `ax/ay` is the outward direction.
  const pockets = [
    { x: felt.x1 - 4, y: felt.y1 - 4, r: 21, ax: -1, ay: -1 }, // top-left corner
    { x: felt.x2 + 4, y: felt.y1 - 4, r: 21, ax: 1, ay: -1 }, // top-right corner
    { x: felt.x1 - 7, y: midY, r: 19, ax: -1, ay: 0 }, // mid-left side
    { x: felt.x2 + 7, y: midY, r: 19, ax: 1, ay: 0 }, // mid-right side (shot target)
    { x: felt.x1 - 4, y: felt.y2 + 4, r: 21, ax: -1, ay: 1 }, // bottom-left corner
    { x: felt.x2 + 4, y: felt.y2 + 4, r: 21, ax: 1, ay: 1 }, // bottom-right corner
  ];

  const diamondsX = [353, 405, 495, 547];
  const diamondsY = [166, 261, 356, 544, 639, 734];

  // Remaining balls scattered around the felt (fixed "random" layout).
  // Total on table = 16: these 14 + the animated cue ball + object ball.
  // Positions avoid the shot corridor, the cue, and all six pockets.
  const scatter = [
    { x: 300, y: 140 },
    { x: 430, y: 122 },
    { x: 560, y: 172 },
    { x: 332, y: 232 },
    { x: 500, y: 262 },
    { x: 598, y: 312 },
    { x: 292, y: 342 },
    { x: 422, y: 382 },
    { x: 310, y: 482 },
    { x: 577, y: 562 },
    { x: 590, y: 662 },
    { x: 362, y: 702 },
    { x: 482, y: 762 },
    { x: 302, y: 792 },
  ];

  return (
    <svg
      viewBox="0 0 900 900"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bgRoomGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#140F0B" />
          <stop offset="100%" stopColor="#0C2A1F" />
        </linearGradient>
        <radialGradient id="feltTopGrad" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#1C6B4C" />
          <stop offset="55%" stopColor="#13503A" />
          <stop offset="100%" stopColor="#0A3125" />
        </radialGradient>
        <linearGradient id="railWoodGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7A4B2C" />
          <stop offset="50%" stopColor="#5A3821" />
          <stop offset="100%" stopColor="#3D2515" />
        </linearGradient>
        <radialGradient id="ballGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="60%" stopColor="#EDE0C8" />
          <stop offset="100%" stopColor="#C9B98F" />
        </radialGradient>
        <radialGradient id="redBallGrad" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#FF7A68" />
          <stop offset="55%" stopColor="#D9291F" />
          <stop offset="100%" stopColor="#7A1220" />
        </radialGradient>
        <radialGradient id="poolBallGrad" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#FFE07A" />
          <stop offset="55%" stopColor="#F0B429" />
          <stop offset="100%" stopColor="#8A5A0A" />
        </radialGradient>
        <linearGradient id="shotCueGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38121A" />
          <stop offset="40%" stopColor="#6E2733" />
          <stop offset="62%" stopColor="#E4D2AE" />
          <stop offset="100%" stopColor="#FBF4E4" />
        </linearGradient>
        <radialGradient id="pocketHoleGrad" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#020202" />
          <stop offset="65%" stopColor="#060606" />
          <stop offset="100%" stopColor="#0B1712" />
        </radialGradient>
        <radialGradient id="spotlightGrad" cx="50%" cy="45%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.30" />
        </radialGradient>
      </defs>

      <rect width="900" height="900" fill="url(#bgRoomGrad)" />

      {/* wooden rail frame */}
      <rect x="212" y="24" width="476" height="852" rx="30" fill="url(#railWoodGrad)" />
      <rect x="212" y="24" width="476" height="852" rx="30" fill="none" stroke="#0E0805" strokeWidth="3" opacity="0.5" />
      {/* cushion nose */}
      <rect x="244" y="54" width="412" height="792" rx="14" fill="#0A2E22" />
      {/* playing felt */}
      <rect x={felt.x1} y={felt.y1} width={felt.x2 - felt.x1} height={felt.y2 - felt.y1} rx="8" fill="url(#feltTopGrad)" />
      <rect x={felt.x1} y={felt.y1} width={felt.x2 - felt.x1} height={felt.y2 - felt.y1} rx="8" fill="url(#spotlightGrad)" />

      {/* rail diamonds */}
      {diamondsX.map((x) => (
        <circle key={"tdx" + x} cx={x} cy={39} r="3.4" fill="#EDE0C8" opacity="0.8" />
      ))}
      {diamondsX.map((x) => (
        <circle key={"bdx" + x} cx={x} cy={861} r="3.4" fill="#EDE0C8" opacity="0.8" />
      ))}
      {diamondsY.map((y) => (
        <circle key={"ldy" + y} cx={227} cy={y} r="3.4" fill="#EDE0C8" opacity="0.8" />
      ))}
      {diamondsY.map((y) => (
        <circle key={"rdy" + y} cx={673} cy={y} r="3.4" fill="#EDE0C8" opacity="0.8" />
      ))}

      {/* 6 pockets as natural cut-in openings */}
      {pockets.map((p, i) => (
        <g key={"p" + i}>
          {/* gap in the cushion where the pocket opens */}
          <circle cx={p.x} cy={p.y} r={p.r + 6} fill="#0A2E22" />
          {/* felt lip rolling over into the hole */}
          <circle cx={p.x} cy={p.y} r={p.r + 2.5} fill="#0E3A2B" />
          <circle cx={p.x} cy={p.y} r={p.r} fill="#072418" />
          {/* the hole itself: deep, near-black throat */}
          <circle cx={p.x} cy={p.y} r={p.r * 0.82} fill="url(#pocketHoleGrad)" />
          {/* inner shadow on the far side of the throat */}
          <path
            d={`M ${p.x - p.r * 0.7} ${p.y + p.r * 0.35} A ${p.r * 0.78} ${p.r * 0.78} 0 0 0 ${p.x + p.r * 0.7} ${p.y + p.r * 0.35}`}
            stroke="#000000"
            strokeWidth="4"
            opacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
          {/* soft light catching the near lip */}
          <path
            d={`M ${p.x - p.r * 0.55} ${p.y - p.r * 0.5} A ${p.r * 0.72} ${p.r * 0.72} 0 0 1 ${p.x + p.r * 0.3} ${p.y - p.r * 0.66}`}
            stroke="#3E8A66"
            strokeWidth="2.4"
            opacity="0.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* remaining balls scattered on the felt */}
      {scatter.map((b, i) => {
        const pc = POOL_PALETTE[i % POOL_PALETTE.length];
        return (
          <g key={"sb" + i}>
            <ellipse cx={b.x + 2} cy={b.y + 4} rx={ballRadius * 0.9} ry={ballRadius * 0.45} fill="#00000022" />
            <circle
              cx={b.x}
              cy={b.y}
              r={ballRadius}
              fill={isPool ? pc.c : "url(#ballGrad)"}
              stroke="#00000033"
              strokeWidth="0.6"
            />
            <circle cx={b.x - 4} cy={b.y - 4} r="3.4" fill="#ffffff77" />
          </g>
        );
      })}

      {/* cue (no hand) */}
      <g transform={`translate(${tipX},${tipY}) rotate(${angleDeg})`}>
        <ellipse cx="-120" cy="6" rx="70" ry="6" fill="#00000028" />
        <g style={{ animation: "cueStrike 6s linear infinite" }}>
          <polygon points="0,-3 -250,-10 -250,10 0,3" fill="url(#shotCueGrad)" />
          <circle cx="-4" cy="0" r="3" fill="#3D6E8F" />
        </g>
      </g>

      {/* object ball (red for russian / yellow for pool) */}
      <circle
        cx={redStart.x}
        cy={redStart.y}
        r={ballRadius}
        fill={objectBallFill}
        stroke="#00000033"
        strokeWidth="0.6"
        style={{ animation: "redRoll 6s linear infinite" }}
      />
      {/* cue/white ball that gets potted */}
      <circle
        cx={whiteStart.x}
        cy={whiteStart.y}
        r={ballRadius}
        fill="url(#ballGrad)"
        stroke="#00000033"
        strokeWidth="0.6"
        style={{ animation: "whiteRoll 6s linear infinite" }}
      />
    </svg>
  );
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadInitial() {
  return { players: [], matches: [], activeGame: null, activeSeries: null, theme: "dark", gameType: "russian", russianMode: "free" };
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function computeStats(players, matches) {
  const byPlayer = {};
  players.forEach((p) => (byPlayer[p.id] = []));
  matches.forEach((m) => {
    m.participants.forEach((pid) => {
      if (byPlayer[pid]) byPlayer[pid].push(m);
    });
  });
  return players
    .map((p) => {
      const pMatches = (byPlayer[p.id] || [])
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      let wins = 0;
      let totalBalls = 0;
      let bestStreak = 0;
      let run = 0;
      let soloGames = 0;
      pMatches.forEach((m) => {
        totalBalls += (m.scores && m.scores[p.id]) || 0;
        if (m.solo) {
          soloGames += 1;
          return; // practice: no effect on wins/streaks
        }
        const won = m.winnerId === p.id;
        if (won) {
          wins += 1;
          run += 1;
          bestStreak = Math.max(bestStreak, run);
        } else {
          run = 0;
        }
      });
      const games = pMatches.length;
      const vsGames = games - soloGames;
      const losses = vsGames - wins;
      let currentStreak = 0;
      for (let i = pMatches.length - 1; i >= 0; i--) {
        if (pMatches[i].solo) continue;
        if (pMatches[i].winnerId === p.id) currentStreak += 1;
        else break;
      }
      return {
        id: p.id,
        name: p.name,
        games,
        wins,
        losses,
        winPct: vsGames ? Math.round((wins / vsGames) * 100) : 0,
        currentStreak,
        bestStreak,
        totalBalls,
        avgBalls: games ? totalBalls / games : 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);
}

function makeStyles(dark) {
  const T = dark
    ? {
        cardBg: "rgba(20,22,18,0.34)",
        cardBorder: "rgba(255,255,255,0.10)",
        text: "#F1EAD8",
        sub: "#B9AF98",
        inputBg: "rgba(255,255,255,0.07)",
        inputBorder: "rgba(255,255,255,0.18)",
        chipBg: "rgba(255,255,255,0.09)",
        chipBorder: "rgba(255,255,255,0.18)",
        navBg: "rgba(20,22,18,0.35)",
        navText: "#F1E9D2",
        headerBg: "rgba(10,20,15,0.22)",
        tableBorder: "rgba(255,255,255,0.18)",
        rowBorder: "rgba(255,255,255,0.08)",
        modalBg: "#1C1D18",
      }
    : {
        cardBg: "rgba(255,251,242,0.60)",
        cardBorder: "#CDBB90",
        text: COLORS.ink,
        sub: "#6E6248",
        inputBg: "rgba(251,247,238,0.92)",
        inputBorder: "#D8CBA9",
        chipBg: "rgba(239,230,204,0.92)",
        chipBorder: "#DCC98F",
        navBg: "rgba(246,240,226,0.60)",
        navText: COLORS.wood,
        headerBg: "rgba(10,20,15,0.16)",
        tableBorder: COLORS.wood,
        rowBorder: "#EEE3C8",
        modalBg: "#FFFDF8",
      };

  return {
    outerBg: { position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" },
    outerOverlay: {
      position: "absolute",
      inset: 0,
      background: "transparent",
    },
    page: {
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      color: T.text,
      paddingBottom: "calc(84px + env(safe-area-inset-bottom))",
    },
    header: {
      padding: "calc(16px + env(safe-area-inset-top)) 20px 18px",
      textAlign: "center",
      background: "radial-gradient(ellipse 70% 120% at 50% 35%, rgba(4,12,8,0.5) 0%, rgba(4,12,8,0.0) 72%)",
    },
    title: {
      fontFamily: "'Fraunces', serif",
      fontOpticalSizing: "auto",
      fontStyle: "italic",
      fontWeight: 600,
      fontSize: "32px",
      letterSpacing: "0.4px",
      color: "#F8F1DE",
      margin: 0,
      textShadow: "0 2px 10px rgba(0,0,0,0.55)",
      display: "inline-block",
    },
    gameTypeBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      marginTop: "8px",
      padding: "5px 14px",
      borderRadius: "999px",
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.25)",
      color: "#F1E9D2",
      fontSize: "11.5px",
      fontWeight: 600,
      cursor: "pointer",
    },
    bottomNav: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
      display: "flex",
      gap: "2px",
      padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
      background: T.navBg,
      backdropFilter: "blur(20px) saturate(150%)",
      WebkitBackdropFilter: "blur(20px) saturate(150%)",
      borderTop: `1px solid ${T.cardBorder}`,
    },
    bottomNavBtn: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "3px",
      padding: "7px 2px",
      borderRadius: "13px",
      border: "none",
      background: "transparent",
      color: T.sub,
      fontSize: "10.5px",
      fontWeight: 600,
      transition: "transform 0.12s ease, background 0.15s ease, color 0.15s ease",
    },
    bottomNavBtnActive: {
      color: dark ? "#F8E7B8" : COLORS.wood,
      background: dark ? "rgba(192,138,62,0.20)" : "rgba(192,138,62,0.20)",
    },
    navIcon: { fontSize: "19px", lineHeight: 1 },
    main: { padding: "0 16px", maxWidth: "560px", margin: "0 auto" },
    card: { background: T.cardBg, backdropFilter: "blur(20px) saturate(150%)", WebkitBackdropFilter: "blur(20px) saturate(150%)", border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "18px", marginBottom: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.18)" },
    h2: { fontFamily: "'Fraunces', serif", fontSize: "17px", fontWeight: 600, margin: "0 0 12px", color: dark ? "#E7CE93" : COLORS.wood, borderLeft: `3px solid ${COLORS.brass}`, paddingLeft: "10px" },
    addRow: { display: "flex", gap: "8px" },
    input: { flex: 1, padding: "10px 12px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, fontSize: "14px", background: T.inputBg, color: T.text },
    brassBtn: { padding: "10px 16px", borderRadius: "8px", border: "none", background: COLORS.brass, color: "#2C1D08", fontWeight: 700, fontSize: "13px" },
    errorText: { color: "#E08877", fontSize: "12.5px", marginTop: "8px" },
    emptyText: { color: T.sub, fontSize: "13.5px", fontStyle: "italic" },
    chipRow: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" },
    playerChip: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 6px 6px 12px", borderRadius: "999px", background: T.chipBg, border: `1px solid ${T.chipBorder}`, fontSize: "13.5px", fontWeight: 500, color: T.text },
    chipRemove: { border: "none", background: "transparent", color: T.sub, fontSize: "16px", lineHeight: 1, width: "20px", height: "20px", borderRadius: "50%" },
    hint: { fontSize: "12.5px", color: T.sub, margin: "4px 0 0" },
    selectChip: { padding: "8px 14px", borderRadius: "999px", border: `1.5px solid ${COLORS.chalk}`, background: dark ? "rgba(255,255,255,0.05)" : "#fff", color: COLORS.chalk, fontWeight: 600, fontSize: "13px" },
    selectChipActive: { background: COLORS.chalk, color: "#fff" },
    diceSection: { marginTop: "16px", paddingTop: "14px", borderTop: `1px dashed ${T.chipBorder}` },
    diceBtn: { padding: "9px 14px", borderRadius: "8px", border: `1.5px solid ${COLORS.chalk}`, background: dark ? "rgba(255,255,255,0.05)" : "#fff", color: COLORS.chalk, fontWeight: 700, fontSize: "12.5px" },
    diceRow: { display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "14px" },
    diceCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
    diceFace: { fontSize: "32px", lineHeight: 1, color: dark ? "#E7CE93" : COLORS.wood },
    diceName: { fontSize: "11px", color: T.sub, fontWeight: 500 },
    tieNote: { marginTop: "10px" },
    breakerBanner: { marginTop: "12px", padding: "10px 12px", borderRadius: "10px", background: dark ? "rgba(192,138,62,0.18)" : "#FBEFCF", border: `1px solid ${dark ? "rgba(231,206,147,0.35)" : "#E7CE93"}`, color: T.text, fontSize: "13px", textAlign: "center" },
    liveHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
    liveDot: { width: "9px", height: "9px", borderRadius: "50%", background: "#3E9B5C", boxShadow: "0 0 0 3px rgba(62,155,92,0.2)" },
    scoreboard: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" },
    scoreCard: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "12px", background: "rgba(10,32,24,0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" },
    scoreName: { color: COLORS.cream, fontWeight: 600, fontSize: "14px", flex: 1 },
    scoreValue: { fontFamily: "'Space Mono', monospace", fontSize: "22px", fontWeight: 700, color: COLORS.brass, minWidth: "38px", textAlign: "center" },
    scoreInput: {
      fontFamily: "'Space Mono', monospace",
      fontSize: "20px",
      fontWeight: 700,
      color: COLORS.brass,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid #4A6B57",
      borderRadius: "8px",
      width: "56px",
      textAlign: "center",
      padding: "6px 2px",
      MozAppearance: "textfield",
    },
    scoreBtns: { display: "flex", gap: "6px" },
    scoreBtnMinus: { width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #4A6B57", background: "transparent", color: COLORS.cream, fontSize: "16px" },
    scoreBtnPlus: { padding: "0 12px", height: "34px", borderRadius: "8px", border: "none", background: COLORS.brass, color: "#2C1D08", fontWeight: 700, fontSize: "12.5px" },
    gameActions: { display: "flex", gap: "10px", marginTop: "16px" },
    finishBtn: { flex: 1, padding: "12px", borderRadius: "10px", border: `1.5px solid ${COLORS.felt}`, background: COLORS.felt, color: COLORS.cream, fontWeight: 700, fontSize: "13px" },
    cancelBtn: { flex: 1, padding: "12px", borderRadius: "10px", border: `1.5px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontWeight: 600, fontSize: "13px" },
    winBtn: { padding: "10px 16px", borderRadius: "10px", border: `1.5px solid ${COLORS.felt}`, background: COLORS.felt, color: COLORS.cream, fontWeight: 700, fontSize: "13px" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.04em", color: T.sub, borderBottom: `2px solid ${T.tableBorder}`, padding: "6px 6px" },
    td: { padding: "9px 6px", borderBottom: `1px solid ${T.rowBorder}`, fontSize: "13px", color: T.text },
    mono: { fontFamily: "'Space Mono', monospace" },
    leaderRow: { background: dark ? "rgba(192,138,62,0.12)" : "#FBF0D6" },
    historyList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" },
    historyItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: `1px solid ${T.rowBorder}`, cursor: "pointer" },
    historyPlayers: { fontSize: "13.5px", fontWeight: 500, color: T.text },
    winnerName: { color: dark ? "#8FD3A8" : COLORS.felt, fontWeight: 700 },
    historyDate: { fontFamily: "'Space Mono', monospace", fontSize: "11px", color: T.sub, marginTop: "2px" },
    deleteBtn: { border: "none", background: "transparent", color: "#B08F5A", fontSize: "18px", padding: "4px 8px" },
    resetBtn: { display: "block", width: "100%", padding: "10px 18px", borderRadius: "8px", border: "1px solid #B5473A", background: "transparent", color: "#B5473A", fontSize: "13px", fontWeight: 600 },
    searchRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" },
    rankList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" },
    rankItem: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 4px", borderBottom: `1px solid ${T.rowBorder}` },
    rankMedal: { width: "26px", textAlign: "center", fontSize: "15px" },
    rankName: { flex: 1, fontSize: "14px", fontWeight: 600, color: T.text },
    rankScore: { fontSize: "12.5px", color: T.sub, fontFamily: "'Space Mono', monospace" },
    settingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: T.text },
    settingBtnRow: { display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" },
    switchTrack: { width: "46px", height: "26px", borderRadius: "999px", border: "none", background: "#8A7E63", position: "relative", padding: 0 },
    switchTrackOn: { background: COLORS.brass },
    switchThumb: { position: "absolute", top: "3px", left: "3px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", transition: "left 0.15s" },
    switchThumbOn: { left: "23px" },
    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 50 },
    modalCard: { background: T.modalBg, borderRadius: "16px", padding: "20px", maxWidth: "400px", width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", color: T.text },
    modalScores: { display: "flex", flexDirection: "column", gap: "6px", margin: "12px 0" },
    modalRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", padding: "6px 0", borderBottom: `1px solid ${T.rowBorder}`, color: T.text },
  };
}

export default function BilliardsTracker() {
  const [data, setData] = useState(loadInitial());
  const [loaded, setLoaded] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState("play");
  const [error, setError] = useState("");
  const [tieCandidates, setTieCandidates] = useState(null);
  const [diceRolls, setDiceRolls] = useState(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ballValue, setBallValue] = useState(5);
  const [handicaps, setHandicaps] = useState({});
  const [h2h, setH2h] = useState({ a: "", b: "" });
  const [victory, setVictory] = useState(null);
  const [seriesPick, setSeriesPick] = useState(1);
  const [scorePulse, setScorePulse] = useState({ pid: null, ts: 0 });

  useEffect(() => {
    const tg = getTG();
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#0A2B20");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#0A2B20");
    } catch (e) {
      // not critical
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData({
            players: (Array.isArray(parsed.players) ? parsed.players : []).map((p, i) => ({
              ...p,
              color: p.color || AVATAR_COLORS[i % AVATAR_COLORS.length],
            })),
            matches: Array.isArray(parsed.matches) ? parsed.matches : [],
            activeGame: parsed.activeGame || null,
            activeSeries: parsed.activeSeries || null,
            theme: parsed.theme === "light" ? "light" : "dark",
            gameType: parsed.gameType === "pool" ? "pool" : "russian",
            russianMode: RUSSIAN_MODES[parsed.russianMode] ? parsed.russianMode : "free",
          });
        }
      } catch (e) {
        // no data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    const tg = getTG();
    if (!tg) return;
    try {
      if (data.activeGame) {
        tg.enableClosingConfirmation && tg.enableClosingConfirmation();
      } else {
        tg.disableClosingConfirmation && tg.disableClosingConfirmation();
      }
    } catch (e) {
      // not critical
    }
  }, [data.activeGame]);

  useEffect(() => {
    const tg = getTG();
    if (!tg || !tg.BackButton) return;
    const handler = () => setSelectedMatchId(null);
    try {
      if (selectedMatchId) {
        tg.BackButton.show();
        tg.BackButton.onClick(handler);
      } else {
        tg.BackButton.hide();
      }
    } catch (e) {
      // not critical
    }
    return () => {
      try {
        tg.BackButton.offClick(handler);
      } catch (e) {
        // not critical
      }
    };
  }, [selectedMatchId]);

  const persist = useCallback(async (next) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  const updateData = useCallback(
    (updater) => {
      setData((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (data.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError("Такой игрок уже есть");
      return;
    }
    setError("");
    updateData((prev) => ({
      ...prev,
      players: [...prev.players, { id: uid(), name, color: AVATAR_COLORS[prev.players.length % AVATAR_COLORS.length] }],
    }));
    setNameInput("");
  };

  const removePlayer = (id) => {
    updateData((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
    setSelected((s) => s.filter((x) => x !== id));
  };

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setDiceRolls(null);
    setHandicaps({});
    haptic("light");
  };

  const selectAllPlayers = () => {
    setSelected(data.players.map((p) => p.id));
    setDiceRolls(null);
    haptic("light");
  };

  const rollDiceFor = (ids) => {
    if (!ids || ids.length < 2) return;
    haptic("medium");
    setDiceRolling(true);
    let count = 0;
    const totalTicks = 9;
    const timer = setInterval(() => {
      const next = {};
      ids.forEach((id) => {
        next[id] = 1 + Math.floor(Math.random() * 6);
      });
      setDiceRolls(next);
      count += 1;
      if (count >= totalTicks) {
        clearInterval(timer);
        setDiceRolling(false);
      }
    }, 90);
  };

  const breakerInfo = useMemo(() => {
    if (!diceRolls) return { breakerId: null, tie: false, leaders: [] };
    const ids = selected.filter((id) => diceRolls[id] !== undefined);
    if (ids.length < 2) return { breakerId: null, tie: false, leaders: [] };
    const max = Math.max(...ids.map((id) => diceRolls[id]));
    const leaders = ids.filter((id) => diceRolls[id] === max);
    return leaders.length === 1
      ? { breakerId: leaders[0], tie: false, leaders }
      : { breakerId: null, tie: true, leaders };
  }, [diceRolls, selected]);

  const buildTargets = (mode, ids) => {
    const gm = mode ? RUSSIAN_MODES[mode] : null;
    if (!gm) return null;
    const t = {};
    ids.forEach((id) => {
      t[id] = handicaps[id] || gm.target;
    });
    return t;
  };

  const startGame = () => {
    if (selected.length < 1) return;
    haptic("medium");
    const scores = {};
    selected.forEach((id) => (scores[id] = 0));
    const breakerId = breakerInfo.breakerId || null;
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      let activeSeries = prev.activeSeries;
      if (!activeSeries && seriesPick > 1 && selected.length >= 2) {
        activeSeries = {
          id: uid(),
          targetWins: seriesPick,
          bestOf: seriesPick * 2 - 1,
          participants: [...selected],
          wins: {},
        };
      }
      return {
        ...prev,
        activeSeries,
        activeGame: {
          id: uid(),
          participants: [...selected],
          scores,
          breakerId,
          gameType: prev.gameType || "russian",
          mode,
          targets: buildTargets(mode, selected),
          actionLog: [],
          startedAt: new Date().toISOString(),
        },
      };
    });
    setDiceRolls(null);
    setHandicaps({});
  };

  const startRematch = (participants) => {
    haptic("medium");
    const scores = {};
    participants.forEach((id) => (scores[id] = 0));
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      const gm = mode ? RUSSIAN_MODES[mode] : null;
      const targets = gm ? Object.fromEntries(participants.map((id) => [id, gm.target])) : null;
      return {
        ...prev,
        activeGame: {
          id: uid(),
          participants: [...participants],
          scores,
          breakerId: null,
          gameType: prev.gameType || "russian",
          mode,
          targets,
          actionLog: [],
          startedAt: new Date().toISOString(),
        },
      };
    });
    setVictory(null);
    setTab("play");
  };

  const cancelSeries = () => {
    if (!window.confirm("Завершить матч досрочно?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeSeries: null }));
    setSeriesPick(1);
  };

  const addPoint = (playerId, delta) => {
    haptic("light");
    setScorePulse({ pid: playerId, ts: Date.now() });
    updateData((prev) => {
      if (!prev.activeGame) return prev;
      const before = prev.activeGame.scores[playerId] || 0;
      const after = Math.max(0, before + delta);
      const scores = { ...prev.activeGame.scores, [playerId]: after };
      const actionLog = [...(prev.activeGame.actionLog || []), { pid: playerId, prev: before }].slice(-5);
      return { ...prev, activeGame: { ...prev.activeGame, scores, actionLog } };
    });
  };

  const setScore = (playerId, value) => {
    const n = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
    updateData((prev) => {
      if (!prev.activeGame) return prev;
      const before = prev.activeGame.scores[playerId] || 0;
      if (before === n) return prev;
      const scores = { ...prev.activeGame.scores, [playerId]: n };
      const actionLog = [...(prev.activeGame.actionLog || []), { pid: playerId, prev: before }].slice(-5);
      return { ...prev, activeGame: { ...prev.activeGame, scores, actionLog } };
    });
  };

  const undoLast = () => {
    haptic("light");
    updateData((prev) => {
      const g = prev.activeGame;
      if (!g || !g.actionLog || g.actionLog.length === 0) return prev;
      const last = g.actionLog[g.actionLog.length - 1];
      const scores = { ...g.scores, [last.pid]: last.prev };
      return { ...prev, activeGame: { ...g, scores, actionLog: g.actionLog.slice(0, -1) } };
    });
  };

  const cancelGame = () => {
    if (!window.confirm("Отменить текущую партию без сохранения?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeGame: null }));
    setTieCandidates(null);
    setSelected([]);
    setDiceRolls(null);
  };

  const finalizeGame = (winnerId) => {
    const g = data.activeGame;
    if (!g) return;
    const durationMs = g.startedAt ? Date.now() - new Date(g.startedAt).getTime() : 0;
    const solo = g.participants.length === 1;

    // Best-of-N series update
    let nextSeries = data.activeSeries;
    let seriesInfo = null;
    const s = data.activeSeries;
    const sameSet =
      s &&
      !solo &&
      s.participants.length === g.participants.length &&
      s.participants.every((id) => g.participants.includes(id));
    if (sameSet) {
      const wins = { ...s.wins, [winnerId]: (s.wins[winnerId] || 0) + 1 };
      const champion = wins[winnerId] >= s.targetWins ? winnerId : null;
      seriesInfo = { wins, targetWins: s.targetWins, bestOf: s.bestOf, participants: s.participants, champion };
      nextSeries = champion ? null : { ...s, wins };
    }

    const settlement = g.mode === "kolhoz" && !solo ? buildKolhozSettlement(g.participants, g.scores) : null;

    const match = {
      id: uid(),
      date: new Date().toISOString(),
      participants: g.participants,
      scores: g.scores,
      winnerId,
      breakerId: g.breakerId || null,
      durationMs,
      gameType: g.gameType || "russian",
      mode: g.mode || null,
      solo,
      seriesId: sameSet ? s.id : null,
      settlement,
    };
    updateData((prev) => ({ ...prev, matches: [...prev.matches, match], activeGame: null, activeSeries: nextSeries }));
    setTieCandidates(null);
    setSelected([]);
    setDiceRolls(null);
    if (seriesInfo && seriesInfo.champion) setSeriesPick(1);
    setVictory({
      winnerId,
      participants: g.participants,
      scores: g.scores,
      durationMs,
      solo,
      mode: g.mode || null,
      gameType: g.gameType || "russian",
      series: seriesInfo,
      settlement,
    });
    haptic("success");
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1700);
  };

  const closeVictory = () => {
    setVictory(null);
    setTab("rating");
  };

  const shareVictory = async () => {
    if (!victory) return;
    const names = victory.participants.map((pid) => `${nameById(pid)} ${victory.scores[pid] || 0}`).join(" : ");
    const gm = victory.mode ? RUSSIAN_MODES[victory.mode] : null;
    const lines = [
      "🎱 Твой бильярд",
      victory.solo
        ? `Тренировка: ${nameById(victory.participants[0])} — ${victory.scores[victory.participants[0]] || 0} шаров`
        : `🏆 Победа: ${nameById(victory.winnerId)}`,
      !victory.solo ? `Счёт: ${names}` : "",
      gm ? `Режим: ${gm.name} (${gm.alias})` : GAME_TYPES[victory.gameType].label,
      victory.durationMs ? `Время: ${formatDuration(victory.durationMs)}` : "",
      victory.series
        ? `Матч (Best of ${victory.series.bestOf}): ${victory.series.participants
            .map((pid) => `${nameById(pid)} ${victory.series.wins[pid] || 0}`)
            .join(" : ")}${victory.series.champion ? " — победа в матче!" : ""}`
        : "",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Результат скопирован — вставьте в чат!");
    } catch (e) {
      window.alert(text);
    }
  };

  const attemptFinish = () => {
    const g = data.activeGame;
    if (!g) return;
    const max = Math.max(...g.participants.map((id) => g.scores[id] || 0));
    const leaders = g.participants.filter((id) => (g.scores[id] || 0) === max);
    if (leaders.length === 1) {
      finalizeGame(leaders[0]);
    } else {
      setTieCandidates(leaders);
    }
  };

  const deleteMatch = (id) => {
    haptic("light");
    updateData((prev) => {
      const removed = prev.matches.find((m) => m.id === id);
      let activeSeries = prev.activeSeries;
      if (removed && removed.seriesId && activeSeries && activeSeries.id === removed.seriesId) {
        const wins = { ...activeSeries.wins };
        wins[removed.winnerId] = Math.max(0, (wins[removed.winnerId] || 0) - 1);
        activeSeries = { ...activeSeries, wins };
      }
      return {
        ...prev,
        matches: prev.matches.filter((m) => m.id !== id),
        activeSeries,
      };
    });
    setSelectedMatchId((cur) => (cur === id ? null : cur));
  };

  const clearAll = () => {
    if (!window.confirm("Удалить всех игроков и всю историю партий?")) return;
    haptic("warning");
    updateData((prev) => ({ players: [], matches: [], activeGame: null, activeSeries: null, theme: prev.theme, gameType: prev.gameType, russianMode: prev.russianMode }));
    setSelected([]);
    setTieCandidates(null);
    setDiceRolls(null);
  };

  const toggleTheme = () => {
    haptic("light");
    updateData((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }));
  };

  const setGameType = (type) => {
    haptic("light");
    updateData((prev) => ({ ...prev, gameType: type }));
  };

  const setRussianMode = (mode) => {
    haptic("light");
    updateData((prev) => ({ ...prev, russianMode: mode }));
  };

  const stats = useMemo(() => computeStats(data.players, data.matches), [data.players, data.matches]);

  const nameById = useCallback(
    (id) => data.players.find((p) => p.id === id)?.name || "?",
    [data.players]
  );

  const sortedHistory = useMemo(
    () => [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [data.matches]
  );

  const filteredHistory = useMemo(() => {
    if (!dateFilter) return sortedHistory;
    return sortedHistory.filter((m) => new Date(m.date).toISOString().slice(0, 10) === dateFilter);
  }, [sortedHistory, dateFilter]);

  const chartData = useMemo(
    () => stats.map((s) => ({ name: s.name, Победы: s.wins, Поражения: s.losses, "% побед": s.winPct })),
    [stats]
  );

  const streakLeaders = useMemo(
    () => [...stats].filter((s) => s.bestStreak > 0).sort((a, b) => b.bestStreak - a.bestStreak).slice(0, 5),
    [stats]
  );

  const playerColor = useCallback(
    (id) => {
      const idx = data.players.findIndex((p) => p.id === id);
      if (idx < 0) return AVATAR_COLORS[0];
      return data.players[idx].color || AVATAR_COLORS[idx % AVATAR_COLORS.length];
    },
    [data.players]
  );

  const records = useMemo(() => {
    const vs = data.matches.filter((m) => !m.solo);
    const withDur = vs.filter((m) => m.durationMs > 0);
    const fastest = withDur.reduce((a, m) => (!a || m.durationMs < a.durationMs ? m : a), null);
    const longest = withDur.reduce((a, m) => (!a || m.durationMs > a.durationMs ? m : a), null);
    let blow = null;
    let blowMargin = -1;
    vs.forEach((m) => {
      const ws = (m.scores && m.scores[m.winnerId]) || 0;
      const opp = Math.max(0, ...m.participants.filter((p) => p !== m.winnerId).map((p) => (m.scores && m.scores[p]) || 0));
      const margin = ws - opp;
      if (margin > blowMargin) {
        blowMargin = margin;
        blow = m;
      }
    });
    return { fastest, longest, blow, blowMargin };
  }, [data.matches]);

  const achievements = useMemo(() => {
    const map = {};
    stats.forEach((s) => {
      const list = [];
      if (s.wins >= 1) list.push(["🥇", "Первая победа"]);
      if (s.bestStreak >= 5) list.push(["🔥", "5 побед подряд"]);
      if (s.bestStreak >= 10) list.push(["⚡", "10 побед подряд"]);
      if (s.totalBalls >= 50) list.push(["🎱", "50 шаров"]);
      if (s.totalBalls >= 100) list.push(["💯", "100 шаров"]);
      if (s.totalBalls >= 500) list.push(["🏵️", "500 шаров"]);
      map[s.id] = list;
    });
    data.matches
      .filter((m) => !m.solo)
      .forEach((m) => {
        const ws = (m.scores && m.scores[m.winnerId]) || 0;
        const oppMax = Math.max(
          0,
          ...m.participants.filter((p) => p !== m.winnerId).map((p) => (m.scores && m.scores[p]) || 0)
        );
        if (oppMax === 0 && ws > 0 && map[m.winnerId] && !map[m.winnerId].some((b) => b[1] === "Сухая победа")) {
          map[m.winnerId].push(["🧊", "Сухая победа"]);
        }
        if (m.durationMs >= 3600000) {
          m.participants.forEach((p) => {
            if (map[p] && !map[p].some((b) => b[1] === "Марафон 60+ мин")) map[p].push(["🕰️", "Марафон 60+ мин"]);
          });
        }
        if (m.durationMs > 0 && m.durationMs <= 300000 && map[m.winnerId] && !map[m.winnerId].some((b) => b[1] === "Блиц-победа")) {
          map[m.winnerId].push(["🚀", "Блиц-победа"]);
        }
      });
    return map;
  }, [stats, data.matches]);

  const h2hStats = useMemo(() => {
    const { a, b } = h2h;
    if (!a || !b || a === b) return null;
    const ms = data.matches.filter((m) => !m.solo && m.participants.length === 2 && m.participants.includes(a) && m.participants.includes(b));
    let wa = 0;
    let wb = 0;
    let ba = 0;
    let bb = 0;
    ms.forEach((m) => {
      if (m.winnerId === a) wa += 1;
      else if (m.winnerId === b) wb += 1;
      ba += (m.scores && m.scores[a]) || 0;
      bb += (m.scores && m.scores[b]) || 0;
    });
    return { games: ms.length, wa, wb, ba, bb };
  }, [h2h, data.matches]);

  const selectedMatch = useMemo(
    () => data.matches.find((m) => m.id === selectedMatchId) || null,
    [data.matches, selectedMatchId]
  );

  const exportExcel = () => {
    const rows = sortedHistory.map((m) => ({
      Дата: new Date(m.date).toLocaleDateString("ru-RU"),
      Время: new Date(m.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      Игроки: m.participants.map(nameById).join(", "),
      Счёт: m.participants.map((pid) => `${nameById(pid)}: ${(m.scores && m.scores[pid]) || 0}`).join(" | "),
      Победитель: nameById(m.winnerId),
      Начинал: m.breakerId ? nameById(m.breakerId) : "",
      "Длительность, мин": m.durationMs ? Math.round(m.durationMs / 60000) : "",
    }));
    const statRows = stats.map((s) => ({
      Игрок: s.name,
      Игр: s.games,
      Побед: s.wins,
      Поражений: s.losses,
      "% побед": s.winPct,
      "Текущая серия": s.currentStreak,
      "Лучшая серия": s.bestStreak,
      "Шаров всего": s.totalBalls,
      "Шаров за игру": Math.round(s.avgBalls * 10) / 10,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "История");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statRows), "Статистика");
    XLSX.writeFile(wb, `billiards-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billiards-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackup = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!window.confirm("Заменить текущие данные резервной копией?")) return;
        const next = {
          players: (Array.isArray(parsed.players) ? parsed.players : []).map((p, i) => ({
            ...p,
            color: p.color || AVATAR_COLORS[i % AVATAR_COLORS.length],
          })),
          matches: Array.isArray(parsed.matches) ? parsed.matches : [],
          activeGame: parsed.activeGame || null,
          activeSeries: parsed.activeSeries || null,
          theme: parsed.theme === "light" ? "light" : "dark",
          gameType: parsed.gameType === "pool" ? "pool" : "russian",
          russianMode: RUSSIAN_MODES[parsed.russianMode] ? parsed.russianMode : "free",
        };
        updateData(next);
      } catch (err) {
        window.alert("Не удалось прочитать файл резервной копии");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.felt, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <span style={{ color: COLORS.cream, fontFamily: "Inter, sans-serif" }}>Загрузка стола…</span>
      </div>
    );
  }

  const activeGame = data.activeGame;
  const dark = data.theme === "dark";
  const styles = makeStyles(dark);
  const isKolhoz = (data.gameType || "russian") === "russian" && (data.russianMode || "free") === "kolhoz";

  return (
    <div>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.brass}; outline-offset: 2px; }
        input { font-family: inherit; }
        ::selection { background: ${COLORS.brass}; color: ${COLORS.ink}; }
        button:disabled { opacity: 0.4; cursor: not-allowed; }
        button:active { transform: scale(0.96); }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        html, body { overscroll-behavior-y: none; }
        @keyframes diceShake {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-18deg) scale(1.12); }
          50% { transform: rotate(14deg) scale(0.94); }
          75% { transform: rotate(-10deg) scale(1.06); }
          100% { transform: rotate(0deg) scale(1); }
        }
        /* Timeline (6s, linear — keyframe spacing defines velocity):
           46-54% slow backswing, 56-58% fast strike, 58% cue contacts red,
           58-70% red rolls & decelerates, 70% stun-shot contact (red stops,
           white departs instantly), 70-84% white decelerates to the pocket,
           84-89% gravity drop into the hole. */
        @keyframes cueStrike {
          0%, 46% { transform: translateX(0); }
          54% { transform: translateX(-26px); }
          56% { transform: translateX(-26px); }
          58% { transform: translateX(3px); }
          60% { transform: translateX(-10px); }
          66%, 100% { transform: translateX(0); }
        }
        @keyframes redRoll {
          0% { transform: translate(0px, 0px); opacity: 0; }
          4% { opacity: 1; }
          58% { transform: translate(0px, 0px); opacity: 1; }
          61% { transform: translate(51px, -27px); }
          64% { transform: translate(93px, -49px); }
          67% { transform: translate(125px, -66px); }
          70% { transform: translate(147px, -78px); }
          94% { transform: translate(147px, -78px); opacity: 1; }
          99%, 100% { transform: translate(147px, -78px); opacity: 0; }
        }
        @keyframes whiteRoll {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0; }
          4% { opacity: 1; }
          70% { transform: translate(0px, 0px) scale(1); opacity: 1; }
          73% { transform: translate(47px, -22px) scale(1); }
          77% { transform: translate(84px, -39px) scale(1); }
          81% { transform: translate(111px, -52px) scale(1); }
          84% { transform: translate(123px, -58px) scale(1); opacity: 1; }
          87% { transform: translate(123px, -55px) scale(0.45); opacity: 1; }
          89%, 100% { transform: translate(123px, -55px) scale(0.05); opacity: 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(112vh) rotate(340deg); opacity: 0; }
        }
        @keyframes iconPop {
          0% { transform: translateY(2px) rotate(-14deg) scale(0.85); }
          55% { transform: translateY(-2px) rotate(6deg) scale(1.12); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes scorePop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .tab-fade { animation: fadeIn 0.22s ease; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={styles.outerBg}>
        <TableArt gameType={data.gameType} />
        <div style={styles.outerOverlay} />
      </div>

      <div style={styles.page}>
        <header style={styles.header} className="no-print">
          <h1 style={styles.title}>
            Твой бильярд
            <CueExclamation height={30} />
          </h1>
          <button
            style={styles.gameTypeBadge}
            onClick={() => setGameType((data.gameType || "russian") === "pool" ? "russian" : "pool")}
            aria-label="Переключить дисциплину"
          >
            <GameIcon type={data.gameType || "russian"} /> {GAME_TYPES[data.gameType || "russian"].label}
          </button>
        </header>

        <main style={styles.main} key={tab} className="tab-fade">
          {tab === "play" && (
            <section>
              {!activeGame && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Игроки</h2>
                  <div style={styles.addRow}>
                    <input
                      style={styles.input}
                      placeholder="Имя игрока"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    />
                    <button style={styles.brassBtn} onClick={addPlayer}>
                      Добавить
                    </button>
                  </div>
                  {error && <div style={styles.errorText}>{error}</div>}
                  {data.players.length === 0 ? (
                    <p style={styles.emptyText}>Пока никого нет. Добавьте хотя бы двоих — игроков может быть сколько угодно.</p>
                  ) : (
                    <div style={styles.chipRow}>
                      {data.players.map((p) => (
                        <span key={p.id} style={styles.playerChip}>
                          <PlayerBall color={playerColor(p.id)} size={12} /> {p.name}
                          <button onClick={() => removePlayer(p.id)} style={styles.chipRemove} aria-label={`Удалить ${p.name}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!activeGame && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Начать партию</h2>
                  {(data.gameType || "russian") === "russian" && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <p style={styles.hint}>Дисциплина</p>
                        <button style={styles.diceBtn} onClick={() => setRulesOpen(true)}>
                          📖 Правила
                        </button>
                      </div>
                      <div style={styles.chipRow}>
                        {Object.entries(RUSSIAN_MODES).map(([key, m]) => (
                          <button
                            key={key}
                            onClick={() => setRussianMode(key)}
                            style={{
                              ...styles.selectChip,
                              ...((data.russianMode || "free") === key ? styles.selectChipActive : {}),
                            }}
                          >
                            {m.alias}
                          </button>
                        ))}
                      </div>
                      <p style={styles.hint}>
                        {RUSSIAN_MODES[data.russianMode || "free"].target
                          ? `${RUSSIAN_MODES[data.russianMode || "free"].name} · до ${
                              RUSSIAN_MODES[data.russianMode || "free"].target
                            } ${RUSSIAN_MODES[data.russianMode || "free"].unit}`
                          : `${RUSSIAN_MODES[data.russianMode || "free"].name} · играют все против всех, круговой расчёт очков в конце`}
                      </p>
                      {isKolhoz && selected.length > 0 && selected.length < 3 && (
                        <p style={{ ...styles.hint, color: COLORS.danger }}>Нужно минимум 3 игрока</p>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <p style={styles.hint}>Отметьте, кто играет</p>
                    {data.players.length >= 2 && (
                      <button style={styles.diceBtn} onClick={selectAllPlayers}>
                        Выбрать всех
                      </button>
                    )}
                  </div>
                  <div style={styles.chipRow}>
                    {data.players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        style={{
                          ...styles.selectChip,
                          ...(selected.includes(p.id) ? styles.selectChipActive : {}),
                        }}
                      >
                        <PlayerBall color={playerColor(p.id)} size={12} /> {p.name}
                      </button>
                    ))}
                  </div>

                  {selected.length >= 2 && (
                    <div style={styles.diceSection}>
                      <p style={styles.hint}>Кто разбивает первым?</p>
                      <button style={styles.diceBtn} onClick={() => rollDiceFor(selected)} disabled={diceRolling}>
                        🎲 Кинуть кубики
                      </button>

                      {diceRolls && (
                        <div style={styles.diceRow}>
                          {selected.map((id) => (
                            <div key={id} style={styles.diceCard}>
                              <div
                                style={{
                                  animation: diceRolling ? "diceShake 0.25s infinite" : "none",
                                }}
                              >
                                <Die value={diceRolls[id] || 1} size={44} />
                              </div>
                              <span style={styles.diceName}>{nameById(id)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!diceRolling && breakerInfo.tie && (
                        <div style={styles.tieNote}>
                          <p style={styles.hint}>
                            Ничья: {breakerInfo.leaders.map((id) => nameById(id)).join(", ")} — нужен переброс
                          </p>
                          <button style={styles.diceBtn} onClick={() => rollDiceFor(breakerInfo.leaders)}>
                            Переброс
                          </button>
                        </div>
                      )}

                      {!diceRolling && breakerInfo.breakerId && (
                        <div style={styles.breakerBanner}>
                          🎯 Первым разбивает: <strong>{nameById(breakerInfo.breakerId)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {data.activeSeries && (
                    <div style={{ ...styles.breakerBanner, textAlign: "left" }}>
                      🏟️ Матч до {data.activeSeries.targetWins} побед (Best of {data.activeSeries.bestOf})
                      <div style={{ marginTop: "4px", fontWeight: 700 }}>
                        {data.activeSeries.participants
                          .map((pid) => `${nameById(pid)} ${data.activeSeries.wins[pid] || 0}`)
                          .join(" : ")}
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button style={{ ...styles.brassBtn, flex: 1 }} onClick={() => startRematch(data.activeSeries.participants)}>
                          Продолжить матч
                        </button>
                        <button style={{ ...styles.diceBtn, flex: 1 }} onClick={cancelSeries}>
                          Завершить матч
                        </button>
                      </div>
                    </div>
                  )}

                  {!isKolhoz && !data.activeSeries && selected.length >= 2 && (
                    <div style={styles.diceSection}>
                      <p style={styles.hint}>Формат</p>
                      <div style={styles.chipRow}>
                        {[
                          [1, "Одна партия"],
                          [2, "Best of 3"],
                          [3, "Best of 5"],
                          [4, "Best of 7"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => {
                              haptic("light");
                              setSeriesPick(val);
                            }}
                            style={{
                              ...styles.selectChip,
                              ...(seriesPick === val ? styles.selectChipActive : {}),
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isKolhoz &&
                    (data.gameType || "russian") === "russian" &&
                    selected.length >= 2 &&
                    RUSSIAN_MODES[data.russianMode || "free"] && (
                      <div style={styles.diceSection}>
                        <p style={styles.hint}>
                          Фора: личная цель каждого (по умолчанию {RUSSIAN_MODES[data.russianMode || "free"].target})
                        </p>
                        {selected.map((pid) => {
                          const base = RUSSIAN_MODES[data.russianMode || "free"].target;
                          const cur = handicaps[pid] || base;
                          return (
                            <div key={pid} style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                              <span style={{ flex: 1, fontSize: "13px" }}>
                                <PlayerBall color={playerColor(pid)} /> {nameById(pid)}
                              </span>
                              <button
                                style={styles.scoreBtnMinus}
                                disabled={cur <= 1}
                                onClick={() => setHandicaps((h) => ({ ...h, [pid]: Math.max(1, cur - 1) }))}
                              >
                                −
                              </button>
                              <span style={{ ...styles.mono, minWidth: "24px", textAlign: "center", fontWeight: 700 }}>{cur}</span>
                              <button
                                style={styles.scoreBtnMinus}
                                disabled={cur >= base}
                                onClick={() => setHandicaps((h) => ({ ...h, [pid]: Math.min(base, cur + 1) }))}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  <button
                    style={{ ...styles.brassBtn, marginTop: "16px", width: "100%" }}
                    disabled={selected.length < 1 || (isKolhoz && selected.length < 3)}
                    onClick={startGame}
                  >
                    {selected.length === 1 ? "Начать тренировку (соло)" : "Начать партию"}
                  </button>
                  {selected.length === 1 && (
                    <p style={styles.hint}>Режим тренировки: играете один, шары идут в вашу статистику</p>
                  )}
                </div>
              )}

              {activeGame && !tieCandidates && (() => {
                const gm = activeGame.mode ? RUSSIAN_MODES[activeGame.mode] : null;
                const isPoints = gm && gm.unit === "очков";
                const targetOf = (pid) => (activeGame.targets && activeGame.targets[pid]) || (gm ? gm.target : 0);
                const reachedId =
                  gm && gm.target
                    ? activeGame.participants.find((pid) => (activeGame.scores[pid] || 0) >= targetOf(pid))
                    : null;
                return (
                <div style={styles.card}>
                  <div style={styles.liveHeader}>
                    <span style={styles.liveDot} />
                    <h2 style={{ ...styles.h2, margin: 0 }}>Партия идёт</h2>
                  </div>
                  {gm && (
                    <p style={styles.hint}>
                      {gm.name} ({gm.alias})
                      {gm.target ? ` · до ${gm.target} ${gm.unit}` : " · круговой расчёт, завершите вручную, когда закончите"}
                    </p>
                  )}
                  {activeGame.breakerId && (
                    <div style={styles.breakerBanner}>
                      🎯 Первым разбивал: <strong>{nameById(activeGame.breakerId)}</strong>
                    </div>
                  )}
                  {reachedId && (
                    <div style={{ ...styles.breakerBanner, borderColor: "#3E9B5C" }}>
                      🏆 <strong>{nameById(reachedId)}</strong> достиг цели ({targetOf(reachedId)} {gm.unit})!{" "}
                      <button
                        style={{ ...styles.brassBtn, marginTop: "8px", width: "100%" }}
                        onClick={() => finalizeGame(reachedId)}
                      >
                        Засчитать победу
                      </button>
                    </div>
                  )}
                  <p style={styles.hint}>
                    {isPoints ? "Отмечайте набранные очки каждого игрока" : "Отмечайте забитые шары каждого игрока"}
                  </p>
                  {isPoints && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={styles.hint}>Номинал забитого шара (очки = номер шара):</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              haptic("light");
                              setBallValue(v);
                            }}
                            style={{
                              ...styles.selectChip,
                              padding: "5px 9px",
                              fontSize: "12px",
                              ...(ballValue === v ? styles.selectChipActive : {}),
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={styles.scoreboard}>
                    {activeGame.participants.map((pid) => (
                      <div key={pid} style={{ ...styles.scoreCard, borderLeft: `4px solid ${playerColor(pid)}` }}>
                        <div style={styles.scoreName}>
                          <PlayerBall color={playerColor(pid)} /> {nameById(pid)}
                          {gm && targetOf(pid) ? (
                            <span style={{ opacity: 0.6, fontSize: "11px", fontWeight: 500 }}> · до {targetOf(pid)}</span>
                          ) : null}
                        </div>
                        <span
                          key={scorePulse.pid === pid ? scorePulse.ts : "s"}
                          style={{
                            display: "inline-block",
                            animation: scorePulse.pid === pid ? "scorePop 0.32s ease" : "none",
                          }}
                        >
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={activeGame.scores[pid] || 0}
                            onChange={(e) => setScore(pid, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            style={styles.scoreInput}
                            aria-label={`Счёт: ${nameById(pid)}`}
                          />
                        </span>
                        <div style={styles.scoreBtns}>
                          <button
                            style={styles.scoreBtnMinus}
                            onClick={() => addPoint(pid, -1)}
                            disabled={(activeGame.scores[pid] || 0) <= 0}
                            aria-label={`Убрать у ${nameById(pid)}`}
                          >
                            −
                          </button>
                          <button
                            style={styles.scoreBtnPlus}
                            onClick={() => addPoint(pid, isPoints ? ballValue : 1)}
                            aria-label={`Добавить: ${nameById(pid)}`}
                          >
                            {isPoints ? `+ ${ballValue}` : "+ шар"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{ ...styles.diceBtn, marginTop: "12px", width: "100%" }}
                    disabled={!activeGame.actionLog || activeGame.actionLog.length === 0}
                    onClick={undoLast}
                  >
                    ↶ Отменить последнее действие
                  </button>
                  <div style={styles.gameActions}>
                    <button style={styles.finishBtn} onClick={attemptFinish}>
                      Завершить партию
                    </button>
                    <button style={styles.cancelBtn} onClick={cancelGame}>
                      Отменить партию
                    </button>
                  </div>
                </div>
                );
              })()}

              {activeGame && tieCandidates && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Ничья по шарам</h2>
                  <p style={styles.hint}>Счёт равный — выберите победителя партии вручную</p>
                  <div style={styles.chipRow}>
                    {tieCandidates.map((id) => (
                      <button key={id} style={styles.winBtn} onClick={() => finalizeGame(id)}>
                        🎱 {nameById(id)} ({activeGame.scores[id] || 0})
                      </button>
                    ))}
                  </div>
                  <button style={{ ...styles.cancelBtn, marginTop: "12px" }} onClick={() => setTieCandidates(null)}>
                    Назад к партии
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "rating" && (
            <section>
              <div style={styles.card}>
                <h2 style={styles.h2}>График результатов</h2>
                {stats.length === 0 ? (
                  <EmptyState text="Сыгранных партий пока нет" />
                ) : (
                  <div style={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 14, right: 6, left: -22, bottom: 0 }} barGap={4}>
                        <CartesianGrid vertical={false} stroke={dark ? "#ffffff14" : "#00000012"} />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: styles.hint.color, fontWeight: 600 }}
                        />
                        <YAxis
                          yAxisId="left"
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: styles.hint.color }}
                        />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
                        <Tooltip
                          content={<ChartTooltip dark={dark} />}
                          cursor={{ fill: dark ? "#ffffff0a" : "#00000008" }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: "11px", fontWeight: 600, color: styles.hint.color }}
                        />
                        <Bar yAxisId="left" dataKey="Победы" fill="#2E8A63" radius={[5, 5, 0, 0]} maxBarSize={26}>
                          <LabelList
                            dataKey="Победы"
                            position="top"
                            style={{ fontSize: 10, fontWeight: 700, fill: styles.hint.color }}
                          />
                        </Bar>
                        <Bar
                          yAxisId="left"
                          dataKey="Поражения"
                          fill="#B5473A"
                          fillOpacity={0.72}
                          radius={[5, 5, 0, 0]}
                          maxBarSize={26}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="% побед"
                          stroke="#C08A3E"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: "#C08A3E", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Рейтинг игроков</h2>
                {stats.length === 0 ? (
                  <EmptyState text="Пока нет данных — сыграйте первую партию" />
                ) : (
                  <ol style={styles.rankList}>
                    {stats.map((s, i) => (
                      <li key={s.id} style={styles.rankItem}>
                        <span style={styles.rankMedal}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                        <span style={styles.rankName}>
                          <PlayerBall color={playerColor(s.id)} /> {s.name}
                        </span>
                        <span style={styles.rankScore}>{s.wins} побед · {s.winPct}%</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Лучшие серии побед</h2>
                {streakLeaders.length === 0 ? (
                  <EmptyState text="Серий побед пока не было" />
                ) : (
                  <ol style={styles.rankList}>
                    {streakLeaders.map((s, i) => (
                      <li key={s.id} style={styles.rankItem}>
                        <span style={styles.rankMedal}>{i + 1}.</span>
                        <span style={styles.rankName}>
                          <PlayerBall color={playerColor(s.id)} /> {s.name}
                        </span>
                        <span style={styles.rankScore}>{s.bestStreak} побед подряд</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Рекорды</h2>
                {!records.fastest && !records.longest && !records.blow ? (
                  <p style={styles.emptyText}>Сыграйте пару партий вдвоём — рекорды появятся здесь.</p>
                ) : (
                  <div>
                    {records.fastest && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        ⚡ Самая быстрая победа: <strong>{nameById(records.fastest.winnerId)}</strong> —{" "}
                        {formatDuration(records.fastest.durationMs)}
                      </p>
                    )}
                    {records.longest && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        🕰️ Самая долгая партия: {formatDuration(records.longest.durationMs)} (
                        {records.longest.participants.map(nameById).join(" и ")})
                      </p>
                    )}
                    {records.blow && records.blowMargin > 0 && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        💥 Самый крупный разгром: <strong>{nameById(records.blow.winnerId)}</strong> —{" "}
                        {records.blow.participants
                          .map((pid) => (records.blow.scores && records.blow.scores[pid]) || 0)
                          .sort((a, b) => b - a)
                          .join(":")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Достижения</h2>
                {stats.filter((s) => (achievements[s.id] || []).length > 0).length === 0 ? (
                  <EmptyState text="Играйте — значки будут копиться автоматически" />
                ) : (
                  stats
                    .filter((s) => (achievements[s.id] || []).length > 0)
                    .map((s) => (
                      <div key={s.id} style={{ marginBottom: "10px" }}>
                        <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: "13.5px" }}>
                          <PlayerBall color={playerColor(s.id)} /> {s.name}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {achievements[s.id].map(([icon, label]) => (
                            <span key={label} style={{ ...styles.playerChip, padding: "4px 10px", fontSize: "12px" }}>
                              {icon} {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Личные встречи</h2>
                {data.players.length < 2 ? (
                  <p style={styles.emptyText}>Нужно минимум два игрока.</p>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        value={h2h.a}
                        onChange={(e) => setH2h((v) => ({ ...v, a: e.target.value }))}
                        style={{ ...styles.input, flex: 1 }}
                      >
                        <option value="">Игрок 1</option>
                        {data.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontWeight: 700 }}>vs</span>
                      <select
                        value={h2h.b}
                        onChange={(e) => setH2h((v) => ({ ...v, b: e.target.value }))}
                        style={{ ...styles.input, flex: 1 }}
                      >
                        <option value="">Игрок 2</option>
                        {data.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {h2hStats && (
                      <div style={{ marginTop: "12px", textAlign: "center" }}>
                        {h2hStats.games === 0 ? (
                          <p style={styles.emptyText}>Эти игроки ещё не встречались.</p>
                        ) : (
                          <div>
                            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700 }}>
                              {h2hStats.wa} : {h2hStats.wb}
                            </div>
                            <p style={{ ...styles.hint, marginTop: "4px" }}>
                              <PlayerBall color={playerColor(h2h.a)} /> {nameById(h2h.a)} против{" "}
                              <PlayerBall color={playerColor(h2h.b)} /> {nameById(h2h.b)}
                            </p>
                            <p style={styles.hint}>
                              Встреч: {h2hStats.games} · Шары: {h2hStats.ba} — {h2hStats.bb}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Статистика по игрокам</h2>
                {stats.length === 0 ? (
                  <p style={styles.emptyText}>Сыгранных партий пока нет.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Игрок</th>
                          <th style={styles.th}>Игр</th>
                          <th style={styles.th}>Побед</th>
                          <th style={styles.th}>Пораж.</th>
                          <th style={styles.th}>%</th>
                          <th style={styles.th}>Серия</th>
                          <th style={styles.th}>Лучш. серия</th>
                          <th style={styles.th}>Шаров</th>
                          <th style={styles.th}>Ср/игру</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((s, i) => (
                          <tr key={s.id} style={i === 0 && s.wins > 0 ? styles.leaderRow : undefined}>
                            <td style={styles.td}>{s.name}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.games}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.wins}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.losses}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.winPct}%</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.currentStreak}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.bestStreak}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.totalBalls}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.avgBalls.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "history" && (
            <section style={styles.card}>
              <h2 style={styles.h2}>История партий</h2>
              <div style={styles.searchRow} className="no-print">
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={styles.input} />
                {dateFilter && (
                  <button style={styles.diceBtn} onClick={() => setDateFilter("")}>
                    Сбросить
                  </button>
                )}
              </div>
              {filteredHistory.length === 0 ? (
                <EmptyState text="Партий не найдено" />
              ) : (
                <ul style={styles.historyList}>
                  {filteredHistory.map((m) => (
                    <li key={m.id} style={styles.historyItem} onClick={() => setSelectedMatchId(m.id)}>
                      <div>
                        <div style={styles.historyPlayers}>
                          {m.participants.map((pid, i) => (
                            <span key={pid}>
                              <span style={pid === m.winnerId ? styles.winnerName : undefined}>
                                {nameById(pid)} {m.scores ? `(${m.scores[pid] || 0})` : ""}
                                {pid === m.breakerId ? " 🎯" : ""}
                              </span>
                              {i < m.participants.length - 1 ? " · " : ""}
                            </span>
                          ))}
                        </div>
                        <div style={styles.historyDate}>
                          <GameIcon type={m.gameType || "russian"} size={12} />{" "}
                          {new Date(m.date).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {m.durationMs ? ` · ${formatDuration(m.durationMs)}` : ""}
                          {m.mode && RUSSIAN_MODES[m.mode] ? ` · ${RUSSIAN_MODES[m.mode].alias}` : ""}
                          {m.solo ? " · тренировка" : ""}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMatch(m.id);
                        }}
                        style={styles.deleteBtn}
                        aria-label="Удалить партию"
                        className="no-print"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "settings" && (
            <section>
              <div style={styles.card}>
                <h2 style={styles.h2}>Тип игры</h2>
                <p style={styles.hint}>Выбор влияет на оформление стола и отмечается в каждой партии</p>
                <div style={styles.chipRow}>
                  {Object.entries(GAME_TYPES).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setGameType(key)}
                      style={{
                        ...styles.selectChip,
                        ...((data.gameType || "russian") === key ? styles.selectChipActive : {}),
                      }}
                    >
                      <GameIcon type={key} size={14} /> {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Оформление</h2>
                <div style={styles.settingRow}>
                  <span>🌙 Тёмная тема</span>
                  <button onClick={toggleTheme} style={{ ...styles.switchTrack, ...(dark ? styles.switchTrackOn : {}) }}>
                    <span style={{ ...styles.switchThumb, ...(dark ? styles.switchThumbOn : {}) }} />
                  </button>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Экспорт</h2>
                <p style={styles.hint}>Скачайте историю и статистику в Excel, или откройте печать, чтобы сохранить как PDF.</p>
                <div style={styles.settingBtnRow}>
                  <button style={styles.brassBtn} onClick={exportExcel}>
                    📊 Excel
                  </button>
                  <button style={styles.diceBtn} onClick={() => window.print()}>
                    🖨️ PDF (печать)
                  </button>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Резервная копия</h2>
                <p style={styles.hint}>Все партии сохраняются автоматически. Дополнительно можно скачать полную копию данных или восстановить её из файла.</p>
                <div style={styles.settingBtnRow}>
                  <button style={styles.brassBtn} onClick={exportBackup}>
                    Скачать копию
                  </button>
                  <label style={{ ...styles.diceBtn, display: "inline-flex", alignItems: "center" }}>
                    Восстановить
                    <input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} />
                  </label>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={{ ...styles.h2, color: COLORS.danger }}>Опасная зона</h2>
                <button style={styles.resetBtn} onClick={clearAll}>
                  Очистить все данные
                </button>
              </div>
            </section>
          )}
        </main>

        <nav style={styles.bottomNav} className="no-print">
          {[
            ["play", "Игра", <NavCue size={20} />],
            ["rating", "Рейтинг", <NavTrophy size={20} />],
            ["history", "История", <NavClock size={20} />],
            ["settings", "Ещё", <NavGear size={20} />],
          ].map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => {
                haptic("light");
                setTab(key);
              }}
              style={{
                ...styles.bottomNavBtn,
                ...(tab === key ? styles.bottomNavBtnActive : {}),
              }}
            >
              <span
                style={{
                  ...styles.navIcon,
                  animation: tab === key ? "iconPop 0.35s ease" : "none",
                }}
              >
                {icon}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      <Confetti active={celebrate} />

      {selectedMatch && (
        <div style={styles.modalOverlay} onClick={() => setSelectedMatchId(null)} className="no-print">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>
              Партия ·{" "}
              {new Date(selectedMatch.date).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </h2>
            <div style={styles.modalScores}>
              {selectedMatch.participants.map((pid) => (
                <div key={pid} style={styles.modalRow}>
                  <span>
                    {nameById(pid)}
                    {pid === selectedMatch.breakerId ? " 🎯" : ""}
                    {pid === selectedMatch.winnerId ? " 🏆" : ""}
                  </span>
                  <span style={styles.mono}>{(selectedMatch.scores && selectedMatch.scores[pid]) || 0}</span>
                </div>
              ))}
            </div>
            <p style={styles.hint}>Начинал: {selectedMatch.breakerId ? nameById(selectedMatch.breakerId) : "не указано"}</p>
            <p style={styles.hint}>
              {selectedMatch.solo ? "Тип: тренировка (соло)" : `Победитель: ${nameById(selectedMatch.winnerId)}`}
            </p>
            <p style={styles.hint}>
              Дисциплина: <GameIcon type={selectedMatch.gameType || "russian"} size={13} />{" "}
              {GAME_TYPES[selectedMatch.gameType || "russian"].label}
              {selectedMatch.mode && RUSSIAN_MODES[selectedMatch.mode]
                ? ` · ${RUSSIAN_MODES[selectedMatch.mode].name} (${RUSSIAN_MODES[selectedMatch.mode].alias})`
                : ""}
            </p>
            <p style={styles.hint}>Продолжительность: {formatDuration(selectedMatch.durationMs)}</p>
            {selectedMatch.settlement && (
              <>
                <p style={styles.hint}>Круговой расчёт (разница очков между парами):</p>
                <KolhozTable
                  participants={selectedMatch.participants}
                  settlement={selectedMatch.settlement}
                  nameById={nameById}
                  playerColor={playerColor}
                />
              </>
            )}
            <button style={{ ...styles.cancelBtn, marginTop: "16px" }} onClick={() => setSelectedMatchId(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {victory && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 55,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            color: "#F3EBDA",
            background: `linear-gradient(180deg, ${
              victory.solo ? COLORS.brass : playerColor(victory.winnerId)
            }cc 0%, rgba(10,43,32,0.97) 68%)`,
            backdropFilter: "blur(6px)",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div style={{ maxWidth: "380px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "60px", lineHeight: 1, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>
              {victory.solo ? "🎯" : "🏆"}
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "26px", margin: "10px 0 4px", color: "#F8F1DE", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {victory.solo
                ? "Тренировка завершена!"
                : victory.series && victory.series.champion
                ? `${nameById(victory.winnerId)} выиграл матч!`
                : `Победа: ${nameById(victory.winnerId)}!`}
            </h2>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "46px", fontWeight: 700, margin: "10px 0", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {victory.participants.map((pid) => victory.scores[pid] || 0).join(" : ")}
            </div>
            <p style={{ ...styles.hint, color: "#E7DCC0" }}>
              {victory.participants.map((pid, i) => (
                <span key={pid}>
                  <PlayerBall color={playerColor(pid)} size={12} /> {nameById(pid)}
                  {i < victory.participants.length - 1 ? "  ·  " : ""}
                </span>
              ))}
            </p>
            {victory.durationMs > 0 && <p style={{ ...styles.hint, color: "#E7DCC0" }}>⏱ {formatDuration(victory.durationMs)}</p>}
            {victory.mode && RUSSIAN_MODES[victory.mode] && (
              <p style={{ ...styles.hint, color: "#E7DCC0" }}>
                {RUSSIAN_MODES[victory.mode].name} ({RUSSIAN_MODES[victory.mode].alias})
              </p>
            )}
            {victory.series && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px" }}>
                🏟️ Матч (Best of {victory.series.bestOf}):{" "}
                <strong>
                  {victory.series.participants
                    .map((pid) => `${nameById(pid)} ${victory.series.wins[pid] || 0}`)
                    .join(" : ")}
                </strong>
                {victory.series.champion && <div style={{ marginTop: "4px" }}>Матч завершён — чемпион определён!</div>}
              </div>
            )}
            {victory.settlement && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px", textAlign: "left" }}>
                🧮 Круговой расчёт (разница очков между парами)
                <KolhozTable
                  participants={victory.participants}
                  settlement={victory.settlement}
                  nameById={nameById}
                  playerColor={playerColor}
                />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
              {(!victory.series || !victory.series.champion) && !victory.solo && (
                <button style={{ ...styles.brassBtn, width: "100%" }} onClick={() => startRematch(victory.participants)}>
                  🔄 Реванш{victory.series ? " (следующая партия матча)" : ""}
                </button>
              )}
              {victory.solo && (
                <button style={{ ...styles.brassBtn, width: "100%" }} onClick={() => startRematch(victory.participants)}>
                  🔄 Ещё одна тренировка
                </button>
              )}
              <button style={{ ...styles.diceBtn, width: "100%" }} onClick={shareVictory}>
                📤 Поделиться результатом
              </button>
              <button style={{ ...styles.finishBtn, width: "100%" }} onClick={closeVictory}>
                К рейтингу
              </button>
            </div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div style={styles.modalOverlay} onClick={() => setRulesOpen(false)} className="no-print">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Дисциплины русского бильярда</h2>
            {Object.entries(RUSSIAN_MODES).map(([key, m]) => (
              <div key={key} style={{ marginBottom: "14px" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "14px" }}>
                  {m.name} ({m.alias}){(data.russianMode || "free") === key ? " · выбрана" : ""}
                </p>
                {m.rules.map((r, i) => (
                  <p key={i} style={{ ...styles.hint, margin: "2px 0" }}>
                    • {r}
                  </p>
                ))}
              </div>
            ))}
            <button style={{ ...styles.cancelBtn, marginTop: "8px" }} onClick={() => setRulesOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
