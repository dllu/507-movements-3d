import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchImpactStep} from './lib/pump-catch-impact-dynamics.mjs';
import {pumpCatchSmoothStep} from './lib/pump-catch-smooth-step.mjs';
import {pumpCatchHasSlidingCam} from './lib/pump-catch-contact-mode.mjs';
import {summarizePumpCatchRows} from './lib/pump-catch-summary.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const input='artifacts/review/086-complete-sixteenth-ms-summary.json',reference=readStudyReport(input),
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-hybrid',step=Number(process.env.PROBE_STEP??.0005),duration=Number(process.env.PROBE_DURATION??16),
  eventStep=Number(process.env.PROBE_EVENT_STEP??1e-8),contactStep=Number(process.env.PROBE_CONTACT_STEP??.0000078125),angularSpeed=reference.angularSpeed;
assert(step>0&&eventStep>0&&eventStep<contactStep&&contactStep<=step&&duration>0);verifyStudySources(reference.sources);
const sources=freezeStudySources([input,'scripts/study-pump-catch-hybrid.mjs','scripts/lib/pump-catch-smooth-step.mjs','scripts/lib/pump-catch-contact-mode.mjs',...reference.sources.map(s=>s.file)],prefix),
  model=makePumpCatchCompleteCandidate(),contact=makePumpCatchBoundsContact(model),dynamics=makePumpCatchSlackDynamics(model,reference.parameters),
  rows=[{time:0,q:[0,0,0],v:[0,0,0],active:[],slack:0}],signature=r=>[...new Set(r.active.map(c=>c.kind))].sort().join('+'),
  events=[],rejected=[],stats={smooth:0,impact:0,eventSubdivisions:0,slidingSubdivisions:0,failureSubdivisions:0,maximumDepth:0};
let failure=null;const started=performance.now();
function advance(target,depth=0){
  stats.maximumDepth=Math.max(stats.maximumDepth,depth);const before=rows.at(-1),h=target-before.time,
    sliding=pumpCatchHasSlidingCam(before.active);
  if(sliding&&h>contactStep*(1+1e-9)){
    stats.slidingSubdivisions++;const mid=(before.time+target)/2;return advance(mid,depth+1)&&advance(target,depth+1);
  }
  const smooth=pumpCatchSmoothStep(dynamics,contact,before,target,h,angularSpeed),
    result=smooth.q?smooth:pumpCatchImpactStep(dynamics,contact,before,target,h,angularSpeed),changed=!result.failed&&signature(before)!==signature(result),
    event=changed||smooth.event;
  if(result.failed||event&&h>eventStep){
    if(depth>=24){failure={time:target,h,depth,result,smooth};return false;}
    if(result.failed){stats.failureSubdivisions++;if(rejected.length<20)rejected.push({time:target,h,depth,reason:result.failed});}else stats.eventSubdivisions++;
    const mid=(before.time+target)/2;return advance(mid,depth+1)&&advance(target,depth+1);
  }
  rows.push(result);stats[result.integration?'smooth':'impact']++;
  if(rows.length%5000===0)console.log({time:target,seconds:(performance.now()-started)/1000,states:rows.length,...stats});
  if(changed)events.push({time:target,from:signature(before),to:signature(result),q:result.q,v:result.v});return true;
}
for(let i=1;i<=Math.round(duration/step);i++){
  if(!advance(i*step))break;if(i%1000===0)console.log({time:rows.at(-1).time,seconds:(performance.now()-started)/1000,states:rows.length,...stats});
}
verifyStudySources(sources);const summary={movement:86,status:'hybrid-smooth-ode-and-localized-impact-study',passed:!failure,step,eventStep,contactStep,duration,angularSpeed,
  parameters:{...dynamics.parameters,completeHardware:model.root.userData.completeHardware},...summarizePumpCatchRows(rows),stats,events,rejected,failure,
  seconds:(performance.now()-started)/1000,sources,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  qualification:'RK4 integrates intervals with free motion or linear wrapped-rope, heel and bed constraints, checking every stage against finite gaps. Negative reactions, winding transitions and new contacts return to the unilateral impact solver. Contact-state changes are localized by subdivision; sliding-cam intervals have a separate step cap. Stage forces are retained for independent audits. This is an unqualified diagnostic pending force, work, convergence and continuous-clearance checks.'};
const packed=await writeGzipStudyReport(prefix+'.json.gz',{...summary,rows});
fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...summary,trajectory:{file:prefix+'.json.gz',...packed}},null,2)+'\n',{flag:'wx'});
console.log({...summary,events:events.length,sources:undefined});if(failure)process.exitCode=1;
