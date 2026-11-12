import LearningLibrary, {LearningArt} from "./LearningLibrary.jsx";
import Table from "./PracticeTable.jsx";
import React, {useState} from "react";
import {exercisesFor, attempts} from "./practice.js";
import {uid} from "./gameLogic.js";
import "./practice.css";

export default function PracticePanel({data, updateData, onBack}) {
  const [school,setSchool]=useState(false);
  const [mirror,setMirror]=useState(false);
  const [layoutCount,setLayoutCount]=useState(6);
  const [group,setGroup]=useState("Все");
  const [exerciseId,setExerciseId]=useState(null);
  const [playerId,setPlayerId]=useState("");
  const [position,setPosition]=useState(0);
  const [target,setTarget]=useState(0);
  const [total,setTotal]=useState(null);
  const type=data.gameType || "russian";
  const catalog=exercisesFor(type);
  const exercise=catalog.find(e=>e.id===exerciseId);
  const runs=(data.practiceSessions||[]).filter(r=>r.gameType===type && (r.playerId||"")===playerId);
  const run=runs.find(r=>r.exerciseId===exerciseId && (!exercise?.series || (r.limit||10)===(["side-series","cross"].includes(exercise.layout) ? layoutCount : 6)));
  const shots=run ? attempts(run) : [];
  const limit=run?.limit || (exercise?.series ? (["side-series","cross"].includes(exercise.layout) ? layoutCount : 6) : 10);
  const active=run && shots.length<limit && run.events.length<100;
  const batch=shots.length>0 && shots.every(e=>e.batch);
  function start() {
    setTotal(null);
    if ((data.practiceSessions||[]).length>=2000) {alert("Достигнут лимит 2000 тренировок. Сохраните копию данных перед очисткой.");return;}
    const next={id:uid(),limit:exercise.series ? (["side-series","cross"].includes(exercise.layout) ? layoutCount : 6) : 10,exerciseId,gameType:type,playerId:playerId||null,startedAt:Date.now(),events:[],undone:[]};
    updateData(prev=>({...prev,practiceSessions:[next,...(prev.practiceSessions||[])]}));
  }
  function record(success) {
    const event={id:uid(),success,at:Date.now()};
    updateData(prev=>({...prev,practiceSessions:(prev.practiceSessions||[]).map(r=>r.id===run.id && attempts(r).length<(r.limit||10) ? {...r,events:[...r.events,event]} : r)}));
  }
  function saveTotal() {
    if(total===null)return;
    if(shots.length && !window.confirm("Заменить отмеченные попытки общим итогом этого подхода?"))return;
    const id=uid(),at=Date.now();
    const events=Array.from({length:limit},(_,i)=>({id:`${id}-${i}`,success:i<total,at:at+i,batch:true}));
    updateData(prev=>({...prev,practiceSessions:(prev.practiceSessions||[]).map(r=>r.id===run.id && attempts(r).length<(r.limit||10) && r.events.length<=100-limit ? {...r,events:[...r.events,...events],undone:[...new Set([...r.undone,...r.events.map(e=>e.id)])]} : r)}));
    setTotal(null);
  }
  function undo() {
    updateData(prev=>({...prev,practiceSessions:(prev.practiceSessions||[]).map(r=>{const last=attempts(r).at(-1);return r.id===run.id && last ? {...r,undone:[...new Set([...r.undone,...(batch ? attempts(r).map(e=>e.id) : [last.id])])]} : r;})}));
  }
  if(school)return <section className="practice-panel"><LearningLibrary type={type} onBack={()=>setSchool(false)}/></section>;
  return <section className="practice-panel">
    <button className="practice-back" onClick={()=>exercise ? setExerciseId(null) : onBack()}>← {exercise ? "Все упражнения" : "К подготовке партии"}</button>
    <h2>{exercise ? exercise.title : "Упражнения"}</h2>
    <p className="practice-muted">{type==="pool" ? "Pool" : "Русский бильярд"} · Упражнения не влияют на статистику партий.</p>
    <label>Для кого тренировка<select aria-label="Игрок тренировки" value={playerId} onChange={e=>{setPlayerId(e.target.value);setTotal(null);}}><option value="">Без имени</option>{data.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!exercise && <><button className="practice-entry" onClick={()=>setSchool(true)}>Школа бильярда<small>Прицеливание, техника и наглядные уроки</small></button><div className="learning-filters">{["Все","Основы","Серии","Борта",...(type==="russian" ? ["Разбой и свояки"] : [])].map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div></>}
    {!exercise ? <div className="practice-catalog">{catalog.filter(e=>group==="Все" || (e.group||"Основы")===group).map((e,i)=>{const history=runs.filter(r=>r.exerciseId===e.id);const complete=history.filter(r=>attempts(r).length===(r.limit||10));const latest=history[0];const best=complete.slice().sort((a,b)=>attempts(b).filter(s=>s.success).length/(b.limit||10)-attempts(a).filter(s=>s.success).length/(a.limit||10)||(b.limit||10)-(a.limit||10))[0];return <button key={e.id} onClick={()=>{setExerciseId(e.id);setPosition(0);setTarget(0);setTotal(null);setMirror(false);setLayoutCount(e.layout==="cross" ? 4 : e.layout==="side-series" ? 12 : 6);}}><span className="practice-number">{String(i+1).padStart(2,"0")}</span><span><strong>{e.title}</strong><small>{e.level} · {e.series ? "Серия без перестановки битка" : `Цель: ${e.goal} из 10`} · {complete.length ? `Лучший результат: ${attempts(best).filter(s=>s.success).length}/${best.limit||10}` : "Пока без результата"}{latest && attempts(latest).length<(latest.limit||10) ? ` · Продолжить ${attempts(latest).length}/${latest.limit||10}` : ""}</small></span><span>›</span></button>;})}</div> : <>
      <Table exercise={exercise} type={type} position={position} target={target} layoutCount={layoutCount} mirror={mirror}/>
      <div className="practice-position"><button aria-pressed={mirror} onClick={()=>setMirror(!mirror)}>Зеркальная сторона</button>
      {exercise.layout==="side-series" && <label>Расстановка<select aria-label="Количество шаров" value={layoutCount} disabled={active} onChange={e=>{setLayoutCount(Number(e.target.value));setTarget(0);}}><option value={6}>6 шаров · по 3 с каждой стороны</option><option value={12}>12 шаров · по 6 с каждой стороны</option></select><strong>На схеме {layoutCount} шаров, биток отдельно</strong></label>}
      {exercise.layout==="cross" && <div>{[4,8].map(n=><button key={n} aria-pressed={layoutCount===n} onClick={()=>{setLayoutCount(n);setTarget(0);}}>{n} шара</button>)}</div>}
      {["side-series","line","cross","clearance"].includes(exercise.layout) && <><p>Подсветить следующий шар</p><div className="learning-filters">{Array.from({length:["side-series","cross"].includes(exercise.layout) ? layoutCount : 6},(_,i)=><button key={i} aria-pressed={target===i} onClick={()=>setTarget(i)}>{i+1}</button>)}</div><small>Биток на рисунке — стартовая позиция. В серии продолжайте с места его остановки. Линия — пример выбранного первого удара.</small></>}
      </div>
      {exercise.positions && <div className="practice-position"><span>Исходная позиция</span><div>{exercise.positions.map((_,i)=><button key={i} aria-pressed={position===i} onClick={()=>setPosition(i)}>{i+1}</button>)}</div><small>Номера — варианты. На столе нужен только один биток.</small></div>}
      {exercise.targets && <div className="practice-position"><span>Целевая зона</span><div>{exercise.targets.map((_,i)=><button key={i} aria-pressed={target===i} onClick={()=>setTarget(i)}>{i+1}</button>)}</div></div>}
      <p className="practice-muted">{exercise.placementOnly ? "С — свой (биток), Ч — чужой, Л — луза. Пунктир показывает расположение С–Ч, а не точку прицеливания. Голубая стрелка указывает выбранную лузу; это не расчёт траектории с винтом." : "Жёлтый пунктир — направление к контакту, белая стрелка — путь чужого. Голубая зона — желаемый выход битка."}</p>
      <div className="practice-instruction"><h3>Как выполнить</h3><p>{exercise.instruction}</p><div className="practice-tip"><svg viewBox="0 0 80 80" width="72" height="72" role="img" aria-label="Точка удара по битку"><circle cx="40" cy="40" r="33" fill="#f5ead1"/><path d="M40 12V68M12 40H68" stroke="#9b8a68" strokeDasharray="3 3"/><circle cx={40+(mirror ? -1 : 1)*(exercise.tipX||0)*50} cy={40+exercise.tip*50} r="5" fill="#16765b"/></svg><span>{exercise.tipLabel || "Зелёная точка — ориентир для наклейки кия. Силу подберите под сукно и расстояние."}</span></div><h3>Успешная попытка</h3><p>{exercise.success}</p></div>
      {!run ? <button className="practice-primary" onClick={start}>Начать выполнение</button> : <div className="practice-score">{active && run.events.length<=100-limit && <div className="practice-total"><h3>{exercise.series ? `Сколько шаров забито из ${limit}?` : "Сколько получилось из 10?"}</h3><div className="practice-total-options" role="group" aria-label={exercise.series ? "Забито шаров" : "Успешных из десяти"}>{Array.from({length:limit+1},(_,i)=><button key={i} aria-pressed={total===i} onClick={()=>setTotal(i)}>{i}</button>)}</div><button className="practice-primary" disabled={total===null} onClick={saveTotal}>Сохранить{total!==null ? ` ${total} из ${limit}` : " результат"}</button><small>{exercise.series ? "Запишите число забитых шаров за один подход до промаха. Биток рукой не переставляйте." : "Выполните десять ударов и выберите общий итог."}</small></div>}<h3>{active ? `Попытки: ${shots.length} / ${limit}` : "Упражнение завершено"}</h3><p className="practice-result">{shots.filter(s=>s.success).length} <span>/ {limit}</span></p>{batch ? <small>Введён общий итог. Порядок отдельных ударов не записывался.</small> : <div className="practice-dots" aria-label="Результаты попыток">{Array.from({length:limit},(_,i)=><span key={i} className={shots[i] ? shots[i].success ? "hit" : "miss" : ""}>{shots[i] ? shots[i].success ? "✓" : "×" : i+1}</span>)}</div>}{active ? !exercise.series && <details className="practice-manual"><summary>Или отмечать каждый удар</summary><div className="practice-actions"><button className="practice-primary" onClick={()=>record(true)}>Получилось</button><button onClick={()=>record(false)}>Не получилось</button></div></details> : <><p>{shots.filter(s=>s.success).length>=(exercise.series ? limit : exercise.goal) ? "Цель достигнута. Попробуйте повторить результат." : "Продолжайте: плавность и точность важнее силы."}</p><button className="practice-primary" onClick={start}>Повторить упражнение</button></>}{shots.length>0 && <button className="practice-back" onClick={undo}>{batch ? "Отменить общий результат" : "Отменить последнюю попытку"}</button>}<small>Попытки сохраняются автоматически.</small></div>}
      <p className="practice-muted">{exercise.tipX ? "Точка на битке показана со стороны игрока. При зеркальной расстановке боковой винт меняется на противоположный." : "Сила удара подбирается под расстояние, сукно и состояние шаров."}</p>
      <details className="practice-visual"><summary>Наглядно: как видеть удар</summary><LearningArt kind={["cut","rail-pot"].includes(exercise.id) ? "overlap" : exercise.placementOnly ? "spin" : exercise.id.includes("svoyak") ? "motion" : "aim"}/></details>
    </>}
  </section>;
}
