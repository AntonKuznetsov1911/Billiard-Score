import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Where *.supabase.co is blocked or throttled (common without a VPN) requests
// would otherwise hang for minutes and keep the sync badge spinning. They are
// cut off instead, the app keeps working from local data and retries later.
// VITE_SUPABASE_URL may point at a reverse proxy on your own domain (see
// proxy/README.md) to reach the club without a VPN at all.
export const REQUEST_TIMEOUT_MS = 12000;

export function fetchWithTimeout(input, init = {}, ms = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        global: { fetch: (input, init) => fetchWithTimeout(input, init) },
      })
    : null;

export function isCloudConfigured() {
  return !!supabase;
}
