import{readFile,writeFile}from'node:fs/promises';
import{makeInternalGuardStudy}from'./lib/internal-guard-study.mjs';
import{projectOpenRimTappet}from'./lib/open-rim-tappet-study.mjs';
const source=JSON.parse(await readFile('artifacts/review/071-source-layout-study.json','utf8'));
const original=makeInternalGuardStudy(source),withoutGuard=makeInternalGuardStudy(source,{disableGuard:true});
const free=projectOpenRimTappet(withoutGuard,{steps:4160,begin:2.2,end:5.1});
const angle=3.5022115384615384,samples=[];
for(const advance of [.3946334959442602,.397,.40,.45,.50,.55,.60,.62831853])samples.push({angle,advance,all:original.atAngle(angle)(advance,true),tappetOnly:withoutGuard.atAngle(angle)(advance,true)});
const variants=[];
for(const upperCenter of [-.4,-.6,-.8,-1,-1.2]){
  const study=makeInternalGuardStudy(source,{upperCenter});
  const result=projectOpenRimTappet(study,{steps:1040,begin:2.2,end:5.1});variants.push(result);
  console.log({upperCenter,poses:result.poses,advance:result.actualAdvance,peak:result.maximumSpeed,failure:result.failed[0]});
}
await writeFile('artifacts/review/071-upper-opening-obstruction.json',JSON.stringify({movement:71,status:'isolated-obstruction-diagnosis',productionChanged:false,
  method:'Recover the complete set of penetrating features near the earlier jump. A tappet-only study separates its local continuity from the guard obstruction. Upper opening centers are varied while retaining all other trial dimensions. These are diagnostic changes; source fidelity, forces and full 3D acceptance remain pending.',
  samples,tappetOnly:free,variants},null,2)+'\n',{flag:'wx'});
