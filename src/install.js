// "Install the app" support. Chrome (Android, desktop) fires
// beforeinstallprompt once, often before React has rendered, so it is caught
// here at startup and kept until the user taps "Установить".
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function initInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the browser's mini-bar
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function canPromptInstall() {
  return !!deferred;
}

export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return !!(choice && choice.outcome === "accepted");
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Already running as an installed app (home-screen icon or the store app).
export function isInstalled() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return !!(standalone || window.navigator.standalone);
}

export function deviceKind() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
