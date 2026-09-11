import{readFile,writeFile}from'node:fs/promises';
import{makeInternalGuardStudy}from'./lib/internal-guard-study.mjs';
import{projectOpenRimTappet}from'./lib/open-rim-tappet-study.mjs';
const source=JSON.parse(await readFile('artifacts/review/071-source-layout-study.json','utf8')),trials=[];
for(const feature of ['pin-only','tappet-and-pin'])for(const upperCenter of [-.4,-.6,-.8,-1])for(const lowerHalfAngle of [.2,.3,.4]){
  const study=makeInternalGuardStudy(source,{upperCenter,lowerHalfAngle,driverPin:feature==='pin-only',additionalDriverPin:feature==='tappet-and-pin'});
  const result=projectOpenRimTappet(study,{steps:1040,begin:2.2,end:5.1});trials.push({feature,...result});
  console.log({feature,upperCenter,lowerHalfAngle,poses:result.poses,advance:result.actualAdvance,peak:result.maximumSpeed,failure:result.failed[0]?.reason});
}
await writeFile('artifacts/review/071-extra-mark-trials.json',JSON.stringify({movement:71,status:'isolated-extra-mark-hypotheses',productionChanged:false,
  method:'Treat the extra circular source mark as an input-carried pin, either alone or alongside the traced tappet, and test whole finite-stud clearance. This is an explicit hypothesis about an unresolved source mark; the source description does not establish that it is an additional drive pin. No physical or source-fidelity acceptance is implied.',trials},null,2)+'\n',{flag:'wx'});
