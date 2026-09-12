import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-release-check',
 coarseFile='artifacts/review/087-first-key-release.json',coarse=readStudyReport(coarseFile),
 fineFile='artifacts/review/087-quarter-key-release.json',fine=readStudyReport(fineFile),
 impactFile='artifacts/review/087-first-key-impact.json',impact=readStudyReport(impactFile),
 files=[coarseFile,fineFile,...coarse.summaries.map(s=>s.file),...fine.summaries.map(s=>s.file),impactFile],
 sources=freezeStudySources([...fine.sources.map(s=>s.file),...files,'scripts/check-weighted-clutch-key-release.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),jaws=makeWeightedClutchNativeJaws(model),branches=[],dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
for(const r of [coarse,fine,impact])verifyStudySources(r.sources);
function at(rows,t){
 let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);
 return{time:t,q:a.q.map((v,k)=>v+f*(b.q[k]-v))};
}
for(const summary of fine.summaries){
 const first=impact.rows.find(r=>r.direction===summary.direction&&r.staticCoefficient===.78),
  report=readStudyReport(summary.file),other=readStudyReport(coarse.summaries.find(s=>s.direction===summary.direction).file),
  d=makeWeightedClutchKeyDynamics(model,first.profile,first),maxCoordinateDifference=[0,0,0,0,0],
  metrics={maximumMomentumResidual:0,minimumGap:Infinity,minimumImpulse:Infinity,maximumContactVelocityResidual:0,
   maximumFrictionConeExcess:0,maximumSlidingLawError:0,maximumFrictionPower:0,maximumKeyGapWithFriction:0,
   absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0,minimumPhysicalContactLoss:Infinity,
   minimumShaftSpeed:Infinity,maximumShaftSpeed:-Infinity},native=[],keyEvents=[];
 let previousKey=null;
 for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),contacts=d.query(b.q,b.time),
   momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+
    c.tangentImpulse*(c.tangent?.[k]??0),0)),vAverage=a.v.map((v,k)=>(v+b.v[k])/2),
   actualContactWork=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,vAverage)+c.tangentImpulse*(c.tangent?dot(c.tangent,vAverage):0),0),
   contactLoss=b.work-a.work-actualContactWork,defect=b.energy-a.energy-actualContactWork,
   activeKey=b.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12);
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));
  metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  metrics.maximumContactVelocityResidual=Math.max(metrics.maximumContactVelocityResidual,
   ...b.active.map(c=>Math.abs(dot(c.gradient,b.v)+c.inputGradient*d.parameters.omegaInput)));
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
  metrics.minimumPhysicalContactLoss=Math.min(metrics.minimumPhysicalContactLoss,contactLoss);
  metrics.minimumShaftSpeed=Math.min(metrics.minimumShaftSpeed,b.v[3]);metrics.maximumShaftSpeed=Math.max(metrics.maximumShaftSpeed,b.v[3]);
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
   const sliding=b.mode.startsWith('slide'),mu=sliding?first.kineticCoefficient:first.staticCoefficient,
    slip=dot(c.tangent,b.v),cone=Math.abs(c.tangentImpulse)-mu*c.impulse;
   metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,cone);
   if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,
    Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
   metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
   if(Math.abs(c.tangentImpulse)>1e-12)metrics.maximumKeyGapWithFriction=Math.max(metrics.maximumKeyGapWithFriction,
    Math.abs(contacts.find(x=>x.kind===c.kind).gap));
  }
  const key=activeKey?.kind??null;
  if(key!==previousKey)keyEvents.push({time:b.time,bracket:[a.time,b.time],kind:key,q:b.q,v:b.v});
  previousKey=key;
 }
 for(let i=0;i<=128;i++){
  const t=Math.min(report.end.time,other.end.time)*i/128,a=at(report.rows,t),b=at(other.rows,t);
  for(let k=0;k<5;k++)maxCoordinateDifference[k]=Math.max(maxCoordinateDifference[k],Math.abs(a.q[k]-b.q[k]));
 }
 // Interpolate deliberately between saved time knots, then query both native
 // jaw solids independently of the measured profile used by the integrator.
 for(let i=0;i<=32;i++){
  const t=report.end.time*(i===32?32:i+.271)/32,row=at(report.rows,t),phase=d.phase(row.q,t),
   queries=['left','right'].map(side=>jaws.evaluate(side,row.q[4]+(side==='left'?-1:1)*model.root.userData.geometry.mainRatio*phase.input,row.q[2]));
  native.push({...row,phase,jaws:queries,key:d.key.query(row.q).map(c=>({kind:c.kind,gap:c.gap})),
   coupling:d.coupling.query(row.q).map(c=>({kind:c.kind,gap:c.gap})),studGap:d.stud.evaluate(row.q[0],phase.e).gap});
 }
 const result={direction:summary.direction,states:report.rows.length,h:report.h,...metrics,keyEvents,maxCoordinateDifference,
  withdrawal:summary.withdrawal,
  releaseEvent:summary.events.find(e=>e.kind==='axial-release'),coarseReleaseEvent:other.events.find(e=>e.kind==='axial-release'),minimumNativeJawGap:Math.min(...native.flatMap(n=>n.jaws.map(j=>j.gap))),
  minimumNativeOffstepGap:Math.min(...native.flatMap(n=>[n.studGap,...n.key.map(c=>c.gap),...n.coupling.map(c=>c.gap)])),
  outputPhaseDeparture:report.end.q[3]-report.start.q[3]-d.parameters.omegaOutput*report.end.time,
  releaseTimeDifference:Math.abs(summary.events.find(e=>e.kind==='axial-release').time-other.events.find(e=>e.kind==='axial-release').time),
  native};
 branches.push(result);console.log({...result,native:native.length,keyEvents:keyEvents.map(e=>({time:e.time,kind:e.kind}))});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,branches,
 qualification:'Independent momentum, complementarity, Coulomb-cone and physical contact-work checks from next-stud impact through first .002 withdrawal. Common-clock comparison uses h=.001 and .00025. Both full native jaw surfaces are checked at 33 interpolated off-step phases per branch. This remains a bounded loaded lifting/release experiment; full reversal and source proportions are unresolved.'})+'\n',{flag:'wx'});
for(const r of branches){
 assert(r.maximumMomentumResidual<1e-9&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12&&r.maximumContactVelocityResidual<1e-8);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumKeyGapWithFriction<2e-8);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOffstepGap> -1e-6&&r.withdrawal>=.002);
 assert(Math.max(...r.maxCoordinateDifference)<.01&&r.releaseTimeDifference<.01);
}
