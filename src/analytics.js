import { supabase } from "./supabaseClient.js";
import { isNativeApp } from "./native.js";

// Anonymous usage count: once a day this device says "I was used today"
// (a random device id, the platform and the app version — nothing about the
// person or their games). See supabase/telegram.sql.
const DEVICE_KEY = "billiards-device-id";
const PING_KEY = "billiards-usage-day";

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
}

function deviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    // randomUUID needs a secure context; plain http (a LAN preview) only has getRandomValues.
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function platform() {
  if (isNativeApp()) {
    const p = window.Capacitor.getPlatform && window.Capacitor.getPlatform();
    return p === "ios" ? "ios" : "android";
  }
  const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return standalone || window.navigator.standalone ? "pwa" : "web";
}

export async function pingUsage() {
  // Automated test browsers aren't real users.
  if (!supabase || typeof window === "undefined" || window.navigator.webdriver) return;
  try {
    const day = today();
    if (window.localStorage.getItem(PING_KEY) === day) return;
    const { error } = await supabase.rpc("ping_app", {
      p_device: deviceId(),
      p_platform: platform(),
      p_version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null,
    });
    // Before telegram.sql is run the function doesn't exist — try again tomorrow anyway.
    if (!error || error.code === "PGRST202") window.localStorage.setItem(PING_KEY, day);
  } catch (e) {
    // offline or blocked — will try again on the next start
  }
}
