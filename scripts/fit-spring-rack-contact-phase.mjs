import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackContact} from './lib/spring-rack-contact-study.mjs';
const base='artifacts/review/',measured=JSON.parse(fs.readFileSync(base+'081-source-measurements-refined.json')),
 phase=JSON.parse(fs.readFileSync(base+'081-first-phase-study.json')),model=makeSpringRackCandidate(),p=model.root.userData.geometry,
 contact=makeSpringRackContact(model),reference=phase.boundaries.find(b=>b.contacts.rows.every(r=>r.J>0)).y,queries=[];
const evaluate=q=>{
 const estimate=reference-p.pitchRadius*q;let lo=estimate-.0007,hi=estimate+.0007;
 assert(contact.pair(q,lo,0).minimumGap<0,'lower bracket');assert(contact.pair(q,hi,0).minimumGap>0,'upper bracket');
 for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(contact.pair(q,mid,0).minimumGap<0)lo=mid;else hi=mid;}
 const y=(lo+hi)/2,rackShift=-y*p.source.scale,
  rackResiduals=measured.rack.readings.filter(r=>r.index!==3&&r.index!==4).map(r=>p.source.rackUpperStrokeOrigin+r.index*p.source.pitch+rackShift-r.point[1]),
  gearResiduals=measured.gear.readings.filter(r=>!r.hidden).map(r=>{
   const angle=p.gearPhase+q+r.index*2*Math.PI/p.teeth,point=[p.source.center[0]+p.source.gearTipRadius*Math.cos(angle),p.source.center[1]-p.source.gearTipRadius*Math.sin(angle)];
   return {index:r.index,point,error:Math.hypot(point[0]-r.point[0],point[1]-r.point[1])};
  }),cost=rackResiduals.reduce((s,v)=>s+v*v,0)+gearResiduals.reduce((s,r)=>s+r.error*r.error,0),
  result={q,y,rackShift,cost,rackResiduals,gearResiduals};queries.push({q,y,cost});return result;
};
let lo=-.06,hi=.02;const ratio=(Math.sqrt(5)-1)/2;let x1=hi-ratio*(hi-lo),x2=lo+ratio*(hi-lo),r1=evaluate(x1),r2=evaluate(x2);
for(let i=0;i<32;i++){if(r1.cost<r2.cost){hi=x2;x2=x1;r2=r1;x1=hi-ratio*(hi-lo);r1=evaluate(x1);}else{lo=x1;x1=x2;r1=r2;x2=lo+ratio*(hi-lo);r2=evaluate(x2);}}
const best=r1.cost<r2.cost?r1:r2,options={gearPhaseOffset:best.q,rackPhasePixels:best.rackShift-.00002},
 fitted=makeSpringRackCandidate(options),check=makeSpringRackContact(fitted).pair(0,0,1e-6);
assert(check.minimumGap>=-1e-6);assert(check.rows.some(r=>r.J>.9));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sources=[];
for(const file of ['scripts/fit-spring-rack-contact-phase.mjs','scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-contact-study.mjs',
 'scripts/lib/spring-rack-source.mjs',base+'081-source-measurements-refined.json',base+'081-first-phase-study.json']){
 const archive=base+'081-fitted-source-pose-source-'+sources.length+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});
}
const report={movement:81,status:'source-pose-contact-phase-fitted',productionChanged:false,mechanicsPassed:false,options,best,queries,
 checks:{minimumGap:check.minimumGap,contacts:check.rows},rackStrokeRmsPixels:Math.sqrt(best.rackResiduals.reduce((s,v)=>s+v*v,0)/best.rackResiduals.length),
 gearTipRmsPixels:Math.sqrt(best.gearResiduals.reduce((s,r)=>s+r.error*r.error,0)/best.gearResiduals.length),
 sources,qualification:'Equal-weight least-squares fit of five visible rack strokes and five visible gear tips, constrained to the actual polygon support boundary. It adjusts only the gear angular phase and rack tooth placement, retaining the measured pitch, counts and all other geometry. A 0.00002-source-pixel offset leaves a small positive starting clearance. Actual 3D source-pose surfaces, loaded travel and finite entry/release remain to be checked.'};
fs.writeFileSync(base+'081-fitted-source-pose.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({options,rackRms:report.rackStrokeRmsPixels,gearRms:report.gearTipRmsPixels,minimumGap:check.minimumGap,contacts:check.rows.length});
