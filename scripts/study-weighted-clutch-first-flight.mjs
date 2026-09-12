import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchFirstFlight} from './lib/weighted-clutch-first-flight.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-flight',h=Number(process.env.PROBE_DT??.001),
 speed=Number(process.env.PROBE_SPEED??.1),horizon=Number(process.env.PROBE_HORIZON??20),
 parent=readStudyReport('artifacts/review/087-native-contact-checkpoint.json'),
 files=[...parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
  'scripts/lib/weighted-clutch-inertia.mjs','scripts/lib/weighted-clutch-fast-stud.mjs',
  'scripts/lib/weighted-clutch-first-flight.mjs','scripts/study-weighted-clutch-first-flight.mjs'],
 sources=freezeStudySources(files,prefix),baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{verifyStudySources(sources);for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 model=makeWeightedClutchLostMotionCandidate(),summaries=[];
assert(h>0&&h<=.002&&horizon>0&&horizon<=60);verify();
for(const direction of ['CCW','CW']){
 const dynamics=makeWeightedClutchFirstFlight(model,{direction,speed}),rows=[dynamics.initial()],events=[],
  isContact=r=>r.active.some(c=>c.kind==='stud'&&c.impulse>1e-12);
 let state=rows[0],error=null,minimumGap=state.gap,maximumImpulse=0,maximumPositionIterations=0;
 try{
  while(state.time<horizon&&!dynamics.reached(state)){
   const next=dynamics.advance(state,Math.min(h,horizon-state.time));
   if(isContact(state)!==isContact(next))events.push({kind:isContact(next)?'contact':'release',time:next.time,q:next.q,v:next.v,e:next.e,gap:next.gap});
   minimumGap=Math.min(minimumGap,next.gap);maximumPositionIterations=Math.max(maximumPositionIterations,next.positionIterations);
   for(const c of next.active)maximumImpulse=Math.max(maximumImpulse,c.impulse);
   rows.push(next);state=next;
  }
 }catch(e){error={message:e.message,stack:e.stack};}
 const end=rows.at(-1),initialRestEnergy=dynamics.energy(dynamics.parameters.start,0),
  energyScale=Math.max(Math.abs(end.work),Math.abs(end.energy-initialRestEnergy),end.loss),
  summary={direction,parameters:dynamics.parameters,h,speed,horizon,states:rows.length,events,minimumGap,
   maximumImpulse,maximumPositionIterations,reachedEndpoint:dynamics.reached(end),error,
   start:rows[0],end,energyScale,relativeDefect:Math.abs(end.defect)/energyScale,
   relativeAbsoluteDefect:end.absoluteDefect/energyScale,
   ledgerResidual:end.energy-initialRestEnergy-end.work+end.loss-end.defect};
 const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
  ...summary,rows,qualification:dynamics.parameters.qualification};
 verify();await writeGzipStudyReport(prefix+'-'+direction+'.json.gz',report);
 summaries.push(summary);console.log(summary);
}
verify();
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
 sources,h,speed,horizon,summaries,qualification:'Partial timed linkage trajectories through lift/release/fall, ending before the shifter takes the opposite slot-end impact. Does not qualify complete clutch reversal, source fidelity, surrounding-part clearances or display playback.'},null,2)+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.reachedEndpoint&&s.minimumGap> -2e-9&&Math.abs(s.ledgerResidual)<1e-8));
