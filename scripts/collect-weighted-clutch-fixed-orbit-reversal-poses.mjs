import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-fixed-orbit-reversal-poses',inputs=['CW','CCW'].flatMap(d=>[
  'artifacts/review/087-fixed-orbit-seating-'+d+'-check.json','artifacts/review/087-fixed-orbit-following-'+d+(d==='CCW'?'-tight-stud-check.json':'-check.json')]),
  reports=inputs.map(readStudyReport),poses=[],previews=[],files=[...inputs];
for(let i=0;i<reports.length;i++){
  const r=reports[i],seating=i%2===0;verifyStudySources(r.sources);
  assert.deepEqual(r.options,reports[0].options);assert(r.poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
  for(const p of r.poses){
    if(!seating&&!['held','following-lift'].includes(p.name))continue;
    poses.push({...p,name:(seating?'seating-':'following-')+p.name,
      cameraDirection:['key-clearance','seated','following-lift'].includes(p.name)?[4,3,10]:undefined});
  }
}
for(const direction of ['CW','CCW']){
  const segmentFiles=['artifacts/review/087-fixed-orbit-lift-fine-'+direction+'-mu0.78.json.gz',
    'artifacts/review/087-fixed-orbit-transfer-fine-'+direction+'.json.gz',
    'artifacts/review/087-fixed-orbit-seating-'+direction+'-fine-'+direction+'.json.gz'],segments=segmentFiles.map(readStudyReport);
  for(let i=1;i<segments.length;i++){
    assert.equal(segments[i].start.time,segments[i-1].end.time);assert.deepEqual(segments[i].start.q,segments[i-1].end.q);
    assert.equal(segments[i].start.phase.input,segments[i-1].end.phase.input);
  }
  previews.push({direction,label:direction+' branch: first reversal',files:segmentFiles,startTime:segments[0].start.time,endTime:segments.at(-1).end.time});
  const followingFile='artifacts/review/087-fixed-orbit-following-'+direction+(direction==='CCW'?'-tight-fine-':'-fine-')+direction+'.json.gz',following=readStudyReport(followingFile);
  previews.push({direction,label:direction+' branch: following stud encounter',files:[followingFile],startTime:following.nextStud.time-.25,endTime:following.end.time});
  files.push(...segmentFiles,followingFile);
}
const sources=freezeStudySources([...reports.flatMap(r=>r.sources.map(s=>s.file)),...files,
  'scripts/collect-weighted-clutch-fixed-orbit-reversal-poses.mjs'],prefix);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:reports[0].options,poses,previews,
  qualification:'Selects twelve previously checked seating/holding/following-lift poses and four inspection-preview segments. The first-reversal joins explicitly preserve position, time and input phase at both boundaries; the jaw impulse changes velocity at fixed position. Rendering and final speed are separate checks.'})+'\n',{flag:'wx'});
console.log({poses:poses.length,previews:previews.length});
