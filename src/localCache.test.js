import { expect, it } from "vitest";
import { cacheAcceptedState } from "./localCache.js";
import { normalizeData, mergeData } from "./gameLogic.js";

it("retains a received club match across an offline restart", () => {
  const values = new Map();
  const storage = { setItem: (k, v) => values.set(k, v), getItem: (k) => values.get(k) };
  const local = normalizeData({});
  const remote = normalizeData({ matches: [{ id: "remote", date: "2026-01-01", participants: ["a"], scores: { a: 8 } }] });
  cacheAcceptedState(storage, "data", mergeData(local, remote));
  const restartedOffline = normalizeData(JSON.parse(storage.getItem("data")));
  expect(restartedOffline.matches[0].id).toBe("remote");
  expect(restartedOffline.matches[0].scores.a).toBe(8);
});

it("reports unavailable storage instead of claiming a successful local copy", () => {
  const storage = { setItem: () => { throw new Error("quota"); } };
  expect(() => cacheAcceptedState(storage, "data", {})).toThrow("quota");
});
