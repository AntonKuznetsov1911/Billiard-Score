export function historyDay(date, now = new Date()) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "Без даты";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
