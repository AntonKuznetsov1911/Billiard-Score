import { supabase } from "./supabaseClient.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I — easy to read aloud

// Invite codes are the only thing protecting a club, so they must come from a
// cryptographic RNG (alphabet is 32 symbols, so masking 5 bits is unbiased).
function randomCode(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[bytes[i] & 31];
  return s;
}

function requireClient() {
  if (!supabase) throw new Error("Облачный доступ не настроен");
  return supabase;
}

export async function sendMagicLink(email) {
  const client = requireClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email, token) {
  const client = requireClient();
  const { error } = await client.auth.verifyOtp({ email, token: token.trim(), type: "email" });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const client = requireClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

async function currentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Не выполнен вход");
  return data.user;
}

export async function createClub(name, displayName) {
  const client = requireClient();
  const user = await currentUser();
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data: club, error } = await client
      .from("clubs")
      .insert({ code, name: name || "Мой клуб", created_by: user.id })
      .select()
      .single();
    if (!error) {
      await client.from("club_members").insert({ club_id: club.id, user_id: user.id, display_name: displayName || null });
      await client.from("club_state").insert({ club_id: club.id, data: {} });
      return club;
    }
    lastError = error;
    if (error.code !== "23505") throw error; // not a unique-code collision — real error
  }
  throw lastError || new Error("Не удалось создать клуб");
}

export async function joinClub(code, displayName) {
  const client = requireClient();
  const user = await currentUser();
  const clean = code.trim().toUpperCase();

  // Preferred path: the join_club_by_code function (see supabase/hardening.sql),
  // which is the only way into someone else's club once the database is hardened.
  const { data: joined, error: rpcError } = await client.rpc("join_club_by_code", {
    p_code: clean,
    p_display_name: displayName || null,
  });
  if (!rpcError) return joined;
  if (rpcError.code === "P0002" || /club_not_found/.test(rpcError.message || "")) {
    throw new Error("Клуб с таким кодом не найден");
  }
  // Database not hardened yet (function missing): fall back to the legacy lookup.
  const missing = rpcError.code === "PGRST202" || rpcError.code === "42883" || /Could not find the function/i.test(rpcError.message || "");
  if (!missing) throw rpcError;

  const { data: club, error } = await client.from("clubs").select("*").eq("code", clean).maybeSingle();
  if (error) throw error;
  if (!club) throw new Error("Клуб с таким кодом не найден");
  const { error: joinError } = await client
    .from("club_members")
    .insert({ club_id: club.id, user_id: user.id, display_name: displayName || null });
  if (joinError && joinError.code !== "23505") throw joinError; // 23505 — уже состоит в клубе, это ок
  return club;
}

export async function leaveClub(clubId) {
  const client = requireClient();
  const user = await currentUser();
  await client.from("club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
}

export async function getMyClub() {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const user = userData && userData.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("club_members")
    .select("club_id, clubs ( id, code, name, created_by )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.clubs || null;
}

export async function getClubMembers(clubId) {
  const client = requireClient();
  const { data, error } = await client.from("club_members").select("user_id, display_name, joined_at").eq("club_id", clubId);
  if (error) throw error;
  return data || [];
}

export async function fetchClubState(clubId) {
  const client = requireClient();
  const { data, error } = await client.from("club_state").select("data, updated_at").eq("club_id", clubId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: data.data, updatedAt: new Date(data.updated_at).getTime() };
}

export async function pushClubState(clubId, appData) {
  const client = requireClient();
  const { error } = await client
    .from("club_state")
    .update({ data: appData, updated_at: new Date().toISOString() })
    .eq("club_id", clubId);
  if (error) throw error;
}

export function subscribeClubState(clubId, onChange) {
  const client = requireClient();
  const channel = client
    .channel(`club_state:${clubId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "club_state", filter: `club_id=eq.${clubId}` },
      (payload) => onChange(payload.new.data, new Date(payload.new.updated_at).getTime())
    )
    .subscribe();
  return () => client.removeChannel(channel);
}

// Change history of the shared club state (append-only on the server, see
// supabase/history.sql). Snapshots are listed without their (large) data.
export async function listClubHistory(clubId, limit = 60) {
  const client = requireClient();
  const { data, error } = await client
    .from("club_state_history")
    .select("id, saved_at, replaced_by, matches_count, players_count, reason")
    .eq("club_id", clubId)
    .order("saved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Creator-only; the server also snapshots the current state first, so a restore can be undone.
export async function restoreClubHistory(historyId) {
  const client = requireClient();
  const { error } = await client.rpc("restore_club_state", { p_history_id: historyId });
  if (error) {
    if (error.code === "42501" || /only_creator/.test(error.message || "")) {
      throw new Error("Восстанавливать может только создатель клуба");
    }
    throw error;
  }
}

export async function setMyClubName(clubId, name) {
  const client = requireClient();
  const { error } = await client.rpc("set_my_club_name", { p_club_id: clubId, p_name: name });
  if (error) {
    if (error.code === "PGRST202" || /Could not find the function/i.test(error.message || "")) {
      throw new Error("Нужно обновить базу: выполните supabase/history.sql");
    }
    throw error;
  }
}

export async function getMyClubName(clubId) {
  const client = requireClient();
  const user = await currentUser();
  const { data } = await client
    .from("club_members")
    .select("display_name")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data && data.display_name) || "";
}
