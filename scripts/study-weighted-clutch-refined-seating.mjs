import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchSeatingEvents} from './lib/weighted-clutch-seating-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-refined-first-seating',h=Number(process.env.PROBE_DT??.00025),
 profileFile=process.env.PROBE_PROFILE??'artifacts/review/087-refined-seating-cusps.json',rawProfiles=readStudyReport(profileFile),
 profiles={...rawProfiles,profiles:rawProfiles.profiles??[rawProfiles]},
 impactFile='artifacts/review/087-first-gravity-jaw-impact.json',impacts=readStudyReport(impactFile),
 sources=freezeStudySources([...profiles.sources.map(s=>s.file),profileFile,impactFile,
  'scripts/lib/weighted-clutch-seating-contact.mjs','scripts/lib/weighted-clutch-seating-events.mjs','scripts/lib/weighted-clutch-loaded-seating.mjs',
  'scripts/study-weighted-clutch-refined-seating.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),summaries=[];
assert(h>0&&h<=.001);verifyStudySources(profiles.sources);verifyStudySources(impacts.sources);
for(const profile of profiles.profiles){
 const impact=impacts.rows.find(r=>r.direction===profile.direction),d=makeWeightedClutchSeatingEvents(model,impact,profile),
  rows=[d.initial()],events=[];let state=rows[0],error=null,seat=null;
 const kinds=r=>r.active.map(c=>c.kind.replace(/jaw-(left|right)-\d+/,'jaw-$1')).sort().join(',');
 try{
  while(state.time<Number(process.env.PROBE_DURATION??12)&&(!seat||state.time<seat.time+.2)){
   const next=d.advance(state,h);if(kinds(next)!==kinds(state)||next.seatingCornerImpact)events.push({time:next.time,kinds:kinds(next),q:next.q,v:next.v});
   rows.push(next);state=next;
   if(!seat&&state.active.length===4&&Math.max(...state.v.slice(0,3).map(Math.abs),Math.abs(state.v[3]-d.parameters.omegaOutput))<1e-8)seat=state;
  }
 }catch(e){error={message:e.message,stack:e.stack};}
 const scale=Math.max(state.loss,Math.abs(state.work),Math.abs(state.energy-rows[0].energy)),
  summary={direction:profile.direction,h,states:rows.length,parameters:d.parameters,start:rows[0],end:state,seat,error,events,
   relativeAbsoluteDefect:state.absoluteDefect/scale,ledgerResidual:state.energy-rows[0].energy-state.work+state.loss-state.defect};
 verifyStudySources(sources);await writeGzipStudyReport(prefix+'-'+profile.direction+'.json.gz',
  {movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push(summary);console.log({direction:profile.direction,h,states:rows.length,error,seat:seat&&{time:seat.time,q:seat.q,v:seat.v},
  end:{time:state.time,q:state.q,v:state.v,active:kinds(state)},relativeAbsoluteDefect:summary.relativeAbsoluteDefect});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.seat&&Math.abs(s.ledgerResidual)<1e-8));
