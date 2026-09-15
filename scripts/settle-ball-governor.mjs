import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
const m=await loadMujoco(),runs=[];
for(const timestep of [.0005,.00025]){
 const p=makeBallGovernorPhysics(m,{timestep});try{
  const rows=[],ends=[];let maxConnection=0;
  for(let tick=0;tick<=Math.round(1600/timestep);tick++){
   assert.ok(Math.abs(p.data.time-tick*timestep)<1e-6,'Native clock reset');
   if(tick%Math.round(8/timestep)===0)ends.push(p.state());
   if(tick>=Math.round(1584/timestep)&&tick%Math.round(.01/timestep)===0){const s=p.state();maxConnection=Math.max(maxConnection,...s.connectionErrors);rows.push(s);}
   if(tick<Math.round(1600/timestep))p.step();
  }
  const a=ends.at(-2),b=ends.at(-1),positionClosure=Math.max(...b.qpos.slice(1).map((x,i)=>Math.abs(x-a.qpos[i+1]))),velocityClosure=Math.max(...b.qvel.map((x,i)=>Math.abs(x-a.qvel[i]))),rotationIncrement=b.spindle-a.spindle;
  runs.push({description:p.description,positionClosure,velocityClosure,rotationIncrement,maxConnection,cycleEndSpreads:ends.filter((_,i)=>i%20===0).map(s=>({time:s.time,spread:s.leftSpread})),rows});fs.writeFileSync(`/dev/shm/161-settled-${timestep}.json`,JSON.stringify(rows));console.log({timestep,positionClosure,velocityClosure,rotationIncrement,maxConnection});
 }finally{p.dispose();}
}
let spread=0,sleeve=0;for(let i=800;i<=1600;i++){spread=Math.max(spread,Math.abs(runs[0].rows[i].leftSpread-runs[1].rows[i].leftSpread));sleeve=Math.max(sleeve,Math.abs(runs[0].rows[i].sleeveY-runs[1].rows[i].sleeveY));}
const report={movement:161,method:'Calibrated full-linkage equilibrium speed endpoints and current-time spindle control, unchanged low damping. Two 1600-second runs; final two cycles sampled at 0.01 seconds. No damping increase or prescribed arm/sleeve trajectory.',runs:runs.map(({rows,...r})=>r),finalCycleMaximumSpreadDifference:spread,finalCycleMaximumSleeveDifference:sleeve,sources:['scripts/settle-ball-governor.mjs','src/simulation/mujoco-ball-governor/physics.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/161-settled-linkage.json',JSON.stringify(report,null,2)+'\n');console.log({spread,sleeve});
