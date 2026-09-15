import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {syncElbowPawl} from '../src/simulation/mujoco-elbow-pawl/sync.js';
import loadMujoco from '@mujoco/mujoco';
import {makeElbowPawlGeometry} from '../src/simulation/mujoco-elbow-pawl/geometry.js';
import {makeElbowPawlPhysics} from '../src/simulation/mujoco-elbow-pawl/physics.js';
const mujoco=await loadMujoco();
for(const side of ['right','left'])test(`155 ${side} installation feeds one tooth through passive contact`,()=>{
 const v=makeElbowPawlGeometry({side}),p=makeElbowPawlPhysics(mujoco,v);
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.nq,5);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','slider'));
  assert.equal(p.model.jnt_stiffness[p.id('mjOBJ_JOINT','pawl')],0);
  assert.equal(p.data.ncon,0,'source-start pose must be free of initial penetration');
  const ticks=Math.round(p.description.options.period/p.timestep),ends=[];
  for(let cycle=0;cycle<4;cycle++){for(let i=0;i<ticks;i++)p.step();ends.push(p.data.qpos[3]);
   mujoco.mj_forward(p.model,p.data);syncElbowPawl(v,{qpos:Array.from(p.data.qpos)});
   for(const name of ['carrier','rod','pawl','output','slider']){const xyz=v.root.userData.blocks[name].getWorldPosition(new THREE.Vector3()),body=p.bodies[name];assert.ok(xyz.distanceTo(new THREE.Vector3(...p.data.xpos.slice(body*3,body*3+3)))<1e-10,name);}
  }
  for(let i=1;i<ends.length;i++)assert.ok(Math.abs((ends[i]-ends[i-1])/v.root.userData.profile.pitch-(side==='right'?-1:1))<1e-4);
  assert.equal(p.data.qfrc_actuator[2],0);assert.equal(p.data.qfrc_actuator[3],0);
  p.reset();assert.deepEqual(Array.from(p.data.qpos),[0,0,0,0,0]);
 }finally{p.dispose();v.dispose();}
});
test('155 wheel stays still when contact is removed',()=>{
 const v=makeElbowPawlGeometry(),p=makeElbowPawlPhysics(mujoco,v);
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);
  const ticks=Math.round(2*p.description.options.period/p.timestep);let maximum=0;
  for(let i=0;i<ticks;i++){p.step();maximum=Math.max(maximum,Math.abs(p.data.qpos[3]));}
  assert.ok(maximum<1e-12);
 }finally{p.dispose();v.dispose();}
});
