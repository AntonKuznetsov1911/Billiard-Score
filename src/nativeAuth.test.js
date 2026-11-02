import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), addListener: vi.fn(), getLaunchUrl: vi.fn() }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: mocks.open, close: mocks.close } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.addListener, getLaunchUrl: mocks.getLaunchUrl } }));
vi.mock("./native.js", () => ({ isNativeApp: () => true }));
import { NATIVE_AUTH_REDIRECT, parseNativeAuthUrl, startNativeGoogleSignIn, finishNativeGoogleSignIn, listenForNativeGoogleSignIn } from "./nativeAuth.js";
let values;
const makeClient = () => ({ auth: { signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null }), exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "test" } } }, error: null }) } });
beforeEach(() => {
  vi.clearAllMocks(); values = new Map();
  vi.stubGlobal("window", { localStorage: { setItem: (k, v) => values.set(k, v), getItem: (k) => values.get(k) ?? null, removeItem: (k) => values.delete(k) } });
  mocks.open.mockResolvedValue(); mocks.close.mockResolvedValue(); mocks.getLaunchUrl.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
it("requests a native redirect and opens the system browser", async () => {
  const c = makeClient(); await startNativeGoogleSignIn(c);
  expect(c.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", options: expect.objectContaining({ redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true }) }));
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ url: "https://test.supabase.co/auth/v1/authorize?provider=google" }));
});
it("accepts only the exact app callback and rejects implicit tokens", () => {
  expect(parseNativeAuthUrl(NATIVE_AUTH_REDIRECT + "?code=ok")).toEqual({ code: "ok" });
  for (const u of ["https://example.com/?code=bad", "io.github.antonkuznetsov1911.billiard://evil/callback?code=bad", NATIVE_AUTH_REDIRECT + "/extra?code=x", NATIVE_AUTH_REDIRECT + "#access_token=bad", NATIVE_AUTH_REDIRECT + "?code=a&code=b"]) expect(parseNativeAuthUrl(u)).toBeNull();
});
it("exchanges duplicate warm/cold callbacks only once", async () => {
  const c = makeClient(); await startNativeGoogleSignIn(c);
  const url = NATIVE_AUTH_REDIRECT + "?code=duplicate-test";
  expect(await Promise.all([finishNativeGoogleSignIn(c, url), finishNativeGoogleSignIn(c, url)])).toEqual([true, true]);
  expect(c.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  expect(await finishNativeGoogleSignIn(c, url)).toBe(false); expect(values.size).toBe(0);
});
it("ignores unsolicited callbacks", async () => {
  const c = makeClient(); expect(await finishNativeGoogleSignIn(c, NATIVE_AUTH_REDIRECT + "?code=unsolicited")).toBe(false);
  expect(c.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("reports expired and denied login without leaking provider details", async () => {
  const c = makeClient(); values.set("billiards-google-login", String(Date.now() - 11 * 60000));
  await expect(finishNativeGoogleSignIn(c, NATIVE_AUTH_REDIRECT + "?code=expired")).rejects.toThrow(/истекло/);
  await startNativeGoogleSignIn(c);
  await expect(finishNativeGoogleSignIn(c, NATIVE_AUTH_REDIRECT + "?error=access_denied&error_description=private-data")).rejects.toThrow(/отменён/);
  expect(c.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(parseNativeAuthUrl(NATIVE_AUTH_REDIRECT + "#error=access_denied")).toMatchObject({ error: expect.any(String) });
});
it("clears a pending login when opening Chrome fails", async () => {
  mocks.open.mockRejectedValue(new Error("not available"));
  await expect(startNativeGoogleSignIn(makeClient())).rejects.toThrow("not available"); expect(values.size).toBe(0);
});
it("handles a killed-app launch URL after listener registration", async () => {
  const c = makeClient(); await startNativeGoogleSignIn(c);
  const remove = vi.fn(); mocks.addListener.mockResolvedValue({ remove });
  mocks.getLaunchUrl.mockResolvedValue({ url: NATIVE_AUTH_REDIRECT + "?code=cold-start" });
  const onSuccess = vi.fn(), onError = vi.fn(); const stop = listenForNativeGoogleSignIn(c, { onSuccess, onError });
  await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(c.auth.exchangeCodeForSession).toHaveBeenCalledWith("cold-start"); expect(onError).not.toHaveBeenCalled();
  stop(); expect(remove).toHaveBeenCalledOnce();
});
it("removes listeners registered after disposal", async () => {
  let resolve; mocks.addListener.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const stop = listenForNativeGoogleSignIn(makeClient(), { onSuccess: vi.fn(), onError: vi.fn() }); stop();
  const remove = vi.fn(); resolve({ remove }); await Promise.resolve();
  expect(remove).toHaveBeenCalledOnce(); expect(mocks.getLaunchUrl).not.toHaveBeenCalled();
});
