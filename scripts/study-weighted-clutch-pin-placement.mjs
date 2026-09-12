import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLinkage} from './lib/weighted-clutch-linkage.mjs';
import {makeWeightedClutchPinPlacement} from './lib/weighted-clutch-pin-placement.mjs';
import {weightedClutchStudContacts} from './lib/weighted-clutch-stud-contact.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-free-pin-placement',
 priorFile='artifacts/review/087-first-operating-proportions.json',prior=readStudyReport(priorFile),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources(['scripts/study-weighted-clutch-pin-placement.mjs','scripts/lib/weighted-clutch-pin-placement.mjs',
  'scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-stud-contact.mjs',
  'scripts/lib/study-report-io.mjs',priorFile],prefix),
 qLeft=prior.coupling.leverLeft,measured=makeWeightedClutchLinkage(),zero=makeWeightedClutchPinPlacement([[0,0],[0,0]]),
 targetReturnMoment=prior.rows[75].minimumCWTorque,rad=degrees=>degrees*Math.PI/180,rows=[];
verify();
let parityError=0,evaluations=0;
for(let i=0;i<=360;i++){
 const a=measured.atAngle(qLeft*i/360),b=zero.atAngle(qLeft*i/360);
 for(const k of ['bellAngle','rodAngle','weightAngle'])parityError=Math.max(parityError,Math.abs(a[k]-b[k]));
 for(const k of ['A','B'])for(let j=0;j<2;j++)parityError=Math.max(parityError,Math.abs(a[k][j]-b[k][j]));
}
assert.equal(parityError,0);
const displacements=(radius,angles)=>angles.map(a=>[radius*Math.cos(rad(a)),radius*Math.sin(rad(a))]);
function score(radius,angles){
 evaluations++;
 try{
  const linkage=makeWeightedClutchPinPlacement(displacements(radius,angles)),
   contacts=weightedClutchStudContacts(linkage,qLeft).contacts.filter(c=>c.approachCW);
  return contacts.length?Math.min(...contacts.map(c=>c.torqueG)):-2;
 }catch{return -2;}
}
function fit(radius){
 let best={angles:[0,0],moment:-2};
 for(let a=0;a<360;a+=15)for(let b=0;b<360;b+=15){
  const angles=[a,b],moment=score(radius,angles);if(moment>best.moment)best={angles,moment};
 }
 for(let step=7.5;step>1e-5;step/=2){
  let improved=true,count=0;
  while(improved&&count++<100){
   improved=false;const center=best.angles;
   for(const da of [-step,0,step])for(const db of [-step,0,step]){
    const angles=[center[0]+da,center[1]+db],moment=score(radius,angles);
    if(moment>best.moment+1e-13){best={angles,moment};improved=true;}
   }
  }
 }
 return{radius,...best,displacementsPixels:displacements(radius,best.angles)};
}
for(const radius of [30,40,50,60,65,70,75]){const r=fit(radius);rows.push(r);console.log(r);}
let low=0,high=75,best=fit(high);assert(best.moment>=targetReturnMoment);
for(let i=0;i<25;i++){
 const radius=(low+high)/2,r=fit(radius);if(r.moment>=targetReturnMoment){high=radius;best=r;}else low=radius;
}
const selected=fit(Math.ceil(high*10)/10),linkage=makeWeightedClutchPinPlacement(selected.displacementsPixels),branches=[];
let minimumForward=Infinity,minimumReturn=Infinity,maximumRodError=0,maximumBellIncrement=-Infinity;
for(const direction of ['CCW','CW'])for(let i=0;i<=512;i++){
 const q=direction==='CCW'?measured.parameters.overCenterAngle*i/512:
  measured.parameters.overCenterAngle+(qLeft-measured.parameters.overCenterAngle)*i/512,
  result=weightedClutchStudContacts(linkage,q),contacts=result.contacts.filter(c=>c['approach'+direction]),
  usefulMoment=contacts.length?Math.min(...contacts.map(c=>direction==='CCW'?-c.torqueG:c.torqueG)):-2;
 if(direction==='CCW')minimumForward=Math.min(minimumForward,usefulMoment);else minimumReturn=Math.min(minimumReturn,usefulMoment);
 branches.push({direction,q,contacts,usefulMoment});
}
let lastBell=null;
for(let i=0;i<=1024;i++){
 const state=linkage.atAngle(qLeft*i/1024);
 maximumRodError=Math.max(maximumRodError,Math.abs(Math.hypot(...state.B.map((v,k)=>v-state.A[k]))-linkage.parameters.rodLength));
 if(lastBell!==null)maximumBellIncrement=Math.max(maximumBellIncrement,state.bellAngle-lastBell);lastBell=state.bellAngle;
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,parityError,evaluations,
 qLeft,targetReturnMoment,rows,searchBracket:[low,high],selected,parameters:linkage.parameters,
 minimumForward,minimumReturn,maximumRodError,maximumBellIncrement,branches,
 qualification:'Independent planar pin-position search. Both displacement magnitudes share one bound; their directions vary independently. A coarse angle grid and local refinement seek the useful clockwise contact moment at the left stop, then 513 poses check each lifting branch. This is not a global minimum proof or a dynamics/native-mesh qualification. Other measured source points remain fixed.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({evaluations,parityError,targetReturnMoment,searchBracket:report.searchBracket,selected,minimumForward,minimumReturn,maximumRodError,maximumBellIncrement});
assert(minimumForward>0&&minimumReturn>=targetReturnMoment&&maximumRodError<1e-12&&maximumBellIncrement<0);
