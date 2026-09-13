import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-four-transfers-poses',reports=[],poses=[],previews=[],files=[];
for(const direction of ['CW','CCW'])for(const segment of [1,2]){
  const input='artifacts/review/087-sequence-'+direction+'-segment-'+segment+'-check.json',r=readStudyReport(input),b=r.branches[0],
    fineFile='artifacts/review/087-sequence-'+direction+(direction==='CCW'&&segment===2?'-resumed-fine':'-fine')+'-segment-'+segment+'.json.gz',fine=readStudyReport(fineFile);
  reports.push(r);files.push(input,fineFile);verifyStudySources(r.sources);
  assert.deepEqual(r.options,reports[0].options);assert(fine.settled&&!fine.error);
  assert(b.maximumComplementarity<1e-8&&b.minimumNativeJawGap> -1e-6&&Math.max(...b.positionDifference)<.002);
  assert(r.poses.length===8&&r.poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
  for(const p of r.poses)if(segment===2||['next-stud','over-center','opposite-jaw','seated'].includes(p.name)){
    poses.push({...p,name:'reversal-'+(segment+2)+'-'+p.name,segment,cameraDirection:['opposite-jaw','seated'].includes(p.name)?[4,3,10]:undefined});
  }
  if(segment===2)previews.push({direction,label:direction+' branch: fourth connected transfer',files:[fineFile],startTime:fine.nextStud.time-.2,endTime:fine.end.time});
}
const sources=freezeStudySources([...reports.flatMap(r=>r.sources.map(s=>s.file)),...files,'scripts/collect-weighted-clutch-four-transfer-poses.mjs'],prefix);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:reports[0].options,poses,previews,
  qualification:'Twenty-four selected checked poses from the third and fourth connected transfers, with two slowed fourth-transfer previews beginning just before stud arrival. All held intervals remain in the numerical evidence. These previews do not establish whole-cycle playback speed or continuous clearance.'})+'\n',{flag:'wx'});
console.log({poses:poses.length,previews:previews.length});
