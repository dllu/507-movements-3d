import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementTightStud} from './lib/weighted-clutch-key-engagement-tight-stud.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',segment=Number(process.env.PROBE_SEGMENT??1),
  prefix=process.env.PROBE_PREFIX??'artifacts/review/087-sequence-'+direction+'-segment-'+segment+'-check',
  coarseFile=process.env.PROBE_COARSE??'artifacts/review/087-sequence-'+direction+'-coarse-segment-'+segment+'.json.gz',
  fineFile=process.env.PROBE_FINE??'artifacts/review/087-sequence-'+direction+'-fine-segment-'+segment+'.json.gz',
  old=readStudyReport(coarseFile),report=readStudyReport(fineFile),fine=report,summary=report,
  priorFineFile=segment===1?'artifacts/review/087-fixed-orbit-next-measured-'+direction+'-fine.json':fineFile.replace(/segment-\d+\.json\.gz$/,'segment-'+(segment-1)+'.json.gz'),
  priorCoarseFile=segment===1?priorFineFile:coarseFile.replace(/segment-\d+\.json\.gz$/,'segment-'+(segment-1)+'.json.gz'),
  sources=freezeStudySources([...fine.sources.map(s=>s.file),coarseFile,fineFile,priorFineFile,priorCoarseFile,
    'scripts/check-weighted-clutch-fixed-orbit-sequence-segment.mjs','scripts/lib/weighted-clutch-fit-audit.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(fine.options),d=makeWeightedClutchKeyEngagementTightStud(model,report.profile,report.friction,report.otherProfiles),
  jaws=makeWeightedClutchNativeJaws(model),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),native=[],poses=[],freeIntervals=[],
  positionDifference=[0,0,0,0,0],metrics={maximumMomentumResidual:0,maximumFreeVelocityError:0,maximumContactRateResidual:0,
    maximumInactiveClosingRate:0,maximumComplementarity:0,minimumGap:Infinity,minimumImpulse:Infinity,maximumFrictionConeExcess:0,
    maximumSlidingLawError:0,maximumFrictionPower:0,maximumImpulseEnergyResidual:0,absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0};
verifyStudySources(old.sources);verifyStudySources(fine.sources);
assert(!summary.error&&!old.error&&summary.settled&&old.settled&&report.nextStud&&old.nextStud);
for(const [file,row] of [[priorFineFile,report.start],[priorCoarseFile,old.start]]){const p=readStudyReport(file);assert.deepEqual(row,segment===1?p.summaries.find(s=>s.direction===direction).end:p.end);}
function at(rows,t){
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].time<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);return a.q.map((x,i)=>x+f*(b.q[i]-x));
}
let interval=null;
for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),force=d.forces(a.q,a.v),contacts=d.query(b.q,b.time),
    momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((n,c)=>n+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
    average=a.v.map((v,k)=>(v+b.v[k])/2),work=b.active.reduce((n,c)=>n+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
    defect=b.energy-a.energy-work;
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.maximumFreeVelocityError=Math.max(metrics.maximumFreeVelocityError,...b.freeVelocity.map((v,k)=>Math.abs(v-a.v[k]-b.h*force[k]/m[k])));
  metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
  metrics.maximumInactiveClosingRate=Math.max(metrics.maximumInactiveClosingRate,...contacts.filter(c=>c.gap<=(c.kind==='stud'||c.kind.startsWith('jaw-')?2e-12:2e-8)).map(c=>-dot(c.gradient,b.v)-c.inputGradient*d.parameters.omegaInput));
  metrics.maximumComplementarity=Math.max(metrics.maximumComplementarity,...b.active.map(c=>Math.abs(c.impulse*c.gap)));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  metrics.maximumImpulseEnergyResidual=Math.max(metrics.maximumImpulseEnergyResidual,Math.abs(b.impulseEnergyResidual));
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
  if(b.time>=old.start.time&&b.time<=old.end.time){const q=at(old.rows,b.time);for(let k=0;k<5;k++)positionDifference[k]=Math.max(positionDifference[k],Math.abs(q[k]-b.q[k]));}
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
    const sliding=b.mode.startsWith('slide'),mu=sliding?report.friction.kineticCoefficient:report.friction.staticCoefficient,slip=dot(c.tangent,b.v);
    metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
    if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
    metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
  }
  if(!b.active.some(c=>Math.abs(c.gradient[0]*c.impulse)>1e-12)){if(!interval)interval={first:i,last:i};else interval.last=i;}
  else if(interval){freeIntervals.push(interval);interval=null;}
}
if(interval)freeIntervals.push(interval);
const freeChecks=[],acceleration=(q,v)=>{const p=d.inertia.linkage(q);return(-p.potentialDerivative-.5*p.inertiaDerivative*v*v)/p.inertia;},
  energy=(q,v)=>{const p=d.inertia.linkage(q);return p.potential+.5*p.inertia*v*v;};
for(const interval of freeIntervals.filter(p=>report.rows[p.last].time-report.rows[p.first].time>.02)){
  const start=report.rows[interval.first],end=report.rows[interval.last];let q=start.q[0],v=start.v[0],time=start.time,
    maximumAngleError=0,maximumSpeedError=0,maximumEnergyError=0;const initialEnergy=energy(q,v);
  for(let i=interval.first+1;i<=interval.last;i++){
    const target=report.rows[i];
    while(time<target.time-1e-12){
      const h=Math.min(.000125,target.time-time),a1=acceleration(q,v),q2=q+h*v/2,v2=v+h*a1/2,a2=acceleration(q2,v2),
        q3=q+h*v2/2,v3=v+h*a2/2,a3=acceleration(q3,v3),q4=q+h*v3,v4=v+h*a3,a4=acceleration(q4,v4);
      q+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a1+2*a2+2*a3+a4)/6;time+=h;
    }
    maximumAngleError=Math.max(maximumAngleError,Math.abs(q-target.q[0]));maximumSpeedError=Math.max(maximumSpeedError,Math.abs(v-target.v[0]));
    maximumEnergyError=Math.max(maximumEnergyError,Math.abs(energy(q,v)-initialEnergy));
  }
  freeChecks.push({startTime:start.time,endTime:end.time,states:interval.last-interval.first+1,maximumAngleError,maximumSpeedError,maximumEnergyError});
}
const event=kind=>report.events.find(e=>e.kind===kind),far=event('far-slot'),firstJaw=event('opposite-jaw-loaded'),
  eventDifferences=['next-stud','weight-over-center','far-slot','withdrawal-threshold','opposite-jaw-loaded','seat-candidate'].map(kind=>({kind,
    difference:Math.abs(event(kind).time-old.events.find(e=>e.kind===kind).time)})),
  beforeFar=report.rows.filter(r=>r.time<far.time),preSlotWithdrawal=beforeFar.reduce((m,r)=>Math.max(m,(r.q[2]-report.start.q[2])*(report.fromSide==='left'?1:-1)),0),
  times=[...Array.from({length:33},(_,i)=>report.start.time+(report.end.time-report.start.time)*(i===32?32:i+.271)/32),
    ...Array.from({length:33},(_,i)=>report.nextStud.time+(report.end.time-report.nextStud.time)*(i===32?32:i+.271)/32),
    ...Array.from({length:33},(_,i)=>firstJaw.time+(report.end.time-firstJaw.time)*i/32)];
for(const time of times){
  const q=at(report.rows,time),phase=d.phase(q,time),constraints=d.query(q,time),queries=['left','right'].map(side=>jaws.evaluate(side,phase.relativeJaws[side],q[2])),
    stud=d.stud.slow.evaluate(q[0],phase.e),fast=d.stud.evaluate(q[0],phase.e),
    approximations=queries.map(j=>{const c=constraints.filter(c=>c.kind.startsWith('jaw-'+j.side+'-'));return{side:j.side,
      error:c.length?Math.min(...c.map(c=>c.gap))-j.gap:null,boundExcess:d.bound.lower(j.side,j.relativeAngle,q[2])-j.gap};});
  native.push({time,q,phase,jaws:queries,studGap:stud.gap,fastStudDifference:Math.abs(stud.gap-fast.gap),approximations,
    otherGaps:constraints.filter(c=>!c.kind.startsWith('jaw-')).map(c=>({kind:c.kind,gap:c.gap}))});
}
const nearest=t=>report.rows.reduce((a,b)=>Math.abs(a.time-t)<Math.abs(b.time-t)?a:b),
  samples=[['held',nearest((report.start.time+report.nextStud.time)/2)],['next-stud',report.nextStud],
    ['middle-lift',nearest((report.nextStud.time+event('weight-over-center').time)/2)],['over-center',nearest(event('weight-over-center').time)],
    ['before-far-slot',beforeFar.at(-1)],['neutral',nearest((event('withdrawal-threshold').time+firstJaw.time)/2)],
    ['opposite-jaw',nearest(firstJaw.time)],['seated',report.end]];
for(const[name,row]of samples){
  const phase=d.phase(row.q,row.time);model.setCoordinates(row.q,phase.input);const solids=auditClutchSourceSolids(model);
  poses.push({name,direction,time:row.time,q:row.q,input:phase.input,state:model.root.userData.state,...solids});
  console.log({name,direction,time:row.time,surfaceChecks:solids.checks,issues:solids.issues.length});
}
const result={direction,segment,states:report.rows.length,...metrics,positionDifference,eventDifferences,preSlotWithdrawal,freeChecks,
  seatTime:report.seat.time,seatTimeDifference:Math.abs(report.seat.time-old.seat.time),native,
  minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),minimumNativeStudGap:Math.min(...native.map(r=>r.studGap)),
  minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),maximumFastStudDifference:Math.max(...native.map(r=>r.fastStudDifference)),
  maximumNativeProfileError:Math.max(...native.flatMap(r=>r.approximations.filter(a=>a.error!==null).map(a=>Math.abs(a.error)))),
  maximumNativeBoundExcess:Math.max(...native.flatMap(r=>r.approximations.map(a=>a.boundExcess)))};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:fine.options,branches:[result],poses,
  qualification:'Independent per-segment fine-step balance, friction, complementarity, impulse-energy and overlapping-time coordinate comparisons through held rotation and a further connected transfer. Each run starts at its own preceding integrated endpoint. Free F/G/rod flight is checked with RK4. Ninety-nine native jaw/stud samples and eight full-solid poses supplement the contact tables. Long-term closure, continuous clearance, source acceptance, final playback and integration remain separate.'})+'\n',{flag:'wx'});
console.log({...result,native:native.length});
assert(result.maximumMomentumResidual<1e-9&&result.maximumFreeVelocityError<1e-9&&result.maximumContactRateResidual<1e-8&&result.maximumInactiveClosingRate<1e-8&&result.maximumComplementarity<1e-8);
assert(result.minimumGap> -2e-9&&result.minimumImpulse> -1e-12&&result.maximumFrictionConeExcess<1e-10&&result.maximumSlidingLawError<1e-10&&result.maximumFrictionPower<1e-10&&result.maximumImpulseEnergyResidual<1e-9);
assert(Math.max(...positionDifference)<.002&&eventDifferences.every(e=>e.difference<.005)&&result.seatTimeDifference<.005&&preSlotWithdrawal<2e-5);
assert(result.minimumNativeJawGap> -1e-6&&result.minimumNativeStudGap> -1e-6&&result.minimumNativeOtherGap> -1e-6&&result.maximumFastStudDifference<1e-10&&result.maximumNativeProfileError<1e-6&&result.maximumNativeBoundExcess<0);
assert(freeChecks.length>0&&freeChecks.every(c=>c.maximumAngleError<.003&&c.maximumSpeedError<.003&&c.maximumEnergyError<1e-8));
assert(poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
