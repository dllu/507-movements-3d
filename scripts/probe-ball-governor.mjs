import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
const m=await loadMujoco(),runs=[];
for(const timestep of [.0005,.00025]){
 const p=makeBallGovernorPhysics(m,{timestep});try{
  const rows=[],ends=[];let error=0,symmetry=0,min=Infinity,max=-Infinity;
  for(let tick=0;tick<=Math.round(32/timestep);tick++){
   assert.ok(Math.abs(p.data.time-tick*timestep)<1e-7);
   if(tick%Math.round(.01/timestep)===0){const s=p.state();rows.push(s);error=Math.max(error,...s.connectionErrors);symmetry=Math.max(symmetry,Math.abs(s.leftSpread-s.rightSpread));min=Math.min(min,s.leftSpread);max=Math.max(max,s.leftSpread);}
   if(tick%Math.round(8/timestep)===0)ends.push(p.state().leftSpread);
   if(tick<Math.round(32/timestep))p.step();
  }
  assert.ok(error<1e-5&&symmetry<1e-10);runs.push({configuration:p.description,maximumPinClosureError:error,maximumSymmetryError:symmetry,spreadRange:[min,max],cycleEndSpread:ends,rows});fs.writeFileSync(`/dev/shm/161-native-${timestep}.json`,JSON.stringify(rows));
 }finally{p.dispose();}
}
let maxDifference=0;for(let i=0;i<runs[0].rows.length;i++)maxDifference=Math.max(maxDifference,Math.abs(runs[0].rows[i].leftSpread-runs[1].rows[i].leftSpread));
const report={movement:161,status:'native-linkage-study-not-registered',runs:runs.map(({rows,...r})=>r),maximumTimestepSpreadDifference:maxDifference,limitations:'Under-damped transients have not settled to a periodic bake. Valve force, speed/load calibration, source-shaped solid clearances and bevel geometry/contact remain to review.',sources:['scripts/probe-ball-governor.mjs','src/simulation/mujoco-ball-governor/physics.js','public/engravings/mm_161.png','src/simulation/authored-governors.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/161-native-linkage.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,sources:undefined},null,2));
