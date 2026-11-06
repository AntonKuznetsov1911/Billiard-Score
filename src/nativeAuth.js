import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "./native.js";

export const NATIVE_AUTH_REDIRECT = "io.github.antonkuznetsov1911.billiard://auth/callback";
const PENDING_KEY = "billiards-google-login";
const MAX_AGE = 10 * 60 * 1000;
const inFlight = new Map();
const completed = new Set();

export function parseNativeAuthUrl(raw) {
  try {
    const url = new URL(raw);
    const expected = new URL(NATIVE_AUTH_REDIRECT);
    if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.username || url.password) return null;
    if (url.searchParams.has("error") || new URLSearchParams(url.hash.slice(1)).has("error")) return { error: "Вход через Google отменён или не завершён. Попробуйте ещё раз." };
    if (url.hash) return null;
    const codes = url.searchParams.getAll("code");
    if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) return null;
    return { code: codes[0] };
  } catch { return null; }
}

export async function startNativeGoogleSignIn(client) {
  if (inFlight.size) throw new Error("Завершаем вход. Подождите несколько секунд.");
  // PKCE verifier is saved by Supabase in this app's storage, never in Chrome.
  window.localStorage.setItem(PENDING_KEY, String(Date.now()));
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
    if (!data?.url || new URL(data.url).protocol !== "https:") throw new Error("Не удалось открыть вход через Google");
    await Browser.open({ url: data.url, toolbarColor: "#0A2B20" });
  } catch (error) {
    window.localStorage.removeItem(PENDING_KEY);
    throw error;
  }
}

export async function finishNativeGoogleSignIn(client, raw) {
  const callback = parseNativeAuthUrl(raw);
  if (!callback) return false;
  if (callback.code && completed.has(callback.code)) return false;
  if (callback.code && inFlight.has(callback.code)) return inFlight.get(callback.code);
  const started = Number(window.localStorage.getItem(PENDING_KEY));
  if (!started) return false; // unsolicited deep link, no sign-in initiated here
  if (Date.now() - started > MAX_AGE || started > Date.now() + 60000) {
    window.localStorage.removeItem(PENDING_KEY);
    throw new Error("Время входа истекло. Нажмите «Войти через Google» ещё раз.");
  }
  const finish = async () => {
    try {
      if (callback.error) throw new Error(callback.error);
      const { data, error } = await client.auth.exchangeCodeForSession(callback.code);
      if (error || !data?.session) throw new Error("Не удалось завершить вход. Повторите вход через Google на этом телефоне.");
      completed.add(callback.code);
      if (completed.size > 20) completed.delete(completed.values().next().value);
      return true;
    } finally {
      window.localStorage.removeItem(PENDING_KEY);
      // Android returns to the Activity through the intent. On iOS close the browser.
      await Browser.close().catch(() => {});
    }
  };
  const result = finish();
  if (callback.code) inFlight.set(callback.code, result);
  try { return await result; }
  finally { if (callback.code) inFlight.delete(callback.code); }
}

export function listenForNativeGoogleSignIn(client, { onSuccess, onError }) {
  if (!isNativeApp() || !client) return () => {};
  let disposed = false;
  let handle;
  const receive = ({ url } = {}) => {
    if (disposed || !url) return;
    finishNativeGoogleSignIn(client, url)
      .then((handled) => { if (!disposed && handled) onSuccess(); })
      .catch((error) => { if (!disposed) onError(error); });
  };
  App.addListener("appUrlOpen", receive).then(async (subscription) => {
    if (disposed) { subscription.remove(); return; }
    handle = subscription;
    // A callback may launch a killed app; warm-app events alone are insufficient.
    const launch = await App.getLaunchUrl();
    if (!disposed && launch) receive(launch);
  }).catch(() => { if (!disposed) onError(new Error("Не удалось подготовить вход через Google. Перезапустите приложение.")); });
  return () => { disposed = true; handle?.remove(); };
}
