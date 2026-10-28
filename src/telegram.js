// Telegram Mini App helpers; everything no-ops outside Telegram.
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
