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
    theme: "light",
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
    theme: parsed.theme === "dark" ? "dark" : "light",
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

// Cumulative win-rate after each head-to-head match, in chronological order,
// one series per player — the "form over time" line chart on the Рейтинг
// tab. Solo practice games don't count (they never affect win/loss).
export function buildRatingTrend(players, matches) {
  const sorted = matches
    .filter((m) => !m.solo)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const running = {};
  players.forEach((p) => {
    running[p.id] = { wins: 0, played: 0 };
  });

  return sorted.map((m, i) => {
    m.participants.forEach((pid) => {
      if (!running[pid]) return;
      running[pid].played += 1;
      if (m.winnerId === pid) running[pid].wins += 1;
    });
    const point = {
      index: i + 1,
      date: new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    };
    players.forEach((p) => {
      const r = running[p.id];
      point[p.name] = r.played > 0 ? Math.round((r.wins / r.played) * 100) : null;
    });
    return point;
  });
}

// Global "best ever" records across all head-to-head matches — used both to
// render the Рекорды card and (by the caller) to detect when a just-finished
// match becomes a new record.
export function computeRecords(matches) {
  const vs = matches.filter((m) => !m.solo);
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
}

// Per-player achievement badges, keyed by player id — used both to render
// the Достижения card and (by the caller) to detect newly-unlocked ones.
export function computeAchievements(stats, matches) {
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
  matches
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
