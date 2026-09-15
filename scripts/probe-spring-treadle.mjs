import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';
const m=await loadMujoco(),runs=[];
for(const timestep of [.00025,.000125]){
 const p=makeSpringTreadlePhysics(m,{timestep});try{
  const rows=[],ends=[];let maxExtension=0,minTreadle=Infinity,maxTreadle=-Infinity,maxTension=0;
  for(let tick=0;tick<=Math.round(16/timestep);tick++){
   assert.ok(Math.abs(p.data.time-tick*timestep)<1e-7);
   if(tick%Math.round(.01/timestep)===0){const s=p.state();assert.ok(s.qpos.every(Number.isFinite));rows.push(s);if(tick>=Math.round(12/timestep)){maxExtension=Math.max(maxExtension,s.bandExtension);minTreadle=Math.min(minTreadle,s.treadle);maxTreadle=Math.max(maxTreadle,s.treadle);maxTension=Math.max(maxTension,s.tension);}}
   if(tick%Math.round(4/timestep)===0)ends.push(p.state());
   if(tick<Math.round(16/timestep))p.step();
  }
  const seam=Math.max(...ends[4].qpos.map((x,i)=>Math.abs(x-ends[3].qpos[i])));
  const summary={...p.description,finalCycleMaximumBandExtension:maxExtension,finalCycleTreadleRange:[minTreadle,maxTreadle],finalCycleMaximumTension:maxTension,lastTwoCycleAngleDifference:seam};
  runs.push({summary,rows});fs.writeFileSync(`/dev/shm/160-coupled-${timestep}.json`,JSON.stringify(rows));
 }finally{p.dispose();}
}
let maxTreadleDifference=0,maxUpperDifference=0;for(let i=1200;i<=1600;i++){const a=runs[0].rows[i],b=runs[1].rows[i];maxTreadleDifference=Math.max(maxTreadleDifference,Math.abs(a.treadle-b.treadle));maxUpperDifference=Math.max(maxUpperDifference,Math.hypot(...a.upper.map((x,k)=>x-b.upper[k])));}
const report={movement:160,status:'coupling-diagnostic-not-registered',runs:runs.map(r=>r.summary),finalCycleMaximumTimestepTreadleDifference:maxTreadleDifference,finalCycleMaximumTimestepUpperDifference:maxUpperDifference,sources:['scripts/probe-spring-treadle.mjs','src/simulation/mujoco-spring-return-treadle/coupled-physics.js','src/simulation/mujoco-spring-return-treadle/leaf-assembly.js','src/simulation/mujoco-spring-return-treadle/source.js','src/simulation/mujoco-spring-return-treadle/band-route.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/160-coupled.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
