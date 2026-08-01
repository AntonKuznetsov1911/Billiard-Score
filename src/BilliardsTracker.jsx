import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
import { saveToCloud, loadFromCloud, cloudSyncAvailable } from "./cloudSync.js";
import { isCloudConfigured } from "./supabaseClient.js";
import {
  sendMagicLink,
  verifyEmailOtp,
  signInWithGoogle,
  onAuthChange,
  getSession,
  signOut as clubSignOut,
  createClub,
  joinClub,
  leaveClub,
  getMyClub,
  fetchClubState,
  pushClubState,
  subscribeClubState,
} from "./clubSync.js";
import tableRussianPhoto from "./assets/table-russian.jpg";
import tablePoolPhoto from "./assets/table-pool.jpg";

const RatingChart = lazy(() => import("./RatingChart.jsx"));

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

const APP_TITLE = {
  russian: "Твой бильярд",
  pool: "Your Pool",
};

const TWO_RAILS_RULE =
  "Правило двух бортов: если после удара битком по прицельному шару ни один шар не забит, удар засчитывается, только если выполнено одно из: любой шар (биток или прицельный) коснулся двух бортов; два разных шара коснулись по одному борту каждый; шар коснулся борта и затем пересёк среднюю линию стола (или наоборот — сначала пересёк линию, потом коснулся борта). Иначе — нарушение (в обиходе «недокат»).";

const COMMON_FOULS = [
  "Касание любого шара на столе рукой, кием, мелом, машинкой для мела или одеждой — нарушение. Поправлять можно только биток, пока он не введён в игру (не сделан первый удар по нему).",
  "Двойной удар: если наклейка кия повторно касается уже начавшего движение битка — нарушение.",
  "Игрок обязан касаться пола хотя бы одной ногой в момент удара — иначе нарушение.",
  "Удар, после которого биток не коснулся ни одного прицельного шара («пустой» удар/недоезд) — нарушение.",
  "Вылет любого шара за борт стола — нарушение, даже если шар задел кий или одежду игрока над бортом.",
  "Пропих (толчок): биток и прицельный шар соприкасаются дольше короткого удара, кий «толкает» шар вместо удара — нарушение.",
];

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
      TWO_RAILS_RULE,
      ...COMMON_FOULS,
      "При нарушении право хода переходит к сопернику; во многих клубах сопернику дополнительно присуждается очко/право забрать шар — уточняйте местные правила.",
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
      TWO_RAILS_RULE,
      ...COMMON_FOULS,
      "При нарушении соперник, помимо права хода, может забрать себе один шар со стола по своему выбору («штрафной шар»).",
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
      TWO_RAILS_RULE,
      ...COMMON_FOULS,
      "При нарушении право хода переходит к сопернику.",
    ],
  },
  classic: {
    name: "Классическая пирамида",
    alias: "71 очко",
    target: 71,
    unit: "очков",
    rules: [
      "Профессиональная дисциплина.",
      "Каждый шар имеет стоимость в очках, равную его номеру; шар с номером 1 (туз) стоит 11 очков.",
      "Для победы необходимо набрать 71 очко.",
      "Самая сложная разновидность русского бильярда.",
      TWO_RAILS_RULE,
      ...COMMON_FOULS,
      "Свой шар (биток), забитый в лузу, — тоже нарушение.",
      "За любое нарушение у нарушителя вычитается 5 очков, а сопернику прибавляется 5 очков. Несколько нарушений в одном ударе штрафуются только один раз.",
      "Если оба игрока набрали по 70 очков, последний забитый прицельный шар ставится обратно на стол, и игра продолжается на решающее очко.",
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
      "Касание любого шара рукой, кием или одеждой — тоже нарушение, как и в остальных разновидностях пирамиды.",
      "Штраф за нарушение обычно равен номиналу разыгрываемого (заказанного) шара и вычитается из очков нарушителя.",
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

function IconTrophy({ size = 14, color = COLORS.brass }) {
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

function IconTarget({ size = 14, color = COLORS.brass }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-2px" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill={color} />
    </svg>
  );
}

function IconDice({ size = 14, color = COLORS.chalk }) {
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

function buildBracketRounds(participants) {
  const rounds = [];
  const firstRound = [];
  for (let i = 0; i < participants.length; i += 2) {
    firstRound.push({ a: participants[i], b: participants[i + 1], winnerId: null });
  }
  rounds.push(firstRound);
  let roundSize = firstRound.length;
  while (roundSize > 1) {
    const nextRound = [];
    for (let i = 0; i < roundSize / 2; i++) nextRound.push({ a: null, b: null, winnerId: null });
    rounds.push(nextRound);
    roundSize = nextRound.length;
  }
  return rounds;
}

function bracketRoundLabel(ri, total) {
  const fromEnd = total - 1 - ri;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "Четвертьфинал";
  return `Раунд ${ri + 1}`;
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

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden="true">
      {/* real table photo, cross-fades between disciplines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${tableRussianPhoto})`,
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          opacity: isPool ? 0 : 1,
          transition: "opacity 0.6s ease",
          animation: "tableKenBurns 22s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${tablePoolPhoto})`,
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          opacity: isPool ? 1 : 0,
          transition: "opacity 0.6s ease",
          animation: "tableKenBurns 22s ease-in-out infinite alternate",
        }}
      />
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

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadInitial() {
  return {
    players: [],
    matches: [],
    activeGame: null,
    activeSeries: null,
    activeBracket: null,
    theme: "dark",
    gameType: "russian",
    russianMode: "free",
    updatedAt: 0,
  };
}

function normalizeData(parsed) {
  return {
    players: (Array.isArray(parsed.players) ? parsed.players : []).map((p, i) => ({
      ...p,
      color: p.color || AVATAR_COLORS[i % AVATAR_COLORS.length],
    })),
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    activeGame: parsed.activeGame || null,
    activeSeries: parsed.activeSeries || null,
    activeBracket: parsed.activeBracket || null,
    theme: parsed.theme === "light" ? "light" : "dark",
    gameType: parsed.gameType === "pool" ? "pool" : "russian",
    russianMode: RUSSIAN_MODES[parsed.russianMode] ? parsed.russianMode : "free",
    updatedAt: parsed.updatedAt || 0,
  };
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
        cardBg: "rgba(20,22,18,0.10)",
        cardBorder: "rgba(255,255,255,0.20)",
        text: "#F1EAD8",
        sub: "#CDC3A6",
        inputBg: "rgba(255,255,255,0.06)",
        inputBorder: "rgba(255,255,255,0.20)",
        chipBg: "rgba(255,255,255,0.08)",
        chipBorder: "rgba(255,255,255,0.20)",
        navBg: "rgba(20,22,18,0.16)",
        navText: "#F1E9D2",
        headerBg: "rgba(10,20,15,0.22)",
        tableBorder: "rgba(255,255,255,0.18)",
        rowBorder: "rgba(255,255,255,0.08)",
        modalBg: "#1C1D18",
      }
    : {
        cardBg: "rgba(255,251,242,0.20)",
        cardBorder: "rgba(205,187,144,0.85)",
        text: COLORS.ink,
        sub: "#6E6248",
        inputBg: "rgba(251,247,238,0.55)",
        inputBorder: "#D8CBA9",
        chipBg: "rgba(239,230,204,0.55)",
        chipBorder: "#DCC98F",
        navBg: "rgba(246,240,226,0.26)",
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
      fontSize: "34px",
      letterSpacing: "0.6px",
      margin: 0,
      display: "inline-block",
      backgroundImage: "linear-gradient(120deg, #FBF0D2 0%, #E7CE93 45%, #C08A3E 75%, #F1DDA6 100%)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "#F8F1DE",
      filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
    },
    gameTypeSwitch: {
      display: "inline-flex",
      marginTop: "10px",
      padding: "3px",
      borderRadius: "999px",
      background: "rgba(10,10,8,0.32)",
      border: "1px solid rgba(255,255,255,0.20)",
      backdropFilter: "blur(14px) saturate(150%)",
      WebkitBackdropFilter: "blur(14px) saturate(150%)",
      boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
    },
    gameTypeSwitchBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 15px",
      borderRadius: "999px",
      border: "none",
      background: "transparent",
      color: "rgba(241,233,210,0.65)",
      fontSize: "11.5px",
      fontWeight: 700,
      letterSpacing: "0.3px",
      cursor: "pointer",
      transition: "background 0.25s ease, color 0.2s ease, box-shadow 0.25s ease",
    },
    gameTypeSwitchBtnActive: {
      background: "linear-gradient(135deg, #D9A354 0%, #A9701F 100%)",
      color: "#241705",
      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
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
    card: {
      background: T.cardBg,
      backdropFilter: "blur(34px) saturate(170%)",
      WebkitBackdropFilter: "blur(34px) saturate(170%)",
      border: `1px solid ${T.cardBorder}`,
      borderRadius: "16px",
      padding: "18px",
      marginBottom: "16px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)",
    },
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
    ghostBtn: { padding: "7px 10px", borderRadius: "8px", border: "1px solid transparent", background: "transparent", color: T.sub, fontWeight: 600, fontSize: "12px" },
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
  const [openRuleKey, setOpenRuleKey] = useState(null);
  const [ballValue, setBallValue] = useState(5);
  const [handicaps, setHandicaps] = useState({});
  const [h2h, setH2h] = useState({ a: "", b: "" });
  const [victory, setVictory] = useState(null);
  const [seriesPick, setSeriesPick] = useState(1);
  const [scorePulse, setScorePulse] = useState({ pid: null, ts: 0 });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [editMatchId, setEditMatchId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("idle"); // idle | sending | sent | verifying | error
  const [authError, setAuthError] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [club, setClub] = useState(null);
  const [clubBusy, setClubBusy] = useState(false);
  const [clubError, setClubError] = useState("");
  const [clubCodeInput, setClubCodeInput] = useState("");
  const [clubNameInput, setClubNameInput] = useState("");

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
      let local = null;
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) local = normalizeData(JSON.parse(res.value));
      } catch (e) {
        // no local data yet
      }

      let cloud = null;
      try {
        const cloudRes = await loadFromCloud();
        if (cloudRes && cloudRes.data) cloud = normalizeData({ ...cloudRes.data, updatedAt: cloudRes.updatedAt });
      } catch (e) {
        // cloud unavailable or empty
      }

      const cloudIsNewer = cloud && (!local || (cloud.updatedAt || 0) > (local.updatedAt || 0));
      const chosen = cloudIsNewer ? cloud : local;

      if (chosen) {
        setData(chosen);
        if (cloudIsNewer) {
          try {
            await window.storage.set(STORAGE_KEY, JSON.stringify(chosen), false);
          } catch (e) {
            // best effort
          }
        }
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    // Ссылка входа могла истечь, быть уже использованной (например, почтовый
    // сервис заранее "открывает" ссылки для проверки на фишинг) или домен не
    // совпал с настройками Supabase — в этих случаях Supabase не выдаёт сессию,
    // а возвращает ошибку прямо в hash адреса, которую иначе никто не покажет.
    const hash = window.location.hash;
    if (hash && hash.includes("error=")) {
      const params = new URLSearchParams(hash.slice(1));
      const desc = params.get("error_description") || params.get("error") || "Ссылка для входа недействительна";
      setAuthStatus("error");
      setAuthError(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    let active = true;
    (async () => {
      const session = await getSession();
      if (active) setAuthSession(session);
    })();
    const unsubscribe = onAuthChange((session) => {
      setAuthSession(session);
      if (!session) setClub(null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;
    let active = true;
    (async () => {
      try {
        const myClub = await getMyClub();
        if (active && myClub) setClub(myClub);
      } catch (e) {
        // not critical — user just isn't in a club yet
      }
    })();
    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!club) return;
    let active = true;
    (async () => {
      try {
        const remote = await fetchClubState(club.id);
        if (active && remote && remote.data) {
          setData(normalizeData({ ...remote.data, updatedAt: remote.updatedAt }));
        }
      } catch (e) {
        setClubError("Не удалось загрузить данные клуба");
      }
    })();
    const unsubscribe = subscribeClubState(club.id, (remoteData, updatedAt) => {
      setData(normalizeData({ ...remoteData, updatedAt }));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [club]);

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

  const persist = useCallback(
    async (next) => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      } catch (e) {
        console.error("Storage error", e);
      }
      // Best-effort mirror to Telegram CloudStorage; silently no-ops outside Telegram.
      saveToCloud(next).catch(() => {});
      // Best-effort mirror to the shared club, if any; the realtime subscription applies
      // remote changes via a separate setData call that never goes through persist(), so
      // there's no echo loop to guard against here.
      if (club) {
        pushClubState(club.id, next).catch(() => setClubError("Не удалось синхронизировать с клубом"));
      }
    },
    [club]
  );

  const updateData = useCallback(
    (updater) => {
      setData((prev) => {
        const next0 = typeof updater === "function" ? updater(prev) : updater;
        const next = { ...next0, updatedAt: Date.now() };
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

  const startTournament = () => {
    if (selected.length !== 4 && selected.length !== 8) return;
    haptic("medium");
    updateData((prev) => ({
      ...prev,
      activeBracket: {
        id: uid(),
        participants: [...selected],
        rounds: buildBracketRounds(selected),
        champion: null,
      },
    }));
    setSelected([]);
    setDiceRolls(null);
  };

  const startBracketMatch = (roundIdx, matchIdx) => {
    const bracket = data.activeBracket;
    if (!bracket) return;
    const m = bracket.rounds[roundIdx] && bracket.rounds[roundIdx][matchIdx];
    if (!m || !m.a || !m.b || m.winnerId) return;
    haptic("medium");
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      return {
        ...prev,
        activeGame: {
          id: uid(),
          participants: [m.a, m.b],
          scores: { [m.a]: 0, [m.b]: 0 },
          breakerId: null,
          gameType: prev.gameType || "russian",
          mode,
          targets: buildTargets(mode, [m.a, m.b]),
          actionLog: [],
          startedAt: new Date().toISOString(),
          bracketRound: roundIdx,
          bracketMatch: matchIdx,
        },
      };
    });
  };

  const cancelBracket = () => {
    if (!window.confirm("Завершить турнир досрочно?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeBracket: null }));
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

    // Tournament bracket advance
    let bracketUpdate = null;
    let bracketInfo = null;
    if (g.bracketRound != null && g.bracketMatch != null && data.activeBracket) {
      const bracket = data.activeBracket;
      const rounds = bracket.rounds.map((r) => r.map((mm) => ({ ...mm })));
      rounds[g.bracketRound][g.bracketMatch].winnerId = winnerId;
      let champion = bracket.champion;
      const isFinal = g.bracketRound + 1 >= rounds.length;
      if (!isFinal) {
        const nextIdx = Math.floor(g.bracketMatch / 2);
        const slot = g.bracketMatch % 2 === 0 ? "a" : "b";
        rounds[g.bracketRound + 1][nextIdx][slot] = winnerId;
      } else {
        champion = winnerId;
      }
      bracketUpdate = { ...bracket, rounds, champion };
      bracketInfo = { isFinal, champion: isFinal ? winnerId : null };
    }

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
      bracketId: bracketUpdate ? bracketUpdate.id : null,
    };
    updateData((prev) => ({
      ...prev,
      matches: [...prev.matches, match],
      activeGame: null,
      activeSeries: nextSeries,
      activeBracket: bracketUpdate || prev.activeBracket,
    }));
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
      bracket: bracketInfo,
    });
    haptic("success");
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1700);
  };

  const closeVictory = () => {
    setTab(victory && victory.bracket ? "play" : "rating");
    setVictory(null);
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

  const startEditMatch = (m) => {
    haptic("light");
    const scores = {};
    m.participants.forEach((pid) => {
      scores[pid] = (m.scores && m.scores[pid]) || 0;
    });
    setEditDraft({ scores });
    setEditMatchId(m.id);
  };

  const cancelEditMatch = () => {
    setEditMatchId(null);
    setEditDraft(null);
  };

  const saveEditMatch = () => {
    if (!editMatchId || !editDraft) return;
    haptic("medium");
    updateData((prev) => {
      const idx = prev.matches.findIndex((m) => m.id === editMatchId);
      if (idx === -1) return prev;
      const old = prev.matches[idx];
      const newScores = editDraft.scores;
      let winnerId = old.winnerId;
      if (!old.solo) {
        const max = Math.max(...old.participants.map((pid) => newScores[pid] || 0));
        const leaders = old.participants.filter((pid) => (newScores[pid] || 0) === max);
        winnerId = leaders.includes(old.winnerId) ? old.winnerId : leaders[0];
      }
      const settlement = old.mode === "kolhoz" && !old.solo ? buildKolhozSettlement(old.participants, newScores) : old.settlement;
      const matches = [...prev.matches];
      matches[idx] = { ...old, scores: newScores, winnerId, settlement };

      let activeSeries = prev.activeSeries;
      if (old.seriesId && activeSeries && activeSeries.id === old.seriesId && winnerId !== old.winnerId) {
        const wins = { ...activeSeries.wins };
        wins[old.winnerId] = Math.max(0, (wins[old.winnerId] || 0) - 1);
        wins[winnerId] = (wins[winnerId] || 0) + 1;
        activeSeries = { ...activeSeries, wins };
      }

      return { ...prev, matches, activeSeries };
    });
    setEditMatchId(null);
    setEditDraft(null);
  };

  const handleSendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;
    setAuthStatus("sending");
    setAuthError("");
    try {
      await sendMagicLink(email);
      setAuthStatus("sent");
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Не удалось отправить код");
    }
  };

  const handleVerifyCode = async () => {
    const code = authCode.trim();
    const email = authEmail.trim();
    if (!code || !email) return;
    setAuthStatus("verifying");
    setAuthError("");
    try {
      await verifyEmailOtp(email, code);
      setAuthCode("");
      setAuthStatus("idle");
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Неверный или устаревший код");
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthStatus("sending");
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Не удалось войти через Google");
    }
  };

  const handleSignOut = async () => {
    await clubSignOut();
    setAuthSession(null);
    setClub(null);
    setAuthStatus("idle");
    setAuthEmail("");
  };

  const handleCreateClub = async () => {
    setClubBusy(true);
    setClubError("");
    try {
      const newClub = await createClub(clubNameInput.trim());
      setClub(newClub);
      setClubNameInput("");
    } catch (e) {
      setClubError(e.message || "Не удалось создать клуб");
    } finally {
      setClubBusy(false);
    }
  };

  const handleJoinClub = async () => {
    if (!clubCodeInput.trim()) return;
    setClubBusy(true);
    setClubError("");
    try {
      const joined = await joinClub(clubCodeInput.trim());
      setClub(joined);
      setClubCodeInput("");
    } catch (e) {
      setClubError(e.message || "Не удалось присоединиться к клубу");
    } finally {
      setClubBusy(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!club) return;
    if (!window.confirm("Покинуть клуб? Локальные данные на этом устройстве останутся, но общий доступ прекратится.")) return;
    setClubBusy(true);
    try {
      await leaveClub(club.id);
      setClub(null);
    } catch (e) {
      setClubError(e.message || "Не удалось покинуть клуб");
    } finally {
      setClubBusy(false);
    }
  };

  const clearAll = () => {
    if (!window.confirm("Удалить всех игроков и всю историю партий?")) return;
    haptic("warning");
    updateData((prev) => ({
      players: [],
      matches: [],
      activeGame: null,
      activeSeries: null,
      activeBracket: null,
      theme: prev.theme,
      gameType: prev.gameType,
      russianMode: prev.russianMode,
    }));
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

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
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
  const immersive = !!(activeGame && gameMode);

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
        @keyframes tableKenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.07); }
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
        <div style={{ ...styles.outerOverlay, ...(activeGame ? { background: "rgba(4,10,7,0.45)" } : {}) }} />
      </div>

      <div style={styles.page}>
        {!immersive && (
          <header style={styles.header} className="no-print">
            <h1 style={styles.title} key={data.gameType || "russian"} className="tab-fade">
              {APP_TITLE[data.gameType || "russian"]}
              <CueExclamation height={30} />
            </h1>
            <div style={styles.gameTypeSwitch} role="tablist" aria-label="Дисциплина">
              <button
                type="button"
                role="tab"
                aria-selected={(data.gameType || "russian") !== "pool"}
                style={{
                  ...styles.gameTypeSwitchBtn,
                  ...((data.gameType || "russian") !== "pool" ? styles.gameTypeSwitchBtnActive : {}),
                }}
                onClick={() => setGameType("russian")}
              >
                <GameIcon type="russian" size={13} /> Русский
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={(data.gameType || "russian") === "pool"}
                style={{
                  ...styles.gameTypeSwitchBtn,
                  ...((data.gameType || "russian") === "pool" ? styles.gameTypeSwitchBtnActive : {}),
                }}
                onClick={() => setGameType("pool")}
              >
                <GameIcon type="pool" size={13} /> Pool
              </button>
            </div>
          </header>
        )}

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

              {!activeGame && !data.activeBracket && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Начать партию</h2>
                  {(data.gameType || "russian") === "russian" && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <p style={styles.hint}>Дисциплина</p>
                        <button
                          style={styles.ghostBtn}
                          onClick={() => {
                            setOpenRuleKey(data.russianMode || "free");
                            setRulesOpen(true);
                          }}
                        >
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

                  {!isKolhoz && (selected.length === 4 || selected.length === 8) && (
                    <button style={{ ...styles.diceBtn, marginTop: "10px", width: "100%" }} onClick={startTournament}>
                      <IconTrophy /> Турнир на выбывание ({selected.length} участника{selected.length === 4 ? "" : "ов"})
                    </button>
                  )}

                  {selected.length >= 2 && (
                    <div style={styles.diceSection}>
                      <p style={styles.hint}>Кто разбивает первым?</p>
                      <button style={styles.diceBtn} onClick={() => rollDiceFor(selected)} disabled={diceRolling}>
                        <IconDice /> Кинуть кубики
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
                          <IconTarget /> Первым разбивает: <strong>{nameById(breakerInfo.breakerId)}</strong>
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

                  {!isKolhoz && selected.length >= 2 && (
                    <button
                      style={{ ...styles.ghostBtn, marginTop: "10px" }}
                      onClick={() => setAdvancedOpen((o) => !o)}
                    >
                      {advancedOpen ? "▲ Скрыть доп. настройки" : "▾ Формат и фора"}
                    </button>
                  )}

                  {!isKolhoz && advancedOpen && !data.activeSeries && selected.length >= 2 && (
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
                    advancedOpen &&
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

              {!activeGame && data.activeBracket && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>
                    <IconTrophy size={16} /> Турнир на выбывание
                  </h2>
                  {data.activeBracket.champion && (
                    <div style={{ ...styles.breakerBanner, borderColor: "#3E9B5C" }}>
                      <IconTrophy /> Чемпион турнира: <strong>{nameById(data.activeBracket.champion)}</strong>
                    </div>
                  )}
                  {data.activeBracket.rounds.map((round, ri) => (
                    <div key={ri} style={{ marginTop: "14px" }}>
                      <p style={styles.hint}>{bracketRoundLabel(ri, data.activeBracket.rounds.length)}</p>
                      {round.map((m, mi) => (
                        <div
                          key={mi}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.05)",
                            marginBottom: "6px",
                          }}
                        >
                          <span style={{ fontSize: "13px" }}>
                            <span style={{ fontWeight: m.winnerId && m.winnerId === m.a ? 700 : 400 }}>
                              {m.a ? nameById(m.a) : "?"}
                              {m.winnerId && m.winnerId === m.a ? <IconTrophy size={12} /> : ""}
                            </span>
                            {" vs "}
                            <span style={{ fontWeight: m.winnerId && m.winnerId === m.b ? 700 : 400 }}>
                              {m.b ? nameById(m.b) : "?"}
                              {m.winnerId && m.winnerId === m.b ? <IconTrophy size={12} /> : ""}
                            </span>
                          </span>
                          {m.a && m.b && !m.winnerId && (
                            <button style={styles.diceBtn} onClick={() => startBracketMatch(ri, mi)}>
                              Играть
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  <button style={{ ...styles.cancelBtn, marginTop: "12px", width: "100%" }} onClick={cancelBracket}>
                    Завершить турнир
                  </button>
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
                    <h2 style={{ ...styles.h2, margin: 0, flex: 1 }}>Партия идёт</h2>
                    <button
                      style={{ ...styles.diceBtn, padding: "6px 10px", fontSize: "11px" }}
                      onClick={() => setGameMode((v) => !v)}
                      className="no-print"
                    >
                      {gameMode ? "▣ Обычный вид" : "⛶ Крупный режим"}
                    </button>
                  </div>
                  {!gameMode && gm && (
                    <p style={styles.hint}>
                      {gm.name} ({gm.alias})
                      {gm.target ? ` · до ${gm.target} ${gm.unit}` : " · круговой расчёт, завершите вручную, когда закончите"}
                    </p>
                  )}
                  {!gameMode && activeGame.breakerId && (
                    <div style={styles.breakerBanner}>
                      <IconTarget /> Первым разбивал: <strong>{nameById(activeGame.breakerId)}</strong>
                    </div>
                  )}
                  {reachedId && (
                    <div style={{ ...styles.breakerBanner, borderColor: "#3E9B5C" }}>
                      <IconTrophy /> <strong>{nameById(reachedId)}</strong> достиг цели ({targetOf(reachedId)} {gm.unit})!{" "}
                      <button
                        style={{ ...styles.brassBtn, marginTop: "8px", width: "100%" }}
                        onClick={() => finalizeGame(reachedId)}
                      >
                        Засчитать победу
                      </button>
                    </div>
                  )}
                  {!gameMode && (
                    <p style={styles.hint}>
                      {isPoints ? "Отмечайте набранные очки каждого игрока" : "Отмечайте забитые шары каждого игрока"}
                    </p>
                  )}
                  {isPoints && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={styles.hint}>Номинал забитого шара (очки = номер шара)</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginTop: "8px" }}>
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              haptic("light");
                              setBallValue(v);
                            }}
                            style={{
                              ...styles.selectChip,
                              borderRadius: "10px",
                              padding: "11px 0",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              ...(ballValue === v ? styles.selectChipActive : {}),
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ ...styles.scoreboard, ...(gameMode ? { gap: "14px", marginTop: "16px" } : {}) }}>
                    {activeGame.participants.map((pid) => (
                      <div
                        key={pid}
                        style={{
                          ...styles.scoreCard,
                          borderLeft: `4px solid ${playerColor(pid)}`,
                          ...(gameMode
                            ? { padding: "22px 18px", cursor: "pointer", userSelect: "none", flexWrap: "wrap", rowGap: "12px" }
                            : {}),
                        }}
                        onClick={gameMode ? () => addPoint(pid, isPoints ? ballValue : 1) : undefined}
                      >
                        <div style={{ ...styles.scoreName, ...(gameMode ? { fontSize: "18px", flexBasis: "100%" } : {}) }}>
                          <PlayerBall color={playerColor(pid)} size={gameMode ? 18 : 14} /> {nameById(pid)}
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
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...styles.scoreInput, ...(gameMode ? { fontSize: "28px", width: "68px", height: "50px" } : {}) }}
                            aria-label={`Счёт: ${nameById(pid)}`}
                          />
                        </span>
                        <div style={styles.scoreBtns}>
                          <button
                            style={{ ...styles.scoreBtnMinus, ...(gameMode ? { width: "52px", height: "52px", fontSize: "24px" } : {}) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              addPoint(pid, -1);
                            }}
                            disabled={(activeGame.scores[pid] || 0) <= 0}
                            aria-label={`Убрать у ${nameById(pid)}`}
                          >
                            −
                          </button>
                          <button
                            style={{
                              ...styles.scoreBtnPlus,
                              ...(gameMode ? { height: "52px", fontSize: "17px", padding: "0 20px" } : {}),
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              addPoint(pid, isPoints ? ballValue : 1);
                            }}
                            aria-label={`Добавить: ${nameById(pid)}`}
                          >
                            {isPoints ? `+ ${ballValue}` : "+ шар"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {gameMode && (
                    <p style={{ ...styles.hint, textAlign: "center", marginTop: "8px" }}>
                      Тапните по карточке игрока, чтобы добавить {isPoints ? `${ballValue} очк.` : "шар"}
                    </p>
                  )}
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
                  <Suspense fallback={<div style={{ ...styles.hint, textAlign: "center", padding: "40px 0" }}>Загрузка графика…</div>}>
                    <RatingChart chartData={chartData} dark={dark} hintColor={styles.hint.color} />
                  </Suspense>
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
                                {pid === m.breakerId ? <IconTarget size={11} /> : ""}
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

              {isCloudConfigured() && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Общий доступ (клуб)</h2>
                  {!authSession && (
                    <>
                      <p style={styles.hint}>
                        Войдите по email, чтобы создать клуб или присоединиться к нему — тогда партии будут видны всем
                        участникам клуба в реальном времени.
                      </p>
                      <div style={styles.addRow}>
                        <input
                          style={styles.input}
                          type="email"
                          placeholder="Ваш email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMagicLink()}
                          disabled={authStatus === "sent" || authStatus === "verifying"}
                        />
                        <button
                          style={styles.brassBtn}
                          onClick={handleSendMagicLink}
                          disabled={authStatus === "sending" || authStatus === "sent" || authStatus === "verifying"}
                        >
                          {authStatus === "sent" ? "Код отправлен" : "Прислать код"}
                        </button>
                      </div>
                      {(authStatus === "sent" || authStatus === "verifying") && (
                        <>
                          <p style={{ ...styles.hint, color: "#3E9B5C" }}>
                            Проверьте почту — пришёл 6-значный код. Введите его ниже.
                          </p>
                          <div style={styles.addRow}>
                            <input
                              style={styles.input}
                              type="text"
                              inputMode="numeric"
                              placeholder="Код из письма"
                              value={authCode}
                              onChange={(e) => setAuthCode(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                            />
                            <button style={styles.brassBtn} onClick={handleVerifyCode} disabled={authStatus === "verifying"}>
                              Подтвердить
                            </button>
                          </div>
                        </>
                      )}
                      {authStatus === "error" && <p style={{ ...styles.hint, color: COLORS.danger }}>{authError}</p>}
                      <p style={{ ...styles.hint, margin: "12px 0 6px" }}>или</p>
                      <button style={{ ...styles.diceBtn, width: "100%" }} onClick={handleGoogleSignIn} disabled={authStatus === "sending"}>
                        Войти через Google
                      </button>
                    </>
                  )}
                  {authSession && !club && (
                    <>
                      <p style={styles.hint}>Вы вошли как {authSession.user.email}.</p>
                      {clubError && <p style={{ ...styles.hint, color: COLORS.danger }}>{clubError}</p>}
                      <div style={{ marginTop: "10px" }}>
                        <p style={styles.hint}>Создать новый клуб</p>
                        <div style={styles.addRow}>
                          <input
                            style={styles.input}
                            placeholder="Название клуба (необязательно)"
                            value={clubNameInput}
                            onChange={(e) => setClubNameInput(e.target.value)}
                          />
                          <button style={styles.brassBtn} onClick={handleCreateClub} disabled={clubBusy}>
                            Создать
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <p style={styles.hint}>Или присоединиться по коду</p>
                        <div style={styles.addRow}>
                          <input
                            style={styles.input}
                            placeholder="Код клуба"
                            value={clubCodeInput}
                            onChange={(e) => setClubCodeInput(e.target.value.toUpperCase())}
                          />
                          <button style={styles.diceBtn} onClick={handleJoinClub} disabled={clubBusy}>
                            Войти
                          </button>
                        </div>
                      </div>
                      <button style={{ ...styles.ghostBtn, marginTop: "10px" }} onClick={handleSignOut}>
                        Выйти из аккаунта
                      </button>
                    </>
                  )}
                  {authSession && club && (
                    <>
                      <div style={{ ...styles.breakerBanner, textAlign: "left" }}>
                        Клуб: <strong>{club.name}</strong>
                        <div style={{ marginTop: "6px" }}>
                          Код приглашения: <span style={styles.mono}>{club.code}</span>
                        </div>
                        <p style={{ ...styles.hint, margin: "6px 0 0" }}>
                          Поделитесь кодом с остальными игроками — им нужно один раз войти по email и ввести этот код.
                        </p>
                      </div>
                      {clubError && <p style={{ ...styles.hint, color: COLORS.danger }}>{clubError}</p>}
                      <div style={styles.settingBtnRow}>
                        <button style={styles.diceBtn} onClick={handleLeaveClub} disabled={clubBusy}>
                          Покинуть клуб
                        </button>
                        <button style={styles.ghostBtn} onClick={handleSignOut}>
                          Выйти из аккаунта
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={styles.card}>
                <h2 style={styles.h2}>Резервная копия</h2>
                <p style={styles.hint}>Все партии сохраняются автоматически. Дополнительно можно скачать полную копию данных или восстановить её из файла.</p>
                <p style={styles.hint}>
                  {cloudSyncAvailable()
                    ? "☁️ Синхронизация с Telegram Cloud включена — данные не потеряются при смене устройства."
                    : "☁️ Синхронизация с Telegram Cloud недоступна вне Telegram — данные хранятся только на этом устройстве."}
                </p>
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

        {!immersive && (
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
        )}
      </div>

      <Confetti active={celebrate} />

      {selectedMatch && (
        <div
          style={styles.modalOverlay}
          onClick={() => {
            setSelectedMatchId(null);
            cancelEditMatch();
          }}
          className="no-print"
        >
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
            {editMatchId === selectedMatch.id ? (
              <>
                <div style={styles.modalScores}>
                  {selectedMatch.participants.map((pid) => (
                    <div key={pid} style={styles.modalRow}>
                      <span>
                        <PlayerBall color={playerColor(pid)} size={12} /> {nameById(pid)}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={editDraft.scores[pid] ?? 0}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            scores: { ...d.scores, [pid]: Math.max(0, Math.floor(Number(e.target.value) || 0)) },
                          }))
                        }
                        onFocus={(e) => e.target.select()}
                        style={{ ...styles.scoreInput, width: "76px" }}
                      />
                    </div>
                  ))}
                </div>
                {!selectedMatch.solo && <p style={styles.hint}>Победитель определится автоматически по наибольшему счёту.</p>}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button style={{ ...styles.brassBtn, flex: 1 }} onClick={saveEditMatch}>
                    Сохранить
                  </button>
                  <button style={{ ...styles.cancelBtn, flex: 1 }} onClick={cancelEditMatch}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.modalScores}>
                  {selectedMatch.participants.map((pid) => (
                    <div key={pid} style={styles.modalRow}>
                      <span>
                        {nameById(pid)}
                        {pid === selectedMatch.breakerId ? <IconTarget size={12} /> : ""}
                        {pid === selectedMatch.winnerId ? <IconTrophy size={12} /> : ""}
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
                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }} className="no-print">
                  <button style={{ ...styles.diceBtn, flex: 1 }} onClick={() => startEditMatch(selectedMatch)}>
                    ✏️ Исправить счёт
                  </button>
                  <button style={{ ...styles.cancelBtn, flex: 1 }} onClick={() => setSelectedMatchId(null)}>
                    Закрыть
                  </button>
                </div>
              </>
            )}
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
            <div style={{ lineHeight: 1, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>
              {victory.solo ? (
                <IconTarget size={60} color="#F8F1DE" />
              ) : (
                <IconTrophy size={60} color="#F8F1DE" />
              )}
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
            {victory.bracket && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px", borderColor: victory.bracket.isFinal ? "#3E9B5C" : undefined }}>
                <IconTrophy />{" "}
                {victory.bracket.isFinal
                  ? `${nameById(victory.bracket.champion)} — чемпион турнира!`
                  : `${nameById(victory.winnerId)} проходит в следующий раунд турнира`}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
              {!victory.bracket && (!victory.series || !victory.series.champion) && !victory.solo && (
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
                {victory.bracket ? "К турнирной сетке" : "К рейтингу"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div style={styles.modalOverlay} onClick={() => setRulesOpen(false)} className="no-print">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Дисциплины русского бильярда</h2>
            {Object.entries(RUSSIAN_MODES).map(([key, m]) => {
              const isOpen = openRuleKey === key;
              return (
                <div key={key} style={{ marginBottom: "8px", borderBottom: `1px solid ${styles.tableBorder || "rgba(128,128,128,0.2)"}` }}>
                  <button
                    onClick={() => setOpenRuleKey(isOpen ? null : key)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "8px 0",
                      cursor: "pointer",
                      color: "inherit",
                      font: "inherit",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "14px", textAlign: "left" }}>
                      {m.name} ({m.alias}){(data.russianMode || "free") === key ? " · выбрана" : ""}
                    </span>
                    <span style={{ opacity: 0.6, fontSize: "12px" }}>{isOpen ? "▲" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ paddingBottom: "10px" }}>
                      {m.rules.map((r, i) => (
                        <p key={i} style={{ ...styles.hint, margin: "2px 0" }}>
                          • {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button style={{ ...styles.cancelBtn, marginTop: "8px" }} onClick={() => setRulesOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
