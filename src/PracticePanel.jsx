import React, {useState} from "react";
import {EXERCISES, ghostBall, attempts} from "./practice.js";
import {uid} from "./gameLogic.js";
import "./practice.css";

export default function PracticePanel({data, updateData, onBack}) {
  const [exerciseId,setExerciseId]=useState(null);
  const [playerId,setPlayerId]=useState("");
  const exercise=EXERCISES.find(e=>e.id===exerciseId);
  const type=data.gameType || "russian";
  const runs=(data.practiceSessions||[]).filter(r=>r.gameType===type && (r.playerId||"")===playerId);
  const run=runs.find(r=>r.exerciseId===exerciseId);
  const shots=run ? attempts(run) : [];
  const active=run && shots.length<10 && run.events.length<100;
  function start() {
    if ((data.practiceSessions||[]).length>=2000) {alert("Достигнут лимит 2000 тренировок. Сохраните копию данных перед очисткой.");return;}
    const next={id:uid(),exerciseId,gameType:type,playerId:playerId||null,startedAt:Date.now(),events:[],undone:[]};
    updateData(prev=>({...prev,practiceSessions:[next,...(prev.practiceSessions||[])]}));
  }
  function record(success) {
    const event={id:uid(),success,at:Date.now()};
    updateData(prev=>({...prev,practiceSessions:(prev.practiceSessions||[]).map(r=>r.id===run.id && attempts(r).length<10 ? {...r,events:[...r.events,event]} : r)}));
  }
  function undo() {
    updateData(prev=>({...prev,practiceSessions:(prev.practiceSessions||[]).map(r=>{const last=attempts(r).at(-1);return r.id===run.id && last ? {...r,undone:[...r.undone,last.id]} : r;})}));
  }
  return <section className="practice-panel">
    <button className="practice-back" onClick={()=>exercise ? setExerciseId(null) : onBack()}>← {exercise ? "Все упражнения" : "К подготовке партии"}</button>
    <h2>{exercise ? exercise.title : "Тренировка"}</h2>
    <p className="practice-muted">{type==="pool" ? "Pool" : "Русский бильярд"} · Упражнения не влияют на статистику партий.</p>
    <label>Для кого тренировка<select aria-label="Игрок тренировки" value={playerId} onChange={e=>setPlayerId(e.target.value)}><option value="">Без имени</option>{data.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!exercise ? <div className="practice-catalog">{EXERCISES.map((e,i)=>{const history=runs.filter(r=>r.exerciseId===e.id);const complete=history.filter(r=>attempts(r).length===10);const latest=history[0];return <button key={e.id} onClick={()=>setExerciseId(e.id)}><span className="practice-number">0{i+1}</span><span><strong>{e.title}</strong><small>Цель: {e.goal} из 10 · {complete.length ? `Лучший результат: ${Math.max(...complete.map(r=>attempts(r).filter(s=>s.success).length))}/10` : "Пока без результата"}{latest && attempts(latest).length<10 ? ` · Продолжить ${attempts(latest).length}/10` : ""}</small></span><span>›</span></button>;})}</div> : <>
      <Table exercise={exercise} type={type}/>
      <p className="practice-muted">Б — биток. Пунктир — направление к шару-призраку, светлая линия — направление прицельного шара. Сетка помогает повторить расстановку; размеры шаров условные.</p>
      <div className="practice-instruction"><h3>Как выполнить</h3><p>{exercise.instruction}</p><div className="practice-tip"><svg viewBox="0 0 80 80" width="72" height="72" role="img" aria-label="Точка удара по битку"><circle cx="40" cy="40" r="33" fill="#f5ead1"/><path d="M40 12V68M12 40H68" stroke="#9b8a68" strokeDasharray="3 3"/><circle cx="40" cy={40+exercise.tip*50} r="5" fill="#16765b"/></svg><span>Зелёная точка — ориентир для наклейки кия.<br/>Силу подберите под сукно и расстояние.</span></div><h3>Успешная попытка</h3><p>{exercise.success}</p></div>
      {!run ? <button className="practice-primary" onClick={start}>Начать 10 попыток</button> : <div className="practice-score"><h3>{active ? `Попытки: ${shots.length} / 10` : "Упражнение завершено"}</h3><p className="practice-result">{shots.filter(s=>s.success).length} <span>/ {shots.length || 10}</span></p><div className="practice-dots" aria-label="Результаты попыток">{Array.from({length:10},(_,i)=><span key={i} className={shots[i] ? shots[i].success ? "hit" : "miss" : ""}>{shots[i] ? shots[i].success ? "✓" : "×" : i+1}</span>)}</div>{active ? <div className="practice-actions"><button className="practice-primary" onClick={()=>record(true)}>Получилось</button><button onClick={()=>record(false)}>Не получилось</button></div> : <><p>{shots.filter(s=>s.success).length>=exercise.goal ? "Цель достигнута. Попробуйте повторить результат." : "Продолжайте: плавность и точность важнее силы."}</p><button className="practice-primary" onClick={start}>Повторить упражнение</button></>}{shots.length>0 && <button className="practice-back" onClick={undo}>Отменить последнюю попытку</button>}<small>Попытки сохраняются автоматически.</small></div>}
      <p className="practice-muted">Схема — учебный ориентир, а не точный расчёт траектории. Начинайте без бокового вращения.</p>
      <a href="https://drdavepoolinfo.com/faq/stun/stop/" target="_blank" rel="noopener noreferrer">О технике остановки битка · Dr. Dave</a>
    </>}
  </section>;
}
function Table({exercise:e,type}) {
  const point=([x,y])=>[70+x*430,65+y*430];
  const cue=point(e.cue), obj=point(e.object), ghost=point(ghostBall(e.object)), pocket=point([2,0]);
  const zone=e.zone ? point(e.zone) : e.id==="stop" ? ghost : null;
  return <svg className="practice-table" viewBox="0 0 1000 560" role="img" aria-label={`Расстановка: ${e.title}. Биток слева снизу, прицельный шар перед правой верхней лузой.`}>
    <rect x="12" y="7" width="976" height="546" rx="48" fill={type==="pool" ? "#252931" : "#59402a"} stroke="#b99555" strokeWidth="5"/>
    <rect x="60" y="55" width="880" height="450" rx="20" fill={type==="pool" ? "#123f59" : "#075741"}/>
    {Array.from({length:9},(_,i)=><line key={`v${i}`} x1={70+i*107.5} x2={70+i*107.5} y1="65" y2="495" stroke="#fff" opacity=".09"/>)}
    {Array.from({length:5},(_,i)=><line key={`h${i}`} x1="70" x2="930" y1={65+i*107.5} y2={65+i*107.5} stroke="#fff" opacity=".09"/>)}
    {[[70,65],[500,60],[930,65],[70,495],[500,500],[930,495]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="24" fill="#050d10" stroke="#b99555" strokeWidth="3"/>)}
    {zone && <circle cx={zone[0]} cy={zone[1]} r="34" fill="#d6b361" fillOpacity=".25" stroke="#e5c985" strokeDasharray="6 5"/>}
    <path d={`M${cue}L${ghost}`} stroke="#f0c878" strokeWidth="4" strokeDasharray="10 7"/>
    <path d={`M${obj}L${pocket}`} stroke="#eee5d0" strokeWidth="4"/>
    <circle cx={ghost[0]} cy={ghost[1]} r="10.3" fill="none" stroke="#f0c878" strokeWidth="3"/>
    <circle cx={obj[0]} cy={obj[1]} r="13" fill={type==="pool" ? "#f5bb28" : "#e9dfc7"} stroke="#b99555" strokeWidth="2"/>
    {type==="pool" && <text x={obj[0]} y={obj[1]+6} textAnchor="middle" fontSize="18" fill="#111">1</text>}
    <circle cx={cue[0]} cy={cue[1]} r="15" fill="#fff4dc" stroke="#d6b361" strokeWidth="3"/>
    <text x={cue[0]} y={cue[1]-26} textAnchor="middle" fontSize="30" fill="#fff4dc">Б</text>
  </svg>;
}
