import React,{useState,useId} from "react";
import {LESSONS} from "./learning.js";

export default function LearningLibrary({type,onBack}) {
  const [selected,setSelected]=useState(null),[query,setQuery]=useState("");
  const lessons=LESSONS.filter(l=>(!l.russian || type==="russian") && `${l.title} ${l.group}`.toLowerCase().includes(query.toLowerCase()));
  const lesson=LESSONS.find(l=>l.id===selected);
  return <div className="learning-library"><button className="practice-back" onClick={()=>lesson ? setSelected(null) : onBack()}>← {lesson ? "Все уроки" : "К упражнениям"}</button>{lesson ? <>
    <small>{lesson.group}</small><h2>{lesson.title}</h2><LearningArt kind={lesson.art}/><ol className="learning-steps">{lesson.steps.map(s=><li key={s}>{s}</li>)}</ol><div className="learning-error"><strong>На что обратить внимание</strong><p>{lesson.mistake}</p></div>
  </> : <><h2>Школа бильярда</h2><p className="practice-muted">От стойки до серий и контроля битка. Выберите тему.</p><input className="learning-search" aria-label="Найти урок" placeholder="Прицеливание, свояк, накат…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="practice-catalog">{lessons.map(l=><button key={l.id} onClick={()=>setSelected(l.id)}><span><small>{l.group}</small><strong>{l.title}</strong></span><span>›</span></button>)}</div>{!lessons.length && <p>Уроков по этому запросу пока нет.</p>}</>}</div>;
}

export function LearningArt({kind="aim"}) {
  const id=useId().replace(/:/g,"");const [fraction,setFraction]=useState(.5);
  const aiming=kind==="aim" || kind==="overlap";
  const r=26,ox=335,oy=125,angle=Math.asin(1-fraction),nx=Math.sin(angle),ny=-Math.cos(angle);
  const gx=ox-2*r*nx,gy=oy-2*r*ny,tx=ox-r*nx,ty=oy-r*ny;
  const sphere=(x,y,r,key)=> <g key={key}><ellipse cx={x+5} cy={y+r*.8} rx={r} ry={r*.38} fill="#002e23" opacity=".65"/><circle cx={x} cy={y} r={r} fill={`url(#${id}-ball)`}/><ellipse cx={x-r*.3} cy={y-r*.45} rx={r*.25} ry={r*.12} fill="white" opacity=".8"/></g>;
  return <div className="learning-art">
    {aiming && <div className="learning-angle" role="group" aria-label="Толщина попадания">{[[1,"Прямой"],[.5,"Полшара"],[.25,"Четверть"]].map(([n,label])=><button key={n} aria-pressed={fraction===n} onClick={()=>setFraction(n)}>{label}</button>)}</div>}
    <svg viewBox="0 0 640 370" role="img" aria-label={aiming ? "Точка контакта и центр воображаемого битка" : "Наглядная схема техники удара"}>
      <defs><radialGradient id={`${id}-ball`} cx="30%" cy="25%" r="75%"><stop stopColor="#fffef0"/><stop offset=".55" stopColor="#e5d49d"/><stop offset="1" stopColor="#858f65"/></radialGradient><linearGradient id={`${id}-felt`} x2="0" y2="1"><stop stopColor="#167649"/><stop offset="1" stopColor="#07573d"/></linearGradient></defs>
      <path d="M65 18H575L630 355H10Z" fill={`url(#${id}-felt)`} stroke="#866644" strokeWidth="15"/>
      {aiming ? <>
        <path d={`M${ox+nx*120} ${oy+ny*120}L${ox} ${oy}`} stroke="#ef6657" strokeWidth="3"/>
        <path fill="none" d={`M${gx} 320V${gy}L${ox} ${oy}`} stroke="#f7ebbb" strokeWidth="2" strokeDasharray="6 5"/>
        <circle cx={gx} cy={gy} r={r} fill="white" fillOpacity=".08" stroke="#f7ebbb" strokeDasharray="5 4"/>
        {sphere(ox,oy,r,"object")}{sphere(gx,285,40,"cue")}
        <path d={`M${gx} 369V333`} stroke="#eee1b8" strokeWidth="9"/>
        <circle cx={tx} cy={ty} r="5" fill="#ffb929"/><circle cx={gx} cy={gy} r="4" fill="#8ce8ff"/>
        <text x="28" y="45" fill="#fff4ce" fontSize="18">Вид вдоль линии кия · условная перспектива</text>
        <text x="32" y="329" fill="#ffda65" fontSize="17">Жёлтая точка — контакт</text><text x="32" y="350" fill="#a6edff" fontSize="17">Голубая — цель центра битка</text>
      </> : kind==="spin" ? <>
        {sphere(320,180,90,"spin")}
        <path d="M320 110V250M250 180H390" stroke="#385842" strokeDasharray="5 4"/>
        {[[320,145,"Накат",345,137],[320,180,"Центр",345,185],[320,215,"Оттяжка",345,235],[285,180,"Левый",120,187],[355,180,"Правый",410,187]].map(([x,y,label,lx,ly])=><g key={label}><circle cx={x} cy={y} r="5" fill="#9e352e"/><text x={lx} y={ly} fill="#fff2cf" fontSize="19">{label}</text></g>)}
        <text x="90" y="324" fill="#fff2cf" fontSize="18">Точки — ориентиры, не край наклейки</text>
      </> : kind==="stroke" ? <>
        <path d="M320 335V90" stroke="#f3df8b" strokeWidth="2" strokeDasharray="8 6"/>{sphere(320,120,28,"cue")}
        <path d="M320 360V166" stroke="#4f3a29" strokeWidth="14"/><path d="M320 320V158" stroke="#eee0b6" strokeWidth="7"/>
        <path d="M278 224Q260 209 270 195Q281 182 294 206L307 220L316 210L326 220L337 209Q352 194 361 208L368 244" fill="none" stroke="#d4b68b" strokeWidth="10" strokeLinecap="round"/>
        <text x="70" y="53" fill="#fff2cf" fontSize="20">Ровная подача по линии</text><text x="70" y="305" fill="#fff2cf" fontSize="18">Мост неподвижен · хват свободный</text>
      </> : <>
        {sphere(230,270,32,"cue")}{sphere(365,140,24,"object")}
        <path d="M230 370V310" stroke="#eee0b6" strokeWidth="9"/>
        <path d={kind==="bank" ? "M230 270L420 52L365 140" : "M230 270L340 166L365 140L510 42"} fill="none" stroke="#f4e19a" strokeWidth="3" strokeDasharray="7 5"/>
        <path d={kind==="motion" ? "M340 166L500 275" : "M340 166L260 90"} fill="none" stroke="#8ee9ff" strokeWidth="3"/>
        <circle cx="500" cy="275" r="32" fill="#87ddff" fillOpacity=".2" stroke="#87ddff" strokeDasharray="5 4"/>
        <text x="65" y="46" fill="#fff2cf" fontSize="19">Сначала забитие, затем контроль выхода</text>
        <text x="65" y="331" fill="#fff2cf" fontSize="17">Линии показывают задачу, а не симуляцию удара</text>
      </>}
    </svg>
  </div>;
}
