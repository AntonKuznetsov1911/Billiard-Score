import React, {useId} from "react";
import {ghostBall} from "./practice.js";

export default function PracticeTable({exercise:e,type,position=0,target=0}) {
  const id=useId().replace(/:/g,"");
  const point=([x,y])=>[70+x*430,65+y*430];
  const start=e.positions?.[position] || e.cue;
  const cue=point(start),obj=point(e.object),aim=e.objectAim || e.pocket || [2,0];
  const contact=e.layout==="rack" ? e.object : ghostBall(e.object,aim,.028);
  const ghost=point(contact),end=point(aim);
  const zone=e.zone || (e.id==="stop" ? contact : null);
  const dx=ghost[0]-cue[0],dy=ghost[1]-cue[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
  function ball(p,key,number=null,isCue=false,opacity=1) {
    const [x,y]=point(p);
    return <g key={key} opacity={opacity} filter={`url(#${id}-shadow)`}><circle cx={x} cy={y} r="12" fill={`url(#${id}-${!isCue && type==="pool" ? "yellow" : "white"})`} stroke="#849d87" strokeWidth=".8"/>{isCue ? <path d={`M${x-5},${y}h10M${x},${y-5}v10`} stroke="#48675a" strokeWidth="1.5"/> : number!==null && <><circle cx={x} cy={y} r="7" fill="#fffbea"/><text x={x} y={y+4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#21392e">{number}</text></>}<ellipse cx={x-3} cy={y-5} rx="4" ry="2" fill="white" opacity=".7"/></g>;
  }
  return <svg className="practice-table" viewBox="0 0 1000 560" role="img" aria-label={`Расстановка: ${e.title}. Кий, шары и направления ударов.`}>
    <defs>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eac19b"/><stop offset=".5" stopColor="#b87948"/><stop offset="1" stopColor="#83502f"/></linearGradient>
      <radialGradient id={`${id}-cloth`}><stop stopColor={type==="pool" ? "#249ec3" : "#12c987"}/><stop offset="1" stopColor={type==="pool" ? "#086282" : "#008052"}/></radialGradient>
      {[['white','#ffffff','#a7b7a2'],['yellow','#fff6b5','#d69a10']].map(([name,light,dark])=><radialGradient key={name} id={`${id}-${name}`} cx="30%" cy="25%" r="75%"><stop stopColor={light}/><stop offset=".5" stopColor={name==="yellow" ? '#f6d254' : '#eef1df'}/><stop offset="1" stopColor={dark}/></radialGradient>)}
      <filter id={`${id}-shadow`} x="-50%" y="-50%" width="220%" height="220%"><feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity=".4"/></filter>
      <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#fff8d1" strokeWidth="1.3"/></marker>
    </defs>
    <rect x="18" y="13" width="964" height="534" rx="34" fill={`url(#${id}-wood)`} stroke="#c9a06b" strokeWidth="3"/>
    <rect x="51" y="46" width="898" height="468" rx="16" fill={type==="pool" ? '#104c64' : '#075e3c'}/>
    <rect x="70" y="65" width="860" height="430" fill={`url(#${id}-cloth)`}/>
    <path d="M70 65L90 84H910L930 65M70 495L90 476H910L930 495" fill={type==="pool" ? '#1687a5' : '#0db576'} stroke="#ffffff" strokeOpacity=".2"/>
    <path d="M70 65L89 85V475L70 495ZM930 65L911 85V475L930 495Z" fill={type==="pool" ? '#08657c' : '#008b57'}/>
    {Array.from({length:7},(_,i)=><g key={i} fill="#f4d9af"><circle cx={177.5+i*107.5} cy="31" r="2.5"/><circle cx={177.5+i*107.5} cy="529" r="2.5"/></g>)}
    {[[70,65],[500,59],[930,65],[70,495],[500,501],[930,495]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="19" fill="#17382b"/><circle cx={x} cy={y+2} r="15" fill="#101c16" stroke="#71613d" strokeWidth="2"/></g>)}
    {e.targets?.map((p,i)=>{const [x,y]=point(p);return <g key={i} opacity={i===target ? 1 : .35}><rect x={x-27} y={y-24} width="54" height="48" rx="8" fill="#93e7ff" fillOpacity=".2" stroke="#b3eeff" strokeWidth="2" strokeDasharray="6 4"/><text x={x} y={y+6} textAnchor="middle" fontSize="20" fill="white">{i+1}</text></g>;})}
    {zone && <circle cx={point(zone)[0]} cy={point(zone)[1]} r="27" fill="#93e7ff" fillOpacity=".2" stroke="#b3eeff" strokeWidth="2" strokeDasharray="6 4"/>}
    {e.positions?.map((p,i)=>i!==position && <g key={i}>{ball(p,`alt${i}`,null,true,.3)}<text x={point(p)[0]+17} y={point(p)[1]-9} fontSize="22" fill="#e2f0c8" opacity=".7">{i+1}</text></g>)}
    <path d={`M${cue}L${ghost}`} stroke="#f9e16e" strokeWidth="2.8" strokeDasharray="4 7"/>
    {e.layout!=="rack" && <path d={`M${obj}L${end}`} stroke="#fff8d1" strokeWidth="2.8" markerEnd={`url(#${id}-arrow)`}/>}
    {e.cuePocket && <path d={`M${ghost}L${point(e.cuePocket)}`} stroke="#8ce8ff" strokeWidth="3" strokeDasharray="7 5" markerEnd={`url(#${id}-arrow)`}/>}
    <line x1={cue[0]-ux*210} y1={cue[1]-uy*210} x2={cue[0]-ux*20} y2={cue[1]-uy*20} stroke="#795636" strokeWidth="7" strokeLinecap="round"/>
    <line x1={cue[0]-ux*180} y1={cue[1]-uy*180} x2={cue[0]-ux*20} y2={cue[1]-uy*20} stroke="#efdbad" strokeWidth="4" strokeLinecap="round"/>
    {e.layout==="rack" ? Array.from({length:5},(_,row)=>Array.from({length:row+1},(_,col)=>ball([e.object[0]+row*.0485,e.object[1]+(col-row/2)*.056],`r${row}-${col}`,1+row*(row+1)/2+col))).flat() : ball(e.object,"object",type==="pool" ? 1 : null)}
    {e.layout!=="rack" && <circle cx={ghost[0]} cy={ghost[1]} r="12" fill="none" stroke="#f7ebad" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8"/>}
    {ball(start,"cue",null,true)}
    <text x={cue[0]+18} y={cue[1]-13} fontSize="24" fontStyle="italic" fill="white">{e.positions ? position+1 : "Б"}</text>
  </svg>;
}
