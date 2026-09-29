import { describe, it, expect } from "vitest";
import { listSafetyCopies, saveSafetyCopy, maybeAutoSafetyCopy } from "./safety.js";

const fake = (limit = Infinity) => {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => {
      if (v.length > limit) throw new Error("quota");
      m[k] = v;
    },
  };
};
const data = (n) => ({ players: [{ id: "a" }], matches: Array.from({ length: n }, (_, i) => ({ id: String(i) })), activeGame: { x: 1 } });

describe("safety copies", () => {
  it("does not store empty data", () => {
    const s = fake();
    expect(saveSafetyCopy(s, { players: [], matches: [] }, "x")).toBe(false);
    expect(listSafetyCopies(s)).toEqual([]);
  });
  it("keeps newest first, at most 5, and drops the running game", () => {
    const s = fake();
    for (let i = 1; i <= 7; i++) saveSafetyCopy(s, data(i), "r", i);
    const list = listSafetyCopies(s);
    expect(list).toHaveLength(5);
    expect(list[0].matches).toBe(7);
    expect(list[0].data.activeGame).toBeNull();
  });
  it("drops the oldest copies when storage quota is hit", () => {
    const one = JSON.stringify([{ ts: 1, reason: "r", matches: 3, players: 1, data: data(3) }]).length;
    const s = fake(one * 2.5);
    for (let i = 0; i < 5; i++) saveSafetyCopy(s, data(3), "r", i + 1);
    expect(listSafetyCopies(s).length).toBeGreaterThan(0);
    expect(listSafetyCopies(s).length).toBeLessThan(5);
  });
  it("auto copy: once a day and only when data changed", () => {
    const s = fake();
    const day = 86400000;
    expect(maybeAutoSafetyCopy(s, data(2), 1000)).toBe(true);
    expect(maybeAutoSafetyCopy(s, data(3), 1000 + day / 2)).toBe(false); // too soon
    expect(maybeAutoSafetyCopy(s, data(2), 1000 + day * 2)).toBe(false); // unchanged
    expect(maybeAutoSafetyCopy(s, data(3), 1000 + day * 2)).toBe(true);
  });
  it("survives corrupted storage", () => {
    const s = fake();
    s.setItem("billiards-safety-copies", "{not json");
    expect(listSafetyCopies(s)).toEqual([]);
  });
});
