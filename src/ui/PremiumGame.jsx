import React from "react";
import { PLAYER_AVATARS } from "../constants.js";

const images = import.meta.glob("../assets/avatars/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const portraits = new Map(PLAYER_AVATARS.map(([id, , file]) => [
  id, images[`../assets/avatars/${file}.webp`],
]));

export function PlayerPortrait({ avatar }) {
  const src = portraits.get(avatar);
  if (src) return <img src={src} className="player-portrait player-portrait-image" alt="" width="65" height="65" />;
  return (
    <svg viewBox="0 0 72 72" className="player-portrait" aria-hidden="true">
      <circle cx="36" cy="36" r="26" fill="#152725" stroke="currentColor" opacity=".65" />
      <path d="m21 53 31-33m0 33L21 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="36" cy="13" r="4" fill="#f4e4bb" />
    </svg>
  );
}

export function DisciplineArt({ mode }) {
  const balls = mode === "kolhoz"
    ? [[32,13,"#d34149","#8e1826"], [23,28,"#f0bc42","#a76c18"], [41,28,"#4b93de","#24538c"]]
    : mode === "classic" ? [[32,23]] : mode === "dynamic"
      ? [[25,22],[41,27]] : [[32,11],[25,21],[39,21],[18,31],[32,31],[46,31]];
  return (
    <svg viewBox="0 0 64 45" className="discipline-art" aria-hidden="true">
      {balls.map(([x, y, face = "#eee0bd", edge = "#c6aa77"]) => <g key={x + ":" + y}>
        <circle cx={x} cy={y + 2} r="8.3" fill="#03130c" opacity=".6" />
        <circle cx={x} cy={y} r={balls.length === 1 ? 14 : 8} fill={edge} />
        <circle cx={x-1} cy={y-1} r={balls.length === 1 ? 12 : 7} fill={face} />
        <circle cx={x-3} cy={y-3} r="2" fill="#fffae6" />
      </g>)}
      {balls.length === 1 && <text x="32" y="27" fill="#322819" fontSize="13" fontWeight="700" textAnchor="middle">71</text>}
    </svg>
  );
}
