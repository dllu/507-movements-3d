import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeRackPinionGeometry} from '../src/simulation/mujoco-rack-pinion/geometry.js';
import {makeMujocoRackPinion} from '../src/simulation/mujoco-rack-pinion/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();
test('113 has closed shallow involute teeth and rollers separated from the rack in depth',()=>{
 const v=makeRackPinionGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,20);
  for(const [name,m]of Object.entries(u.parts)){const s=inspectWeightedClutchSolid(m.geometry);assert(s.volume>0,name);assert.equal(s.components,1,name);assert.equal(s.unmatchedEdges+s.degenerate+s.nonfinite+s.wrongNormals,0,name);}
  assert.equal(u.parts.pinion.geometry.userData.teeth,15);assert.equal(u.parts.pinion.geometry.userData.addendum,.8);
  u.parts.rack.geometry.computeBoundingBox();for(const n of ['leftRoller','rightRoller']){u.parts[n].geometry.computeBoundingBox();assert(u.parts[n].geometry.boundingBox.min.z>u.parts.rack.geometry.boundingBox.max.z);}
  assert.equal(u.hideGround,true);
 }finally{disposeObject3D(v.root);}
});
test('113 native convex cells match the rendered plates and preserve the passive coordinates',t=>{
 const v=makeMujocoRackPinion(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try{
  assert.equal(p.model.nq,5);assert.equal(p.model.neq,0);assert.equal(p.model.nu,2);
  assert.equal(p.model.actuator_gainprm[10],0);
  for(const [name,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   for(let j=0;j<n;j++){const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;}
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({vertices:count,errorPixels:100*error,geoms:p.model.ngeom}));
 }finally{v.dispose();}
});
for(const mode of ['pinion','rack'])test('113 '+mode+' input drives its mate through two complete contact cycles',t=>{
 const v=makeMujocoRackPinion(mujoco,{mode}),p=v.physics,f=v.root.userData.profile;let meshError=0,inputError=0,lift=0,penetration=0,lo=0,hi=0,step=0;
 try{
  for(let i=0;i<Math.round(12/p.timestep);i++){
   const before=p.data.qpos[1];p.step();const d=p.data;assert([...d.qpos,...d.qvel].every(Number.isFinite));
   meshError=Math.max(meshError,Math.abs(d.qpos[1]+f.pitchRadius*d.qpos[0]));inputError=Math.max(inputError,Math.abs(d.qpos[1]-p.description.input(d.time).position));lift=Math.max(lift,Math.abs(d.qpos[2]));lo=Math.min(lo,d.qpos[1]);hi=Math.max(hi,d.qpos[1]);step=Math.max(step,Math.abs(d.qpos[1]-before));
   const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  assert(lo<-f.amplitude+.01&&hi>f.amplitude-.01);assert(meshError<.0015);assert(inputError<.01);assert(lift<.001);assert(penetration<.001);assert(step<.002);
  t.diagnostic(JSON.stringify({mode,meshErrorPixels:100*meshError,inputErrorPixels:100*inputError,liftPixels:100*lift,penetrationPixels:100*penetration,maxStepPixels:100*step}));
  v.reset();for(let i=0;i<p.model.ngeom;i++)if((p.model.geom_contype[i]&3)!==0){p.model.geom_contype[i]=0;p.model.geom_conaffinity[i]=0;}
  v.update(1.5);if(mode==='rack'){assert(p.data.qpos[1]>f.amplitude-.01);assert(Math.abs(f.pitchRadius*p.data.qpos[0])<.001,'unpowered pinion stays within 0.1 pixel at its pitch circle');}else{assert(p.data.qpos[0]<-.95*f.amplitude/f.pitchRadius);assert(Math.abs(p.data.qpos[1])<.001,'unpowered rack stays within 0.1 pixel despite roller settling');}
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
test('113 both rollers stay under the table and roll with it, with no prescribed rotation',()=>{
 const v=makeMujocoRackPinion(mujoco),p=v.physics,f=v.root.userData.profile,flat=[f.left+.06,f.right-.07];let cover=Infinity,slip=0;
 try{
  for(let i=1;i<=Math.round(6/p.timestep);i++){p.step();const {qpos,qvel}=p.data;
   cover=Math.min(cover,f.rollers[0].x-(flat[0]+qpos[1]),flat[1]+qpos[1]-f.rollers[1].x);
   for(const [k,r]of f.rollers.entries())slip=Math.max(slip,Math.abs(qvel[1]+r.radius*qvel[3+k]));}
  assert(cover>.04,'the flat underside covers both roller tops through the stroke');assert(slip<.02,'passive rollers roll with the table');
 }finally{v.dispose();}
});
test('113 restart, backward seeking and input switching own exact native state',()=>{
 const v=makeMujocoRackPinion(mujoco),p=v.physics;
 try{
  v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  v.root.userData.setConfiguration('rack');assert.equal(p.model.actuator_gainprm[0],0);assert.equal(p.model.actuator_gainprm[10],2000);assert.deepEqual(Array.from(p.data.qpos),[0,0,0,0,0]);v.update(1.5);const f=v.root.userData.profile;assert(p.data.qpos[0]<-.95*f.amplitude/f.pitchRadius);
  v.root.userData.setConfiguration('pinion');v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();}
});
