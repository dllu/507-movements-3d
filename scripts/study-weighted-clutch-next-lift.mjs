import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchSeatingEvents} from './lib/weighted-clutch-seating-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-forward-next-lift',
 input=process.env.PROBE_IMPACT??'artifacts/review/087-forward-next-stud-impact.json',impact=readStudyReport(input),
 profileFile=process.env.PROBE_PROFILE??'artifacts/review/087-reused-forward-seating-profile.json',profiles=readStudyReport(profileFile),
 firstImpacts=readStudyReport('artifacts/review/087-first-gravity-jaw-impact.json'),h=Number(process.env.PROBE_DT??.0000625),
 sources=freezeStudySources([...impact.sources.map(s=>s.file),input,'scripts/lib/weighted-clutch-seating-events.mjs',
  'scripts/study-weighted-clutch-next-lift.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),summaries=[];
verifyStudySources(impact.sources);
for(const first of impact.rows){
 const profile=profiles.profiles.find(p=>p.direction===first.direction),
  d=makeWeightedClutchSeatingEvents(model,firstImpacts.rows.find(r=>r.direction===first.direction),profile),
  energy=d.energy(first.q,first.velocityAfter),initial={time:first.time,q:first.q,v:first.velocityAfter,phase:first.phase,
   energy,initialEnergy:energy,active:first.active,loss:0,work:0,defect:0,absoluteDefect:0},rows=[initial];
 let state=initial,error=null;
 try{while(state.time<initial.time+.5){state=d.advance(state,h);rows.push(state);}}
 catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:first.direction,h,states:rows.length,parameters:d.parameters,start:initial,end:state,error,
  maximumWithdrawal:Math.max(...rows.map(r=>(r.q[2]-initial.q[2])*(profile.side==='left'?1:-1))),
  maximumOutputSpeedDeparture:Math.max(...rows.map(r=>Math.abs(r.v[3]-d.parameters.omegaOutput)))};
 verifyStudySources(sources);await writeGzipStudyReport(prefix+'-'+first.direction+'.json.gz',
  {movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push(summary);console.log({direction:first.direction,states:rows.length,error,maximumWithdrawal:summary.maximumWithdrawal,
  maximumOutputSpeedDeparture:summary.maximumOutputSpeedDeparture,end:{time:state.time,q:state.q,v:state.v}});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries,
 qualification:'Half a time unit after the returning stud impact. Tests whether the frictionless triangular-jaw candidate retains engagement as lifting begins. Neither clutch translation nor output speed is held. This diagnostic trajectory is not a completed reversal or a qualified replacement design.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error));
