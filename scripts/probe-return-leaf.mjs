import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeReturnLeafPhysics} from '../src/simulation/mujoco-spring-return-treadle/leaf-physics.js';
const mujoco=await loadMujoco(),runs=[];
for(const [segments,timestep] of [[16,.0005],[32,.0005],[64,.0005],[64,.00025]]){
 const p=makeReturnLeafPhysics(mujoco,{segments,tailSegments:Math.round(segments*3/16),timestep,release:2});
 try{
  const initial=p.state(),restLengths=initial.points.slice(1).map((x,i)=>Math.hypot(...x.map((v,k)=>v-initial.points[i][k]))),rows=[];let maximumLinkLengthError=0,loaded;
  const steps=Math.round(4/timestep),stride=Math.round(.01/timestep);
  for(let tick=0;tick<=steps;tick++){
   assert.ok(Math.abs(p.data.time-tick*timestep)<1e-7,'Native clock reset');
   if(tick%stride===0){const s=p.state();assert.ok(s.qpos.every(Number.isFinite));s.points.slice(1).forEach((x,i)=>{maximumLinkLengthError=Math.max(maximumLinkLengthError,Math.abs(Math.hypot(...x.map((v,k)=>v-s.points[i][k]))-restLengths[i]));});if(tick===Math.round(1.99/timestep))loaded=s;rows.push({time:tick*timestep,tie:s.tie,points:s.points});}
   if(tick<steps)p.step();
  }
  const final=p.state(),report={...p.description,maximumLinkLengthError,loadedTie:loaded.tie,loadedDisplacement:loaded.tie.map((x,i)=>x-initial.tie[i]),finalReturnError:Math.hypot(...final.tie.map((x,i)=>x-initial.tie[i]))};
  assert.ok(maximumLinkLengthError<1e-12);assert.ok(report.loadedDisplacement[1]<-.3);assert.ok(report.finalReturnError<1e-7);
  fs.writeFileSync(`/dev/shm/160-leaf-${segments}-${timestep}.json`,JSON.stringify(rows));runs.push(report);
 }finally{p.dispose();}
}
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const report={movement:160,status:'isolated-spring-candidate',runs,spatialRefinementLoadedTip:[distance(runs[0].loadedTie,runs[1].loadedTie),distance(runs[1].loadedTie,runs[2].loadedTie)],timestepRefinementLoadedTip:distance(runs[2].loadedTie,runs[3].loadedTie),sources:['scripts/probe-return-leaf.mjs','src/simulation/mujoco-spring-return-treadle/leaf-physics.js','src/simulation/mujoco-spring-return-treadle/source.js','src/simulation/mujoco-spring-return-treadle/leaf-assembly.js','src/simulation/mujoco/simulation.js','public/engravings/mm_160.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/160-return-leaf.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
