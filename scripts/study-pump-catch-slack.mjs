import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchNormalContact} from './lib/pump-catch-normal-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchSlackStep} from './lib/pump-catch-slack-dynamics.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-slack-dynamics',step=Number(process.env.PROBE_STEP??.001),duration=Number(process.env.PROBE_DURATION??8),loadMass=Number(process.env.PROBE_LOAD??1),
  angularSpeed=-2*Math.PI/Number(process.env.PROBE_PERIOD??4),drag=Number(process.env.PROBE_DRAG??0);assert(step>0&&duration>0&&loadMass>0);
const frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/study-pump-catch-slack.mjs','scripts/lib/pump-catch-slack-dynamics.mjs','scripts/lib/pump-catch-normal-contact.mjs','scripts/lib/pump-catch-rope.mjs',
  'scripts/lib/pump-catch-dynamics.mjs','scripts/lib/pump-catch-contact.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','scripts/lib/study-report-io.mjs'],prefix);
const model=makePumpCatchCandidate(),contact=makePumpCatchNormalContact(model),dynamics=makePumpCatchSlackDynamics(model,{loadMass,drag}),rows=[{time:0,q:[0,0,0],v:[0,0,0],active:[],slack:0}],events=[],rejected=[];
let failure=null,previous='',maximumIterations=0,subdivisions=0;const started=performance.now();
function advance(target,depth=0){
  const before=rows.at(-1),h=target-before.time,result=pumpCatchSlackStep(dynamics,contact,before,target,h,angularSpeed);
  if(result.failed){if(rejected.length<40)rejected.push({...result,h,depth});if(depth===8){failure=result;return false;}subdivisions++;
    const middle=(before.time+target)/2;return advance(middle,depth+1)&&advance(target,depth+1);}
  rows.push(result);maximumIterations=Math.max(maximumIterations,result.iterations);const active=[...new Set(result.active.map(c=>c.kind))].sort().join('+');
  if(active!==previous){events.push({time:result.time,from:previous,to:active,q:result.q,v:result.v,slack:result.slack});previous=active;}return true;
}
for(let i=1;i<=Math.round(duration/step);i++){
  if(!advance(i*step))break;if(i%1000===0)console.log({time:rows.at(-1).time,seconds:(performance.now()-started)/1000,q:rows.at(-1).q,v:rows.at(-1).v,events:events.length,subdivisions});
}
verify();verifyStudySources(sources);const summary={movement:86,status:'independent-pump-with-unilateral-rope-diagnostic',passed:!failure,mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,
  step,duration,angularSpeed,parameters:dynamics.parameters,states:rows.length,actualEnd:rows.at(-1).time,range:[0,1,2].map(k=>[Math.min(...rows.map(r=>r.q[k])),Math.max(...rows.map(r=>r.q[k]))]),
  maximumSlack:Math.max(...rows.map(r=>r.slack)),events,maximumIterations,subdivisions,rejected,failure,seconds:(performance.now()-started)/1000,sources,
  qualification:'Free wheel, absolute catch angle and vertical pump load. A finite attached massless rope transmits tension only, including unwinding and the straight span; no stroke stop is prescribed. Corrected finite face/corner normals supply cam and stop reactions. Failed nonlinear trials are bisected and recomputed. This remains diagnostic until independent spatial, mass/force, edge-crossing, time-step and complete hardware checks pass.'};
const packed=await writeGzipStudyReport(prefix+'.json.gz',{...summary,rows});fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...summary,trajectory:{file:prefix+'.json.gz',...packed}},null,2)+'\n',{flag:'wx'});
console.log({...summary,events:events.length,rejected:rejected.slice(0,3),sources:undefined});if(failure)process.exitCode=1;
