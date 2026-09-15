import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeLatchStudy} from '../src/simulation/mujoco-diagonal-catch/latch-study.js';
import {makeDiagonalContactStudy} from '../src/simulation/mujoco-diagonal-catch/contact-study.js';
const m=await loadMujoco(),retention=[],coupled=[],traces=[];

function run(p,duration,observe){
 let minimumGap=0,failure=null;const samples=[];
 try{
  const steps=Math.round(duration/p.timestep),stride=Math.round(.02/p.timestep);
  for(let i=0;i<=steps;i++){
   if(i%stride===0){const state=p.state();samples.push(state);observe?.(state);
    const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
   }
   if(i===steps)break;
   const time=p.data.time;p.step();
   if(p.data.time<=time||!Array.from(p.data.qvel).every(v=>Number.isFinite(v)&&Math.abs(v)<100)){failure=p.state();break;}
  }
  return {parameters:p.parameters,minimumGap,failure,samples,final:p.state()};
 }finally{p.dispose();}
}
for(const side of ['upper','lower'])for(const options of [{},{timestep:.000125},{friction:0},{release:true,friction:0},{contacts:false}]){
 const r=run(makeLatchStudy(m,{side,...options}),3);
 const held=r.samples.find(s=>Math.abs(s.time-1)<.001),initial=r.parameters.initial,open=side==='upper'?r.parameters.fit.angle:0;
 const summary={...r,held,holds:Math.abs(held.handle-initial)<.02,released:Math.abs(r.final.handle-open)<.02};delete summary.samples;
 const {fit,...parameters}=r.parameters;summary.parameters={...parameters,closedAngle:fit.angle};
 retention.push(summary);traces.push({kind:'retention',...r});
}
for(const options of [{registered:false},{},{timestep:.00025},{contacts:false}]){
 const p=makeDiagonalContactStudy(m,options),period=p.parameters.period,stages=[];
 const r=run(p,period*2,s=>{
  for(const cycle of [0,1])for(const [stage,fraction]of [['top',.45],['bottom',.95]])if(Math.abs(s.time-(cycle+fraction)*period)<.011)stages.push({cycle,stage,...s});
 });
 for(const s of stages){
  const expected=s.stage==='top'?{upper:r.parameters.fits.upper.angle,lower:r.parameters.fits.lower.angle,piston:r.parameters.end}:{upper:0,lower:0,piston:r.parameters.start};
  s.errors={upper:Math.abs(s.upper-expected.upper),lower:Math.abs(s.lower-expected.lower),piston:Math.abs(s.piston-expected.piston)};
  s.passed=s.errors.upper<.02&&s.errors.lower<.02&&s.errors.piston<.015;
 }
 const summary={...r,stages,completedTwoCycles:!r.failure&&stages.length===4&&stages.every(s=>s.passed)};delete summary.samples;
 const {fits,...parameters}=r.parameters;summary.parameters={...parameters,closedAngles:{upper:fits.upper.angle,lower:fits.lower.angle}};
 coupled.push(summary);traces.push({kind:'coupled',...r});
}
const controls={
 stable:retention.every(r=>!r.failure)&&coupled.every(r=>!r.failure),
 passiveRetention:retention.filter(r=>r.parameters.contacts&&!r.parameters.release).every(r=>r.holds),
 externalCatchLiftReleases:retention.filter(r=>r.parameters.release).every(r=>r.holds&&r.released),
 disabledContactDoesNotHold:retention.filter(r=>!r.parameters.contacts).every(r=>!r.holds&&r.released),
};
const sources=['scripts/probe-diagonal-catch-transfer.mjs','src/simulation/mujoco-diagonal-catch/catch-profile.js','src/simulation/mujoco-diagonal-catch/latch-study.js','src/simulation/mujoco-diagonal-catch/contact-study.js','src/simulation/mujoco-diagonal-catch/handle-fit.js','src/simulation/authored-diagonal-catches.js','src/simulation/mujoco-bench-clamp/profile.js','src/simulation/mujoco/simulation.js'];
const report={movements:[181,182],status:'contact-reconstruction-not-qualified',scope:'Offline candidate catch/finger contact geometry. Production still uses the previous scripted latch. Isolated retention and external release do not establish complete transfer.',assumptions:['Catch outline traced from plate 181; terminal finger surfaces inferred from both plates.','Upper holding face lifted 3 source pixels; lower heel moved 6 pixels right and 5 up to register with the fitted handle axes.','Registered model has a one-sided catch stop at zero radians; unregistered control permits -0.3 radians.','Catch mass 0.25, handle masses 0.1, inertias, friction and stops are diagnostic assumptions.','Contact layers separate the working arms from the catching fingers; connecting hardware and full visible-solid validation are not included.','The isolated release control applies a 6-unit torque pulse directly to the catch for 0.2 seconds; the coupled model actuates only the piston.'],controls,retention,coupled,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('/dev/shm/181-transfer-probe.json',JSON.stringify(traces));
fs.writeFileSync('docs/validation/181-transfer-study.json',JSON.stringify(report,null,2)+'\n');
console.log(controls);console.table(coupled.flatMap(r=>r.stages.map(s=>({registered:r.parameters.registered,contacts:r.parameters.contacts,dt:r.parameters.timestep,cycle:s.cycle,stage:s.stage,...s.errors,passed:s.passed}))));
// A numerically stable run or successful isolated latch is not a working engine.
if(!Object.values(controls).every(Boolean)||!coupled.filter(r=>r.parameters.registered&&r.parameters.contacts).every(r=>r.completedTwoCycles))process.exitCode=1;
