import React, {useId} from "react";
import russianTable from "./assets/training-russian.webp";
import poolTable from "./assets/training-pool.webp";
import {ghostBall} from "./practice.js";

export default function PracticeTable({exercise:e,type,position=0,target=0,layoutCount=6,mirror=false}) {
  const id=useId().replace(/:/g,"");
  const height=type==="pool" ? 564 : 500;
  const point=([x,y])=>[70+x*430,(type==="pool" ? 78 : 80)+(mirror ? 1-y : y)*(type==="pool" ? 410 : 340)];
  const patterns={
    "side-series":Array.from({length:layoutCount},(_,i)=>{const half=layoutCount/2,j=i%half;return [.8+(j%3)*.2,i<half ? (layoutCount===12 ? .29-Math.floor(j/3)*.13 : .16) : (layoutCount===12 ? .71+Math.floor(j/3)*.13 : .84)];}),
    line:Array.from({length:6},(_,i)=>[.45+i*.22,.5]),
    cross:(layoutCount===4 ? [[1,.22],[1,.78],[.55,.5],[1.45,.5]] : [[1,.22],[1,.38],[1,.62],[1,.78],[.55,.5],[.75,.5],[1.25,.5],[1.45,.5]]),
    clearance:[[.4,.22],[.75,.68],[1.15,.2],[1.48,.7],[1.72,.35],[.32,.85]],
  };
  const balls=patterns[e.layout];
  const object=balls ? balls[target%balls.length] : e.object;
  const pocket=balls ? (e.layout==="side-series" ? [1,object[1]<.5 ? 0 : 1] : [object[0]<1 ? 0 : 2,object[1]<.5 ? 0 : 1]) : e.objectAim || e.pocket || [2,0];
  const start=e.positions?.[position] || e.cue;
  const cue=point(start),obj=point(object);
  const contact=e.layout==="rack" && !e.rackContact ? object : ghostBall(object,pocket,.028);
  const ghost=point(contact),end=point(pocket);
  const zone=e.zone || (e.id==="stop" ? contact : null);
  const direction=point(e.cuePath?.[0] || contact);
  const dx=direction[0]-cue[0],dy=direction[1]-cue[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
  const path=points=>points.map((p,i)=>`${i ? "L" : "M"}${point(p)}`).join("");
  function ball(p,key,number=null,isCue=false,opacity=1) {
    const [x,y]=point(p);
    return <g key={key} opacity={opacity} filter={`url(#${id}-shadow)`}><circle cx={x} cy={y} r="12" fill={`url(#${id}-${!isCue && type==="pool" ? "yellow" : "white"})`} stroke="#849d87" strokeWidth=".8"/>{isCue ? <path d={`M${x-5},${y}h10M${x},${y-5}v10`} stroke="#48675a" strokeWidth="1.5"/> : number!==null && <><circle cx={x} cy={y} r="7" fill="#fffbea"/><text x={x} y={y+4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#21392e">{number}</text></>}<ellipse cx={x-3} cy={y-5} rx="4" ry="2" fill="white" opacity=".7"/></g>;
  }
  return <svg className="practice-table" viewBox={`0 0 1000 ${height}`} role="img" aria-label={`Расстановка: ${e.title}. Кий, шары и направления ударов.`}>
    <defs>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eac19b"/><stop offset=".5" stopColor="#b87948"/><stop offset="1" stopColor="#83502f"/></linearGradient>
      <radialGradient id={`${id}-cloth`}><stop stopColor={type==="pool" ? "#249ec3" : "#12c987"}/><stop offset="1" stopColor={type==="pool" ? "#086282" : "#008052"}/></radialGradient>
      {[['white','#ffffff','#a7b7a2'],['yellow','#fff6b5','#d69a10']].map(([name,light,dark])=><radialGradient key={name} id={`${id}-${name}`} cx="30%" cy="25%" r="75%"><stop stopColor={light}/><stop offset=".5" stopColor={name==="yellow" ? '#f6d254' : '#eef1df'}/><stop offset="1" stopColor={dark}/></radialGradient>)}
      <filter id={`${id}-shadow`} x="-50%" y="-50%" width="220%" height="220%"><feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity=".4"/></filter>
      <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#fff8d1" strokeWidth="1.3"/></marker>
    </defs>
    <image href={type==="pool" ? poolTable : russianTable} width="1000" height={height} preserveAspectRatio="none"/>
    {e.targets?.map((p,i)=>{const [x,y]=point(p);return <g key={i} opacity={i===target ? 1 : .35}><rect x={x-27} y={y-24} width="54" height="48" rx="8" fill="#93e7ff" fillOpacity=".2" stroke="#b3eeff" strokeWidth="2" strokeDasharray="6 4"/><text x={x} y={y+6} textAnchor="middle" fontSize="20" fill="white">{i+1}</text></g>;})}
    {zone && <circle cx={point(zone)[0]} cy={point(zone)[1]} r="27" fill="#93e7ff" fillOpacity=".2" stroke="#b3eeff" strokeWidth="2" strokeDasharray="6 4"/>}
    {e.positions?.map((p,i)=>i!==position && <g key={i}>{ball(p,`alt${i}`,null,true,.3)}<text x={point(p)[0]+17} y={point(p)[1]-9} fontSize="22" fill="#e2f0c8" opacity=".7">{i+1}</text></g>)}
    <path fill="none" d={e.cuePath ? path([start,...e.cuePath]) : `M${cue}L${ghost}`} stroke="#f9e16e" strokeWidth="2.8" strokeDasharray="4 7"/>
    {e.layout!=="rack" && !e.noObject && !e.contactOnly && <path fill="none" d={e.objectPath ? path([object,...e.objectPath]) : `M${obj}L${end}`} stroke="#fff8d1" strokeWidth="2.8" markerEnd={`url(#${id}-arrow)`}/>}
    {e.cuePocket && <path d={`M${ghost}L${point(e.cuePocket)}`} stroke="#8ce8ff" strokeWidth="3" strokeDasharray="7 5" markerEnd={`url(#${id}-arrow)`}/>}
    {e.afterPath && <path d={path([contact,...e.afterPath])} fill="none" stroke="#8ce8ff" strokeWidth="3" strokeDasharray="7 5" markerEnd={`url(#${id}-arrow)`}/>}
    <line x1={cue[0]-ux*210} y1={cue[1]-uy*210} x2={cue[0]-ux*20} y2={cue[1]-uy*20} stroke="#795636" strokeWidth="7" strokeLinecap="round"/>
    <line x1={cue[0]-ux*180} y1={cue[1]-uy*180} x2={cue[0]-ux*20} y2={cue[1]-uy*20} stroke="#efdbad" strokeWidth="4" strokeLinecap="round"/>
    {e.layout==="rack" ? Array.from({length:5},(_,row)=>Array.from({length:row+1},(_,col)=>ball([(e.rackOrigin||e.object)[0]+row*.0485,(e.rackOrigin||e.object)[1]+(col-row/2)*.056],`r${row}-${col}`,1+row*(row+1)/2+col))).flat() : balls ? balls.map((p,i)=>ball(p,`pattern${i}`,i+1,false,i===target%balls.length ? 1 : .7)) : !e.noObject && ball(object,"object",type==="pool" ? 1 : null)}
    {e.layout!=="rack" && !e.noObject && !e.contactOnly && <circle cx={ghost[0]} cy={ghost[1]} r="12" fill="none" stroke="#f7ebad" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8"/>}
    {e.rackContact && <circle cx={obj[0]} cy={obj[1]} r="17" fill="none" stroke="#ffcf63" strokeWidth="2"/>}
    {ball(start,"cue",null,true)}
    <text x={cue[0]+18} y={cue[1]-13} fontSize="24" fontStyle="italic" fill="white">{e.positions ? position+1 : "Б"}</text>
  </svg>;
}
