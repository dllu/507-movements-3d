import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyNeutral} from './lib/weighted-clutch-key-neutral.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-first-key-neutral-check',
 coarseFile='artifacts/review/087-first-key-neutral.json',coarse=readStudyReport(coarseFile),
 fineFile='artifacts/review/087-quarter-key-neutral.json',fine=readStudyReport(fineFile),
 releaseFile='artifacts/review/087-quarter-key-release.json',release=readStudyReport(releaseFile),
 initialFile='artifacts/review/087-first-key-impact.json',initial=readStudyReport(initialFile),
 files=[coarseFile,fineFile,releaseFile,initialFile,...coarse.summaries.map(s=>s.file),...fine.summaries.map(s=>s.file)],
 sources=freezeStudySources([...fine.sources.map(s=>s.file),...files,'scripts/check-weighted-clutch-key-neutral.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),branches=[],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
for(const r of [coarse,fine,release,initial])verifyStudySources(r.sources);
function at(rows,t){let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);return{time:t,q:a.q.map((v,k)=>v+f*(b.q[k]-v))};}
for(const summary of fine.summaries){
 const first=initial.rows.find(r=>r.direction===summary.direction&&r.staticCoefficient===.78),
  report=readStudyReport(summary.file),other=readStudyReport(coarse.summaries.find(s=>s.direction===summary.direction).file),
  d=makeWeightedClutchKeyNeutral(model,first.profile,first),previous=release.summaries.find(s=>s.direction===summary.direction).end,
  native=[],maxCoordinateDifference=[0,0,0,0,0],metrics={maximumMomentumResidual:0,maximumContactRateResidual:0,
   minimumGap:Infinity,minimumImpulse:Infinity,maximumFrictionConeExcess:0,maximumSlidingLawError:0,maximumFrictionPower:0,
   maximumBoundExcess:0,absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0,minimumPhysicalContactLoss:Infinity};
 assert.deepEqual(report.start,previous);
 for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),contacts=d.query(b.q,b.time),
   momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
   average=a.v.map((v,k)=>(v+b.v[k])/2),work=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
   defect=b.energy-a.energy-work,loss=b.work-a.work-work;
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap),b.oppositeJaw.exact?b.oppositeJaw.gap:b.oppositeJaw.lowerBound);
  metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  if(b.oppositeJaw.exact)metrics.maximumBoundExcess=Math.max(metrics.maximumBoundExcess,b.oppositeJaw.lowerBound-b.oppositeJaw.gap);
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
  metrics.minimumPhysicalContactLoss=Math.min(metrics.minimumPhysicalContactLoss,loss);
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
   const sliding=b.mode.startsWith('slide'),mu=sliding?first.kineticCoefficient:first.staticCoefficient,slip=dot(c.tangent,b.v);
   metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
   if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
   metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
  }
 }
 for(let i=0;i<=128;i++){
  const t=report.start.time+(Math.min(report.end.time,other.end.time)-report.start.time)*i/128,a=at(report.rows,t),b=at(other.rows,t);
  for(let k=0;k<5;k++)maxCoordinateDifference[k]=Math.max(maxCoordinateDifference[k],Math.abs(a.q[k]-b.q[k]));
 }
 for(let i=0;i<=32;i++){
  const t=report.start.time+(report.end.time-report.start.time)*(i===32?32:i+.271)/32,row=at(report.rows,t),phase=d.phase(row.q,t),
   jaws=['left','right'].map(side=>d.jaws.evaluate(side,row.q[4]+(side==='left'?-1:1)*model.root.userData.geometry.mainRatio*phase.input,row.q[2])),
   opposite=d.opposite(row.q,t,true);
  native.push({...row,phase,jaws,opposite,otherGaps:d.query(row.q,t).map(c=>({kind:c.kind,gap:c.gap}))});
 }
 const result={direction:summary.direction,states:report.rows.length,...metrics,exactStateContinuity:true,maxCoordinateDifference,
  impactTimeDifference:Math.abs(report.end.time-other.end.time),native,
  minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),
  minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),
  maximumNativeBoundExcess:Math.max(...native.map(r=>r.opposite.lowerBound-r.opposite.gap))};
 branches.push(result);console.log({...result,native:native.length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,branches,
 qualification:'Independent balance, friction, native-gap and two-step-size checks of neutral travel from unchanged key-friction withdrawal endpoints. The conservative opposite-jaw bound is screened against full native queries. First-jaw timing is resolved within the reported comparison; no seating or complete-cycle acceptance is implied.'})+'\n',{flag:'wx'});
for(const r of branches){
 assert(r.maximumMomentumResidual<1e-9&&r.maximumContactRateResidual<1e-8&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumBoundExcess<=0);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6&&r.maximumNativeBoundExcess<0);
 assert(r.impactTimeDifference<.0001&&Math.max(...r.maxCoordinateDifference)<.0002);
}
