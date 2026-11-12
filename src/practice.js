export const EXERCISES = [
  { id: "straight", title: "Прямой удар", goal: 7, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0, instruction: "Поставьте биток и прицельный шар на одну линию с угловой лузой. Цельтесь в центр шара, ведите кий ровно, без бокового вращения.", success: "Прицельный шар забит в указанную лузу." },
  { id: "cut", title: "Резка", goal: 7, cue: [0.85, 0.34], object: [1.45, 0.34], tip: 0, instruction: "Найдите точку контакта на линии от прицельного шара к лузе. Направьте центр битка в пунктирный шар-призрак. Не добавляйте боковое вращение.", success: "Шар забит, биток не упал в лузу." },
  { id: "stop", title: "Остановка битка", goal: 6, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0.18, instruction: "Начните с удара немного ниже центра. Подберите силу и высоту удара так, чтобы к столкновению биток скользил без наката и оттяжки. На этой прямой он должен остановиться у точки контакта.", success: "Шар забит, биток остановился в пределах диаметра шара от точки контакта." },
  { id: "follow", title: "Накат", goal: 6, cue: [0.95, 0.525], object: [1.45, 0.275], tip: -0.3, zone: [1.68, 0.16], instruction: "Ударьте немного выше центра. Держите кий близко к горизонтали и плавно проведите его вперёд. После прямого столкновения биток должен покатиться вслед за шаром.", success: "Шар забит, биток дошёл до отмеченной зоны и остался на столе." },
  { id: "draw", title: "Оттяжка", goal: 5, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0.35, zone: [0.95, 0.525], instruction: "Намелите наклейку. Ударьте ниже центра, но не у самого края, плавно проводя кий вперёд. Не дёргайте кий назад: биток возвращает обратное вращение.", success: "Шар забит, биток вернулся в отмеченную зону." },
];
export function ghostBall(object, pocket = [2, 0], radius = 0.024) {
  const dx = pocket[0] - object[0], dy = pocket[1] - object[1];
  const length = Math.hypot(dx, dy);
  return [object[0] - dx / length * radius * 2, object[1] - dy / length * radius * 2];
}
export function attempts(run) {
  const undone = new Set(run.undone || []);
  return (run.events || []).filter(e => !undone.has(e.id)).sort((a,b) => a.at-b.at || a.id.localeCompare(b.id)).slice(0,10);
}
export function cleanPractice(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(r => r && typeof r.id === "string" && r.id.length <= 100 && EXERCISES.some(e => e.id === r.exerciseId) && Number.isFinite(r.startedAt) && r.startedAt > 0).slice(0,2000).map(r => ({
    id:r.id, exerciseId:r.exerciseId, gameType:r.gameType === "pool" ? "pool" : "russian",
    playerId:typeof r.playerId === "string" ? r.playerId.slice(0,100) : null,
    startedAt:r.startedAt,
    events:Array.isArray(r.events) ? [...new Map(r.events.filter(e => e && typeof e.id === "string" && e.id.length <=100 && typeof e.success === "boolean" && Number.isFinite(e.at)).slice(0,100).map(e => [e.id,{id:e.id,success:e.success,at:e.at}])).values()] : [],
    undone:Array.isArray(r.undone) ? [...new Set(r.undone.filter(id => typeof id === "string" && id.length <=100))].slice(0,100) : [],
  }));
}
export function mergePractice(a,b,resetAt=0) {
  const runs = new Map();
  for (const r of [...cleanPractice(a),...cleanPractice(b)]) {
    if (r.startedAt <= resetAt) continue;
    const old=runs.get(r.id);
    runs.set(r.id,old ? {...old,events:[...new Map([...old.events,...r.events].map(e=>[e.id,e])).values()],undone:[...new Set([...old.undone,...r.undone])]} : r);
  }
  return [...runs.values()].map(r => ({...r,
    events:r.events.sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id)),
    undone:r.undone.sort(),
  })).sort((a,b)=>b.startedAt-a.startedAt || a.id.localeCompare(b.id));
}
