import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import loadMujoco from '@mujoco/mujoco';
import {makeTappetStudy} from '../src/simulation/mujoco-diagonal-catch/tappet-study.js';
import {fitDiagonalHandle} from '../src/simulation/mujoco-diagonal-catch/handle-fit.js';
const m=await loadMujoco(),runs=[];
for(const side of ['lower','upper'])for(const options of [{},{timestep:.000125},{contacts:false},{extraTravel:.4},{extraTravel:.4,timestep:.000125}]){
 const p=makeTappetStudy(m,{side,...options}),samples=[];let minimumGap=0,failure=null;
 try{for(let i=0;i<=Math.round(4/p.timestep);i++){
  if(i%Math.round(.01/p.timestep)===0)samples.push(p.state());
  const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
  if(i<Math.round(4/p.timestep)){const time=p.data.time;p.step();if(p.data.time<=time||!Array.from(p.data.qvel).every(v=>Number.isFinite(v)&&Math.abs(v)<100)){failure=p.state();break;}}
 }
 const final=p.state(),pistonError=Math.abs(final.piston-final.target);
 runs.push({parameters:p.parameters,minimumGap,failure,final,pistonError,completedStroke:!failure&&pistonError<.01,angleRange:[Math.min(...samples.map(s=>s.angle)),Math.max(...samples.map(s=>s.angle))],samples});
 }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/181-tappet-probe.json',JSON.stringify(runs));
const checks=[];
for(const side of ['lower','upper']){
 const cases=runs.filter(r=>r.parameters.side===side),control=cases.find(r=>!r.parameters.contacts);
 const check={side,stable:cases.every(r=>!r.failure),disabledContactCompletesStroke:control.completedStroke,disabledContactHandleDrift:Math.max(...control.angleRange.map(a=>Math.abs(a-control.parameters.initial))),prescribedStopsCompleteStroke:cases.filter(r=>r.parameters.contacts&&!r.parameters.extraTravel).every(r=>r.completedStroke),extraTravelCompletesStroke:cases.filter(r=>r.parameters.extraTravel).every(r=>r.completedStroke)};
 checks.push(check);
}
const report={movement:181,status:'isolated-tappet-study',scope:'Current working-arm surface with a source-width input shoe; passive weighted handle, inferred valve end stops, no catch and no other handle. This does not qualify the complete mechanism.',assumptions:['Shoe bounds follow source pixels 170 through 193 at scale 0.0125.','Handle mass, inertia, friction, damping, valve stops and actuator force are diagnostic assumptions, not measurements.','Extra-travel cases widen only the driven stop by 0.4 radians; they are counterfactual controls, not proposed production motion.','With no catch, a released handle falls back under its weight after the shoe passes.'],checks,runs:runs.map(({samples,...r})=>r),sources:['scripts/probe-diagonal-catch-tappet.mjs','src/simulation/mujoco-diagonal-catch/tappet-study.js','src/simulation/authored-diagonal-catches.js','src/simulation/mujoco-diagonal-catch/handle-fit.js','src/simulation/mujoco-diagonal-catch/tappet-envelope.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
report.sourceFits={upper:fitDiagonalHandle('upper'),lower:fitDiagonalHandle('lower')};
fs.writeFileSync('docs/validation/181-tappet-study.json',JSON.stringify(report,null,2)+'\n');console.log(report.runs);
// Validate the experiment's controls, not the complete mechanism. A reported
// stalled source-angle case remains a failure of that geometry even if these pass.
for(const check of checks){
 assert(check.prescribedStopsCompleteStroke,`${check.side}: fitted handle stalls`);
 assert(check.stable,`${check.side}: unstable integration`);
 assert(check.disabledContactCompletesStroke,`${check.side}: input cannot move without contact`);
 assert(check.disabledContactHandleDrift<.001,`${check.side}: unforced handle moves`);
 assert(check.extraTravelCompletesStroke,`${check.side}: extra-travel control still stalls`);
}
