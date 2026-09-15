import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics,waterGovernorGeometry} from '../src/simulation/mujoco-water-governor/physics.js';
import {governorEquilibrium} from '../src/simulation/mujoco-ball-governor/equilibrium.js';
const m=await loadMujoco(),period=14*Math.PI/governorEquilibrium(.375,waterGovernorGeometry()).speed,runs=[];
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
for(const steps of [32768,65536]){
 const p=makeWaterGovernorPhysics(m,{period,timestep:period/steps}),ends=[],cycles=[],samples=[];
 let minimumSelector=Infinity,maximumSelector=-Infinity,minimumSpeed=0,maximumSpeed=0;
 try{
  for(let tick=0;tick<=steps*64;tick++){
   const selector=.108+p.data.qpos[5];minimumSelector=Math.min(minimumSelector,selector);maximumSelector=Math.max(maximumSelector,selector);
   if(tick%32===0){const s=p.state();minimumSpeed=Math.min(minimumSpeed,s.outputSpeed);maximumSpeed=Math.max(maximumSpeed,s.outputSpeed);if(tick>=steps*63&&tick%(steps/512)===0)samples.push(s);}
   if(tick%steps===0){
    assert.ok(Math.abs(p.data.time-tick*p.timestep)<1e-6,'native clock reset');
    const s=p.state();ends.push(s);
    if(ends.length>1){const a=ends.at(-2);cycles.push({cycle:tick/steps,minimumSpeed,maximumSpeed,internalClosure:Math.max(...s.qpos.slice(1,6).map((x,i)=>Math.abs(x-a.qpos[i+1]))),velocityClosure:Math.max(...s.qvel.map((x,i)=>Math.abs(x-a.qvel[i]))),spindlePhaseClosure:wrap(s.spindle-a.spindle),outputPhaseClosure:wrap(s.output-a.output),outputAdvance:s.output-a.output});}
    minimumSpeed=0;maximumSpeed=0;
   }
   if(tick<steps*64)p.step();
  }
  assert.ok(minimumSelector>-.335&&maximumSelector<.425,'selector passed a backing face');
  const r={stepsPerCycle:steps,timestep:p.timestep,period,minimumSelector,maximumSelector,lastCycles:cycles.slice(-8)};runs.push(r);console.log(r);
  fs.writeFileSync(`/dev/shm/162-repeated-${steps}.json`,JSON.stringify({cycles,samples}));
 }finally{p.dispose();}
}
const report={movement:162,status:'repeated-cycle-diagnostic-not-a-bake',method:'64 cycles at two timesteps. Drive period gives seven nominal spindle turns, without prescribing loose-gear phase or output closure. Backing limits checked every native step.',runs,sources:['scripts/settle-water-governor.mjs','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/162-repeated-selector.json',JSON.stringify(report,null,2)+'\n');
