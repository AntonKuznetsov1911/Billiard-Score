import { it, expect } from "vitest";
import { acceptedClubTerms, acceptClubTerms, blockedClubs, setClubBlocked } from "./clubSafety.js";
function storage() { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; }
it("requires separate acceptance for each account and handles broken storage", () => {
  const s = storage();
  expect(acceptedClubTerms(s, "a")).toBe(false);
  acceptClubTerms(s, "a");
  expect(acceptedClubTerms(s, "a")).toBe(true);
  expect(acceptedClubTerms(s, "b")).toBe(false);
  expect(acceptedClubTerms({ getItem() { throw Error(); } }, "a")).toBe(false);
  expect(() => acceptClubTerms({ ...s, setItem() { throw Error(); } }, "b")).toThrow();
});
it("blocks only the selected club and account, persists across reads and can unblock", () => {
  const s = storage(); const club = { id: "club1", name: "Тест" };
  setClubBlocked(s, "a", club, true); setClubBlocked(s, "a", club, true);
  expect(blockedClubs(s, "a")).toEqual([club]);
  expect(blockedClubs(s, "b")).toEqual([]);
  setClubBlocked(s, "a", club, false);
  expect(blockedClubs(s, "a")).toEqual([]);
});
