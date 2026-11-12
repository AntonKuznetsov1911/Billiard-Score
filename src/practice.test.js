import {describe,it,expect} from "vitest";
import {attempts,cleanPractice,mergePractice,ghostBall,EXERCISES} from "./practice.js";
import {loadInitial,normalizeData,mergeData,restoreSnapshot} from "./gameLogic.js";
const run={id:"run",exerciseId:"straight",gameType:"russian",startedAt:100,events:[{id:"one",success:true,at:101}],undone:[]};
describe("guided practice",()=>{
  it("aims at a tangent ghost ball on the object-pocket line",()=>{
    for(const e of EXERCISES){const g=ghostBall(e.object);expect(Math.hypot(g[0]-e.object[0],g[1]-e.object[1])).toBeCloseTo(.048);expect((g[0]-e.object[0])*(0-e.object[1])-(g[1]-e.object[1])*(2-e.object[0])).toBeCloseTo(0);}
  });
  it("rejects malformed records and keeps only ten visible attempts",()=>{
    expect(cleanPractice([null,{...run,exerciseId:"bad"},{...run,startedAt:Infinity}])).toEqual([]);
    expect(attempts({...run,events:Array.from({length:12},(_,i)=>({id:String(i),at:i,success:true})),undone:["0"]})).toHaveLength(10);
  });
  it("unions offline attempts and undo events without duplicate runs",()=>{
    const other={...run,events:[{id:"two",success:false,at:102}],undone:["one"]};
    const result=mergePractice([run],[other]);expect(result).toHaveLength(1);expect(attempts(result[0]).map(e=>e.id)).toEqual(["two"]);
    expect(mergePractice(result,result)).toEqual(result);
    expect(mergePractice([other],[run])).toEqual(result);
  });
  it("preserves progress in normalization, merges, backups and reset generations",()=>{
    const a={...loadInitial(),practiceSessions:[run],updatedAt:101};
    expect(normalizeData(a).practiceSessions).toHaveLength(1);
    expect(mergeData(a,{...loadInitial(),updatedAt:102}).practiceSessions).toHaveLength(1);
    expect(mergeData(a,{...loadInitial(),practiceResetAt:200,updatedAt:200}).practiceSessions).toEqual([]);
    expect(restoreSnapshot(a,loadInitial(),300).practiceSessions).toEqual([]);
    expect(a.matches).toEqual([]);
  });
});
