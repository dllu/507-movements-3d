import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
test('initial rope bow preserves endpoints and bounds source displacement without adding actuation',async()=>{
 const mujoco=await loadMujoco(),straight=makeFiniteCordTreadlePhysics(mujoco),bowed=makeFiniteCordTreadlePhysics(mujoco,{initialBow:.02});
 try{
  const a=straight.state(),b=bowed.state();let maximum=0;
  for(let i=0;i<a.points.length;i++){
   const distance=Math.hypot(...a.points[i].map((v,j)=>v-b.points[i][j]));maximum=Math.max(maximum,distance);
   assert.ok(distance<=.020001);assert.ok(Math.abs(b.points[i][2]-.64)<1e-12);
   if(i===0||i===a.points.length-1)assert.ok(distance<1e-12);
  }
  assert.ok(maximum>.019);assert.equal(bowed.model.nu,1);
  const before=JSON.stringify(b.points);bowed.step();bowed.reset();mujoco.mj_forward(bowed.model,bowed.data);assert.equal(JSON.stringify(bowed.state().points),before);
 }finally{straight.dispose();bowed.dispose();}
});
test('localized bow leaves the rest of the initial rope unchanged',async()=>{
 const mujoco=await loadMujoco(),straight=makeFiniteCordTreadlePhysics(mujoco),bowed=makeFiniteCordTreadlePhysics(mujoco,{initialBow:.02,initialBowLength:1});
 try{const a=straight.state().points,b=bowed.state().points;let remaining=0,changed=0;
  for(let i=a.length-1;i>=0;i--){if(i<a.length-1)remaining+=Math.hypot(...a[i].map((v,j)=>v-a[i+1][j]));const delta=Math.hypot(...a[i].map((v,j)=>v-b[i][j]));assert.ok(delta<=.020001);if(remaining>1||i===a.length-1)assert.ok(delta<1e-12);else if(delta>.001)changed++;}
  assert.ok(changed>=5,'Bow must affect the local end shape');assert.equal(bowed.model.nu,1);
 }finally{straight.dispose();bowed.dispose();}
});
