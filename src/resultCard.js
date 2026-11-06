export async function renderResultCard(match, nameById, label) {
  await document.fonts?.ready;
  const ids = (match.participants || []).slice(0, 20);
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = Math.max(1200, 620 + ids.length * 150);
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Не удалось создать карточку");
  const g = c.createLinearGradient(0, 0, 1080, canvas.height); g.addColorStop(0, "#19382d"); g.addColorStop(1, "#09120f");
  c.fillStyle = g; c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = "#b69a62"; c.lineWidth = 2; c.strokeRect(48, 48, 984, canvas.height - 96);
  c.fillStyle = "#cbb887"; c.font = '600 28px Inter, sans-serif'; c.fillText("ТВОЙ БИЛЬЯРД", 100, 135);
  c.fillStyle = "#f4f0e7"; c.font = '600 68px Fraunces, serif'; c.fillText(match.solo ? "Тренировка" : "Хорошая партия.", 100, 245);
  c.fillStyle = "#a7b9ae"; c.font = '28px Inter, sans-serif'; c.fillText(String(label).slice(0, 48), 100, 315);
  ids.forEach((id, i) => {
    const y = 430 + i * 150; const winner = match.winnerId === id;
    c.fillStyle = winner ? "#213e30" : "#13271e"; c.fillRect(90, y - 60, 900, 125);
    c.fillStyle = winner ? "#e1c78d" : "#f4f0e7"; c.font = '600 36px Inter, sans-serif';
    const name = String(nameById(id));
    const chunks = name.length > 25 ? [name.slice(0, 25), name.slice(25, 40)] : [name];
    chunks.forEach((line, j) => c.fillText(line, 120, y - (chunks.length > 1 ? 15 : 0) + j * 40));
    c.font = '700 64px "Space Mono", monospace'; c.textAlign = "right"; c.fillText(String(match.scores?.[id] || 0), 955, y + 10); c.textAlign = "left";
  });
  c.fillStyle = "#cbb887"; c.font = '28px Inter, sans-serif';
  c.fillText(match.winnerId ? `Победитель: ${String(nameById(match.winnerId)).slice(0, 38)}` : "Результат сохранён", 100, canvas.height - 190);
  c.fillStyle = "#81978b"; c.font = '24px Inter, sans-serif';
  c.fillText(new Date(match.date || Date.now()).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }), 100, canvas.height - 125);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error("Не удалось создать PNG")), "image/png"));
}
