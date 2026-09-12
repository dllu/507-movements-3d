import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchImpactStep} from './lib/pump-catch-impact-dynamics.mjs';
import {pumpCatchSmoothStep} from './lib/pump-catch-smooth-step.mjs';
import {pumpCatchHasSlidingCam} from './lib/pump-catch-contact-mode.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input='artifacts/review/086-quarter-ms-hybrid.json.gz',data=readStudyReport(input),
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-return-contact-event-diagnostic',
  start=Number(process.env.PROBE_START??7.9215),duration=.003,step=.0005,eventStep=1e-8,contactStep=.0000078125,
  model=makePumpCatchCompleteCandidate(),contact=makePumpCatchBoundsContact(model),dynamics=makePumpCatchSlackDynamics(model,data.parameters),
  initial=data.rows.find(r=>r.time>=start),rows=[initial],counts={},events=[],witnesses=[],limit=500;
// The old trajectory is only a diagnostic seed. Its own archived sources are
// checked separately from the current solver used to advance the small window.
for(const s of data.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256);
const sources=freezeStudySources([input,'scripts/probe-pump-catch-hybrid-contact-events.mjs',...data.sources.map(s=>s.file),
  'scripts/lib/pump-catch-contact-mode.mjs'],prefix),signature=r=>[...new Set(r.active.map(c=>c.kind))].sort().join('+');
let failure=null,limited=false;
function advance(target,depth=0){
  if(rows.length>=limit){limited=true;return false;}
  const before=rows.at(-1),h=target-before.time,sliding=pumpCatchHasSlidingCam(before.active);
  if(sliding&&h>contactStep*(1+1e-9)){const mid=(before.time+target)/2;return advance(mid,depth+1)&&advance(target,depth+1);}
  const smooth=pumpCatchSmoothStep(dynamics,contact,before,target,h,data.angularSpeed),
    result=smooth.q?smooth:pumpCatchImpactStep(dynamics,contact,before,target,h,data.angularSpeed),
    changed=!result.failed&&signature(before)!==signature(result),event=changed||smooth.event;
  if(result.failed||event&&h>eventStep){
    const reason=result.failed??smooth.event??'reaction-signature';counts[reason]=(counts[reason]??0)+1;
    if(depth>=24){failure={target,h,result,smooth};return false;}
    const mid=(before.time+target)/2;return advance(mid,depth+1)&&advance(target,depth+1);
  }
  rows.push(result);
  if(changed&&events.length<20)events.push({time:target,h,from:signature(before),to:signature(result),smoothEvent:smooth.event});
  if(h<1e-7&&witnesses.length<12)witnesses.push({before,result,h,smoothEvent:smooth.event,
    nearby:contact.query(result.q,data.angularSpeed*target).filter(c=>c.gap<=2e-8)});
  return true;
}
for(let i=1;i<=Math.round(duration/step);i++)if(!advance(initial.time+i*step))break;
verifyStudySources(sources);
const report={movement:86,status:'bounded-return-contact-event-diagnostic',input,start:initial.time,end:rows.at(-1).time,
  states:rows.length,limited,failure,counts,events,witnesses,sources,productionChanged:false,mechanicsPassed:false,
  qualification:'A bounded local reproduction seeded from a retained earlier trajectory. It diagnoses solver-mode transitions; it does not replace either running full study or establish agreement with their actual states.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,witnesses:witnesses.length,sources:undefined});if(failure)process.exitCode=1;
