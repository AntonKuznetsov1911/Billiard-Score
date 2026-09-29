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
      let breaksCount = 0;
      let breaksAnswered = 0;
      let breaksPotted = 0;
      pMatches.forEach((m) => {
        totalBalls += (m.scores && m.scores[p.id]) || 0;
        if (m.breakerId === p.id) {
          breaksCount += 1;
          if (m.breakerPotted === true || m.breakerPotted === false) {
            breaksAnswered += 1;
            if (m.breakerPotted === true) breaksPotted += 1;
          }
        }
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
        breaksCount,
        breaksPotted,
        breakPct: breaksAnswered ? Math.round((breaksPotted / breaksAnswered) * 100) : 0,
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

  // Best break-shot accuracy — highest % of potting on the break, among
  // players with at least 3 answered breaks (avoids one lucky break "winning").
  const breakTotals = {};
  vs.forEach((m) => {
    if (!m.breakerId || (m.breakerPotted !== true && m.breakerPotted !== false)) return;
    const t = breakTotals[m.breakerId] || (breakTotals[m.breakerId] = { total: 0, potted: 0 });
    t.total += 1;
    if (m.breakerPotted === true) t.potted += 1;
  });
  let bestBreaker = null;
  Object.entries(breakTotals).forEach(([playerId, t]) => {
    if (t.total < 3) return;
    const pct = Math.round((t.potted / t.total) * 100);
    if (!bestBreaker || pct > bestBreaker.pct || (pct === bestBreaker.pct && t.total > bestBreaker.total)) {
      bestBreaker = { playerId, potted: t.potted, total: t.total, pct };
    }
  });

  return { fastest, longest, blow, blowMargin, bestBreaker };
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
    if (s.breaksPotted >= 1) list.push(["🎯", "Точный разбой"]);
    if (s.breaksPotted >= 10) list.push(["💥", "10 удачных разбоев"]);
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

// ---------------------------------------------------------------------------
// Statistics helpers for the Рейтинг tab
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

// period: "all" | "week" (last 7 days) | "month" (last 30 days)
// gameType: "all" | "russian" | "pool"; mode: "all" | a RUSSIAN_MODES key
export function filterMatches(matches, { period = "all", gameType = "all", mode = "all" } = {}, now = Date.now()) {
  const from = period === "week" ? now - 7 * DAY_MS : period === "month" ? now - 30 * DAY_MS : null;
  return matches.filter((m) => {
    if (from !== null && new Date(m.date).getTime() < from) return false;
    const gt = m.gameType || "russian";
    if (gameType !== "all" && gt !== gameType) return false;
    if (mode !== "all" && (gt !== "russian" || (m.mode || "free") !== mode)) return false;
    return true;
  });
}

// Elo over head-to-head matches in chronological order. In games with more
// than two players the winner is rated against each loser, K split evenly.
export function computeElo(players, matches, { k = 32, start = 1000 } = {}) {
  const rating = {};
  const games = {};
  players.forEach((p) => {
    rating[p.id] = start;
    games[p.id] = 0;
  });
  matches
    .filter((m) => !m.solo && m.winnerId && rating[m.winnerId] !== undefined)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((m) => {
      const losers = m.participants.filter((pid) => pid !== m.winnerId && rating[pid] !== undefined);
      if (!losers.length) return;
      const before = { ...rating };
      const kk = k / losers.length;
      losers.forEach((lid) => {
        const expectedWin = 1 / (1 + Math.pow(10, (before[lid] - before[m.winnerId]) / 400));
        rating[m.winnerId] += kk * (1 - expectedWin);
        rating[lid] -= kk * (1 - expectedWin);
      });
      games[m.winnerId] += 1;
      losers.forEach((lid) => (games[lid] += 1));
    });
  const out = {};
  Object.keys(rating).forEach((id) => (out[id] = { rating: Math.round(rating[id]), games: games[id] }));
  return out;
}

// wins/losses of every player against every other one (pairwise; in a
// multi-player game the winner beats each loser, losers don't count vs each other).
export function computeHeadToHeadMatrix(players, matches) {
  const matrix = {};
  players.forEach((a) => {
    matrix[a.id] = {};
    players.forEach((b) => {
      if (a.id !== b.id) matrix[a.id][b.id] = { wins: 0, losses: 0 };
    });
  });
  matches
    .filter((m) => !m.solo && m.winnerId)
    .forEach((m) => {
      m.participants.forEach((pid) => {
        if (pid === m.winnerId || !matrix[m.winnerId] || !matrix[m.winnerId][pid]) return;
        matrix[m.winnerId][pid].wins += 1;
        matrix[pid][m.winnerId].losses += 1;
      });
    });
  return matrix;
}

export function computePlayerProfile(playerId, players, matches) {
  const mine = matches
    .filter((m) => m.participants.includes(playerId))
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const vs = mine.filter((m) => !m.solo);
  const wins = vs.filter((m) => m.winnerId === playerId).length;

  const byType = {};
  vs.forEach((m) => {
    const gt = m.gameType || "russian";
    byType[gt] = (byType[gt] || 0) + 1;
  });
  const favoriteGameType = Object.keys(byType).sort((a, b) => byType[b] - byType[a])[0] || null;

  let own = 0;
  let opp = 0;
  vs.forEach((m) => {
    own += (m.scores && m.scores[playerId]) || 0;
    const others = m.participants.filter((p) => p !== playerId).map((p) => (m.scores && m.scores[p]) || 0);
    opp += others.length ? Math.max(...others) : 0;
  });

  const matrix = computeHeadToHeadMatrix(players, matches);
  const row = matrix[playerId] || {};
  let nemesis = null;
  let victim = null;
  Object.keys(row).forEach((oid) => {
    const r = row[oid];
    if (r.wins + r.losses < 2) return;
    if (r.losses > r.wins && (!nemesis || r.losses - r.wins > nemesis.losses - nemesis.wins)) nemesis = { id: oid, ...r };
    if (r.wins > r.losses && (!victim || r.wins - r.losses > victim.wins - victim.losses)) victim = { id: oid, ...r };
  });

  const breaking = { asBreaker: { games: 0, wins: 0 }, other: { games: 0, wins: 0 } };
  vs.forEach((m) => {
    if (!m.breakerId) return;
    const bucket = m.breakerId === playerId ? breaking.asBreaker : breaking.other;
    bucket.games += 1;
    if (m.winnerId === playerId) bucket.wins += 1;
  });

  return {
    games: vs.length,
    wins,
    form: vs.slice(-5).map((m) => (m.winnerId === playerId ? "W" : "L")),
    favoriteGameType,
    avgOwn: vs.length ? own / vs.length : 0,
    avgOpp: vs.length ? opp / vs.length : 0,
    totalDurationMs: mine.reduce((sum, m) => sum + (m.durationMs > 0 ? m.durationMs : 0), 0),
    nemesis,
    victim,
    breaking,
  };
}

// Weekday (Mon=0..Sun=6) and part-of-day distribution, total table time and a
// 10-week calendar (columns = weeks, rows = Mon..Sun) ending with the current week.
export function computeActivity(matches, now = Date.now()) {
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const dayPart = { morning: 0, day: 0, evening: 0, night: 0 };
  const perDay = {};
  let totalDurationMs = 0;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  matches.forEach((m) => {
    const d = new Date(m.date);
    weekday[(d.getDay() + 6) % 7] += 1;
    const h = d.getHours();
    if (h >= 5 && h < 11) dayPart.morning += 1;
    else if (h >= 11 && h < 17) dayPart.day += 1;
    else if (h >= 17 && h < 23) dayPart.evening += 1;
    else dayPart.night += 1;
    perDay[dayKey(d)] = (perDay[dayKey(d)] || 0) + 1;
    if (m.durationMs > 0) totalDurationMs += m.durationMs;
  });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = [];
  for (let w = 9; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(monday);
      cell.setDate(monday.getDate() - w * 7 + d);
      col.push({ date: cell.getTime(), count: cell > today ? null : perDay[dayKey(cell)] || 0 });
    }
    weeks.push(col);
  }
  return { weekday, dayPart, totalDurationMs, weeks, games: matches.length };
}

// Balls scored and minutes per match, in order — the "tempo" chart.
export function buildMatchTempo(matches, limit = 30) {
  return matches
    .filter((m) => m.durationMs > 0)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit)
    .map((m, i) => ({
      index: i + 1,
      date: new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      Шары: m.participants.reduce((s, pid) => s + ((m.scores && m.scores[pid]) || 0), 0),
      Минуты: Math.max(1, Math.round(m.durationMs / 60000)),
    }));
}

// Headline numbers for the shareable "итоги" card. null when there is nothing to show.
export function buildPeriodSummary(players, matches) {
  if (!matches.length) return null;
  const stats = computeStats(players, matches).filter((s) => s.games > 0);
  const vs = matches.filter((m) => !m.solo);
  const mvp = stats.filter((s) => s.wins > 0)[0] || null; // computeStats sorts by wins, then win %
  const streak = stats.slice().sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const balls = stats.slice().sort((a, b) => b.totalBalls - a.totalBalls)[0];
  const records = computeRecords(matches);
  return {
    games: matches.length,
    durationMs: matches.reduce((s, m) => s + (m.durationMs > 0 ? m.durationMs : 0), 0),
    mvp: mvp && { name: mvp.name, wins: mvp.wins, winPct: mvp.winPct },
    streak: streak && streak.bestStreak > 1 ? { name: streak.name, value: streak.bestStreak } : null,
    balls: balls && balls.totalBalls > 0 ? { name: balls.name, value: balls.totalBalls } : null,
    blowMargin: records.blow && records.blowMargin > 0 ? records.blowMargin : 0,
    vsGames: vs.length,
  };
}
