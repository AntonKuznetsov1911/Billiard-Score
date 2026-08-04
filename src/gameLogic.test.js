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
});
