import { describe, it, expect } from "vitest";
import {
  uid,
  loadInitial,
  normalizeData,
  formatDuration,
  computeStats,
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
    expect(initial.theme).toBe("dark");
    expect(initial.gameType).toBe("russian");
    expect(initial.russianMode).toBe("free");
  });
});

describe("normalizeData", () => {
  it("fills in missing fields and assigns avatar colors to players without one", () => {
    const out = normalizeData({ players: [{ id: "p1", name: "Anton" }] });
    expect(out.players[0].color).toBeTruthy();
    expect(out.matches).toEqual([]);
    expect(out.theme).toBe("dark");
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
