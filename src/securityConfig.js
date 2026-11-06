export function validatePublicConfig(env, { development = false } = {}) {
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("VITE_") && (/secret|password|service_role|private/i.test(name) || String(value).startsWith("sb_secret_"))) {
      throw new Error("Sensitive configuration must not use the public VITE_ prefix");
    }
  }
  const url = env.VITE_SUPABASE_URL || "";
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  if (!url && !key) return;
  if (!url || !key) throw new Error("Supabase URL and public key must be configured together");
  const parsed = new URL(url);
  const local = development && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((!local && parsed.protocol !== "https:") || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Supabase must use an HTTPS URL without credentials, query or fragment");
  }
  if (key.startsWith("sb_publishable_") && key.length > 20) return;
  try {
    const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (key.split(".").length === 3 && payload.role === "anon") return;
  } catch { /* Only supported public key formats are allowed. */ }
  throw new Error("Only a Supabase publishable or anon key is allowed in the client");
}
