import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-connected-key-lift-check',
 inputFiles=process.env.PROBE_REPORTS?.split(',')??['artifacts/review/087-first-connected-key-lift.json'],
 direct=process.env.PROBE_REPORTS?inputFiles.map(readStudyReport):null,
 parent=direct?{sources:direct.flatMap(r=>r.sources),summaries:direct.map(({rows,...r},i)=>({...r,file:inputFiles[i]}))}:readStudyReport(inputFiles[0]),
 seatFile='artifacts/review/087-first-key-seating-events.json',seating=readStudyReport(seatFile),
 impactFile='artifacts/review/087-first-key-jaw-impact.json',impact=readStudyReport(impactFile),
 profileFile='artifacts/review/087-first-key-seating-profiles.json',profiles=readStudyReport(profileFile),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),...inputFiles,seatFile,impactFile,profileFile,...parent.summaries.map(s=>s.file),
  'scripts/check-weighted-clutch-connected-lift.mjs'],prefix),model=makeWeightedClutchKeyCandidate(),jaws=makeWeightedClutchNativeJaws(model),branches=[],
 dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
verifyStudySources(parent.sources);
function at(rows,t){let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],f=(t-a.time)/(b.time-a.time);return{time:t,q:a.q.map((v,k)=>v+f*(b.q[k]-v))};}
for(const summary of parent.summaries){
 const first=impact.rows.find(r=>r.direction===summary.direction),profile=profiles.profiles.find(p=>p.direction===summary.direction),
  report=readStudyReport(summary.file),d=makeWeightedClutchKeyEngagementEvents(model,profile,first.friction,[first.originalProfile]),
  native=[],freeIntervals=[],metrics={maximumMomentumResidual:0,maximumFreeVelocityError:0,maximumContactRateResidual:0,
   maximumComplementarity:0,minimumGap:Infinity,minimumImpulse:Infinity,maximumFrictionConeExcess:0,
   maximumSlidingLawError:0,maximumFrictionPower:0,absolutePhysicalContactWorkDefect:0,signedPhysicalContactWorkDefect:0};
 assert.deepEqual(report.start,seating.summaries.find(s=>s.direction===summary.direction).end);
 let interval=null;
 for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),forces=d.forces(a.q,a.v),contacts=d.query(b.q,b.time),
   momentum=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
   average=a.v.map((v,k)=>(v+b.v[k])/2),work=b.active.reduce((s,c)=>s+c.impulse*dot(c.gradient,average)+c.tangentImpulse*(c.tangent?dot(c.tangent,average):0),0),
   defect=b.energy-a.energy-work;
  metrics.maximumMomentumResidual=Math.max(metrics.maximumMomentumResidual,...momentum.map(Math.abs));
  metrics.maximumFreeVelocityError=Math.max(metrics.maximumFreeVelocityError,...b.freeVelocity.map((v,k)=>Math.abs(v-a.v[k]-b.h*forces[k]/m[k])));
  metrics.maximumContactRateResidual=Math.max(metrics.maximumContactRateResidual,...b.active.map(c=>Math.abs(dot(c.gradient,b.v)-c.target)));
  metrics.maximumComplementarity=Math.max(metrics.maximumComplementarity,...b.active.map(c=>Math.abs(c.impulse*c.gap)));
  metrics.minimumGap=Math.min(metrics.minimumGap,...contacts.map(c=>c.gap));metrics.minimumImpulse=Math.min(metrics.minimumImpulse,...b.active.map(c=>c.impulse));
  metrics.absolutePhysicalContactWorkDefect+=Math.abs(defect);metrics.signedPhysicalContactWorkDefect+=defect;
  for(const c of b.active.filter(c=>c.friction==='axial-key')){
   const sliding=b.mode.startsWith('slide'),mu=sliding?first.friction.kineticCoefficient:first.friction.staticCoefficient,slip=dot(c.tangent,b.v);
   metrics.maximumFrictionConeExcess=Math.max(metrics.maximumFrictionConeExcess,Math.abs(c.tangentImpulse)-mu*c.impulse);
   if(sliding)metrics.maximumSlidingLawError=Math.max(metrics.maximumSlidingLawError,Math.abs(c.tangentImpulse+mu*c.impulse*Math.sign(slip)));
   metrics.maximumFrictionPower=Math.max(metrics.maximumFrictionPower,c.tangentImpulse*slip);
  }
  const free=!b.active.some(c=>(c.friction==='axial-key'||c.kind==='stud')&&c.impulse>1e-12)&&
   Math.max(...b.v.slice(0,3).map(Math.abs))<1e-8&&Math.abs(b.v[4]-d.parameters.omegaOutput)<1e-8;
  if(free){if(!interval)interval={first:i,last:i};else interval.last=i;}
  else if(interval){if(interval.last>interval.first)freeIntervals.push(interval);interval=null;}
 }
 if(interval&&interval.last>interval.first)freeIntervals.push(interval);
 const freeChecks=[];
 for(const interval of freeIntervals){
  const start=report.rows[interval.first],end=report.rows[interval.last],I=d.parameters.shaftInertia,
   acceleration=phi=>-d.gravity.at(phi,0).gradient[3]/I,
   energy=(phi,v)=>.5*I*v*v+d.gravity.at(phi,0).potential;
  let phi=start.q[3],v=start.v[3],time=start.time,maxAngleError=0,maxSpeedError=0,maximumEnergyError=0;
  const initialEnergy=energy(phi,v);
  for(let i=interval.first+1;i<=interval.last;i++){
   const target=report.rows[i];
   while(time<target.time-1e-12){
    const h=Math.min(.0001,target.time-time),a1=acceleration(phi),q2=phi+h*v/2,v2=v+h*a1/2,a2=acceleration(q2),
     q3=phi+h*v2/2,v3=v+h*a2/2,a3=acceleration(q3),q4=phi+h*v3,v4=v+h*a3,a4=acceleration(q4);
    phi+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a1+2*a2+2*a3+a4)/6;time+=h;
   }
   maxAngleError=Math.max(maxAngleError,Math.abs(phi-target.q[3]));maxSpeedError=Math.max(maxSpeedError,Math.abs(v-target.v[3]));
   maximumEnergyError=Math.max(maximumEnergyError,Math.abs(energy(phi,v)-initialEnergy));
  }
  freeChecks.push({startTime:start.time,endTime:end.time,states:interval.last-interval.first+1,maxAngleError,maxSpeedError,maximumEnergyError});
 }
 const seed=report.rows.filter(r=>r.time<=report.nextStud.time-.3).at(-1),replay=[seed];let state=seed,replayError=null,replayStud=null;
 try{while(state.time<report.end.time-1e-12){
  state=d.advance(state,Math.min(.00025,report.end.time-state.time));replay.push(state);
  if(!replayStud&&state.active.some(c=>c.kind==='stud'&&c.impulse>1e-12))replayStud=state;
 }}catch(e){replayError={message:e.message,stack:e.stack};}
 const maximumReplayPositionDifference=[0,0,0,0,0];
 for(let i=0;i<=128;i++){
  const t=seed.time+(state.time-seed.time)*i/128,a=at(replay,t),b=at(report.rows,t);
  for(let k=0;k<5;k++)maximumReplayPositionDifference[k]=Math.max(maximumReplayPositionDifference[k],Math.abs(a.q[k]-b.q[k]));
 }
 const replayFile=prefix+'-'+summary.direction+'-replay.json.gz';
 await writeGzipStudyReport(replayFile,{movement:87,productionChanged:false,mechanicsPassed:false,sources,direction:summary.direction,
  start:seed,end:state,error:replayError,nextStud:replayStud,rows:replay});
 const times=[...Array.from({length:25},(_,i)=>report.start.time+(report.end.time-report.start.time)*(i===24?24:i+.271)/24),
  ...Array.from({length:17},(_,i)=>report.nextStud.time+(report.end.time-report.nextStud.time)*i/16)];
 for(const time of times){
  const row=at(report.rows,time),phase=d.phase(row.q,time),queries=['left','right'].map(side=>jaws.evaluate(side,phase.relativeJaws[side],row.q[2]));
  native.push({...row,phase,jaws:queries,otherGaps:d.query(row.q,time).filter(c=>!c.kind.startsWith('jaw-')).map(c=>({kind:c.kind,gap:c.gap}))});
 }
 const result={direction:summary.direction,side:summary.side,states:report.rows.length,...metrics,exactSeatedStateContinuity:true,
  maximumWithdrawal:summary.maximumWithdrawal,nextStudTime:report.nextStud.time,nextStudKeyAngle:report.nextStud.phase.key,
  keyEvents:report.events,freeChecks,replayFile,replayError,replayStates:replay.length,replayStudTime:replayStud?.time,
  replayStudTimeDifference:replayStud?Math.abs(replayStud.time-report.nextStud.time):null,maximumReplayPositionDifference,
  minimumNativeJawGap:Math.min(...native.flatMap(r=>r.jaws.map(j=>j.gap))),minimumNativeOtherGap:Math.min(...native.flatMap(r=>r.otherGaps.map(c=>c.gap))),native};
 branches.push(result);console.log({...result,native:native.length,keyEvents:report.events.map(e=>({kind:e.kind,time:e.time}))});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,inputs:inputFiles,branches,
 qualification:'Checks the state-continuous second lift after opposite-jaw seating. Unloaded shaft intervals are independently integrated with fourth-order Runge-Kutta using only native output inertia/gravity. A four-times-finer local replay covers each next-stud impact and the outgoing half time unit. Native jaw and other gap samples supplement full stored-state balance checks. These remain bounded branches, not source-fidelity or repeating-cycle acceptance.'})+'\n',{flag:'wx'});
for(const r of branches){
 assert(r.maximumMomentumResidual<1e-9&&r.maximumFreeVelocityError<1e-9&&r.maximumContactRateResidual<1e-8&&r.maximumComplementarity<1e-8&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumWithdrawal<1e-8);
 assert(r.freeChecks.length>=1&&r.freeChecks.every(c=>c.maxAngleError<.0005&&c.maxSpeedError<.0005&&c.maximumEnergyError<1e-9));
 assert(!r.replayError&&r.replayStudTimeDifference<.002&&Math.max(...r.maximumReplayPositionDifference)<.005);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6);
}
