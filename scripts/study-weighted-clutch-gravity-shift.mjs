import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchGravityShift} from './lib/weighted-clutch-gravity-shift.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-gravity-shift',h=Number(process.env.PROBE_DT??.00025),
 parent=readStudyReport('artifacts/review/087-first-native-jaws.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/lib/weighted-clutch-jaw-bound.mjs',
  'scripts/lib/weighted-clutch-diagonal-contact.mjs','scripts/lib/weighted-clutch-gravity-shift.mjs','scripts/lib/weighted-clutch-output-gravity.mjs','scripts/study-weighted-clutch-gravity-shift.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),summaries=[];
assert(h>0&&h<=.001);
for(const direction of ['CCW','CW']){
 const file='artifacts/review/087-sixteenth-step-flight-'+direction+'.json.gz',flight=readStudyReport(file),d=makeWeightedClutchGravityShift(model,flight),
  rows=[d.initial()],events=[];let state=rows[0],error=null;
 const kinds=r=>r.active.map(c=>c.kind).sort().join(',');
 try{
  while(state.time<2&&!state.oppositeJawImpact){
   const next=d.advance(state,h);if(kinds(next)!==kinds(state))events.push({time:next.time,kinds:kinds(next),q:next.q,v:next.v});
   rows.push(next);state=next;
  }
 }catch(e){error={message:e.message,stack:e.stack};}
 const scale=Math.max(state.loss,Math.abs(state.energy-rows[0].initialEnergy)),
  summary={direction,h,states:rows.length,parameters:d.parameters,events,start:rows[0],end:state,error,nativeJawQueries:d.nativeJawQueries,
   relativeDefect:Math.abs(state.defect)/scale,relativeAbsoluteDefect:state.absoluteDefect/scale,
   ledgerResidual:state.energy-rows[0].initialEnergy+state.loss-state.defect};
 verifyStudySources(sources);
 await writeGzipStudyReport(prefix+'-'+direction+'.json.gz',{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input:{file,sha256:hashStudyFile(file)},...summary,rows});
 summaries.push(summary);console.log(summary);
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,summaries},null,2)+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.end.oppositeJawImpact&&Math.abs(s.end.jaw.gap)<1e-9&&Math.abs(s.ledgerResidual)<1e-8));
