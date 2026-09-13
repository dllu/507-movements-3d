import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-following-'+direction+'-check',
  coarseFile=process.env.PROBE_COARSE??'artifacts/review/087-fixed-orbit-following-'+direction+'-coarse.json',
  fineFile=process.env.PROBE_FINE??'artifacts/review/087-fixed-orbit-following-'+direction+'-fine.json',
  coarse=readStudyReport(coarseFile),fine=readStudyReport(fineFile),
  seatFile='artifacts/review/087-fixed-orbit-seating-'+direction+'-fine.json',seat=readStudyReport(seatFile),
  summary=fine.summaries.find(s=>s.direction===direction),old=readStudyReport(coarse.summaries.find(s=>s.direction===direction).file),
  report=readStudyReport(summary.file),sources=freezeStudySources([...fine.sources.map(s=>s.file),coarseFile,fineFile,seatFile,
    ...coarse.summaries.map(s=>s.file),...fine.summaries.map(s=>s.file),'scripts/check-weighted-clutch-fixed-orbit-following-lift.mjs',
    'scripts/lib/weighted-clutch-fit-audit.mjs'],prefix),model=makeWeightedClutchDistributedCandidate(fine.options),
  d=makeWeightedClutchKeyEngagementEvents(model,report.profile,report.friction,[report.originalProfile]),
  jaws=makeWeightedClutchNativeJaws(model),native=[],poses=[],freeIntervals=[],positionDifference=[0,0,0,0,0],
  metrics={maximumMomentumResidual:0,maximumFreeVelocityError:0,maximumContactRateResidual:0,maximumComplementarity:0,
    minimumGap:Infinity,minimumImpulse:Infinity,maximumFrictionConeExcess:0,maximumSlidingLawError:0,maximumFrictionPower:0,
    absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
for(const r of [coarse,fine,seat])verifyStudySources(r.sources);
assert(!summary.error&&!old.error&&summary.nextStud&&old.nextStud);
assert.deepEqual(report.start,seat.summaries.find(s=>s.direction===direction).end);assert.deepEqual(report.start,old.start);
function at(rows,t){
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].time<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);return a.q.map((x,i)=>x+f*(b.q[i]-x));
}
let interval=null;
for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),force=d.forces(a.q,a.v),contacts=d.query(b.q,b.time),
    momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
    average=a.v.map((v,k)=>(v+b.v[k])/2),work=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
    defect=b.energy-a.energy-work;
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.maximumFreeVelocityError=Math.max(metrics.maximumFreeVelocityError,...b.freeVelocity.map((v,k)=>Math.abs(v-a.v[k]-b.h*force[k]/m[k])));
  metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
  metrics.maximumComplementarity=Math.max(metrics.maximumComplementarity,...b.active.map(c=>Math.abs(c.impulse*c.gap)));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
  if(b.time<=old.end.time){const other=at(old.rows,b.time);for(let k=0;k<5;k++)positionDifference[k]=Math.max(positionDifference[k],Math.abs(other[k]-b.q[k]));}
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
    const sliding=b.mode.startsWith('slide'),mu=sliding?report.friction.kineticCoefficient:report.friction.staticCoefficient,slip=dot(c.tangent,b.v);
    metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
    if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
    metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
  }
  const free=!b.active.some(c=>(c.friction==='axial-key'||c.kind==='stud')&&c.impulse>1e-12)&&
    Math.max(...b.v.slice(0,3).map(Math.abs))<1e-8&&Math.abs(b.v[4]-d.parameters.omegaOutput)<1e-8;
  if(free){if(!interval)interval={first:i,last:i};else interval.last=i;}
  else if(interval){if(interval.last-interval.first>=4)freeIntervals.push(interval);interval=null;}
}
if(interval&&interval.last-interval.first>=4)freeIntervals.push(interval);
const freeChecks=[];
for(const interval of freeIntervals){
  const start=report.rows[interval.first],end=report.rows[interval.last],I=d.parameters.shaftInertia,
    acceleration=phi=>-d.gravity.at(phi,0).gradient[3]/I,energy=(phi,v)=>.5*I*v*v+d.gravity.at(phi,0).potential;
  let phi=start.q[3],v=start.v[3],time=start.time,maximumAngleError=0,maximumSpeedError=0,maximumEnergyError=0;
  const initialEnergy=energy(phi,v);
  for(let i=interval.first+1;i<=interval.last;i++){
    const target=report.rows[i];
    while(time<target.time-1e-12){
      const h=Math.min(.000125,target.time-time),a1=acceleration(phi),q2=phi+h*v/2,v2=v+h*a1/2,a2=acceleration(q2),
        q3=phi+h*v2/2,v3=v+h*a2/2,a3=acceleration(q3),q4=phi+h*v3,v4=v+h*a3,a4=acceleration(q4);
      phi+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a1+2*a2+2*a3+a4)/6;time+=h;
    }
    maximumAngleError=Math.max(maximumAngleError,Math.abs(phi-target.q[3]));maximumSpeedError=Math.max(maximumSpeedError,Math.abs(v-target.v[3]));
    maximumEnergyError=Math.max(maximumEnergyError,Math.abs(energy(phi,v)-initialEnergy));
  }
  freeChecks.push({startTime:start.time,endTime:end.time,states:interval.last-interval.first+1,maximumAngleError,maximumSpeedError,maximumEnergyError});
}
const times=[...Array.from({length:33},(_,i)=>report.start.time+(report.end.time-report.start.time)*(i===32?32:i+.271)/32),
  ...Array.from({length:17},(_,i)=>report.nextStud.time+(report.end.time-report.nextStud.time)*i/16)];
for(const time of times){
  const q=at(report.rows,time),phase=d.phase(q,time),queries=['left','right'].map(side=>jaws.evaluate(side,phase.relativeJaws[side],q[2]));
  native.push({time,q,phase,jaws:queries,otherGaps:d.query(q,time).filter(c=>!c.kind.startsWith('jaw-')).map(c=>({kind:c.kind,gap:c.gap}))});
}
const nearest=t=>report.rows.reduce((a,b)=>Math.abs(a.time-t)<Math.abs(b.time-t)?a:b),
  samples=[['held',nearest((report.start.time+report.nextStud.time)/2)],['before-stud',report.rows.filter(r=>r.time<report.nextStud.time).at(-1)],
    ['next-stud',report.nextStud],['following-lift',report.end]];
for(const[name,row]of samples){
  const phase=d.phase(row.q,row.time);model.setCoordinates(row.q,phase.input);const solids=auditClutchSourceSolids(model);
  poses.push({name,direction,time:row.time,q:row.q,input:phase.input,state:model.root.userData.state,...solids});
  console.log({name,direction,time:row.time,surfaceChecks:solids.checks,issues:solids.issues.length});
}
const result={direction,states:report.rows.length,...metrics,positionDifference,freeChecks,nextStudTime:report.nextStud.time,
  nextStudTimeDifference:Math.abs(report.nextStud.time-old.nextStud.time),maximumWithdrawal:summary.maximumWithdrawal,
  minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),native};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:fine.options,branches:[result],poses,
  qualification:'Checks the unchanged seated state through held rotation and the next fixed-orbit lift. Fine stored states receive balance/friction checks and common-time comparison against the coarser held/lift step schedule. Free shaft intervals are independently integrated with fourth-order Runge-Kutta. Fifty native contact samples and four full-solid poses supplement the contact solver; repeated transfers, continuous clearance, final speed and integration remain pending.'})+'\n',{flag:'wx'});
console.log({...result,native:native.length});
assert(result.maximumMomentumResidual<1e-9&&result.maximumFreeVelocityError<1e-9&&result.maximumContactRateResidual<1e-8&&result.maximumComplementarity<1e-8);
assert(result.minimumGap> -2e-9&&result.minimumImpulse> -1e-12&&result.maximumFrictionConeExcess<1e-10&&result.maximumSlidingLawError<1e-10&&result.maximumFrictionPower<1e-10);
assert(Math.max(...positionDifference)<.002&&result.nextStudTimeDifference<.005&&result.maximumWithdrawal<2e-5);
assert(result.minimumNativeJawGap> -1e-6&&result.minimumNativeOtherGap> -1e-6&&poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
assert(freeChecks.length>0&&freeChecks.every(c=>c.maximumAngleError<.001&&c.maximumSpeedError<.001&&c.maximumEnergyError<1e-8));
