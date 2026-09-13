import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLinkage} from './lib/weighted-clutch-linkage.mjs';
import {makeAdjustedWeightedClutchLinkage} from './lib/weighted-clutch-lost-motion.mjs';
import {weightedClutchStudContacts} from './lib/weighted-clutch-stud-contact.mjs';
import {makeWeightedClutchSourceFit,sourceFitStudContacts,sourceFitBranchMargins} from './lib/weighted-clutch-source-fit.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-distributed-source-fit',
  priorFile='artifacts/review/087-first-operating-proportions.json',prior=readStudyReport(priorFile),
  freeAngle=prior.coupling.freeAngle,measured=makeWeightedClutchLinkage(),adjusted=makeAdjustedWeightedClutchLinkage(75),
  shifts75=Object.fromEntries(['A','B'].map(name=>[name,adjusted.parameters[name+'0'].map((v,i)=>(v-measured.parameters[name+'0'][i])*300*(i===0?1:-1))])),
  reference=makeWeightedClutchSourceFit(shifts75,freeAngle),zero=makeWeightedClutchSourceFit({},freeAngle),
  baselineMargin=sourceFitBranchMargins(reference,512),target={forward:baselineMargin.forward*1.02,returning:baselineMargin.returning*1.02},
  sources=freezeStudySources(['scripts/study-weighted-clutch-distributed-fit.mjs','scripts/lib/weighted-clutch-source-fit.mjs',
    'scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-source.mjs',
    'scripts/lib/weighted-clutch-stud-contact.mjs','scripts/lib/study-report-io.mjs',priorFile],prefix);
let parity=0,derivativeError=0;
for(const[fit,old]of [[zero,measured],[reference,adjusted]])for(let i=0;i<=360;i++){
  const q=prior.coupling.leverLeft*i/360,a=fit.atAngle(q),b=old.atAngle(q),
    ca=sourceFitStudContacts(fit,q),cb=weightedClutchStudContacts(old,q);
  for(const k of ['bellAngle','rodAngle','weightAngle'])parity=Math.max(parity,Math.abs(a[k]-b[k]));
  for(const k of ['A','B'])for(let j=0;j<2;j++)parity=Math.max(parity,Math.abs(a[k][j]-b[k][j]));
  assert.equal(ca.contacts.length,cb.contacts.length);
  for(let j=0;j<ca.contacts.length;j++)for(const k of ['theta','torqueG','derivativeE'])parity=Math.max(parity,Math.abs(ca.contacts[j][k]-cb.contacts[j][k]));
  const h=1e-5,derivative=(fit.atAngle(q+h).bellAngle-fit.atAngle(q-h).bellAngle)/(2*h);
  derivativeError=Math.max(derivativeError,Math.abs(a.beta-derivative));
}
assert(parity<1e-12&&derivativeError<1e-8);
assert(Math.abs(reference.parameters.leverLeft-prior.coupling.leverLeft)<1e-12);

// A deterministic bounded differential-evolution search. It finds feasible
// fits; failures at smaller radii do not prove global infeasibility.
const names=['F','A','G','B','upper','E','stud'],dimension=13,rows=[];
function decode(vector,radius){
  let offset=0;const shifts={};
  for(const name of names){
    let x=Math.max(-1,Math.min(1,vector[offset++])),y=name==='E'?0:Math.max(-1,Math.min(1,vector[offset++]));
    const scale=Math.max(1,Math.hypot(x,y));shifts[name]=[radius*x/scale,radius*y/scale];
  }
  return shifts;
}
let evaluations=0;
function evaluate(vector,radius){
  evaluations++;
  try{
    const shifts=decode(vector,radius),fit=makeWeightedClutchSourceFit(shifts,freeAngle),m=sourceFitBranchMargins(fit,16),
      margin=Math.min(m.forward/target.forward,m.returning/target.returning),
      penalty=100*Math.max(0,.001-fit.parameters.pinEdgeMaterial)+10*Math.max(0,m.maximumBeta+.02)+10*Math.max(0,.02-m.minimumToggleDistance);
    return {score:margin-penalty,margin,penalty,shifts,m,vector};
  }catch{return{score:-100,vector};}
}
function search(radius,seed,warm){
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const population=Array.from({length:96},(_,i)=>evaluate(i===0&&warm?warm.vector:
    Array.from({length:dimension},()=>2*random()-1),radius));
  let best=population.reduce((a,b)=>a.score>b.score?a:b);
  for(let generation=0;generation<320;generation++){
    for(let i=0;i<population.length;i++){
      const indices=[];
      while(indices.length<3){const j=Math.floor(random()*population.length);if(j!==i&&!indices.includes(j))indices.push(j);}
      const[a,b,c]=indices.map(j=>population[j].vector),forced=Math.floor(random()*dimension),
        trial=population[i].vector.map((v,k)=>random()<.85||k===forced?Math.max(-1,Math.min(1,a[k]+.7*(b[k]-c[k]))):v),candidate=evaluate(trial,radius);
      if(candidate.score>=population[i].score)population[i]=candidate;
      if(candidate.score>best.score)best=candidate;
    }
  }
  // Coordinate polishing supplies reproducible local refinement, without a
  // claim that this or the population search found a global minimum.
  for(let step=.1;step>=.00001;step/=2){
    for(let round=0;round<20;round++){
      let improved=false;
      for(let k=0;k<dimension;k++)for(const sign of [-1,1]){
        const v=[...best.vector];v[k]=Math.max(-1,Math.min(1,v[k]+sign*step));
        const candidate=evaluate(v,radius);if(candidate.score>best.score+1e-12){best=candidate;improved=true;}
      }
      if(!improved)break;
    }
  }
  const result={radius,seed,...best};rows.push(result);
  console.log({radius,seed,score:best.score,margin:best.margin,penalty:best.penalty,shifts:best.shifts});
  return result;
}
let best=null,low=0,high=null;
for(const radius of [10,20,30,40,50]){
  const r=search(radius,87000+radius,best);best=r;
  if(r.margin>=1&&r.penalty===0){high=radius;break;}low=radius;
}
assert(high!==null,'No feasible fit found within the studied bounds');
for(let i=0;i<4;i++){
  const radius=(low+high)/2,r=search(radius,87100+i,best);
  if(r.margin>=1&&r.penalty===0){high=radius;best=r;}else low=radius;
}
const radius=Math.ceil(high),selected=search(radius,87200,best),fit=makeWeightedClutchSourceFit(selected.shifts,freeAngle),
  margins=sourceFitBranchMargins(fit,2048),branches=[];
assert(selected.margin>=1&&selected.penalty===0&&margins.forward>=baselineMargin.forward&&margins.returning>=baselineMargin.returning);
for(const direction of ['CCW','CW'])for(let i=0;i<=512;i++){
  const q=direction==='CCW'?fit.parameters.overCenterAngle*i/512:
    fit.parameters.overCenterAngle+(fit.parameters.leverLeft-fit.parameters.overCenterAngle)*i/512,
    r=sourceFitStudContacts(fit,q);
  branches.push({direction,...r,contacts:r.contacts.filter(c=>c['approach'+direction])});
}
const crossing={};
for(const[label,fn]of [['usefulReturn',q=>sourceFitStudContacts(zero,q).contacts.filter(c=>c.approachCW).reduce((m,c)=>Math.min(m,c.torqueG),Infinity)],
  ['radialReach',q=>-sourceFitStudContacts(zero,q).radialGap]]){
  let lo=0,hi=Math.PI/2;
  for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(fn(mid)>0)lo=mid;else hi=mid;}
  crossing[label]=(lo+hi)/2;
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
  freeAngle,baselineMargin,target,parity,derivativeError,evaluations,searchBracket:[low,high],rows,selected,
  parameters:fit.parameters,margins,branches,measuredLimits:{...crossing,overCenterAngle:zero.parameters.overCenterAngle},
  qualification:'Deterministic distributed source-point fit retaining the existing full slot lost motion. All seven fitted feature displacements share one pixel bound; E stays on the horizontal shaft axis. The weighted lever retains positive material around its rod-pin bore. The sampled generalized lifting-force margins equal or exceed the earlier 75-pixel candidate. This is a feasible planar fit, not a global optimum, a new source measurement, native-solid or gravity/contact-dynamics qualification.'},null,2)+'\n',{flag:'wx'});
console.log({parity,derivativeError,evaluations,searchBracket:[low,high],maximumDisplacement:fit.parameters.maximumDisplacement,margins,measuredLimits:crossing});
