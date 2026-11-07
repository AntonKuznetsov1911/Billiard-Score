import React from "react";
import { PLAYER_AVATARS } from "../constants.js";

import amerikanka from "../assets/disciplines/01-amerikanka.webp";
import moskovskaya from "../assets/disciplines/02-moskovskaya.webp";
import nevskaya from "../assets/disciplines/03-nevskaya.webp";
import kolhoz from "../assets/disciplines/04-kolhoz.webp";
import classic from "../assets/disciplines/05-71-ochko.webp";

const disciplineIcons = {
  free: amerikanka,
  combined: moskovskaya,
  dynamic: nevskaya,
  kolhoz,
  classic,
};

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
  return <img src={disciplineIcons[mode]} className="discipline-art" alt="" width="256" height="180" />;
}
