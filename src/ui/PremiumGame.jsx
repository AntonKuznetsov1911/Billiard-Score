import React from "react";

const animal = {
  lion: "M36 5 52 12 62 25 64 43 55 61 36 69 17 61 8 43 10 25 20 12Z",
  wolf: "M12 8 28 22 44 22 60 8 58 46 49 53 36 67 23 53 14 46Z",
  panther: "M13 26Q3 6 21 12L29 19H43L51 12Q69 6 59 26L62 46 51 57 36 65 21 57 10 46Z",
};

export function PlayerPortrait({ avatar }) {
  const face = Object.hasOwn(animal, avatar) ? animal[avatar] : null;
  return (
    <svg viewBox="0 0 72 72" className="player-portrait" aria-hidden="true">
      {face ? <>
        <path d={face} fill="#152725" stroke="currentColor" strokeWidth="1.5" />
        <path d="M19 29 36 20 53 29 48 44 44 56 36 60 28 56 24 44Z" fill="currentColor" opacity=".25" />
        <path d="m21 34 10 4-9 2m29-6-10 4 9 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m29 46 7 6 7-6m-7 6v5m-7 1 7-1 7 1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </> : avatar === "helmet" ? <>
        <path d="M13 41C11 21 21 10 37 10c18 0 28 11 26 29L54 59 26 64 13 50Z" fill="#192d2c" stroke="currentColor" strokeWidth="2" />
        <path d="M16 32 56 26 59 37 22 47Z" fill="currentColor" opacity=".4" />
        <path d="m23 52 21 5 10-8M23 24l11-7" stroke="currentColor" fill="none" strokeWidth="2" />
      </> : avatar === "eight" ? <>
        <circle cx="36" cy="36" r="27" fill="#091615" stroke="currentColor" strokeWidth="2" />
        <circle cx="36" cy="36" r="14" fill="#f2ddac" />
        <text x="36" y="43" fill="#11221b" fontSize="20" fontWeight="700" textAnchor="middle">8</text>
      </> : <>
        <circle cx="36" cy="36" r="26" fill="#152725" stroke="currentColor" opacity=".65" />
        <path d="m21 53 31-33m0 33L21 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="36" cy="13" r="4" fill="#f4e4bb" />
      </>}
    </svg>
  );
}

export function DisciplineArt({ mode }) {
  const balls = mode === "classic" ? [[32,23]] : ["dynamic", "kolhoz"].includes(mode)
    ? [[25,22],[41,27]] : [[32,11],[25,21],[39,21],[18,31],[32,31],[46,31]];
  return (
    <svg viewBox="0 0 64 45" className="discipline-art" aria-hidden="true">
      {balls.map(([x,y]) => <g key={x + ":" + y}>
        <circle cx={x} cy={y + 2} r="8.3" fill="#03130c" opacity=".6" />
        <circle cx={x} cy={y} r={balls.length === 1 ? 14 : 8} fill="#c6aa77" />
        <circle cx={x-1} cy={y-1} r={balls.length === 1 ? 12 : 7} fill="#eee0bd" />
        <circle cx={x-3} cy={y-3} r="2" fill="#fffae6" />
      </g>)}
      {balls.length === 1 && <text x="32" y="27" fill="#322819" fontSize="13" fontWeight="700" textAnchor="middle">71</text>}
    </svg>
  );
}
