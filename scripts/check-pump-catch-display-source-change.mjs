import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,freezeStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-rope-display-source-controls',input='artifacts/review/086-complete-eighth-ms-summary.json',data=readStudyReport(input),
  source=data.sources.find(s=>s.file==='scripts/lib/pump-catch-rope-mesh.mjs'),before=fs.readFileSync(source.archive,'utf8'),
  allowed=verifyPumpCatchStudySources(data.sources),controls=[];
assert.equal(allowed.length,1);assert.equal(allowed[0].file,source.file);
for(const [name,from,to]of [['rope-length','ropeLength=4.75','ropeLength=4.76'],['arc-resolution','arcStep=.003','arcStep=.004'],
  ['curve-shape','cut=-.85','cut=-.86'],['clamp-tangent','Math.sin(q[0])','Math.sin(q[0]+.01)'],['unrelated-text','// A massless','// Another massless']]){
  const archive=prefix+'-'+name+'-fixture.txt',text=before.replace(from,to);assert.notEqual(text,before);fs.writeFileSync(archive,text,{flag:'wx'});
  const fixture={...source,archive,sha256:hashStudyFile(archive)};assert.throws(()=>verifyPumpCatchStudySources([fixture]));controls.push({name,archive,rejected:true});
}
const sources=freezeStudySources([input,source.archive,'scripts/check-pump-catch-display-source-change.mjs','scripts/lib/pump-catch-rope-mesh.mjs',
  'scripts/lib/pump-catch-study-sources.mjs','scripts/lib/study-report-io.mjs'],prefix),report={movement:86,passed:true,allowed,controls,sources,
  qualification:'The exact display-only chord-count replacement is accepted. Changes to length, wrapping resolution, curve shape, clamp tangent and unrelated text are rejected. All remaining study sources are unchanged.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
