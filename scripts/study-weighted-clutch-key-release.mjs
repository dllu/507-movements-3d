import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-release',
 impactFile='artifacts/review/087-first-key-impact.json',impact=readStudyReport(impactFile),
 h=Number(process.env.PROBE_DT??.001),horizon=7,withdrawalThreshold=.002,
 sources=freezeStudySources([...impact.sources.map(s=>s.file),impactFile,'scripts/study-weighted-clutch-key-release.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),summaries=[];
verifyStudySources(impact.sources);
assert(h>0&&Number.isFinite(h));
for(const first of impact.rows.filter(r=>r.staticCoefficient===.78)){
 const d=makeWeightedClutchKeyDynamics(model,first.profile,first),
  initial=d.initial(first.q,first.impact.v,first.impact.active),rows=[initial],events=[];
 let state=initial,error=null,withdrawal=0,lastContact=initial.active.some(c=>c.kind==='stud');
 try{while(state.time<horizon-1e-12&&withdrawal<withdrawalThreshold){
  const before=state;state=d.step(state,Math.min(h,horizon-state.time));rows.push(state);
  withdrawal=(state.q[2]-initial.q[2])*(first.side==='left'?1:-1);
  const contact=state.active.some(c=>c.kind==='stud');
  if(contact!==lastContact)events.push({kind:contact?'stud-contact':'stud-release',time:state.time,q:state.q,v:state.v});
  lastContact=contact;
  if(!events.some(e=>e.kind==='axial-release')&&Math.abs(state.q[2]-initial.q[2])>1e-7)
   events.push({kind:'axial-release',time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v});
 }}catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:first.direction,h,horizon,withdrawalThreshold,states:rows.length,parameters:d.parameters,
  start:initial,end:state,error,events,withdrawal,reachedWithdrawalThreshold:withdrawal>=withdrawalThreshold,
  maximumSelectedPriorityVelocitySpread:Math.max(...rows.map(r=>r.selectedPriorityVelocitySpread??0)),
  maximumTransportPriorityVelocitySpread:Math.max(...rows.map(r=>r.transportPriorityVelocitySpread??0)),
  minimumGap:Math.min(...rows.map(r=>r.minimumGap))};
 verifyStudySources(sources);const file=prefix+'-'+first.direction+'.json.gz';
 await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push({...summary,file});console.log({direction:first.direction,h,states:rows.length,error,
  time:state.time,q:state.q,v:state.v,withdrawal,axialRelease:events.find(e=>e.kind==='axial-release'),
  lastStudEvent:events.filter(e=>e.kind.startsWith('stud')).at(-1),
  maximumSelectedPriorityVelocitySpread:summary.maximumSelectedPriorityVelocitySpread});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,summaries,qualification:'Diagnostic extension from loaded next-stud impact through either .002 axial withdrawal or seven time units. No event is clamped or concatenated to an earlier frictionless trajectory. This probes whether illustrative key friction retains the clutch through lifting and subsequently permits withdrawal; it does not complete neutral travel, opposite-jaw seating or another cycle.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error));
