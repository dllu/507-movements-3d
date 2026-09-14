import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeHalfNutGeometry} from '../src/simulation/mujoco-half-nut/geometry.js';
import {makeMujocoHalfNut} from '../src/simulation/mujoco-half-nut/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();
test('110 candidate has closed solids and actual tapered thread tips',()=>{
 const v=makeHalfNutGeometry(),u=v.root.userData;
 try {
  assert.equal(Object.keys(u.parts).length,20);
  for(const [name,m]of Object.entries(u.parts)) {
   const a=inspectWeightedClutchSolid(m.geometry);assert(a.volume>0,name);assert.equal(a.unmatchedEdges+a.degenerate+a.wrongNormals+a.nonfinite,0,name);
   assert.equal(a.components,name.endsWith('NutThread')?8:1,name);
  }
  assert(u.profile.external[0].lead*u.profile.external[1].lead<0);
  assert(u.profile.nuts.every(n=>n.thread.tipRelief>0));assert.equal(u.hideGround,true);
  // All half-nut vertices must clear the roller's radial envelope in neutral.
  for(const cell of u.cells.carriage)for(const [x,y,z]of cell)assert(Math.hypot(y-u.profile.spacing,z)>u.profile.crestRadius,'neutral half-nut crosses the screw');
 }finally{disposeObject3D(v.root);}
});
test('110 compiled contact vertices match the rendered construction and the traverse has no actuator',t=>{
 const v=makeMujocoHalfNut(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try {
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,2);assert.equal(p.model.neq,0);
  assert.deepEqual(Array.from(p.model.actuator_trnid),[p.id('mjOBJ_JOINT','roller'),-1,p.id('mjOBJ_JOINT','selector'),-1]);
  for(const [family,cells]of Object.entries(u.cells)) {
   const inverse=u.blocks[family].matrixWorld.clone().invert();
   for(const [i,cell]of cells.entries()) {
    const id=p.id('mjOBJ_GEOM',family+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
    const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
    for(let j=0;j<n;j++) {
     const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform).applyMatrix4(inverse);
     error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;
    }
   }
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({compiledVertices:count,maximumVertexErrorPixels:error*100,geoms:p.model.ngeom}));
 }finally{v.dispose();}
});
test('110 contact drives three successive reversals without position resets',t=>{
 const v=makeMujocoHalfNut(mujoco),p=v.physics;let penetration=0,maxPosition=0,maxJump=0,previous=0;
 try {
  for(let i=0;i<Math.round(21/p.timestep);i++) {
   p.step();const d=p.data;assert([...d.qpos,...d.qvel].every(Number.isFinite));
   maxPosition=Math.max(maxPosition,Math.abs(d.qpos[1]));maxJump=Math.max(maxJump,Math.abs(d.qpos[1]-previous));previous=d.qpos[1];
   const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  t.diagnostic(JSON.stringify({transitions:p.control.transitions,maximumTravelPixels:100*maxPosition,maximumStepPixels:100*maxJump,maximumPenetrationPixels:100*penetration}));
  assert.deepEqual(p.control.transitions.map(r=>Math.sign(r.target)),[1,-1,1]);assert(maxPosition<.24,'traverse range');assert(maxJump<.003,'per-step traverse jump');assert(penetration*100<.15,'contact penetration');
  assert(p.data.qpos[1]<-.1&&p.data.qvel[1]>0,'third rightward stroke did not engage');
  v.reset();p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);p.data.qvel.fill(0);v.update(2);
  assert(Math.abs(p.data.qpos[1])<1e-10,'disabling contact must stop the initially stationary traverse');assert(p.data.qpos[0]>10);
 }finally{v.dispose();v.dispose();}
 assert(p.model.isDeleted()&&p.data.isDeleted());
});
test('110 restart and seeking reproduce the same state across render frame partitions',()=>{
 const v=makeMujocoHalfNut(mujoco),p=v.physics;
 try {
  v.update(4.5);const state=[...p.data.qpos,...p.data.qvel],transitions=structuredClone(p.control.transitions);
  v.reset();for(let i=1;i<=270;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);assert.deepEqual(p.control.transitions,transitions);
  v.update(.5);v.update(4.5);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();}
});
