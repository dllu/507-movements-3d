import{readFile,writeFile}from'node:fs/promises';
import{makeMutilatedBevelCandidate}from'./lib/mutilated-bevel-candidate.mjs';
import{relieveSectorEnds,relieveSectorEndsContinuous}from'./lib/mutilated-bevel-tooth-relief.mjs';
import{prepareBevelSurfaces,sampleBevelPair}from'./lib/bevel-working-surfaces.mjs';

const parameters=process.env.CANDIDATE_PARAMETERS?JSON.parse(await readFile(process.env.CANDIDATE_PARAMETERS,'utf8')):{},
  model=makeMutilatedBevelCandidate(parameters),cut=process.env.CUT_MODE==='continuous'?relieveSectorEndsContinuous:relieveSectorEnds,
  relief=cut(model,{endTeeth:Number(process.env.END_TEETH??1),steps:Number(process.env.CUT_STEPS??720)}),{blocks:b,geometry:p}=model.root.userData;
console.log(relief.rows.map(({polygons,...row})=>row));
const A=prepareBevelSurfaces(b.gearA),C=prepareBevelSurfaces(b.driverC),rows=[];
for(let i=0;i<193;i++){
  const coordinate=(i+.319)/193,time=(coordinate-p.initialCyclePhase)*p.period;
  model.update(time);model.root.updateMatrixWorld(true);const a=sampleBevelPair(A,C),c=sampleBevelPair(C,A);
  rows.push({coordinate,indexing:model.root.userData.kinematics.indexingA,gap:Math.min(a.gap,c.gap),inside:a.inside+c.inside,checks:a.checks+c.checks,witness:a.gap<c.gap?a.witness:c.witness});
}
const report={movement:74,status:'isolated-end-tooth-relief-study',productionChanged:false,parameters:p,relief,rows,
  inside:rows.reduce((sum,r)=>sum+r.inside,0),minimumGap:Math.min(...rows.map(r=>r.gap)),
  qualification:'One A/C full-cycle sampled clearance study after end-tooth relief. This is not full hardware or sustained-contact acceptance.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-initial-relief-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({inside:report.inside,minimumGap:report.minimumGap});
