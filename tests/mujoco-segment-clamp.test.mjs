import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSegmentClampGeometry,jawTips} from '../src/simulation/mujoco-segment-clamp/geometry.js';
import {makeMujocoSegmentClamp} from '../src/simulation/mujoco-segment-clamp/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('120 source hardware has closed solids and a recessed frame behind the large pinion',()=>{
 const v=makeSegmentClampGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,12);
  for(const[name,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,name);assert.equal(r.components,1,name);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,name);}
  const frame=u.parts.internalFrame.geometry,gear=u.parts.largePinion.geometry;frame.computeBoundingBox();gear.computeBoundingBox();assert(gear.boundingBox.min.z-frame.boundingBox.max.z>.05);
  assert(u.hideGround);assert.notEqual(u.profile.externalRatio,u.profile.internalRatio);
 }finally{disposeObject3D(v.root);}
});

test('120 compiles one input hinge and bounded approximations of the actual working surfaces',t=>{
 const v=makeMujocoSegmentClamp(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;
 try{
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ntendon,0);
  for(const[name,cells]of Object.entries(u.cells))for(const[i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh],body=p.model.geom_bodyid[id];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   const inverse=new THREE.Matrix4().makeTranslation(-p.data.xpos[body*3],-p.data.xpos[body*3+1],-p.data.xpos[body*3+2]);transform.premultiply(inverse);
   const points=cell.map(q=>new THREE.Vector3(...q));for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);assert(Object.values(u.contactApproximation).every(r=>r.maximumError<=.0005+1e-12));
  t.diagnostic(JSON.stringify({vertices,compiledVertexErrorPixels:error*100,maximumBoundaryApproximationPixels:100*Math.max(...Object.values(u.contactApproximation).map(r=>r.maximumError))}));
 }finally{v.dispose();}
});

test('120 both tooth pairs independently drive their passive jaw',()=>{
 for(const disabled of ['smallPinion','largePinion','both']){
  const v=makeMujocoSegmentClamp(mujoco,{gravity:0,amplitude:1.9}),p=v.physics;
  try{
   for(const[id,group]of Object.entries(p.geomGroups))if(group===disabled||(disabled==='both'&&group.endsWith('Pinion')))p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
   v.update(1.25);assert(p.data.qpos[0]>.9);
   if(disabled!=='largePinion')assert(Math.abs(p.data.qpos[1])<1e-10);else assert(p.data.qpos[1]<-.23);
   if(disabled!=='smallPinion')assert(Math.abs(p.data.qpos[2])<1e-10);else assert(p.data.qpos[2]>.26);
  }finally{v.dispose();}
 }
});

test('120 a long stroke closes against native jaw contact and reopens over two cycles',t=>{
 const v=makeMujocoSegmentClamp(mujoco,{amplitude:1.9}),p=v.physics,f=v.root.userData.profile;
 try{
  let error=0,penetration=0;const jawCycles=new Set(),gearPairs=new Set();
  for(let i=0;i<10/p.timestep;i++){
   p.step();const q=p.data.qpos;assert([...q,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);
   assert.equal(p.data.qfrc_actuator[1],0);assert.equal(p.data.qfrc_actuator[2],0);
   error=Math.max(error,100*Math.abs(q[1]+f.externalRatio*q[0])*f.externalTeeth*f.externalModule/2,100*Math.abs(q[2]-f.internalRatio*q[0])*f.internalTeeth*f.internalModule/2);
   const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{penetration=Math.max(penetration,-100*c.dist);const pair=Array.from(c.geom).map(id=>p.geomGroups[id]).sort().join('/');if(pair==='leftJaw/rightJaw')jawCycles.add(Math.floor(p.data.time/5));else gearPairs.add(pair);}finally{c.delete();}}}finally{cs.delete();}
   if(Math.abs(p.data.time-2.5)<1e-8||Math.abs(p.data.time-7.5)<1e-8){assert(q[0]>1.50&&q[0]<1.53);assert(p.data.qfrc_actuator[0]>7.9);}
  }
  assert.deepEqual([...jawCycles],[0,1]);assert.equal(gearPairs.size,2);assert(Math.abs(p.data.qpos[0])<.01);assert(error<.15);assert(penetration<.05);
  t.diagnostic(JSON.stringify({maximumRollingErrorPixels:error,maximumPenetrationPixels:penetration}));
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('120 default stroke closes the jaws against native contact with both segments on their pinions',t=>{
 const v=makeMujocoSegmentClamp(mujoco),p=v.physics,f=v.root.userData.profile,pinion=Math.atan2(f.input[1],f.input[0]);
 try{
  let external=0,internal=0,error=0,input=0;const pairs=new Set(),jawCycles=new Set();
  for(let i=0;i<10/p.timestep;i++){
   p.step();const q=p.data.qpos;assert([...q,...p.data.qvel].every(Number.isFinite));
   external=Math.max(external,Math.abs(q[1]));internal=Math.max(internal,Math.abs(q[2]));input=Math.max(input,q[0]);
   error=Math.max(error,100*Math.abs(q[1]+f.externalRatio*q[0])*f.externalTeeth*f.externalModule/2,100*Math.abs(q[2]-f.internalRatio*q[0])*f.internalTeeth*f.internalModule/2);
   const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{const pair=Array.from(c.geom).map(id=>p.geomGroups[id]).sort().join('/');if(pair==='leftJaw/rightJaw')jawCycles.add(Math.floor(p.data.time/5));else pairs.add(pair);}finally{c.delete();}}}finally{cs.delete();}
  }
  // The jaws meet in every cycle and stop the shaft short of its command; the
  // pinions stay inside both working tooth arcs throughout.
  assert.deepEqual([...jawCycles],[0,1]);assert(input>1.50&&input<1.53);
  const deg=Math.PI/180,marginExternal=Math.min(pinion-(-123*deg-external),-39*deg-external-pinion),marginInternal=Math.min(pinion-(-119*deg+internal),-61*deg+internal-pinion);
  assert(marginExternal>15*deg);assert(marginInternal>5*deg);
  assert.equal(pairs.size,2);assert(error<.15);assert(Math.abs(p.data.qpos[0])<.01);
  t.diagnostic(JSON.stringify({externalDegrees:external/deg,internalDegrees:internal/deg,marginExternal:marginExternal/deg,marginInternal:marginInternal/deg,maximumRollingErrorPixels:error}));
 }finally{v.dispose();}
});

test('120 closed jaws meet point to point without crossing',t=>{
 const v=makeMujocoSegmentClamp(mujoco),u=v.root.userData,local=([x,y])=>new THREE.Vector3((x-u.source.axis[0])/100,(u.source.axis[1]-y)/100,0),[left,right]=jawTips().map(local);
 try{
  let closest=Infinity;
  for(let i=1;i<=300;i++){v.update(i/60);const l=left.clone().applyMatrix4(u.blocks.external.matrixWorld),r=right.clone().applyMatrix4(u.blocks.internal.matrixWorld);
   // The left point never passes to the right of the right point.
   assert(r.x-l.x>-.002,'jaw points cross at '+(i/60));closest=Math.min(closest,l.distanceTo(r));}
  v.update(2.5);const l=left.clone().applyMatrix4(u.blocks.external.matrixWorld),r=right.clone().applyMatrix4(u.blocks.internal.matrixWorld);
  assert(100*l.distanceTo(r)<.5);assert(Math.abs(Math.hypot(...jawTips()[0].map((q,i)=>q-u.source.axis[i]))-Math.hypot(...jawTips()[1].map((q,i)=>q-u.source.axis[i])))<1e-9);
  t.diagnostic(JSON.stringify({closedPointGapPixels:100*l.distanceTo(r),closestPixels:100*closest}));
 }finally{v.dispose();}
});

test('120 removing jaw contact removes the closing stop',()=>{
 const v=makeMujocoSegmentClamp(mujoco,{jawContact:false,amplitude:1.9}),p=v.physics;
 try{v.update(2.5);assert(p.data.qpos[0]>1.87);assert(p.data.qpos[1]<-.47);assert(p.data.qpos[2]>.54);}finally{v.dispose();}
});

test('120 restart, seeking and frame partitioning reproduce native state',()=>{
 const v=makeMujocoSegmentClamp(mujoco),p=v.physics;
 try{v.update(2.5);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=150;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2.5);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}finally{v.dispose();}
});
