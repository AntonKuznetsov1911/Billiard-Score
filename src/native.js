// Running inside the Android/iOS app (Capacitor) rather than a browser.
// There the store delivers updates (no service worker) and web-only sign-in
// redirects (Google, email links) can't come back into the app.
export function isNativeApp() {
  try {
    return !!(typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}
