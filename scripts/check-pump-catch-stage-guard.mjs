import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {pumpCatchSmoothStep} from './lib/pump-catch-smooth-step.mjs';
import {pumpCatchRope} from './lib/pump-catch-rope.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-stage-guard-control',input='artifacts/review/086-quarter-ms-hybrid.json.gz',data=readStudyReport(input),
  model=makePumpCatchCompleteCandidate(),contact=makePumpCatchBoundsContact(model),dynamics=makePumpCatchSlackDynamics(model,data.parameters);
// This deliberately replays a rejected historical interval against the current
// guard; its old implementation remains available in the archived inputs.
for(const s of data.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained failing input: '+s.file);
let witness=null;
outer:for(let i=1;i<data.rows.length;i++){
  const row=data.rows[i],before=data.rows[i-1];if(!row.integration)continue;const h=row.time-before.time;
  for(let j=0;j<4;j++){
    const s=row.stages[j],time=before.time+[0,.5,.5,1][j]*h,
      gap=Math.min(contact.minimumRawGap(s.q,data.angularSpeed*time),pumpCatchRope(s.q,data.parameters).gap,s.q[2]-data.parameters.pumpStopHeight);
    if(gap>=-2e-8)continue;
    const result=pumpCatchSmoothStep(dynamics,contact,before,row.time,h,data.angularSpeed);
    assert.equal(result.event,'intermediate-contact');witness={interval:i-1,time:row.time,stage:j,stageTime:time,q:s.q,gap,result};break outer;
  }
}
assert(witness,'Historical audit must contain a rejected intermediate pose');
const sources=freezeStudySources([input,'scripts/check-pump-catch-stage-guard.mjs','scripts/lib/pump-catch-smooth-step.mjs',...data.sources.map(s=>s.file)],prefix);
verifyStudySources(sources);const report={movement:86,passed:true,witness,sources,
  qualification:'A finite penetration from the retained failing trajectory is replayed against the new guard and explicitly rejected before the smooth interval can be accepted.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
