export const CLUB_TERMS_VERSION = "2026-11-06";
const TERMS_KEY = "billiards-club-terms";
const BLOCKED_KEY = "billiards-blocked-clubs";
// Access to localStorage itself can throw when device storage is disabled.
export const clubSafetyStorage = {
  getItem(key) { return window.localStorage.getItem(key); },
  setItem(key, value) { window.localStorage.setItem(key, value); },
};

function read(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export function acceptedClubTerms(storage, userId) {
  return !!userId && read(storage, TERMS_KEY)[userId] === CLUB_TERMS_VERSION;
}
export function acceptClubTerms(storage, userId) {
  if (!userId) throw new Error("Сначала войдите в аккаунт");
  storage.setItem(TERMS_KEY, JSON.stringify({ ...read(storage, TERMS_KEY), [userId]: CLUB_TERMS_VERSION }));
}
export function blockedClubs(storage, userId) {
  const list = read(storage, BLOCKED_KEY)[userId];
  return Array.isArray(list) ? list.filter(x => x && typeof x.id === "string" && typeof x.name === "string") : [];
}
export function setClubBlocked(storage, userId, club, blocked) {
  const all = read(storage, BLOCKED_KEY);
  const list = blockedClubs(storage, userId).filter(x => x.id !== club.id);
  if (blocked) list.push({ id: club.id, name: club.name });
  storage.setItem(BLOCKED_KEY, JSON.stringify({ ...all, [userId]: list }));
}
