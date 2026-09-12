import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchFirstFlight} from './lib/weighted-clutch-first-flight.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-recontact-refinement',
 input='artifacts/review/087-sixteenth-step-flight-CW.json.gz',parent=readStudyReport(input),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/check-weighted-clutch-first-recontact.mjs',input],prefix),
 model=makeWeightedClutchLostMotionCandidate(),dynamics=makeWeightedClutchFirstFlight(model,{direction:'CW'}),
 summaries=[],trajectories=[];
verifyStudySources(parent.sources);
for(const h of [.0000625,.00003125,.000015625,.0000078125,.00000390625]){
 let state=dynamics.initial();const rows=[[state.time,state.q,state.v,state.gap]],events=[];
 const active=r=>r.active.some(c=>c.kind==='stud'&&c.impulse>1e-12);
 while(state.time<.24){
  const next=dynamics.step(state,Math.min(h,.24-state.time));
  if(active(state)!==active(next))events.push({kind:active(next)?'contact':'release',time:next.time,q:next.q,v:next.v});
  rows.push([next.time,next.q,next.v,next.gap]);state=next;
 }
 let maximumAngleError=0,integratedVelocityError=0,lastError=0,lastTime=0,j=1;
 const previous=trajectories.at(-1);
 if(previous)for(const[t,q,v]of rows){
  while(previous.rows[j][0]<t&&j<previous.rows.length-1)j++;
  const a=previous.rows[j-1],b=previous.rows[j],u=(t-a[0])/(b[0]-a[0]),oldQ=a[1]+u*(b[1]-a[1]),oldV=a[2]+u*(b[2]-a[2]),error=Math.abs(v-oldV);
  maximumAngleError=Math.max(maximumAngleError,Math.abs(q-oldQ));
  integratedVelocityError+=(t-lastTime)*(error+lastError)/2;lastError=error;lastTime=t;
 }
 const summary={h,states:rows.length,events,maximumAngleError,integratedVelocityError,end:state,
  qualification:'Refines the initial native-facet release and first recontact only; velocities jump at recontact, so integrated velocity error accompanies the position comparison.'};
 summaries.push(summary);trajectories.push({h,rows});console.log(summary);
}
verifyStudySources(sources);
await writeGzipStudyReport(prefix+'-trajectories.json.gz',{movement:87,sources,columns:['time','q','v','gap'],summaries,
 rows:trajectories.flatMap(t=>t.rows.map(r=>[t.h,...r]))});
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,summaries},null,2)+'\n',{flag:'wx'});
for(const s of summaries)assert(s.events.length===2&&s.events[0].kind==='release'&&s.events[1].kind==='contact');
assert(summaries.at(-1).maximumAngleError<1e-5&&summaries.at(-1).integratedVelocityError<3e-5);
assert(Math.abs(summaries.at(-1).events[1].time-summaries.at(-2).events[1].time)<5e-5);
