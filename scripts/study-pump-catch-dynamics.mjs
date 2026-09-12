import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchContact} from './lib/pump-catch-contact.mjs';
import {makePumpCatchDynamics,pumpCatchStep} from './lib/pump-catch-dynamics.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-free-dynamics',step=Number(process.env.PROBE_STEP??.001),duration=Number(process.env.PROBE_DURATION??4),
  loadMass=Number(process.env.PROBE_LOAD??.05),angularSpeed=-2*Math.PI/Number(process.env.PROBE_PERIOD??4),drag=Number(process.env.PROBE_DRAG??0);
assert(step>0&&duration>0&&loadMass>0);const frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/study-pump-catch-dynamics.mjs','scripts/lib/pump-catch-dynamics.mjs','scripts/lib/pump-catch-contact.mjs',
  'scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','src/simulation/finite-plate-geometry.js',
  'src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','scripts/lib/study-report-io.mjs'],prefix);
const model=makePumpCatchCandidate(),contact=makePumpCatchContact(model),dynamics=makePumpCatchDynamics(model,{loadMass,drag}),rows=[{time:0,q:[0,0],v:[0,0],active:[]}],events=[];
let failure=null,previous='',maximumIterations=0;const started=performance.now();
for(let i=1;i<=Math.round(duration/step);i++){
  const result=pumpCatchStep(dynamics,contact,rows.at(-1),i*step,step,angularSpeed);if(result.failed){failure=result;break;}
  rows.push(result);maximumIterations=Math.max(maximumIterations,result.iterations);const active=[...new Set(result.active.map(c=>c.kind))].sort().join('+');
  if(active!==previous){events.push({time:result.time,from:previous,to:active,q:result.q,v:result.v});previous=active;}
  if(i%1000===0)console.log({time:result.time,seconds:(performance.now()-started)/1000,q:result.q,v:result.v,events:events.length});
}
verify();verifyStudySources(sources);const summary={movement:86,status:'free-wheel-and-catch-finite-contact-diagnostic',passed:!failure,mechanicsPassed:false,candidateIntegrated:false,
  productionChanged:false,step,duration,angularSpeed,parameters:dynamics.parameters,states:rows.length,actualEnd:rows.at(-1).time,
  range:[0,1].map(k=>[Math.min(...rows.map(r=>r.q[k])),Math.max(...rows.map(r=>r.q[k]))]),events,maximumIterations,failure,
  seconds:(performance.now()-started)/1000,sources,qualification:'Two free coordinates: wheel angle and absolute catch angle. Actual core mesh masses, ideal taut massless pump rope, assumed load and lower stroke stop, gravity and inelastic finite boundary contacts determine the diagnostic motion. Pump hardware, force/cone audit, edge-crossing bounds, step-size agreement and rendering remain unqualified.'};
const packed=await writeGzipStudyReport(prefix+'.json.gz',{...summary,rows});
fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...summary,trajectory:{file:prefix+'.json.gz',...packed}},null,2)+'\n',{flag:'wx'});console.log({...summary,sources:undefined});if(failure)process.exitCode=1;
