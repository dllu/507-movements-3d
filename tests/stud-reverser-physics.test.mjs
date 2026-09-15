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
