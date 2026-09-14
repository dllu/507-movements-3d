import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMicrometerGeometry} from '../src/simulation/mujoco-micrometer/geometry.js';
import {makeMujocoMicrometer} from '../src/simulation/mujoco-micrometer/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();

test('111 has closed nested solids, matching thread hands and room for the inner crest',()=>{
 const v=makeMicrometerGeometry(),u=v.root.userData,f=u.profile;
 try {
  assert.equal(Object.keys(u.parts).length,7);
  for(const [name,m] of Object.entries(u.parts)) {
   const a=inspectWeightedClutchSolid(m.geometry);
   assert(a.volume>0,name);assert.equal(a.components,1,name);
   assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,name);
  }
  assert.equal(f.inner.lead,f.internal.lead);assert(f.outer.lead*f.inner.lead>0);
  assert(Math.abs(f.inner.width+f.internal.width+2*f.clearance-f.pitchInner)<1e-12);
  assert(f.bore-f.innerCrest>=f.clearance-1e-12);assert(f.outerCore-f.bore>=.025-1e-12);
  assert(f.innerHigh-f.pitchInner*f.turns>1.5*f.pitchInner);assert.equal(u.hideGround,true);
 }finally{disposeObject3D(v.root);}
});

test('111 native ideal screw joints drive a nonrotating output through two cycles and reversed loads',t=>{
 for(const load of [0,-20,20]) {
  const v=makeMujocoMicrometer(mujoco,{load}),p=v.physics,f=v.root.userData.profile;
  let inputError=0,outputError=0,rotationError=0,maximum=-Infinity,minimum=Infinity;
  try {
   assert.equal(p.model.nq,4);assert.equal(p.model.nu,1);assert.equal(p.model.neq,3);assert.equal(p.model.ngeom,0);
   assert.deepEqual(Array.from(p.model.actuator_trnid),[p.id('mjOBJ_JOINT','turn'),-1]);
   assert.equal(p.data.qfrc_applied[1],load);assert.equal(p.data.qfrc_applied[2],load);
   for(let i=0;i<Math.round(32/p.timestep);i++) {
    p.step();const q=p.coordinates();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
    inputError=Math.max(inputError,Math.abs(q.angle-p.description.input(p.data.time).angle));
    outputError=Math.max(outputError,Math.abs(q.output-f.difference*q.angle));rotationError=Math.max(rotationError,Math.abs(q.innerRotation));
    minimum=Math.min(minimum,q.output);maximum=Math.max(maximum,q.output);
   }
   assert(inputError<.01);assert(outputError<.00002);assert(rotationError<1e-5);
   assert(Math.abs(maximum-(f.pitchOuter-f.pitchInner)*f.turns)<.0001);assert(Math.abs(minimum)<.0001);
   v.sync();const id=p.bodies.inner,q=p.coordinates();
   assert(Math.abs(p.data.xpos[3*id+2]-q.output)<1e-12);
   assert(Math.abs(v.root.userData.blocks.inner.quaternion.z)<1e-5);
   t.diagnostic(JSON.stringify({load,inputErrorRadians:inputError,outputErrorPixels:100*outputError,rotationErrorRadians:rotationError,travelPixels:[100*minimum,100*maximum]}));
  }finally{v.dispose();}
 }
});

test('111 output depends on the native nested-thread constraint; restart and seeking are deterministic',()=>{
 const v=makeMujocoMicrometer(mujoco),p=v.physics;
 try {
  v.update(3);const expected=[...p.data.qpos,...p.data.qvel];
  v.reset();for(let i=1;i<=180;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
  v.update(.5);v.update(3);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
  const before=[...p.data.qpos,...p.data.qvel];v.root.userData.setSectionView(true);v.sync();v.root.userData.setSectionView(false);
  assert.deepEqual([...p.data.qpos,...p.data.qvel],before,'section view changed physics');
  // The WASM binding does not expose its bool eq_active array. Compile the
  // same native model with only this equality removed for the causal check.
  const released=createMujocoSimulation(mujoco,{xml:p.description.xml.replace(/<joint name="nestedThread"[^>]*\/>/,''),beforeStep:({data,time})=>{const s=p.description.input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
  try {
   for(let i=0;i<Math.round(.5/released.timestep);i++)released.step();
   assert(released.data.qpos[1]+released.data.qpos[2]<-.2,'removing the screw constraint must release the output under gravity');
  }finally{released.dispose();}
 }finally{v.dispose();v.dispose();}
 assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('111 optional contact model uses construction vertices and advances without a prescribed inner feed',t=>{
 const v=makeMujocoMicrometer(mujoco,{threadModel:'contact'}),p=v.physics,u=v.root.userData;let error=0,count=0,penetration=0;
 try {
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,1);
  assert.throws(()=>p.id('mjOBJ_EQUALITY','nestedThread'),/Unknown MuJoCo/);
  for(const [family,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()) {
   const id=p.id('mjOBJ_GEOM',family+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   // Both native bodies start at the local origin. The presentation root's
   // rotation into world Y is deliberately absent from this native comparison.
   for(let j=0;j<n;j++) {
    const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);
    error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;
   }
  }
  assert(error<2e-6);
  for(let i=0;i<Math.round(1/p.timestep);i++) {
   p.step();const contacts=p.data.contact;
   try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  const q=p.coordinates();assert(Math.abs(q.angle-p.description.input(1).angle)<.01);assert(q.output>.007,'contact-driven output stalled');
  assert(Math.abs(q.output-u.profile.difference*q.angle)<.001);assert(penetration<.0003);
  t.diagnostic(JSON.stringify({compiledVertices:count,maximumVertexErrorPixels:error*100,geoms:p.model.ngeom,angle:q.angle,outputPixels:q.output*100,penetrationPixels:penetration*100}));
 }finally{v.dispose();}
});
