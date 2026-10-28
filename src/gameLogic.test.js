import { describe, it, expect } from "vitest";
import {
  uid,
  mergeData,
  stampChanges,
  addGameEvent,
  undoGameEvent,
  canUndoGame,
  isGameStale,
  lastGameActivity,
  loadInitial,
  normalizeData,
  formatDuration,
  computeStats,
  buildRatingTrend,
  computeRecords,
  computeAchievements,
  filterMatches,
  computeElo,
  computeHeadToHeadMatrix,
  computePlayerProfile,
  computeActivity,
  buildMatchTempo,
  buildPeriodSummary,
  moveMatchToTrash,
  restoreMatchFromTrash,
  buildBracketRounds,
  bracketRoundLabel,
  buildKolhozSettlement,
  busyPlayerIds,
  kolhozVictim,
  kolhozSuggestOrder,
  kolhozSwap,
  startKolhozRound,
  setKolhozOrder,
  kolhozAllRounds,
  kolhozSettlement,
  kolhozNet,
  kolhozGross,
  gameStandings,
  buildPayments,
  moneyBalance,
  cleanStake,
  formatRub,
} from "./gameLogic.js";

describe("uid", () => {
  it("returns a non-empty string and is unique across calls", () => {
    const a = uid();
    const b = uid();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("loadInitial", () => {
  it("returns sane defaults for a brand-new install", () => {
    const initial = loadInitial();
    expect(initial.players).toEqual([]);
    expect(initial.matches).toEqual([]);
    expect(initial.activeGames).toEqual([]);
    expect(initial.theme).toBe("light");
    expect(initial.gameType).toBe("russian");
    expect(initial.russianMode).toBe("free");
  });
});

describe("normalizeData", () => {
  it("fills in missing fields and assigns avatar colors to players without one", () => {
    const out = normalizeData({ players: [{ id: "p1", name: "Anton" }] });
    expect(out.players[0].color).toBeTruthy();
    expect(out.matches).toEqual([]);
    expect(out.theme).toBe("light");
    expect(out.russianMode).toBe("free");
  });

  it("keeps an already-set player color", () => {
    const out = normalizeData({ players: [{ id: "p1", name: "Anton", color: "#123456" }] });
    expect(out.players[0].color).toBe("#123456");
  });

  it("falls back to russian gameType for anything other than pool", () => {
    expect(normalizeData({ gameType: "pool" }).gameType).toBe("pool");
    expect(normalizeData({ gameType: "nonsense" }).gameType).toBe("russian");
    expect(normalizeData({}).gameType).toBe("russian");
  });

  it("falls back to the free russian mode for an unknown mode key", () => {
    expect(normalizeData({ russianMode: "classic" }).russianMode).toBe("classic");
    expect(normalizeData({ russianMode: "made-up" }).russianMode).toBe("free");
  });

  it("defaults to light theme unless dark was explicitly saved", () => {
    expect(normalizeData({ theme: "dark" }).theme).toBe("dark");
    expect(normalizeData({ theme: "light" }).theme).toBe("light");
    expect(normalizeData({ theme: "nonsense" }).theme).toBe("light");
    expect(normalizeData({}).theme).toBe("light");
  });
});

describe("formatDuration", () => {
  it("renders minutes under an hour", () => {
    expect(formatDuration(5 * 60000)).toBe("5 мин");
  });

  it("renders hours and minutes over an hour", () => {
    expect(formatDuration(90 * 60000)).toBe("1 ч 30 мин");
  });

  it("rounds up to at least 1 minute for very short games", () => {
    expect(formatDuration(1000)).toBe("1 мин");
  });

  it("returns a placeholder for missing/invalid duration", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(-500)).toBe("—");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("buildRatingTrend", () => {
  const players = [{ id: "a", name: "Anton" }, { id: "b", name: "Igor" }];

  it("tracks cumulative win rate per player across chronological matches", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", solo: false, date: "2024-01-01" },
      { participants: ["a", "b"], winnerId: "a", solo: false, date: "2024-01-02" },
      { participants: ["a", "b"], winnerId: "b", solo: false, date: "2024-01-03" },
    ];
    const trend = buildRatingTrend(players, matches);
    expect(trend).toHaveLength(3);
    expect(trend[0].Anton).toBe(100);
    expect(trend[0].Igor).toBe(0);
    expect(trend[2].Anton).toBe(67);
    expect(trend[2].Igor).toBe(33);
  });

  it("leaves a player's value null until they've played at least once", () => {
    const matches = [{ participants: ["a"], winnerId: "a", solo: false, date: "2024-01-01" }];
    // "a" plays solo-vs-nobody-else here is contrived; use a real 1-player entry to check Igor stays null
    const trend = buildRatingTrend(players, matches);
    expect(trend[0].Igor).toBeNull();
  });

  it("ignores solo practice games entirely", () => {
    const matches = [{ participants: ["a"], winnerId: "a", solo: true, date: "2024-01-01" }];
    expect(buildRatingTrend(players, matches)).toEqual([]);
  });

  it("sorts points chronologically regardless of input order", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", solo: false, date: "2024-03-01" },
      { participants: ["a", "b"], winnerId: "b", solo: false, date: "2024-01-01" },
    ];
    const trend = buildRatingTrend(players, matches);
    expect(trend[0].date).toContain("янв");
    expect(trend[1].date).toContain("мар");
  });
});

describe("computeRecords", () => {
  it("picks the fastest, longest and biggest-blowout matches", () => {
    const matches = [
      { id: "m1", participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 6 }, solo: false, durationMs: 600000 },
      { id: "m2", participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 0 }, solo: false, durationMs: 300000 },
      { id: "m3", participants: ["a", "b"], winnerId: "b", scores: { a: 2, b: 8 }, solo: false, durationMs: 1200000 },
    ];
    const records = computeRecords(matches);
    expect(records.fastest.id).toBe("m2");
    expect(records.longest.id).toBe("m3");
    expect(records.blow.id).toBe("m2");
    expect(records.blowMargin).toBe(8);
  });

  it("ignores solo games and matches without a recorded duration", () => {
    const matches = [{ id: "m1", participants: ["a"], winnerId: "a", scores: { a: 6 }, solo: true, durationMs: 60000 }];
    const records = computeRecords(matches);
    expect(records.fastest).toBeNull();
    expect(records.longest).toBeNull();
    expect(records.blow).toBeNull();
  });

  it("picks the best break-shot accuracy among players with at least 3 answered breaks", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 2 }, solo: false, breakerId: "a", breakerPotted: true },
      { participants: ["a", "b"], winnerId: "b", scores: { a: 2, b: 8 }, solo: false, breakerId: "a", breakerPotted: true },
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 2 }, solo: false, breakerId: "a", breakerPotted: false },
      { participants: ["a", "b"], winnerId: "b", scores: { a: 2, b: 8 }, solo: false, breakerId: "b", breakerPotted: true },
    ];
    const records = computeRecords(matches);
    // "a" broke 3 times, potted 2/3 = 67%; "b" only has 1 answered break — below the threshold.
    expect(records.bestBreaker.playerId).toBe("a");
    expect(records.bestBreaker.potted).toBe(2);
    expect(records.bestBreaker.total).toBe(3);
    expect(records.bestBreaker.pct).toBe(67);
  });

  it("has no best breaker when nobody has enough answered breaks", () => {
    const matches = [{ participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 2 }, solo: false, breakerId: "a", breakerPotted: true }];
    expect(computeRecords(matches).bestBreaker).toBeNull();
  });
});

describe("computeAchievements", () => {
  const players = [{ id: "a", name: "Anton" }, { id: "b", name: "Igor" }];

  it("awards streak and win-count badges from stats", () => {
    const matches = [];
    const stats = computeStats(players, matches).map((s) => (s.id === "a" ? { ...s, wins: 1, bestStreak: 5 } : s));
    const map = computeAchievements(stats, matches);
    const labels = map.a.map((b) => b[1]);
    expect(labels).toContain("Первая победа");
    expect(labels).toContain("5 побед подряд");
    expect(map.b).toEqual([]);
  });

  it("awards a dry-win badge only to the winner of a shutout", () => {
    const matches = [{ id: "m1", participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 0 }, solo: false, durationMs: 100000 }];
    const stats = computeStats(players, matches);
    const map = computeAchievements(stats, matches);
    expect(map.a.some((b) => b[1] === "Сухая победа")).toBe(true);
    expect(map.b.some((b) => b[1] === "Сухая победа")).toBe(false);
  });

  it("awards a blitz badge for a short match and a marathon badge for a long one", () => {
    const blitz = [{ id: "m1", participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 4 }, solo: false, durationMs: 200000 }];
    const marathon = [{ id: "m1", participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 4 }, solo: false, durationMs: 4000000 }];
    const blitzMap = computeAchievements(computeStats(players, blitz), blitz);
    const marathonMap = computeAchievements(computeStats(players, marathon), marathon);
    expect(blitzMap.a.some((b) => b[1] === "Блиц-победа")).toBe(true);
    expect(marathonMap.a.some((b) => b[1] === "Марафон 60+ мин")).toBe(true);
    expect(marathonMap.b.some((b) => b[1] === "Марафон 60+ мин")).toBe(true);
  });

  it("awards break-accuracy badges based on successful breaks, not just attempts", () => {
    const matches = [{ participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 4 }, solo: false, breakerId: "a", breakerPotted: true }];
    const map = computeAchievements(computeStats(players, matches), matches);
    expect(map.a.some((b) => b[1] === "Точный разбой")).toBe(true);
    expect(map.b.some((b) => b[1] === "Точный разбой")).toBe(false);

    const missed = [{ participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 4 }, solo: false, breakerId: "a", breakerPotted: false }];
    const missedMap = computeAchievements(computeStats(players, missed), missed);
    expect(missedMap.a.some((b) => b[1] === "Точный разбой")).toBe(false);
  });
});

describe("buildBracketRounds", () => {
  it("builds a 2-round bracket for 4 participants", () => {
    const rounds = buildBracketRounds(["a", "b", "c", "d"]);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toEqual([
      { a: "a", b: "b", winnerId: null },
      { a: "c", b: "d", winnerId: null },
    ]);
    expect(rounds[1]).toEqual([{ a: null, b: null, winnerId: null }]);
  });

  it("builds a 3-round bracket for 8 participants", () => {
    const rounds = buildBracketRounds(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(rounds.map((r) => r.length)).toEqual([4, 2, 1]);
  });
});

describe("bracketRoundLabel", () => {
  it("labels the last round as the final regardless of bracket size", () => {
    expect(bracketRoundLabel(2, 3)).toBe("Финал");
    expect(bracketRoundLabel(1, 2)).toBe("Финал");
  });

  it("labels the semifinal and quarterfinal rounds", () => {
    expect(bracketRoundLabel(1, 3)).toBe("Полуфинал");
    expect(bracketRoundLabel(0, 3)).toBe("Четвертьфинал");
    expect(bracketRoundLabel(1, 4)).toBe("Четвертьфинал");
  });
});

describe("buildKolhozSettlement", () => {
  it("computes the pairwise score difference for every pair", () => {
    const settlement = buildKolhozSettlement(["a", "b", "c"], { a: 5, b: 3, c: 2 });
    expect(settlement.a.b).toBe(2);
    expect(settlement.b.a).toBe(-2);
    expect(settlement.a.c).toBe(3);
    expect(settlement.b.c).toBe(1);
  });

  it("treats a missing score as zero", () => {
    const settlement = buildKolhozSettlement(["a", "b"], { a: 4 });
    expect(settlement.a.b).toBe(4);
    expect(settlement.b.a).toBe(-4);
  });
});

describe("computeStats", () => {
  const players = [{ id: "a", name: "Anton" }, { id: "b", name: "Igor" }];

  it("counts wins, losses and win percentage for head-to-head matches", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 3 }, solo: false, date: "2024-01-01" },
      { participants: ["a", "b"], winnerId: "b", scores: { a: 5, b: 8 }, solo: false, date: "2024-01-02" },
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 6 }, solo: false, date: "2024-01-03" },
    ];
    const stats = computeStats(players, matches);
    const anton = stats.find((s) => s.id === "a");
    expect(anton.games).toBe(3);
    expect(anton.wins).toBe(2);
    expect(anton.losses).toBe(1);
    expect(anton.winPct).toBe(67);
    expect(anton.currentStreak).toBe(1);
  });

  it("excludes solo practice games from wins/losses but keeps ball totals", () => {
    const matches = [{ participants: ["a"], winnerId: "a", scores: { a: 6 }, solo: true, date: "2024-01-01" }];
    const stats = computeStats(players, matches);
    const anton = stats.find((s) => s.id === "a");
    expect(anton.games).toBe(1);
    expect(anton.wins).toBe(0);
    expect(anton.losses).toBe(0);
    expect(anton.totalBalls).toBe(6);
  });

  it("sorts players by wins, then win percentage", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 1 }, solo: false, date: "2024-01-01" },
    ];
    const stats = computeStats(players, matches);
    expect(stats[0].id).toBe("a");
  });

  it("tracks break count and break accuracy, ignoring unanswered breaks in the percentage", () => {
    const matches = [
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 1 }, solo: false, date: "2024-01-01", breakerId: "a", breakerPotted: true },
      { participants: ["a", "b"], winnerId: "b", scores: { a: 1, b: 8 }, solo: false, date: "2024-01-02", breakerId: "a", breakerPotted: false },
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 1 }, solo: false, date: "2024-01-03", breakerId: "a", breakerPotted: null },
    ];
    const anton = computeStats(players, matches).find((s) => s.id === "a");
    expect(anton.breaksCount).toBe(3);
    expect(anton.breaksPotted).toBe(1);
    expect(anton.breakPct).toBe(50); // 1/2 answered breaks, the unanswered one excluded
  });
});

describe("filterMatches", () => {
  const now = new Date(2024, 5, 30, 12).getTime();
  const day = 86400000;
  const matches = [
    { id: "old", date: new Date(now - 40 * day).toISOString(), gameType: "russian", mode: "free" },
    { id: "m", date: new Date(now - 10 * day).toISOString(), gameType: "pool" },
    { id: "w", date: new Date(now - 2 * day).toISOString(), gameType: "russian", mode: "kolhoz" },
    { id: "legacy", date: new Date(now - 1 * day).toISOString() },
  ];
  it("filters by period", () => {
    expect(filterMatches(matches, { period: "week" }, now).map((m) => m.id)).toEqual(["w", "legacy"]);
    expect(filterMatches(matches, { period: "month" }, now).map((m) => m.id)).toEqual(["m", "w", "legacy"]);
    expect(filterMatches(matches, {}, now)).toHaveLength(4);
  });
  it("filters by discipline and treats missing gameType as russian, missing mode as free", () => {
    expect(filterMatches(matches, { gameType: "pool" }, now).map((m) => m.id)).toEqual(["m"]);
    expect(filterMatches(matches, { gameType: "russian" }, now).map((m) => m.id)).toEqual(["old", "w", "legacy"]);
    expect(filterMatches(matches, { mode: "free" }, now).map((m) => m.id)).toEqual(["old", "legacy"]);
    expect(filterMatches(matches, { mode: "kolhoz" }, now).map((m) => m.id)).toEqual(["w"]);
  });
});

describe("computeElo", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("starts everyone at 1000 and moves the winner up and loser down equally", () => {
    const elo = computeElo(players, [{ participants: ["a", "b"], winnerId: "a", date: "2024-01-01" }]);
    expect(elo.a.rating).toBe(1016);
    expect(elo.b.rating).toBe(984);
    expect(elo.c.rating).toBe(1000);
    expect(elo.a.games).toBe(1);
  });
  it("rewards beating a stronger opponent more than a weaker one", () => {
    const seed = [
      { participants: ["a", "b"], winnerId: "a", date: "2024-01-01" },
      { participants: ["a", "b"], winnerId: "a", date: "2024-01-02" },
    ];
    const upset = computeElo(players, [...seed, { participants: ["a", "b"], winnerId: "b", date: "2024-01-03" }]);
    const base = computeElo(players, seed);
    expect(upset.b.rating - base.b.rating).toBeGreaterThan(16);
  });
  it("ignores solo games and sorts chronologically", () => {
    const solo = computeElo(players, [{ participants: ["a"], winnerId: "a", solo: true, date: "2024-01-01" }]);
    expect(solo.a.rating).toBe(1000);
  });
});

describe("computeHeadToHeadMatrix", () => {
  it("counts pairwise wins/losses, winner beats every loser", () => {
    const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const m = computeHeadToHeadMatrix(players, [
      { participants: ["a", "b", "c"], winnerId: "a" },
      { participants: ["a", "b"], winnerId: "b" },
    ]);
    expect(m.a.b).toEqual({ wins: 1, losses: 1 });
    expect(m.a.c).toEqual({ wins: 1, losses: 0 });
    expect(m.c.b).toEqual({ wins: 0, losses: 0 });
    expect(m.b.a).toEqual({ wins: 1, losses: 1 });
  });
});

describe("computePlayerProfile", () => {
  const players = [{ id: "a" }, { id: "b" }];
  const mk = (i, winnerId, extra = {}) => ({
    participants: ["a", "b"],
    winnerId,
    scores: winnerId === "a" ? { a: 8, b: 4 } : { a: 3, b: 8 },
    date: `2024-01-0${i}`,
    durationMs: 600000,
    ...extra,
  });
  it("builds form, averages, nemesis/victim and break split", () => {
    const matches = [
      mk(1, "a", { breakerId: "a" }),
      mk(2, "a", { breakerId: "b" }),
      mk(3, "b", { breakerId: "b" }),
      mk(4, "a", { breakerId: "a", gameType: "pool" }),
    ];
    const pa = computePlayerProfile("a", players, matches);
    expect(pa.games).toBe(4);
    expect(pa.wins).toBe(3);
    expect(pa.form).toEqual(["W", "W", "L", "W"]);
    expect(pa.favoriteGameType).toBe("russian");
    expect(pa.avgOwn).toBeCloseTo((8 + 8 + 3 + 8) / 4);
    expect(pa.totalDurationMs).toBe(2400000);
    expect(pa.victim.id).toBe("b");
    expect(pa.nemesis).toBeNull();
    expect(pa.breaking.asBreaker).toEqual({ games: 2, wins: 2 });
    expect(pa.breaking.other).toEqual({ games: 2, wins: 1 });
    expect(computePlayerProfile("b", players, matches).nemesis.id).toBe("a");
  });
  it("only keeps the last 5 results in form", () => {
    const matches = [1, 2, 3, 4, 5, 6].map((i) => mk(i, i % 2 ? "a" : "b"));
    expect(computePlayerProfile("a", players, matches).form).toHaveLength(5);
  });
});

describe("computeActivity", () => {
  it("buckets by weekday, part of day and builds a 10-week calendar", () => {
    const now = new Date(2024, 0, 10, 12).getTime(); // Wednesday
    const matches = [
      { date: new Date(2024, 0, 8, 9).toISOString(), durationMs: 60000 }, // Monday morning
      { date: new Date(2024, 0, 10, 19).toISOString(), durationMs: 120000 }, // Wednesday evening
      { date: new Date(2024, 0, 10, 20).toISOString() },
    ];
    const a = computeActivity(matches, now);
    expect(a.weekday).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(a.dayPart).toEqual({ morning: 1, day: 0, evening: 2, night: 0 });
    expect(a.totalDurationMs).toBe(180000);
    expect(a.weeks).toHaveLength(10);
    const last = a.weeks[9];
    expect(last[0].count).toBe(1); // Monday
    expect(last[2].count).toBe(2); // Wednesday (today)
    expect(last[3].count).toBeNull(); // Thursday is in the future
  });
});

describe("buildMatchTempo and buildPeriodSummary", () => {
  it("returns balls and minutes per match", () => {
    const t = buildMatchTempo([
      { participants: ["a", "b"], scores: { a: 8, b: 3 }, durationMs: 600000, date: "2024-01-02" },
      { participants: ["a", "b"], scores: { a: 1, b: 1 }, date: "2024-01-01" },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].Шары).toBe(11);
    expect(t[0].Минуты).toBe(10);
  });
  it("summarises a period and returns null when empty", () => {
    const players = [{ id: "a", name: "Anton" }, { id: "b", name: "Igor" }];
    expect(buildPeriodSummary(players, [])).toBeNull();
    const s = buildPeriodSummary(players, [
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 2 }, durationMs: 600000, date: "2024-01-01" },
      { participants: ["a", "b"], winnerId: "a", scores: { a: 8, b: 5 }, durationMs: 300000, date: "2024-01-02" },
    ]);
    expect(s.games).toBe(2);
    expect(s.mvp.name).toBe("Anton");
    expect(s.streak).toEqual({ name: "Anton", value: 2 });
    expect(s.durationMs).toBe(900000);
    expect(s.blowMargin).toBe(6);
  });
});

describe("normalizeData treats input as untrusted", () => {
  it("survives garbage without throwing", () => {
    [null, undefined, 5, "x", [], { players: "no", matches: 7, activeGame: "boom" }].forEach((bad) => {
      const out = normalizeData(bad);
      expect(out.players).toEqual([]);
      expect(out.matches).toEqual([]);
      expect(out.activeGames).toEqual([]);
    });
  });
  it("drops structurally broken players and matches, keeps good ones", () => {
    const out = normalizeData({
      players: [{ id: "a", name: "Ok" }, { name: "no id" }, null, { id: 5, name: "bad id" }],
      matches: [
        { id: "m1", participants: ["a"], date: "2024-01-01", scores: { a: 3 }, winnerId: "a" },
        { id: "m2", participants: "nope", date: "2024-01-01" },
        { id: "m3", participants: ["a"], date: "not a date" },
      ],
    });
    expect(out.players.map((p) => p.id)).toEqual(["a"]);
    expect(out.matches.map((m) => m.id)).toEqual(["m1"]);
  });
  it("clamps names, colors, scores and durations", () => {
    const out = normalizeData({
      players: [{ id: "a", name: "x".repeat(500), color: "red; background:url(//evil)" }],
      matches: [{ participants: ["a"], date: "2024-01-01", scores: { a: 1e12, b: "9" }, durationMs: -5 }],
    });
    expect(out.players[0].name).toHaveLength(40);
    expect(out.players[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(out.matches[0].scores).toEqual({ a: 999, b: 0 });
    expect(out.matches[0].durationMs).toBe(0);
    expect(typeof out.matches[0].id).toBe("string");
  });
  it("rejects an activeGame without a participants array", () => {
    expect(normalizeData({ activeGame: { participants: "a", scores: {} } }).activeGames).toEqual([]);
    const g = normalizeData({ activeGame: { participants: ["a"], scores: { a: 2 }, actionLog: [1, { pid: "a", prev: 1 }] } }).activeGames[0];
    // A game saved before the event log existed keeps its score as the base.
    expect(g.scores).toEqual({ a: 2 });
    expect(g.baseScores).toEqual({ a: 2 });
    expect(g.events).toEqual([]);
    expect(g.actionLog).toBeUndefined();
  });
});

describe("match trash", () => {
  const base = () => ({
    matches: [
      { id: "m1", participants: ["a", "b"], winnerId: "a", seriesId: "s1" },
      { id: "m2", participants: ["a", "b"], winnerId: "b" },
    ],
    trash: [],
    activeSeries: { id: "s1", wins: { a: 1 } },
  });
  it("moves a match to the trash instead of losing it, and undoes its series win", () => {
    const out = moveMatchToTrash(base(), "m1", 123);
    expect(out.matches.map((m) => m.id)).toEqual(["m2"]);
    expect(out.trash).toHaveLength(1);
    expect(out.trash[0]).toMatchObject({ id: "m1", deletedAt: 123 });
    expect(out.activeSeries.wins.a).toBe(0);
  });
  it("restores it with the series win back", () => {
    const back = restoreMatchFromTrash(moveMatchToTrash(base(), "m1", 1), "m1");
    expect(back.matches.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    expect(back.trash).toEqual([]);
    expect(back.matches.find((m) => m.id === "m1").deletedAt).toBeUndefined();
    expect(back.activeSeries.wins.a).toBe(1);
  });
  it("ignores unknown ids and caps the trash", () => {
    const d = base();
    expect(moveMatchToTrash(d, "nope")).toBe(d);
    expect(restoreMatchFromTrash(d, "nope")).toBe(d);
    let cur = { matches: Array.from({ length: 320 }, (_, i) => ({ id: "x" + i, participants: ["a"] })), trash: [], activeSeries: null };
    for (let i = 0; i < 320; i++) cur = moveMatchToTrash(cur, "x" + i, i);
    expect(cur.trash).toHaveLength(300);
  });
  it("normalizeData keeps the trash and sanitizes it", () => {
    const out = normalizeData({ trash: [{ id: "t", participants: ["a"], date: "2024-01-01", deletedAt: 5 }, { junk: true }] });
    expect(out.trash).toHaveLength(1);
    expect(out.trash[0].deletedAt).toBe(5);
    expect(normalizeData({}).trash).toEqual([]);
  });
});

describe("concurrent club edits", () => {
  const game = (extra = {}) =>
    normalizeData({ activeGame: { id: "g1", participants: ["a", "b"], scores: {}, events: [], startedAt: "2024-01-01T10:00:00Z", ...extra } })
      .activeGames[0];
  const tap = (g, id, pid, d, ts) => addGameEvent(g, { id, pid, d, ts });
  const state = (over = {}) => normalizeData({ players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], ...over });

  it("keeps both devices' taps on the same game", () => {
    const base = game();
    const d1 = { ...state(), activeGames: [tap(tap(base, "e1", "a", 1, 1), "e2", "a", 1, 3)], updatedAt: 3 };
    const d2 = { ...state(), activeGames: [tap(base, "e3", "b", 1, 2)], updatedAt: 2 };
    const m = mergeData(d1, d2);
    expect(m.activeGames[0].scores).toEqual({ a: 2, b: 1 });
    expect(mergeData(d2, d1).activeGames[0].scores).toEqual({ a: 2, b: 1 });
    // an old echo of our own earlier state changes nothing
    expect(mergeData(m, d1).activeGames[0].scores).toEqual({ a: 2, b: 1 });
    expect(mergeData(m, m).activeGames[0].events).toHaveLength(3);
  });

  it("undo marks an event undone and survives merging", () => {
    let g = tap(tap(game(), "e1", "a", 1, 1), "e2", "b", 1, 2);
    const other = { ...state(), activeGames: [g], updatedAt: 2 };
    expect(canUndoGame(g)).toBe(true);
    g = undoGameEvent(g);
    expect(g.scores).toEqual({ a: 1, b: 0 });
    const mine = { ...state(), activeGames: [g], updatedAt: 5 };
    expect(mergeData(other, mine).activeGames[0].scores).toEqual({ a: 1, b: 0 });
    expect(canUndoGame(undoGameEvent(g))).toBe(false);
  });

  it("clamps at zero and supports setting a score", () => {
    let g = tap(game(), "e1", "a", -1, 1);
    expect(g.scores.a).toBe(0);
    g = addGameEvent(g, { id: "e2", pid: "a", v: 7, ts: 2 });
    g = tap(g, "e3", "a", 1, 3);
    expect(g.scores.a).toBe(8);
  });

  it("a finished or cancelled game is not resurrected by another device", () => {
    const g = tap(game(), "e1", "a", 1, 1);
    const prev = { ...state(), activeGames: [g], updatedAt: 1 };
    const finished = stampChanges(prev, { ...prev, activeGames: [], matches: [{ id: "m1", participants: ["a", "b"], date: "2024-01-01" }] }, 10);
    expect(finished.endedGames).toEqual(["g1"]);
    const late = { ...prev, activeGames: [tap(g, "e2", "b", 1, 11)], updatedAt: 11 };
    const m = mergeData({ ...finished, updatedAt: 10 }, late);
    expect(m.activeGames).toEqual([]);
    expect(m.matches.map((x) => x.id)).toEqual(["m1"]);
  });

  it("merges matches added on different devices and keeps deletions", () => {
    const base = state({ matches: [{ id: "m0", participants: ["a"], date: "2024-01-01" }] });
    const d1 = stampChanges(base, { ...base, matches: [...base.matches, { id: "m1", participants: ["a"], date: "2024-01-02" }] }, 5);
    const del = { ...base, matches: [], trash: [{ ...base.matches[0], deletedAt: 6 }] };
    const m = mergeData({ ...d1, updatedAt: 5 }, { ...del, updatedAt: 6 });
    expect(m.matches.map((x) => x.id)).toEqual(["m1"]);
    expect(m.trash.map((x) => x.id)).toEqual(["m0"]);
    // restoring later wins over the older deletion
    const restored = stampChanges(del, { ...del, matches: [base.matches[0]], trash: [] }, 9);
    const m2 = mergeData(m, { ...restored, updatedAt: 9 });
    expect(m2.matches.map((x) => x.id)).toEqual(["m0", "m1"]);
    expect(m2.trash).toEqual([]);
  });

  it("an edit on one device and a new match on another both survive", () => {
    const base = state({ matches: [{ id: "m0", participants: ["a", "b"], date: "2024-01-01", scores: { a: 1, b: 0 }, winnerId: "a" }] });
    const edited = stampChanges(base, { ...base, matches: [{ ...base.matches[0], scores: { a: 3, b: 0 } }] }, 7);
    const added = stampChanges(base, { ...base, matches: [...base.matches, { id: "m1", participants: ["a"], date: "2024-01-03" }] }, 8);
    const m = mergeData({ ...edited, updatedAt: 7 }, { ...added, updatedAt: 8 });
    expect(m.matches.find((x) => x.id === "m0").scores).toEqual({ a: 3, b: 0 });
    expect(m.matches).toHaveLength(2);
  });

  it("player removal and addition on different devices both apply", () => {
    const base = state();
    const removed = stampChanges(base, { ...base, players: base.players.filter((p) => p.id !== "b") }, 3);
    const added = stampChanges(base, { ...base, players: [...base.players, { id: "c", name: "C" }] }, 4);
    const m = mergeData({ ...removed, updatedAt: 3 }, { ...added, updatedAt: 4 });
    expect(m.players.map((p) => p.id).sort()).toEqual(["a", "c"]);
    // bringing the player back later (e.g. restoring club history) wins over the removal
    const back = stampChanges(removed, { ...removed, players: [...removed.players, { id: "b", name: "B" }] }, 12);
    expect(mergeData(m, { ...back, updatedAt: 12 }).players.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("restoring a snapshot over a sabotage deletion isn't undone by other devices", () => {
    const base = state({ matches: [{ id: "m0", participants: ["a"], date: "2024-01-01" }] });
    const wiped = stampChanges(base, { ...base, players: [], matches: [], trash: [{ ...base.matches[0], deletedAt: 5 }] }, 5);
    const restored = stampChanges(wiped, normalizeData(base), 20);
    const m = mergeData({ ...restored, updatedAt: 20 }, { ...wiped, updatedAt: 5 });
    expect(m.matches.map((x) => x.id)).toEqual(["m0"]);
    expect(m.players).toHaveLength(2);
  });

  it("series/settings come from the side that changed them last, not the last tap", () => {
    const base = { ...state(), activeSeries: { id: "s", wins: {} } };
    const finished = stampChanges(base, { ...base, activeSeries: { id: "s", wins: { a: 1 } } }, 5);
    const tapper = { ...base, updatedAt: 9 };
    expect(mergeData({ ...finished, updatedAt: 5 }, tapper).activeSeries.wins).toEqual({ a: 1 });
  });
});

describe("forgotten game reminder", () => {
  const g = { startedAt: "2024-01-01T10:00:00Z", events: [{ id: "e", pid: "a", d: 1, ts: Date.parse("2024-01-01T11:00:00Z") }] };
  it("counts the last score change as activity", () => {
    expect(lastGameActivity(g)).toBe(Date.parse("2024-01-01T11:00:00Z"));
  });
  it("is stale only after two idle hours", () => {
    expect(isGameStale(g, Date.parse("2024-01-01T12:59:00Z"))).toBe(false);
    expect(isGameStale(g, Date.parse("2024-01-01T13:00:00Z"))).toBe(true);
    expect(isGameStale(null)).toBe(false);
  });
});

describe("who changed what", () => {
  const base = normalizeData({ matches: [{ id: "m0", participants: ["a"], date: "2024-01-01", createdBy: "Антон" }] });
  it("records the author of new, edited and deleted matches", () => {
    const added = stampChanges(base, { ...base, matches: [...base.matches, { id: "m1", participants: ["a"], date: "2024-01-02" }] }, 5, "Игорь");
    expect(added.matches[1]).toMatchObject({ createdBy: "Игорь", modifiedBy: "Игорь" });
    expect(added.matches[0].modifiedBy).toBe("");
    const edited = stampChanges(added, { ...added, matches: [{ ...added.matches[0], scores: { a: 5 } }, added.matches[1]] }, 6, "Сергей");
    expect(edited.matches[0]).toMatchObject({ createdBy: "Антон", modifiedBy: "Сергей" });
    const deleted = stampChanges(edited, moveMatchToTrash(edited, "m1", 7), 7, "Пётр");
    expect(deleted.trash[0]).toMatchObject({ id: "m1", deletedBy: "Пётр" });
    const back = stampChanges(deleted, restoreMatchFromTrash(deleted, "m1"), 8, "Анна");
    expect(back.matches.find((m) => m.id === "m1").deletedBy).toBeUndefined();
    const again = stampChanges(back, moveMatchToTrash(back, "m1", 9), 9, "Олег");
    expect(again.trash[0].deletedBy).toBe("Олег");
  });
  it("keeps the author on score events", () => {
    const g = normalizeData({ activeGame: { id: "g", participants: ["a"], events: [] } }).activeGames[0];
    expect(addGameEvent(g, { id: "e", pid: "a", d: 1, ts: 1, by: "Антон" }).events[0].by).toBe("Антон");
  });
});

describe("parallel games", () => {
  const players = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" }];
  const g = (id, participants, startedAt) => normalizeData({ activeGames: [{ id, participants, events: [], startedAt }] }).activeGames[0];
  const tap = (game, id, pid, ts) => addGameEvent(game, { id, pid, d: 1, ts });

  it("keeps two games started on different devices", () => {
    const one = { ...normalizeData({ players }), activeGames: [g("g1", ["a", "b"], "2024-01-01T10:00:00Z")], updatedAt: 1 };
    const two = { ...normalizeData({ players }), activeGames: [g("g2", ["c", "d"], "2024-01-01T10:05:00Z")], updatedAt: 2 };
    const m = mergeData(one, two);
    expect(m.activeGames.map((x) => x.id)).toEqual(["g1", "g2"]);
    expect(mergeData(two, one).activeGames.map((x) => x.id)).toEqual(["g1", "g2"]);
  });

  it("finishing one game leaves the other running everywhere", () => {
    const both = { ...normalizeData({ players }), activeGames: [g("g1", ["a", "b"], "1"), g("g2", ["c", "d"], "2")], updatedAt: 1 };
    const done = stampChanges(both, { ...both, activeGames: both.activeGames.filter((x) => x.id !== "g1") }, 5);
    expect(done.endedGames).toEqual(["g1"]);
    const otherDevice = { ...both, activeGames: [tap(both.activeGames[0], "e1", "a", 6), tap(both.activeGames[1], "e2", "c", 6)], updatedAt: 6 };
    const m = mergeData({ ...done, updatedAt: 5 }, otherDevice);
    expect(m.activeGames.map((x) => x.id)).toEqual(["g2"]);
    expect(m.activeGames[0].scores).toEqual({ c: 1, d: 0 });
  });

  it("reads the single game stored by older versions", () => {
    const d = normalizeData({ activeGame: { id: "old", participants: ["a", "b"], scores: { a: 2 } } });
    expect(d.activeGames.map((x) => x.id)).toEqual(["old"]);
    expect(normalizeData({ activeGame: { id: "old", participants: ["a"] }, endedGames: ["old"] }).activeGames).toEqual([]);
  });

  it("knows which players are busy at another table", () => {
    const games = [g("g1", ["a", "b"], "1"), g("g2", ["c"], "2")];
    expect([...busyPlayerIds(games)].sort()).toEqual(["a", "b", "c"]);
    expect([...busyPlayerIds(games, "g1")]).toEqual(["c"]);
  });
});

describe("kolhoz rounds", () => {
  // Ваня → Сергей → Антон → Ваня
  const start = () =>
    normalizeData({ activeGames: [{ id: "k", participants: ["v", "s", "a"], events: [], kolhoz: { order: ["v", "s", "a"], rounds: [] } }] }).activeGames[0];
  const pts = (game, id, pid, d, ts) => addGameEvent(game, { id, pid, d, ts });

  it("each player wins from the next one in the circle", () => {
    expect(kolhozVictim(["v", "s", "a"], "v")).toBe("s");
    expect(kolhozVictim(["v", "s", "a"], "a")).toBe("v");
    let g = pts(pts(start(), "1", "v", 10, 1), "2", "s", 4, 2);
    const set = kolhozSettlement(g.participants, kolhozAllRounds(g));
    expect(set.v.s).toBe(10); // Сергей должен Ване 10
    expect(set.s.v).toBe(-10);
    expect(set.s.a).toBe(4);
    expect(set.a.v).toBe(0);
    expect(kolhozNet(set)).toEqual({ v: 10, s: -6, a: -4 });
  });

  it("changing positions freezes the round and starts scoring from zero", () => {
    let g = pts(start(), "1", "v", 10, 1);
    const next = kolhozSuggestOrder(g.kolhoz.order);
    expect(next).toEqual(["v", "a", "s"]); // теперь Ваня забивает Антону
    g = startKolhozRound(g, next);
    expect(g.scores).toEqual({ v: 0, s: 0, a: 0 });
    expect(g.kolhoz.rounds).toHaveLength(1);
    g = pts(g, "2", "v", 3, 2);
    expect(g.events[1].r).toBe(1);
    const set = kolhozSettlement(g.participants, kolhozAllRounds(g));
    expect(set.v).toEqual({ s: 10, a: 3 });
    expect(kolhozGross(g.participants, kolhozAllRounds(g))).toEqual({ v: 13, s: 0, a: 0 });
    expect(gameStandings(g)).toEqual({ v: 13, s: -10, a: -3 });
  });

  it("undo only touches the current round", () => {
    let g = startKolhozRound(pts(start(), "1", "v", 5, 1), ["v", "a", "s"]);
    expect(canUndoGame(g)).toBe(false);
    g = undoGameEvent(g);
    expect(kolhozAllRounds(g)[0].scores.v).toBe(5);
  });

  it("swap and reorder before the round starts", () => {
    expect(kolhozSwap(["v", "s", "a"], 0, 2)).toEqual(["a", "s", "v"]);
    expect(setKolhozOrder(start(), ["s", "v", "a"]).kolhoz.order).toEqual(["s", "v", "a"]);
  });

  it("a round closed on one device isn't lost when merging", () => {
    const base = { ...normalizeData({}), activeGames: [pts(start(), "1", "v", 2, 1)], updatedAt: 1 };
    const closed = { ...base, activeGames: [startKolhozRound(base.activeGames[0], ["v", "a", "s"])], updatedAt: 2 };
    const m = mergeData(base, closed);
    expect(m.activeGames[0].kolhoz.rounds).toHaveLength(1);
    expect(m.activeGames[0].kolhoz.order).toEqual(["v", "a", "s"]);
    expect(mergeData(closed, base).activeGames[0].kolhoz.rounds).toHaveLength(1);
  });

  it("drops a non-numeric settlement from untrusted club data", () => {
    const out = normalizeData({ matches: [{ id: "m", participants: ["a", "b"], date: "2024-01-01", settlement: { a: { b: { evil: 1 } }, b: "x" } }] });
    expect(out.matches[0].settlement).toEqual({ a: { b: 0 } });
  });
});

describe("playing for money", () => {
  it("kolhoz: stake per point between every pair", () => {
    const settlement = { v: { s: 10, a: -3 }, s: { v: -10, a: 4 }, a: { v: 3, s: -4 } };
    const m = { participants: ["v", "s", "a"], mode: "kolhoz", settlement, stake: 200 };
    expect(buildPayments(m)).toEqual([
      { from: "s", to: "v", amount: 2000 },
      { from: "v", to: "a", amount: 600 },
      { from: "a", to: "s", amount: 800 },
    ]);
    expect(moneyBalance([m])).toEqual({ v: 1400, s: -1200, a: -200 });
  });
  it("other games: every loser pays the winner the stake", () => {
    expect(buildPayments({ participants: ["a", "b", "c"], winnerId: "a", stake: 500 })).toEqual([
      { from: "b", to: "a", amount: 500 },
      { from: "c", to: "a", amount: 500 },
    ]);
    expect(buildPayments({ participants: ["a", "b"], winnerId: "a" })).toEqual([]);
    expect(buildPayments({ participants: ["a"], winnerId: "a", stake: 100, solo: true })).toEqual([]);
  });
  it("cleans stakes from untrusted data and formats rubles", () => {
    expect(cleanStake("200")).toBe(200);
    expect(cleanStake(-5)).toBe(0);
    expect(cleanStake(1e12)).toBe(1000000);
    expect(normalizeData({ matches: [{ id: "m", participants: ["a"], date: "2024-01-01", stake: "x" }] }).matches[0].stake).toBe(0);
    expect(formatRub(-2600).replace(/\s/g, " ")).toBe("−2 600 ₽");
  });
});

describe("club data written by a careless or hostile member can't crash the app", () => {
  it("drops broken series, bracket and game fields", () => {
    const out = normalizeData({
      russianMode: "constructor",
      activeSeries: { participants: "x", targetWins: {} },
      activeBracket: { rounds: "nope" },
      activeGames: [{ id: "g", participants: ["a", "b"], gameType: "evil", mode: "__proto__", targets: { a: { x: 1 } }, startedBy: { n: 1 }, bracketRound: "1" }],
      matches: [{ id: "m", participants: ["a"], date: "2024-01-01", gameType: 5, mode: "toString" }],
    });
    expect(out.russianMode).toBe("free");
    expect(out.activeSeries).toBeNull();
    expect(out.activeBracket).toBeNull();
    const g = out.activeGames[0];
    expect(g).toMatchObject({ gameType: "russian", mode: null, targets: { a: 0 }, startedBy: "", bracketRound: null });
    expect(out.matches[0]).toMatchObject({ gameType: "russian", mode: null });
  });
  it("keeps a valid series and bracket", () => {
    const out = normalizeData({
      activeSeries: { id: "s", targetWins: 2, participants: ["a", "b"], wins: { a: 1 } },
      activeBracket: { id: "b", participants: ["a", "b", "c", "d"], rounds: [[{ a: "a", b: "b", winnerId: null }, { a: "c", b: "d", winnerId: "c" }], [{ a: null, b: "c", winnerId: null }]], champion: null },
    });
    expect(out.activeSeries).toMatchObject({ targetWins: 2, bestOf: 3, wins: { a: 1 } });
    expect(out.activeBracket.rounds[0][1].winnerId).toBe("c");
  });
});

describe("club races found in review", () => {
  it("a kolhoz tap that arrives after the positions were changed still counts", () => {
    const start = normalizeData({ activeGames: [{ id: "k", participants: ["v", "s", "a"], events: [], kolhoz: { order: ["v", "s", "a"], rounds: [] } }] }).activeGames[0];
    const both = addGameEvent(start, { id: "e1", pid: "v", d: 2, ts: 1 });
    // device A changes positions before B's tap (e2, same round) reaches it
    const deviceA = { ...normalizeData({}), activeGames: [startKolhozRound(both, ["v", "a", "s"])], updatedAt: 3 };
    const deviceB = { ...normalizeData({}), activeGames: [addGameEvent(both, { id: "e2", pid: "s", d: 5, ts: 2 })], updatedAt: 2 };
    const g = mergeData(deviceA, deviceB).activeGames[0];
    expect(g.kolhoz.rounds).toHaveLength(1);
    expect(kolhozAllRounds(g)[0].scores).toEqual({ v: 2, s: 5, a: 0 });
    expect(g.scores).toEqual({ v: 0, s: 0, a: 0 });
  });

  it("two bracket matches finished on different devices both advance", () => {
    const bracket = {
      id: "b",
      participants: ["a", "b", "c", "d"],
      rounds: [[{ a: "a", b: "b", winnerId: null }, { a: "c", b: "d", winnerId: null }], [{ a: null, b: null, winnerId: null }]],
      champion: null,
    };
    const base = normalizeData({ activeBracket: bracket });
    const one = stampChanges(base, { ...base, activeBracket: { ...bracket, rounds: [[{ a: "a", b: "b", winnerId: "a" }, bracket.rounds[0][1]], [{ a: "a", b: null, winnerId: null }]] } }, 5);
    const two = stampChanges(base, { ...base, activeBracket: { ...bracket, rounds: [[bracket.rounds[0][0], { a: "c", b: "d", winnerId: "d" }], [{ a: null, b: "d", winnerId: null }]] } }, 6);
    const m = mergeData({ ...one, updatedAt: 5 }, { ...two, updatedAt: 6 });
    expect(m.activeBracket.rounds[0].map((x) => x.winnerId)).toEqual(["a", "d"]);
    expect(m.activeBracket.rounds[1][0]).toMatchObject({ a: "a", b: "d" });
  });
});

describe("kolhoz with a trimmed event log", () => {
  it("keeps the snapshot of a round whose first events were cut off", () => {
    let g = normalizeData({ activeGames: [{ id: "k", participants: ["v", "s"], events: [], kolhoz: { order: ["v", "s"], rounds: [] } }] }).activeGames[0];
    for (let i = 0; i < 1600; i++) g = addGameEvent(g, { id: `a${i}`, pid: i % 2 ? "s" : "v", d: 1, ts: i });
    g = startKolhozRound(g, ["s", "v"]); // round 1 frozen at 800 : 800
    for (let i = 0; i < 1500; i++) g = addGameEvent(g, { id: `b${i}`, pid: "s", d: 1, ts: 5000 + i });
    expect(g.events).toHaveLength(3000); // the 100 oldest first-round taps are gone
    expect(kolhozAllRounds(g)[0].scores).toEqual({ v: 800, s: 800 });
  });
});

describe("kolhoz log cap is tracked, not guessed", () => {
  it("a full but untrimmed log still recomputes rounds (late tap counted)", () => {
    let g = normalizeData({ activeGames: [{ id: "k", participants: ["v", "s"], events: [], kolhoz: { order: ["v", "s"], rounds: [] } }] }).activeGames[0];
    for (let i = 0; i < 1499; i++) g = addGameEvent(g, { id: `a${i}`, pid: i % 2 ? "s" : "v", d: 1, ts: i });
    const beforeChange = g;
    g = startKolhozRound(g, ["s", "v"]);
    for (let i = 0; i < 1500; i++) g = addGameEvent(g, { id: `b${i}`, pid: "s", d: 1, ts: 5000 + i });
    const late = addGameEvent(beforeChange, { id: "late", pid: "s", d: 1, ts: 1499 });
    const m = mergeData({ ...normalizeData({}), activeGames: [g], updatedAt: 2 }, { ...normalizeData({}), activeGames: [late], updatedAt: 1 }).activeGames[0];
    expect(m.events).toHaveLength(3000);
    expect(m.trimmedRound).toBe(-1);
    expect(kolhozAllRounds(m)[0].scores).toEqual({ v: 750, s: 750 });
  });
  it("remembers which round lost events", () => {
    let g = normalizeData({ activeGames: [{ id: "k", participants: ["v", "s"], events: [], kolhoz: { order: ["v", "s"], rounds: [] } }] }).activeGames[0];
    for (let i = 0; i < 3001; i++) g = addGameEvent(g, { id: `a${i}`, pid: "v", d: 0, ts: i });
    expect(g.trimmedRound).toBe(0);
    expect(normalizeData({ activeGames: [g] }).activeGames[0].trimmedRound).toBe(0);
  });
});

describe("trim marker from older versions and untrusted data", () => {
  const full = (extra) =>
    normalizeData({
      activeGames: [
        {
          id: "k",
          participants: ["v", "s"],
          events: Array.from({ length: 3000 }, (_, i) => ({ id: `e${i}`, pid: "v", d: 1, ts: i, ...(i >= 100 ? { r: 1 } : {}) })),
          kolhoz: { order: ["v", "s"], rounds: [{ order: ["v", "s"], scores: { v: 400, s: 0 } }] },
          ...extra,
        },
      ],
    }).activeGames[0];
  it("a full log saved without the marker keeps the round snapshot", () => {
    const g = full({});
    expect(g.trimmedRound).toBe(0);
    expect(kolhozAllRounds(g)[0].scores.v).toBe(400);
  });
  it("an invalid marker is replaced, a valid one kept", () => {
    expect(full({ trimmedRound: 5000 }).trimmedRound).toBe(0);
    expect(full({ trimmedRound: "x" }).trimmedRound).toBe(0);
    expect(full({ trimmedRound: -1 }).trimmedRound).toBe(-1);
  });
});
