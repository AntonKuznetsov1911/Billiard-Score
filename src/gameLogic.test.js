import { describe, it, expect } from "vitest";
import {
  uid,
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
  buildBracketRounds,
  bracketRoundLabel,
  buildKolhozSettlement,
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
    expect(initial.activeGame).toBeNull();
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
      expect(out.activeGame).toBeNull();
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
    expect(normalizeData({ activeGame: { participants: "a", scores: {} } }).activeGame).toBeNull();
    const g = normalizeData({ activeGame: { participants: ["a"], scores: { a: 2 }, actionLog: [1, { pid: "a", prev: 1 }] } }).activeGame;
    expect(g.actionLog).toEqual([{ pid: "a", prev: 1 }]);
  });
});
