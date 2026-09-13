import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyNeutral} from './lib/weighted-clutch-key-neutral.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-neutral',
 input='artifacts/review/087-quarter-key-release.json',parent=readStudyReport(input),
 impactFile='artifacts/review/087-first-key-impact.json',impacts=readStudyReport(impactFile),h=Number(process.env.PROBE_DT??.00025),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),input,impactFile,
  'scripts/lib/weighted-clutch-jaw-bound.mjs','scripts/lib/weighted-clutch-key-neutral.mjs','scripts/study-weighted-clutch-key-neutral.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),summaries=[];
verifyStudySources(parent.sources);verifyStudySources(impacts.sources);assert(h>0&&Number.isFinite(h));
for(const branch of parent.summaries){
 const first=impacts.rows.find(r=>r.direction===branch.direction&&r.staticCoefficient===.78),
  d=makeWeightedClutchKeyNeutral(model,first.profile,first),start=branch.end,rows=[start];
 let state=start,error=null;
 try{while(state.time<start.time+2&&!state.oppositeJawImpact){state=d.advance(state,h);rows.push(state);}}
 catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:branch.direction,h,states:rows.length,parameters:d.parameters,start,end:state,error,nativeQueries:d.nativeQueries,
  elapsed:state.time-start.time,minimumGap:Math.min(...rows.map(r=>r.minimumGap)),
  maximumSelectedPriorityVelocitySpread:Math.max(...rows.map(r=>r.selectedPriorityVelocitySpread??0))},
  file=prefix+'-'+branch.direction+'.json.gz';
 verifyStudySources(sources);await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push({...summary,file});console.log({direction:branch.direction,h,states:rows.length,error,elapsed:summary.elapsed,
  time:state.time,q:state.q,v:state.v,nativeQueries:d.nativeQueries,oppositeJaw:state.oppositeJaw});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries,
 qualification:'Exact state/clock continuation from the previously checked five-coordinate withdrawal endpoints through first opposite-jaw contact. Key friction, output gravity and reflected inertia remain active. This stage stops before the new jaw impulse and does not claim seated engagement or a full repeating cycle.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.end.oppositeJawImpact&&Math.abs(s.end.oppositeJaw.gap)<1e-9));
