import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyNeutral} from './lib/weighted-clutch-key-neutral.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-transfer-check',
  coarseFile=process.env.PROBE_COARSE??'artifacts/review/087-fixed-orbit-transfer-coarse.json',
  fineFile=process.env.PROBE_FINE??'artifacts/review/087-fixed-orbit-transfer-fine.json',
  coarse=readStudyReport(coarseFile),fine=readStudyReport(fineFile),
  geometryFile='artifacts/review/087-first-fixed-orbit-geometry.json',geometry=readStudyReport(geometryFile),
  sources=freezeStudySources([...fine.sources.map(s=>s.file),...geometry.sources.map(s=>s.file),coarseFile,fineFile,geometryFile,
    ...coarse.summaries.map(s=>s.file),...fine.summaries.map(s=>s.file),'scripts/check-weighted-clutch-fixed-orbit-transfer.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(fine.options),jaws=makeWeightedClutchNativeJaws(model),branches=[],poses=[],
  dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
verifyStudySources(coarse.sources);verifyStudySources(fine.sources);verifyStudySources(geometry.sources);
function at(rows,t){
  let lo=0,hi=rows.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].time<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);
  return a.q.map((x,i)=>x+f*(b.q[i]-x));
}
for(const summary of fine.summaries){
  const report=readStudyReport(summary.file),old=readStudyReport(coarse.summaries.find(s=>
    s.direction===summary.direction).file),
    d=makeWeightedClutchKeyNeutral(model,report.profile,report.friction),native=[],
    metrics={maximumMomentumResidual:0,maximumFreeVelocityError:0,maximumContactRateResidual:0,maximumComplementarity:0,
      minimumGap:Infinity,minimumImpulse:Infinity,maximumFrictionConeExcess:0,maximumSlidingLawError:0,maximumFrictionPower:0,
      absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0},positionDifference=[0,0,0,0,0];
  assert(!summary.error&&!old.error);assert.deepEqual(report.start,old.start);
  for(let i=1;i<report.rows.length;i++){
    const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),force=d.forces(a.q,a.v),contacts=d.query(b.q,b.time),
      momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>
        s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),average=a.v.map((v,k)=>(v+b.v[k])/2),
      work=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
      defect=b.energy-a.energy-work,other=at(old.rows,Math.min(b.time,old.end.time));
    metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
    metrics.maximumFreeVelocityError=Math.max(metrics.maximumFreeVelocityError,...b.freeVelocity.map((v,k)=>Math.abs(v-a.v[k]-b.h*force[k]/m[k])));
    metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
    metrics.maximumComplementarity=Math.max(metrics.maximumComplementarity,...b.active.map(c=>Math.abs(c.impulse*c.gap)));
    metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));
    metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
    metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
    if(b.time<=old.end.time)for(let k=0;k<5;k++)positionDifference[k]=Math.max(positionDifference[k],Math.abs(other[k]-b.q[k]));
    for(const c of b.active.filter(c=>c.friction==='axial-key')){
      const sliding=b.mode.startsWith('slide'),mu=sliding?report.friction.kineticCoefficient:report.friction.staticCoefficient,slip=dot(c.tangent,b.v);
      metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
      if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
      metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
    }
  }
  const nearest=t=>report.rows.reduce((a,b)=>Math.abs(a.time-t)<Math.abs(b.time-t)?a:b),
    event=kind=>report.events.find(e=>e.kind===kind),far=event('far-slot'),withdrawal=event('withdrawal-threshold'),
    beforeFar=report.rows.filter(r=>r.time<far.time),
    preSlotWithdrawal=beforeFar.reduce((m,r)=>Math.max(m,(r.q[2]-report.start.q[2])*(report.side==='left'?1:-1)),0),
    eventDifferences=['weight-over-center','far-slot','withdrawal-threshold','opposite-jaw'].map(kind=>({kind,
      fine:event(kind).time,coarse:old.events.find(e=>e.kind===kind).time,
      difference:Math.abs(event(kind).time-old.events.find(e=>e.kind===kind).time)})),
    samples=[['middle-lift',nearest((report.start.time+event('weight-over-center').time)/2)],
      ['over-center',nearest(event('weight-over-center').time)],['before-far-slot',beforeFar.at(-1)],
      ['withdrawal',nearest(withdrawal.time)],['neutral',nearest((withdrawal.time+report.end.time)/2)],['opposite-jaw',report.end]];
  for(let i=0;i<=32;i++){
    const time=report.start.time+(report.end.time-report.start.time)*(i===32?32:i+.271)/32,q=at(report.rows,time),phase=d.phase(q,time),
      nativeJaws=['left','right'].map(side=>jaws.evaluate(side,q[4]+(side==='left'?-1:1)*model.root.userData.geometry.mainRatio*phase.input,q[2])),
      stud=d.stud.slow.evaluate(q[0],phase.e),fast=d.stud.evaluate(q[0],phase.e),otherGaps=d.query(q,time).map(c=>({kind:c.kind,gap:c.gap}));
    native.push({time,q,jaws:nativeJaws,studGap:stud.gap,fastStudDifference:Math.abs(stud.gap-fast.gap),otherGaps});
  }
  for(const[name,row]of samples){
    const phase=d.phase(row.q,row.time);model.setCoordinates(row.q,phase.input);const solids=auditClutchSourceSolids(model);
    poses.push({name,direction:summary.direction,time:row.time,q:row.q,input:phase.input,state:model.root.userData.state,...solids});
    console.log({name,direction:summary.direction,time:row.time,surfaceChecks:solids.checks,issues:solids.issues.length});
  }
  const result={direction:summary.direction,side:summary.side,states:report.rows.length,...metrics,positionDifference,eventDifferences,preSlotWithdrawal,oppositeJawGap:report.end.oppositeJaw.gap,
    minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),
    minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),
    minimumNativeStudGap:Math.min(...native.map(r=>r.studGap)),maximumFastStudDifference:Math.max(...native.map(r=>r.fastStudDifference)),native};
  branches.push(result);console.log({...result,native:native.length});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:fine.options,branches,poses,
  qualification:'Checks continuation of both fixed-orbit initial lifts through release and neutral travel to first opposite-jaw contact. Every fine step receives balance/contact/friction checks and common-time comparison. Thirty-three off-step native jaw/stud/coupling samples per branch and twelve full-solid poses supplement the dynamics. Small pre-slot drift is measured explicitly. The first new-jaw impulse, loaded seating, continuous clearance, source fidelity, material identity and repeating cycles are not established here.'})+'\n',{flag:'wx'});
for(const r of branches){
  assert(r.maximumMomentumResidual<1e-9&&r.maximumFreeVelocityError<1e-9&&r.maximumContactRateResidual<1e-8&&r.maximumComplementarity<1e-8);
  assert(r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12&&r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10);
  assert(r.preSlotWithdrawal<2e-5&&r.eventDifferences.every(e=>e.difference<.003)&&Math.abs(r.oppositeJawGap)<1e-9&&r.minimumNativeOtherGap> -1e-6);
  assert(Math.max(...r.positionDifference)<.001&&r.minimumNativeJawGap> -1e-6&&r.minimumNativeStudGap> -1e-6&&r.maximumFastStudDifference<1e-10);
}
assert(poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
