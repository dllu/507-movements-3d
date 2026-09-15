import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeStudReverserPhysics} from '../src/simulation/mujoco-stud-reverser/physics.js';
const mujoco=await loadMujoco();
test('153 prototype has one driven disk and passive bar and elbow coordinates',()=>{
 const p=makeStudReverserPhysics(mujoco);try{assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);for(let i=0;i<4800;i++)p.step();assert.ok(p.data.qpos[1]>.5);assert.ok(Array.from(p.data.qfrc_applied).every(x=>x===0));}finally{p.dispose();}
});
test('153 bar stays stationary when stud contact is removed',()=>{
 const p=makeStudReverserPhysics(mujoco,{contact:false,gravity:0});try{const q=Array.from(p.data.qpos);for(let i=0;i<4800;i++)p.step();assert.ok(Math.abs(p.data.qpos[0]-q[0])>.5);assert.ok(Math.abs(p.data.qpos[1]-q[1])<1e-12);assert.ok(Math.abs(p.data.qpos[2]-q[2])<1e-12);}finally{p.dispose();}
});
test('153 relieved arm sustains passive reciprocation without a prescribed reset',()=>{
 const p=makeStudReverserPhysics(mujoco,{inputContactMinimum:1.4,barFriction:2});
 try{assert.deepEqual(Array.from(p.model.jnt_range).slice(4,6),[0,0]);assert.equal(p.model.geom_bodyid[p.id('mjOBJ_GEOM','lever-rest-stop')],0);let low=Infinity,high=-Infinity;const periodTicks=Math.round(p.description.period/p.timestep),ends=[];
  for(let i=1;i<=periodTicks*3;i++){p.step();if(i>periodTicks*2){low=Math.min(low,p.data.qpos[1]);high=Math.max(high,p.data.qpos[1]);}if(i%periodTicks===0)ends.push(Array.from(p.data.qpos));}
  assert.ok(low>-.02&&low<.08);assert.ok(high>1&&high<1.05);assert.ok(Math.abs(ends[2][1]-ends[1][1])<.001);assert.ok(Math.abs(ends[2][2]-ends[1][2])<1e-5);
 }finally{p.dispose();}
});
