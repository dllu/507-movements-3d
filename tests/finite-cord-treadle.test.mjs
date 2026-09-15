import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
test('159 finite rope survives slack pickup, retains its length and keeps the foot above the floor',async()=>{
 const mujoco=await loadMujoco(),p=makeFiniteCordTreadlePhysics(mujoco),rows=[];
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.nq,99);const initial=p.state();assert.ok(initial.attachmentError<1e-10);
  const ticks=Math.round(4/p.timestep),stride=Math.round(.02/p.timestep);let maximumLengthError=0;
  for(let i=0;i<=ticks;i++){
   assert.ok(Math.abs(p.data.time-i*p.timestep)<1e-7,'MuJoCo must not reset after an unstable step');
   if(i%stride===0){mujoco.mj_forward(p.model,p.data);const s=p.state();rows.push(s);let length=0;for(let j=1;j<s.points.length;j++)length+=Math.hypot(...s.points[j].map((v,k)=>v-s.points[j-1][k]));maximumLengthError=Math.max(maximumLengthError,Math.abs(length-p.description.totalLength));assert.ok(s.points.flat().every(Number.isFinite));for(const point of s.points)assert.ok(Math.abs(point[2]-.64)<1e-10);}
   if(i<ticks)p.step();
  }
  const summary={movement:159,description:p.description,duration:rows.at(-1).time,samples:rows.length,maximumLengthError,maximumAttachmentError:Math.max(...rows.map(r=>r.attachmentError)),minimumFootClearance:Math.min(...rows.map(r=>r.footClearance)),treadleRange:[Math.min(...rows.map(r=>r.treadle)),Math.max(...rows.map(r=>r.treadle))],pulleyRange:[Math.min(...rows.map(r=>r.pulley)),Math.max(...rows.map(r=>r.pulley))],sources:['tests/finite-cord-treadle.test.mjs','src/simulation/mujoco-cord-treadle/rope-physics.js','src/simulation/cord-treadle-motion.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
  fs.writeFileSync('/dev/shm/159-rope-96-coarse.json',JSON.stringify(rows));fs.writeFileSync('/dev/shm/159-finite-rope-baseline.json',JSON.stringify(summary,null,2)+'\n');
  assert.ok(maximumLengthError<1e-9);assert.ok(summary.maximumAttachmentError<.005);assert.ok(summary.minimumFootClearance>-.005);assert.ok(summary.treadleRange[1]-summary.treadleRange[0]>.5);assert.ok(summary.pulleyRange[1]-summary.pulleyRange[0]>2);
  p.reset();assert.deepEqual(p.state().points,initial.points);
 }finally{p.dispose();}
});
