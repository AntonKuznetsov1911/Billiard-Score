// Local safety copies: a small ring of full-data snapshots kept in
// localStorage, taken before destructive actions (clear all, restore a
// backup) and automatically once a day, so nothing is lost "just like that".
export const SAFETY_KEY = "billiards-safety-copies";
const MAX_COPIES = 5;
const DAY_MS = 86400000;

export function listSafetyCopies(storage) {
  try {
    const list = JSON.parse(storage.getItem(SAFETY_KEY) || "[]");
    return Array.isArray(list) ? list.filter((c) => c && typeof c.ts === "number" && c.data) : [];
  } catch (e) {
    return [];
  }
}

export function saveSafetyCopy(storage, data, reason, now = Date.now()) {
  const hasContent = data && ((data.players && data.players.length) || (data.matches && data.matches.length));
  if (!hasContent) return false;
  const copy = {
    ts: now,
    reason,
    matches: data.matches.length,
    players: data.players.length,
    data: { ...data, activeGame: null },
  };
  let list = [copy, ...listSafetyCopies(storage)].slice(0, MAX_COPIES);
  // localStorage has a small quota: drop the oldest copies until it fits.
  while (list.length) {
    try {
      storage.setItem(SAFETY_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      list = list.slice(0, -1);
    }
  }
  return false;
}

// At most one automatic copy per day, and only when the data changed since the last one.
export function maybeAutoSafetyCopy(storage, data, now = Date.now()) {
  const [latest] = listSafetyCopies(storage);
  if (latest && now - latest.ts < DAY_MS) return false;
  if (latest && latest.matches === data.matches.length && latest.players === data.players.length) return false;
  return saveSafetyCopy(storage, data, "auto", now);
}
