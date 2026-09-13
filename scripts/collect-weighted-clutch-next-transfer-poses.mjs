import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-next-transfer-poses',inputs=['CW','CCW'].map(d=>'artifacts/review/087-next-transfer-'+d+'-check.json'),
  reports=inputs.map(readStudyReport),poses=[],previews=[],files=[...inputs];
for(const r of reports){
  verifyStudySources(r.sources);assert.deepEqual(r.options,reports[0].options);
  assert(r.poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
  for(const b of r.branches)assert(b.maximumComplementarity<1e-8&&b.minimumNativeJawGap> -1e-6&&Math.max(...b.positionDifference)<.002);
  for(const p of r.poses)poses.push({...p,cameraDirection:['opposite-jaw','seated'].includes(p.name)?[4,3,10]:undefined});
  const direction=r.branches[0].direction,file='artifacts/review/087-fixed-orbit-next-measured-'+direction+'-fine-'+direction+'.json.gz',s=readStudyReport(file);
  assert(s.settled&&!s.error);files.push(file);
  previews.push({direction,label:direction+' branch: second connected transfer',files:[file],startTime:s.start.time,endTime:s.end.time});
}
const sources=freezeStudySources([...reports.flatMap(r=>r.sources.map(s=>s.file)),...files,'scripts/collect-weighted-clutch-next-transfer-poses.mjs'],prefix);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
  options:reports[0].options,poses,previews,qualification:'Twelve checked poses and two diagnostic preview segments for the second connected transfers. Production, source acceptance, long-term repetition and final playback speed remain separate.'})+'\n',{flag:'wx'});
console.log({poses:poses.length,previews:previews.length});
