import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-first-key-seating-check',coarseFile='artifacts/review/087-first-key-seating-events.json',coarse=readStudyReport(coarseFile),
 fineFile='artifacts/review/087-quarter-key-seating-events.json',fine=readStudyReport(fineFile),
 impactFile='artifacts/review/087-first-key-jaw-impact.json',impact=readStudyReport(impactFile),
 profileFile='artifacts/review/087-first-key-seating-profiles.json',profiles=readStudyReport(profileFile),
 neutralFile='artifacts/review/087-quarter-key-neutral.json',neutral=readStudyReport(neutralFile),
 files=[coarseFile,fineFile,impactFile,profileFile,neutralFile,...coarse.summaries.map(s=>s.file),...fine.summaries.map(s=>s.file)],
 sources=freezeStudySources([...fine.sources.map(s=>s.file),...files,'scripts/check-weighted-clutch-key-seating.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),jaws=makeWeightedClutchNativeJaws(model),branches=[],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
for(const r of [coarse,fine,impact,profiles,neutral])verifyStudySources(r.sources);
function at(rows,t){let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);return{time:t,q:a.q.map((v,k)=>v+f*(b.q[k]-v))};}
for(const summary of fine.summaries){
 const first=impact.rows.find(r=>r.direction===summary.direction),profile=profiles.profiles.find(p=>p.direction===summary.direction),
  report=readStudyReport(summary.file),other=readStudyReport(coarse.summaries.find(s=>s.direction===summary.direction).file),
  incoming=neutral.summaries.find(s=>s.direction===summary.direction).end,
  d=makeWeightedClutchKeyEngagementEvents(model,profile,first.friction,[first.originalProfile]),
  native=[],maxCoordinateDifference=[0,0,0,0,0],keyEvents=[],metrics={maximumMomentumResidual:0,maximumContactRateResidual:0,
   maximumInactiveClosingRate:0,maximumComplementarity:0,minimumGap:Infinity,minimumImpulse:Infinity,
   maximumFrictionConeExcess:0,maximumSlidingLawError:0,maximumFrictionPower:0,maximumImpulseEnergyResidual:0,
   absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0,minimumPhysicalContactLoss:Infinity,
   maximumSelectedPriorityVelocitySpread:0,stepHalvings:0};
 assert.deepEqual(report.start.q,incoming.q);assert.equal(report.start.time,incoming.time);
 assert.deepEqual(report.start.v,first.velocityAfter);assert.equal(report.start.phase.input,incoming.phase.input);assert(Math.abs(report.jumpDefect)<1e-9);
 let previousKey=null;
 for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),contacts=d.query(b.q,b.time),
   momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
   average=a.v.map((v,k)=>(v+b.v[k])/2),work=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
   defect=b.energy-a.energy-work,loss=b.work-a.work-work;
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
  metrics.maximumInactiveClosingRate=Math.max(metrics.maximumInactiveClosingRate,...contacts.filter(c=>c.gap<=(c.kind.startsWith('jaw-')?2e-12:2e-8)).map(c=>-dot(c.gradient,b.v)-c.inputGradient*d.parameters.omegaInput));
  metrics.maximumComplementarity=Math.max(metrics.maximumComplementarity,...b.active.map(c=>Math.abs(c.impulse*c.gap)));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  metrics.maximumImpulseEnergyResidual=Math.max(metrics.maximumImpulseEnergyResidual,Math.abs(b.impulseEnergyResidual));
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;metrics.minimumPhysicalContactLoss=Math.min(metrics.minimumPhysicalContactLoss,loss);
  metrics.maximumSelectedPriorityVelocitySpread=Math.max(metrics.maximumSelectedPriorityVelocitySpread,b.selectedPriorityVelocitySpread,b.transportPriorityVelocitySpread);
  metrics.stepHalvings+=b.rejectedSteps.length;
  const activeKey=b.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
  if(activeKey!==previousKey)keyEvents.push({time:b.time,kind:activeKey,q:b.q,v:b.v});previousKey=activeKey;
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
   const sliding=b.mode.startsWith('slide'),mu=sliding?first.friction.kineticCoefficient:first.friction.staticCoefficient,slip=dot(c.tangent,b.v);
   metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
   if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
   metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
  }
 }
 for(let i=0;i<=128;i++){
  const t=report.start.time+(Math.min(report.end.time,other.end.time)-report.start.time)*i/128,a=at(report.rows,t),b=at(other.rows,t);
  for(let k=0;k<5;k++)maxCoordinateDifference[k]=Math.max(maxCoordinateDifference[k],Math.abs(a.q[k]-b.q[k]));
 }
 for(let i=0;i<=64;i++){
  const t=report.start.time+(report.end.time-report.start.time)*(i===64?64:i+.271)/64,row=at(report.rows,t),phase=d.phase(row.q,t),constraints=d.query(row.q,t),
   queries=['left','right'].map(side=>jaws.evaluate(side,phase.relativeJaws[side],row.q[2])),
   approximations=queries.map(j=>{const c=constraints.filter(c=>c.kind.startsWith('jaw-'+j.side+'-'));return{side:j.side,
    profileError:c.length?Math.min(...c.map(c=>c.gap))-j.gap:null,lowerBound:d.bound.lower(j.side,j.relativeAngle,row.q[2]),nativeGap:j.gap};});
  native.push({...row,phase,jaws:queries,approximations,otherGaps:constraints.filter(c=>!c.kind.startsWith('jaw-')).map(c=>({kind:c.kind,gap:c.gap}))});
 }
 const result={direction:summary.direction,side:summary.side,states:report.rows.length,...metrics,exactImpactContinuity:true,maxCoordinateDifference,
  settled:summary.settled,seat:summary.seat,seatTimeDifference:Math.abs(summary.seat.time-other.seat.time),keyEvents,
  native,minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),
  minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),
  maximumNativeBoundExcess:Math.max(...native.flatMap(r=>r.approximations.map(a=>a.lowerBound-a.nativeGap))),
  maximumNativeProfileError:Math.max(...native.flatMap(r=>r.approximations.filter(a=>a.profileError!==null).map(a=>Math.abs(a.profileError))))};
 branches.push(result);console.log({...result,native:native.length,seat:{time:summary.seat.time,q:summary.seat.q,v:summary.seat.v},keyEvents:keyEvents.map(e=>({time:e.time,kind:e.kind}))});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,branches,
 qualification:'Independent balance, friction, native contact and two-step-size checks through both opposite-jaw seated states. The impact applies at unchanged position and time; the resulting shaft/D backlash is integrated. Native profile interpolation remains sampled. This qualifies the connected first reversal branches, not source proportions or a repeating full-cycle animation.'})+'\n',{flag:'wx'});
for(const r of branches){
 assert(r.settled&&r.maximumMomentumResidual<1e-9&&r.maximumContactRateResidual<1e-8&&r.maximumInactiveClosingRate<1e-8&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12);
 assert(r.maximumComplementarity<1e-8&&r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumImpulseEnergyResidual<1e-9);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6&&r.maximumNativeBoundExcess<0&&r.maximumNativeProfileError<1e-6);
 assert(r.maximumSelectedPriorityVelocitySpread<1e-7&&r.seatTimeDifference<.01&&Math.max(...r.maxCoordinateDifference)<.005);
}
