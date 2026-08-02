import { AVATAR_COLORS, RUSSIAN_MODES } from "./constants.js";

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadInitial() {
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

export function normalizeData(parsed) {
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

export function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export function computeStats(players, matches) {
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

export function buildBracketRounds(participants) {
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

export function bracketRoundLabel(ri, total) {
  const fromEnd = total - 1 - ri;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "Четвертьфинал";
  return `Раунд ${ri + 1}`;
}

export function buildKolhozSettlement(participants, scores) {
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
