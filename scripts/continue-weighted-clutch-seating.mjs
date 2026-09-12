import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchSeatingEvents} from './lib/weighted-clutch-seating-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/087-first-return-seating-events-CW.json.gz',prior=readStudyReport(input),
 prefix=process.env.PROBE_PREFIX??'artifacts/review/087-continued-return-seating',
 profileFile='artifacts/review/087-wide-return-seating-profile.json',profiles=readStudyReport(profileFile),
 impacts=readStudyReport('artifacts/review/087-first-gravity-jaw-impact.json'),
 sources=freezeStudySources([...prior.sources.map(s=>s.file),input,'scripts/continue-weighted-clutch-seating.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),profile=profiles.profiles.find(p=>p.direction===prior.direction),
 d=makeWeightedClutchSeatingEvents(model,impacts.rows.find(r=>r.direction===prior.direction),profile),rows=prior.rows.slice(),events=prior.events.slice();
verifyStudySources(prior.sources);assert(!prior.error&&!prior.seat);
let state=prior.end,seat=null,error=null;
try{
 while(state.time<12&&(!seat||state.time<seat.time+.2)){
  state=d.advance(state,prior.h);rows.push(state);
  if(state.seatingCornerImpact)events.push({time:state.time,q:state.q,v:state.v,seatingCornerImpact:true});
  if(!seat&&state.active.length===4&&Math.max(...state.v.slice(0,3).map(Math.abs),Math.abs(state.v[3]-d.parameters.omegaOutput))<1e-8)seat=state;
 }
}catch(e){error={message:e.message,stack:e.stack};}
const scale=Math.max(state.loss,Math.abs(state.work),Math.abs(state.energy-prior.start.energy)),
 summary={direction:prior.direction,h:prior.h,states:rows.length,parameters:d.parameters,start:prior.start,end:state,seat,error,events,
  relativeAbsoluteDefect:state.absoluteDefect/scale,ledgerResidual:state.energy-prior.start.energy-state.work+state.loss-state.defect};
verifyStudySources(sources);await writeGzipStudyReport(prefix+'-'+prior.direction+'.json.gz',
 {movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries:[summary]})+'\n',{flag:'wx'});
console.log({direction:prior.direction,h:prior.h,states:rows.length,seat:seat&&{time:seat.time,q:seat.q,v:seat.v},error,
 end:{time:state.time,q:state.q,v:state.v},relativeAbsoluteDefect:summary.relativeAbsoluteDefect});
assert(!error&&seat&&Math.abs(summary.ledgerResidual)<1e-8);
