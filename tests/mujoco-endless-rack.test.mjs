import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeEndlessRackGeometry} from '../src/simulation/mujoco-endless-rack/geometry.js';
import {makeMujocoEndlessRack} from '../src/simulation/mujoco-endless-rack/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();

test('119 preserves closed hardware and a section view independent of the solids',()=>{
 const v=makeEndlessRackGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,9);
  for(const [name,mesh]of Object.entries(u.parts)){const a=inspectWeightedClutchSolid(mesh.geometry);assert(a.volume>0,name);assert.equal(a.components,1,name);assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,name);}
  assert.equal(u.parts.pinion.geometry.userData.toothProfile,'rounded-rack-generated-involute-with-root-transition');
  assert(u.sectionView&&!u.parts.guide.visible);u.setSectionView(false);assert(u.parts.guide.visible);u.setSectionView(true);assert(!u.parts.guide.visible);
  assert(u.hideGround);assert(u.parts.pinion.geometry.attributes.position.count>0);
 }finally{disposeObject3D(v.root);}
});

test('119 native tooth cells match the visible pinion and complete endless rack',t=>{
 const v=makeMujocoEndlessRack(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;
 try{
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ntendon,0);
  assert.equal(p.description.options.retention,10000);
  for(const [name,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));transform.premultiply(u.parts[name].matrixWorld.clone().invert());
   const points=cell.map(q=>new THREE.Vector3(...q));for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({vertices,maximumVertexErrorPixels:error*100}));
 }finally{v.dispose();}
});

test('119 ideal retention supplies only normal support and cannot drive travel without teeth',()=>{
 const v=makeMujocoEndlessRack(mujoco,{retention:10000,gravity:0}),p=v.physics,f=v.root.userData.profile;
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);p.data.qvel[0]=p.data.qvel[2]=0;v.update(2);
  assert(Math.abs(p.data.qpos[0])<1e-10);assert(Math.abs(p.data.qpos[2])<1e-10);assert(p.data.qpos[1]<-7);
  for(let i=0;i<24;i++){
   const {point,tangent}=f.atDistance(f.length*i/24),normal=[-tangent[1],tangent[0]],delta=.0005;
   p.data.qpos[0]=point[1]+delta*normal[1]-f.H;p.data.qpos[2]=-point[0]-delta*normal[0]-f.rackOffset;
   p.data.qvel[0]=tangent[1];p.data.qvel[2]=-tangent[0];p.step();
   const tangentialPower=p.data.qfrc_applied[0]*tangent[1]-p.data.qfrc_applied[2]*tangent[0];assert(Math.abs(tangentialPower)<1e-9);
   assert(Math.abs(Math.hypot(p.data.qfrc_applied[0],p.data.qfrc_applied[2])-5)<1e-8);
  }
 }finally{v.dispose();}
});

test('119 retained mesh completes two contact-driven circuits and restarts exactly',t=>{
 const v=makeMujocoEndlessRack(mujoco),p=v.physics,f=v.root.userData.profile;
 try{
  let error=0,penetration=0,lo=Infinity,hi=-Infinity,phase,travel=0;const visited=new Set();
  for(let i=0;i<16/p.timestep;i++){
   p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);
   const x=p.data.qpos[2]+f.rackOffset,y=p.data.qpos[0]+f.H,ideal=f.atDistance(-f.rackOffset-f.R*p.data.qpos[1]);error=Math.max(error,100*Math.hypot(x+ideal.point[0],y-ideal.point[1]));lo=Math.min(lo,x);hi=Math.max(hi,x);
   const angle=Math.atan2(y,-x);if(phase!==undefined)travel+=Math.atan2(Math.sin(angle-phase),Math.cos(angle-phase));phase=angle;
   if(p.data.ncon)visited.add(Math.abs(x)<f.L?(y>0?'top':'bottom'):(x<0?'right':'left'));
   assert.equal(p.data.qfrc_actuator[0],0);assert.equal(p.data.qfrc_actuator[2],0);
   const contacts=p.data.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-100*c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  assert.equal(visited.size,4);assert(Math.abs(travel/(2*Math.PI)+2)<.002);assert(lo<-1.96&&hi>1.96);assert(error<.6);assert(penetration<.03);
  t.diagnostic(JSON.stringify({circuits:travel/(2*Math.PI),maximumTransmissionErrorPixels:error,maximumPenetrationPixels:penetration}));
  v.reset();v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.root.userData.setSectionView(false);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
