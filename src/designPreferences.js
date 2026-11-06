const KEY = "billiards-match-presets-v1";
export function readPresets(storage) {
  try {
    const items = JSON.parse(storage.getItem(KEY) || "[]");
    if (!Array.isArray(items)) return [];
    return items.filter(p => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.participants))
      .map(p => ({ ...p, name: p.name.slice(0, 80), participants: p.participants.filter(x => typeof x === "string").slice(0, 20) })).slice(0, 8);
  } catch { return []; }
}
export function savePreset(storage, preset) {
  const items = readPresets(storage).filter(p => p.id !== preset.id);
  storage.setItem(KEY, JSON.stringify([preset, ...items].slice(0, 8)));
  return readPresets(storage);
}
export function removePreset(storage, id) {
  const items = readPresets(storage).filter(p => p.id !== id);
  storage.setItem(KEY, JSON.stringify(items)); return items;
}
export function historyDay(date, now = new Date()) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "Без даты";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
