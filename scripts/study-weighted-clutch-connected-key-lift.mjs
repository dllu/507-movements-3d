import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-connected-key-lift',
 input=process.env.PROBE_INPUT??'artifacts/review/087-first-key-seating-events.json',parent=readStudyReport(input),
 impactFile='artifacts/review/087-first-key-jaw-impact.json',impacts=readStudyReport(impactFile),
 profileFile='artifacts/review/087-first-key-seating-profiles.json',profiles=readStudyReport(profileFile),
 h=Number(process.env.PROBE_DT??.001),horizon=70,
 sources=freezeStudySources([...parent.sources.map(s=>s.file),input,impactFile,profileFile,
  'scripts/study-weighted-clutch-connected-key-lift.mjs'],prefix),model=makeWeightedClutchKeyCandidate(),summaries=[];
verifyStudySources(parent.sources);assert(h>0&&Number.isFinite(h));
for(const branch of parent.summaries){
 assert(branch.settled&&!branch.error);const first=impacts.rows.find(r=>r.direction===branch.direction),
  profile=profiles.profiles.find(p=>p.direction===branch.direction),
  d=makeWeightedClutchKeyEngagementEvents(model,profile,first.friction,[first.originalProfile]),start=branch.end,rows=[start],events=[];
 let state=start,error=null,nextStud=null,lastKey=start.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
 try{while(state.time<start.time+horizon&&!(nextStud&&state.time>=nextStud.time+.5)){
  const before=state;state=d.advance(state,h);rows.push(state);
  const key=state.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
  if(key!==lastKey)events.push({kind:key??'key-unloaded',time:state.time,q:state.q,v:state.v});lastKey=key;
  if(!nextStud&&state.active.some(c=>c.kind==='stud'&&c.impulse>1e-12)){
   nextStud=state;events.push({kind:'next-stud',time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v});
   console.log({direction:branch.direction,event:'next-stud',time:state.time,afterHolding:state.time-start.time,q:state.q,v:state.v});
  }
 }}catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:branch.direction,side:branch.side,h,horizon,states:rows.length,parameters:d.parameters,
  start,end:state,error,nextStud,events,elapsed:state.time-start.time,
  maximumWithdrawal:Math.max(...rows.map(r=>(r.q[2]-start.q[2])*(branch.side==='left'?1:-1))),
  minimumGap:Math.min(...rows.map(r=>r.minimumGap)),
  maximumSelectedPriorityVelocitySpread:Math.max(...rows.map(r=>r.selectedPriorityVelocitySpread??0)),
  stepHalvings:rows.reduce((s,r)=>s+(r.rejectedSteps?.length??0),0)},file=prefix+'-'+branch.direction+'.json.gz';
 verifyStudySources(sources);await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push({...summary,file});console.log({direction:branch.direction,states:rows.length,error,elapsed:summary.elapsed,
  nextStud:nextStud?.time,maximumWithdrawal:summary.maximumWithdrawal,end:{time:state.time,q:state.q,v:state.v},keyEvents:events.length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries,
 qualification:'Continuous continuation from the observed opposite-jaw seated states through held rotation, native key unloading/reloading and the next stud-driven lift. No new preload, phase, velocity or endpoint is assigned. The final half time unit is a connected second lifting experiment; further shifts, source proportions and a complete repeating cycle remain unqualified.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.nextStud&&s.end.time>=s.nextStud.time+.5));
