export const EXERCISES = [
  { id: "straight", title: "Прямой удар", goal: 7, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0, instruction: "Поставьте биток и прицельный шар на одну линию с угловой лузой. Цельтесь в центр шара, ведите кий ровно, без бокового вращения.", success: "Прицельный шар забит в указанную лузу." },
  { id: "cut", title: "Резка", goal: 7, cue: [0.85, 0.34], object: [1.45, 0.34], tip: 0, instruction: "Найдите точку контакта на линии от прицельного шара к лузе. Направьте центр битка в пунктирный шар-призрак. Не добавляйте боковое вращение.", success: "Шар забит, биток не упал в лузу." },
  { id: "stop", title: "Остановка битка", goal: 6, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0.18, instruction: "Начните с удара немного ниже центра. Подберите силу и высоту удара так, чтобы к столкновению биток скользил без наката и оттяжки. На этой прямой он должен остановиться у точки контакта.", success: "Шар забит, биток остановился в пределах диаметра шара от точки контакта." },
  { id: "follow", title: "Накат", goal: 6, cue: [0.95, 0.525], object: [1.45, 0.275], tip: -0.3, zone: [1.68, 0.16], instruction: "Ударьте немного выше центра. Держите кий близко к горизонтали и плавно проведите его вперёд. После прямого столкновения биток должен покатиться вслед за шаром.", success: "Шар забит, биток дошёл до отмеченной зоны и остался на столе." },
  { id: "draw", title: "Оттяжка", goal: 5, cue: [0.95, 0.525], object: [1.45, 0.275], tip: 0.35, zone: [0.95, 0.525], instruction: "Намелите наклейку. Ударьте ниже центра, но не у самого края, плавно проводя кий вперёд. Не дёргайте кий назад: биток возвращает обратное вращение.", success: "Шар забит, биток вернулся в отмеченную зону." },
];
const BU = { title: "Billiard University · Fundamentals", url: "https://billiarduniversity.org/testing/exams/" };
const PYRAMID = { title: "Школа Игоря Литовченко · направления тренировок", url: "https://billiardpro.club/program" };
const FEDERATION = { title: "ФБСР · техническая подготовка пирамиды", url: "https://www.fbsrf.ru/sites/default/files/tehnicheskie_normativy_fbsr_1.pdf" };
EXERCISES.forEach(e => {
  e.source = BU;
  e.level = e.id === "draw" ? "Средний" : "Базовый";
  e.positions = e.id === "cut" ? [[.85,.34],[.85,.48],[.85,.62],[.85,.76]] : [[1.15,.425],[.95,.525],[.75,.625],[.55,.725]];
});
EXERCISES.push(
  { id:"long-straight",title:"Дальний прямой",goal:7,level:"Средний",cue:[.35,.825],object:[1.45,.275],tip:0,source:PYRAMID,
    positions:[[.65,.675],[.55,.725],[.45,.775],[.35,.825]],
    instruction:"Начните с ближайшей позиции. После серии из десяти ударов отодвиньте биток на одну позицию, если забили не меньше семи. При меньшем результате повторите дистанцию. Сохраняйте ровный темп и неподвижную голову.",success:"Прицельный шар забит без падения битка. Запишите число успешных ударов из десяти." },
  { id:"rail-pot",title:"Шар вдоль борта",goal:6,level:"Средний",cue:[.65,.18],object:[1.48,.065],pocket:[2,0],tip:0,source:PYRAMID,
    instruction:"Расположите прицельный шар примерно в диаметре шара от длинного борта, биток — по схеме. Играйте в ближнюю угловую лузу мягким ровным ударом без бокового вращения. Затем зеркально повторите с другой стороны.",success:"Прицельный шар забит, биток остаётся на столе." },
  { id:"wheel",title:"Веер выходов",types:["pool"],goal:5,level:"Продвинутый",cue:[.85,.5],object:[1.45,.275],tip:0,source:BU,
    targets:[[1.85,.8],[1.35,.85],[.75,.85],[.2,.7],[.2,.2]],
    instruction:"Забивайте один и тот же шар в угол, меняя выход битка к пяти отмеченным зонам. На каждую зону дайте себе две попытки. Подбирайте высоту удара и силу; после каждого удара восстановите расстановку.",success:"Шар забит, биток коснулся выбранной зоны. Всего десять попыток: по две на каждую цель." },
  { id:"target-control",title:"Контроль позиции",types:["pool"],goal:6,level:"Средний",cue:[.85,.5],object:[1.45,.275],tip:0,source:BU,
    targets:[[1.65,.7],[1.1,.7],[.55,.7],[.55,.25],[1.1,.25]],
    instruction:"Забивайте шар в угол и останавливайте биток в выбранной зоне. Выполните по две попытки на каждую из пяти зон. Можно использовать борта. Начните с крупных зон и уменьшайте их только после стабильного результата.",success:"Прицельный шар забит, биток остановился внутри выбранной зоны; по две попытки на каждую." },
  { id:"svoyak-middle",title:"Свояк в среднюю",types:["russian"],goal:5,level:"Продвинутый",cue:[.55,.4212],object:[1.25,.4],objectAim:[1.7882,.1348],cuePocket:[1,0],tip:.12,source:FEDERATION,
    instruction:"Поставьте шары по схеме. Играйте битком по чужому так, чтобы свой пошёл в среднюю лузу. Начните без бокового винта; подбирайте резку и силу малыми изменениями. Затем повторите зеркально. Схема задаёт исходный ориентир, а не гарантированную траекторию.",success:"После контакта с чужим биток забит в указанную среднюю лузу." },
  { id:"break-control",title:"Контроль разбоя",types:["russian"],goal:6,level:"Средний",cue:[.55,.5],object:[1.42,.5],layout:"rack",tip:0,source:PYRAMID,
    positions:[[.55,.23],[.55,.39],[.55,.5],[.55,.74]],
    instruction:"Плотно соберите пирамиду. Выберите одну из четырёх исходных позиций и повторите из неё десять раз. Сначала добейтесь точного попадания в головной шар и сохранения битка на столе; силу наращивайте постепенно. Здесь оценивается контроль, а не забитый с разбоя шар.",success:"Первым задет головной шар, биток не забит и не вылетел со стола. Это учебный критерий, а не проверка правильности разбоя по правилам соревнований." },
);
export const exercisesFor = type => EXERCISES.filter(e => !e.types || e.types.includes(type));
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
    events:Array.isArray(r.events) ? [...new Map(r.events.filter(e => e && typeof e.id === "string" && e.id.length <=100 && typeof e.success === "boolean" && Number.isFinite(e.at)).slice(0,100).map(e => [e.id,{id:e.id,success:e.success,at:e.at,...(e.batch === true ? {batch:true} : {})}])).values()] : [],
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
