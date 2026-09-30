import { describe, it, expect, vi } from "vitest";
import { mergeData, normalizeData, addGameEvent } from "./gameLogic.js";

// In-memory stand-in for the `club_state` row with PostgREST-like filtering:
// an update only applies when every .eq() filter matches, like the real table.
const row = { club_id: "c1", data: null, updated_at: "t0" };
let version = 0;
let beforeWrite = null;

vi.mock("./supabaseClient.js", () => {
  const from = () => {
    const filters = {};
    let patch = null;
    const q = {
      select: () => q,
      update: (p) => ((patch = p), q),
      eq: (k, v) => ((filters[k] = v), q),
      maybeSingle: async () => ({ data: { data: row.data, updated_at: row.updated_at }, error: null }),
      then: async (resolve) => {
        if (beforeWrite) {
          const hook = beforeWrite;
          beforeWrite = null;
          await hook();
        }
        const ok = Object.entries(filters).every(([k, v]) => row[k] === v);
        if (patch && ok) Object.assign(row, patch, { updated_at: `t${++version}` });
        resolve({ data: ok ? [{ club_id: row.club_id }] : [], error: null });
      },
    };
    return q;
  };
  return { supabase: { from } };
});

const { pushClubState } = await import("./clubSync.js");
const merge = (local, remoteRaw) => mergeData(local, normalizeData(remoteRaw));

describe("pushClubState", () => {
  it("two devices writing at the same moment both keep their taps", async () => {
    const game = normalizeData({ activeGame: { id: "g", participants: ["a", "b"], scores: {}, events: [] } });
    row.data = { ...game, updatedAt: 1 };
    const deviceA = { ...game, activeGame: addGameEvent(game.activeGame, { id: "e1", pid: "a", d: 1, ts: 2 }), updatedAt: 2 };
    const deviceB = { ...game, activeGame: addGameEvent(game.activeGame, { id: "e2", pid: "b", d: 1, ts: 3 }), updatedAt: 3 };
    // B's write lands between A's read and A's write → A's compare-and-swap fails and retries.
    beforeWrite = () => pushClubState("c1", deviceB, merge);
    await pushClubState("c1", deviceA, merge);
    expect(normalizeData(row.data).activeGame.scores).toEqual({ a: 1, b: 1 });
  });
});
