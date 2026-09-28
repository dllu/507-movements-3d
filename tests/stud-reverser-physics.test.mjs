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
test('153 elbow boss is lever-coloured with its pin in the eye, and the return arm has plate width',async()=>{
 const THREE=await import('three');const {makeRelievedStudReverser}=await import('../src/simulation/mujoco-stud-reverser/geometry.js');
 const v=makeRelievedStudReverser({inputContactMinimum:1.4}),b=v.root.userData.blocks,g=v.root.userData.geometry;
 try{
  assert.equal(b.leverPivotCollar.material,b.inputArm.userData.blocks.working.material);
  const pin=b.fixedFrame.getObjectByName('fixed-elbow-pivot-pin');assert.ok(pin);pin.geometry.computeBoundingBox();
  assert.ok(pin.geometry.boundingBox.max.z>g.leverPlaneZ+.36,'pin reaches the boss face');
  const arm=b.outputArm.userData.blocks.body.geometry;arm.computeBoundingBox();
  // Working (+y) edge unchanged at the old half-width; idle edge widened to about 0.31 total at the eye.
  assert.ok(Math.abs(arm.boundingBox.max.y-g.leverOutputHalfWidth)<1e-3);
  assert.ok(arm.boundingBox.max.y-arm.boundingBox.min.y>.3);
  assert.ok(Math.abs(arm.boundingBox.max.x-(g.leverOutputLength+g.leverOutputHalfWidth))<5e-3);
 }finally{v.dispose();}
});
