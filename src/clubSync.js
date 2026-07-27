import { supabase } from "./supabaseClient.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I — easy to read aloud

function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
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
  const { data: club, error } = await client
    .from("clubs")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!club) throw new Error("Клуб с таким кодом не найден");
  const { error: joinError } = await client
    .from("club_members")
    .upsert({ club_id: club.id, user_id: user.id, display_name: displayName || null }, { onConflict: "club_id,user_id" });
  if (joinError) throw joinError;
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
    .select("club_id, clubs ( id, code, name )")
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
