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
