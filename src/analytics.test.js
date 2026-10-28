import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn(async () => ({ error: null }));
vi.mock("./supabaseClient.js", () => ({ supabase: { rpc: (...a) => rpc(...a) } }));

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
  navigator: { webdriver: false },
  matchMedia: () => ({ matches: false }),
};

const { pingUsage } = await import("./analytics.js");

describe("anonymous usage ping", () => {
  beforeEach(() => {
    store.clear();
    rpc.mockClear();
    window.navigator.webdriver = false;
  });

  it("reports once a day with a stable random device id", async () => {
    await pingUsage();
    await pingUsage();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("ping_app");
    expect(args.p_device).toMatch(/^[0-9a-f-]{36}$/);
    expect(args.p_platform).toBe("web");
    store.delete("billiards-usage-day"); // next day
    await pingUsage();
    expect(rpc.mock.calls[1][1].p_device).toBe(args.p_device);
  });

  it("is silent in automated test browsers", async () => {
    window.navigator.webdriver = true;
    await pingUsage();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tries again later when the server can't be reached", async () => {
    rpc.mockImplementationOnce(async () => ({ error: { code: "fetch_failed" } }));
    await pingUsage();
    await pingUsage();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
