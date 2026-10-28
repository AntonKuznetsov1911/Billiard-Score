// Telegram Mini App helpers; everything no-ops outside Telegram.
// The Telegram WebApp script isn't loaded any more (the Mini App isn't used),
// so these stay dormant; to bring the Mini App back, add
// <script src="https://telegram.org/js/telegram-web-app.js"></script> to index.html
// and https://telegram.org to script-src of the CSP in vite.config.js.
export function getTG() {
  try {
    // The script defines Telegram.WebApp in any browser; initData is only
    // filled in when the app is really opened from Telegram.
    if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      return window.Telegram.WebApp;
    }
  } catch (e) {
    // not inside Telegram
  }
  return null;
}

export function haptic(type) {
  const tg = getTG();
  if (!tg || !tg.HapticFeedback) return;
  try {
    if (type === "success" || type === "error" || type === "warning") {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type || "light");
    }
  } catch (e) {
    // ignore
  }
}
