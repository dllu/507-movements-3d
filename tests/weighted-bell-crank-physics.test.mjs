import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeWeightedBellCrankPhysics} from '../src/simulation/mujoco-weighted-bell-crank/physics.js';
import {makeSupportedWeightedBellCrank} from '../src/simulation/mujoco-weighted-bell-crank/geometry.js';
import {syncWeightedBellCrank,weightedCordGeometry} from '../src/simulation/mujoco-weighted-bell-crank/sync.js';
const mujoco=await loadMujoco();
test('154 has one driven disk, passive followers, unilateral cord and a fixed contact stop',()=>{
 const p=makeWeightedBellCrankPhysics(mujoco,{supported:true}),v=makeSupportedWeightedBellCrank();
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.nq,3);assert.equal(p.model.ntendon,1);
  assert.deepEqual(Array.from(p.model.jnt_range),[0,0,0,0,0,0]);
  assert.equal(p.model.geom_bodyid[p.id('mjOBJ_GEOM','rest-stop')],0);
  assert.deepEqual(Array.from(p.model.tendon_range),[0,p.description.cordLength]);
  const g=v.root.userData.geometry;
  for(let i=0;i<=100;i++){
   const angle=p.description.initialLever+.18*i/100,c=weightedCordGeometry(g,angle),reference=v.root.userData.cordGeometryAtLeverAngle(-angle);
   assert.ok(Math.abs(c.incomingLength-reference.incomingLength)<1e-10);assert.ok(Math.abs(c.wrapLength-reference.wrapLength)<1e-10);
   const lift=(c.incomingLength+c.wrapLength)*g.sourceScale+3.43-p.description.cordLength;
   p.data.qpos.set([0,angle,lift]);mujoco.mj_forward(p.model,p.data);
   assert.ok(Math.abs(p.data.ten_length[0]-p.description.cordLength)<1e-10);
   syncWeightedBellCrank(v,p.state());
   assert.ok(Math.abs(v.root.userData.blocks.weight.position.y+.56-lift)<1e-12);
  }
 }finally{v.dispose();p.dispose();}
});
test('154 contacts lift the weight repeatedly; removing contact prevents the lift',()=>{
 for(const contact of [true,false]){
  const p=makeWeightedBellCrankPhysics(mujoco,{supported:true,contact});
  try{
   let maximum=-Infinity,minimum=Infinity;
   for(let i=0;i<Math.round(12/p.timestep);i++){p.step();maximum=Math.max(maximum,p.data.qpos[2]);minimum=Math.min(minimum,p.data.qpos[2]);}
   if(contact){assert.ok(maximum>.23&&maximum<.28);assert.ok(minimum>-.002);}
   else assert.ok(maximum<.001);
   p.reset();assert.deepEqual(Array.from(p.data.qpos),[0,p.description.initialLever,0]);
  }finally{p.dispose();}
 }
});
