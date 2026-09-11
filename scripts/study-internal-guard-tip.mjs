import{readFile,writeFile}from'node:fs/promises';
import{makeInternalGuardStudy}from'./lib/internal-guard-study.mjs';
import{projectOpenRimTappet}from'./lib/open-rim-tappet-study.mjs';
const source=JSON.parse(await readFile('artifacts/review/071-source-layout-study.json','utf8')),trials=[];
for(const centerDistance of [1.62,1.68,1.7315955309684])for(const tipExtension of [-.08,-.04,.03,.06,.09,.12,.15])
  for(const lowerCenter of [.95,1.15,1.35]){
    const study=makeInternalGuardStudy(source,{centerDistance,tipExtension,lowerCenter});
    const result=projectOpenRimTappet(study,{steps:1040,begin:1.6,end:5.4});
    trials.push(result);
    console.log({centerDistance,tipExtension,lowerCenter,poses:result.poses,u:result.actualAdvance,
      peak:result.maximumSpeed,at:result.failed[0]?.angle,why:result.failed[0]?.reason});
  }
await writeFile('artifacts/review/071-tip-notch-trials.json',JSON.stringify({movement:71,productionChanged:false,status:'isolated-tip-and-exit-notch-trials',
  method:'Vary the source tappet tip length, shaft spacing and lower-notch position to test whether an earlier encounter with a different stud can produce a continuous single index. These variants do not establish a source interpretation or acceptance.',trials},null,2)+'\n',{flag:'wx'});
