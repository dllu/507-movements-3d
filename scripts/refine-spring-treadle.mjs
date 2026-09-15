import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';
const m=await loadMujoco(),configs=[{segments:32,tailSegments:6,bandStiffness:20000,timestep:.000125},{segments:64,tailSegments:12,bandStiffness:20000,timestep:.000125},{segments:64,tailSegments:12,bandStiffness:40000,timestep:.000125},{segments:64,tailSegments:12,bandStiffness:40000,timestep:.0000625}],runs=[];
for(let run=0;run<configs.length;run++){
 const p=makeSpringTreadlePhysics(m,configs[run]);try{
  const rows=[],ends=[],dt=p.timestep;let extension=0;
  for(let tick=0;tick<=Math.round(16/dt);tick++){
   assert.ok(Math.abs(p.data.time-tick*dt)<1e-7);
   if(tick>=Math.round(12/dt)&&tick%Math.round(.01/dt)===0){const s=p.state();assert.ok(s.qpos.every(Number.isFinite));rows.push(s);extension=Math.max(extension,s.bandExtension);}
   if(tick===Math.round(12/dt)||tick===Math.round(16/dt))ends.push(p.state());
   if(tick<Math.round(16/dt))p.step();
  }
  const closure=Math.max(...ends[1].qpos.map((x,i)=>Math.abs(x-ends[0].qpos[i])));
  runs.push({configuration:p.description,maximumBandExtension:extension,cycleAngleClosure:closure,rows});fs.writeFileSync(`/dev/shm/160-refined-${run}.json`,JSON.stringify(rows));console.log({run,closure,extension});
 }finally{p.dispose();}
}
const comparisons=[];
for(let j=1;j<runs.length;j++){
 let treadle=0,upper=0,foot=0;
 for(let i=0;i<runs[j].rows.length;i++){const a=runs[j-1].rows[i],b=runs[j].rows[i];treadle=Math.max(treadle,Math.abs(a.treadle-b.treadle));for(const name of ['upper','foot']){const d=Math.hypot(...a[name].map((x,k)=>x-b[name][k]));if(name==='upper')upper=Math.max(upper,d);else foot=Math.max(foot,d);}}
 comparisons.push({from:j-1,to:j,maximumTreadleAngleDifference:treadle,maximumUpperDifference:upper,maximumFootDifference:foot});
}
const report={movement:160,method:'Four native 16-second runs; compare the final cycle at matching 0.01-second phases. Refine leaf discretization, band compliance, then timestep. This checks the stated massless-pulley idealization, not unknown real material properties.',runs:runs.map(({rows,...r})=>r),comparisons,sources:['scripts/refine-spring-treadle.mjs','src/simulation/mujoco-spring-return-treadle/coupled-physics.js','src/simulation/mujoco-spring-return-treadle/leaf-assembly.js','src/simulation/mujoco-spring-return-treadle/source.js','src/simulation/mujoco-spring-return-treadle/band-route.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/160-coupled-refinement.json',JSON.stringify(report,null,2)+'\n');console.log(comparisons);
