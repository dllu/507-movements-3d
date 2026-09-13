import fs from 'node:fs';
import assert from 'node:assert/strict';
import source from './lib/weighted-clutch-source.mjs';
import {makeWeightedClutchLinkage} from './lib/weighted-clutch-linkage.mjs';
import {canonicalWeightedClutchFit} from './lib/weighted-clutch-distributed-candidate.mjs';
import {sourceFitBranchMargins} from './lib/weighted-clutch-source-fit.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-fixed-orbit-fit',
  input='artifacts/review/087-first-distributed-source-fit.json',prior=readStudyReport(input),
  target=prior.target,freeAngle=prior.freeAngle,names=['F','A','G','B','upper'],dimension=10,
  orbit=Math.hypot(...source.wheelE.stud.center.map((x,i)=>x-source.wheelE.hub.center[i]))/source.scale,
  sources=freezeStudySources([...distributedClutchSources,input,'scripts/study-weighted-clutch-fixed-orbit-fit.mjs'],prefix),
  measured=makeWeightedClutchLinkage().parameters,rows=[];
verifyStudySources(prior.sources);
let evaluations=0;
function decode(vector,radius){
  const shifts={E:[0,0],stud:[0,source.origin[1]-source.wheelE.hub.center[1]]};
  for(let i=0;i<names.length;i++){
    const x=Math.max(-1,Math.min(1,vector[2*i])),y=Math.max(-1,Math.min(1,vector[2*i+1])),scale=Math.max(1,Math.hypot(x,y));
    shifts[names[i]]=[radius*x/scale,radius*y/scale];
  }
  return shifts;
}
function evaluate(vector,radius){
  evaluations++;
  try{
    const shifts=decode(vector,radius),fit=canonicalWeightedClutchFit({shifts,freeAngle}),L=fit.parameters,m=sourceFitBranchMargins(fit,24),
      margin=Math.min(m.forward/target.forward,m.returning/target.returning),
      penalty=1000*Math.max(0,.003-L.pinEdgeMaterial)+
        1000*Math.max(0,L.maximumDisplacement-radius-1e-9)/source.scale+
        10*Math.max(0,m.maximumBeta+.02)+10*Math.max(0,.02-m.minimumToggleDistance),
      meanSquared=Object.values(L.shifts).reduce((s,p)=>s+p[0]**2+p[1]**2,0)/7;
    assert(Math.abs(L.orbit-orbit)<1e-12);
    // Once a modest force reserve is available, prefer lower aggregate
    // displacement rather than buying still more force with source error.
    return {score:Math.min(margin,1.05)-penalty-.02*meanSquared/radius**2,
      margin,penalty,meanSquared,shifts,actualShifts:L.shifts,m,vector,maximumDisplacement:L.maximumDisplacement};
  }catch{return{score:-100,vector};}
}
const sourceUnit=p=>{const d=[p[0],-p[1]],l=Math.hypot(...d);return d.map(v=>v/l);},
  a=sourceUnit(measured.armF),b=sourceUnit(measured.armG),
  radialSeed=[...a,...a.map(x=>-x),...b.map(x=>-x),...b,0,0];
function search(radius,seed,warm){
  let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const population=Array.from({length:96},(_,i)=>evaluate(i===0&&warm?warm.vector:i===1?radialSeed:
    Array.from({length:dimension},()=>2*random()-1),radius));
  let best=population.reduce((a,b)=>a.score>b.score?a:b);
  for(let generation=0;generation<400;generation++)for(let i=0;i<population.length;i++){
    const indices=[];
    while(indices.length<3){const j=Math.floor(random()*population.length);if(j!==i&&!indices.includes(j))indices.push(j);}
    const[a,b,c]=indices.map(j=>population[j].vector),forced=Math.floor(random()*dimension),
      vector=population[i].vector.map((v,k)=>random()<.85||k===forced?Math.max(-1,Math.min(1,a[k]+.7*(b[k]-c[k]))):v),candidate=evaluate(vector,radius);
    if(candidate.score>=population[i].score)population[i]=candidate;if(candidate.score>best.score)best=candidate;
  }
  for(let step=.1;step>=1e-5;step/=2)for(let round=0;round<24;round++){
    let improved=false;
    for(let k=0;k<dimension;k++)for(const sign of [-1,1]){
      const v=[...best.vector];v[k]=Math.max(-1,Math.min(1,v[k]+sign*step));const candidate=evaluate(v,radius);
      if(candidate.score>best.score+1e-12){best=candidate;improved=true;}
    }
    if(!improved)break;
  }
  const row={radius,seed,...best};rows.push(row);
  console.log({radius,score:best.score,margin:best.margin,penalty:best.penalty,rms:Math.sqrt(best.meanSquared),actualShifts:best.actualShifts});
  return row;
}
let best=null,low=0,high=null;
for(const radius of [25,30,35,40,45,50]){
  const r=search(radius,87300+radius,best);best=r;
  if(r.margin>=1&&r.penalty===0){high=radius;break;}low=radius;
}
assert(high!==null,'No feasible fixed-orbit fit in the searched bounds');
for(let i=0;i<4;i++){
  const radius=(low+high)/2,r=search(radius,87400+i,best);
  if(r.margin>=1&&r.penalty===0){high=radius;best=r;}else low=radius;
}
const selected=search(Math.ceil(high),87500,best),options={shifts:selected.shifts,freeAngle},
  fit=canonicalWeightedClutchFit(options),L=fit.parameters,margins=sourceFitBranchMargins(fit,2048),
  studInsideMargin=(source.wheelE.outer.radius/source.scale-L.orbit-L.studRadius)*source.scale;
assert(selected.margin>=1&&selected.penalty===0&&margins.forward>=prior.baselineMargin.forward&&margins.returning>=prior.baselineMargin.returning);
assert(Math.abs(L.orbit-orbit)<1e-12&&Math.abs(L.shifts.E[0])<1e-12&&studInsideMargin>32);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input,options,freeAngle,orbit,target,evaluations,searchBracket:[low,high],rows,selected,parameters:L,margins,studInsideMargin,
  qualification:'A feasible deterministic source fit retaining E center in X, its measured stud orbit, and the source stud/rim margin. E and its pinion remain coaxial with the long shaft; initial stud contact and its actual displacement are included in the fit. Five linkage points vary inside a common source-pixel bound. Force reserve is capped in the objective so aggregate landmark error also matters. This is not a global optimum, native-solid or full-dynamics qualification.'},null,2)+'\n',{flag:'wx'});
console.log({evaluations,searchBracket:[low,high],maximumDisplacement:L.maximumDisplacement,margins,studInsideMargin});
