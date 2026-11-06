import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } }, error: null })),
}));
vi.mock("./supabaseClient.js", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, auth: { getUser: mocks.getUser } } }));
import { joinClub } from "./clubSync.js";
describe("club join authorization boundary", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.getUser.mockClear();
  });
  it("accepts a successful authorized RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "club1" }, error: null });
    expect(await joinClub(" abcd2345 ", "Антон")).toEqual({ id: "club1" });
    expect(mocks.rpc).toHaveBeenCalledWith("join_club_by_code", { p_code: "ABCD2345", p_display_name: "Антон" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not fall back to table reads when the protected RPC is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(joinClub("ABCD2345", "Антон")).rejects.toThrow("настроек сервера");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("honors the server throttle", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "too_many_attempts" } });
    await expect(joinClub("ABCD2345", "Антон")).rejects.toThrow("15 минут");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects an unrecognized invite without a second request", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(joinClub("ABCD2345", "Антон")).rejects.toThrow("не найден");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
