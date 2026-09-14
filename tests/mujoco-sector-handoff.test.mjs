import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSectorHandoffGeometry} from '../src/simulation/mujoco-sector-handoff/geometry.js';
import {makeMujocoSectorHandoff} from '../src/simulation/mujoco-sector-handoff/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('123 restores closed sectors, connected rack teeth and a finite transfer pocket',()=>{
 const v=makeSectorHandoffGeometry(),u=v.root.userData,f=u.profile;
 try{
  assert.equal(Object.keys(u.parts).length,18);assert(u.hideGround);
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  assert(f.camBoundarySimplification.maximumError<=.00005);assert(f.camBoundarySimplification.vertices<f.camBoundarySimplification.originalVertices);
  assert(f.endRelief.left.maximumRemoval>.08&&f.endRelief.left.maximumRemoval<.09);
  for(const n of ['upperEnd','lowerEnd']){u.parts[n].geometry.computeBoundingBox();assert.equal(u.parts[n].geometry.boundingBox.min.z,Math.fround(.46));}
 }finally{disposeObject3D(v.root);}
});

test('123 compiles one rack input, three passive rotors and bounded involute contact cells',t=>{
 const v=makeMujocoSectorHandoff(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;
 try{
  assert.equal(p.model.nq,4);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ntendon,0);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','rack'));
  for(const[n,cells]of Object.entries(u.cells))for(const[i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',n+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh],body=p.model.geom_bodyid[id],transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
   transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));transform.premultiply(new THREE.Matrix4().makeTranslation(-p.data.xpos[body*3],-p.data.xpos[body*3+1],-p.data.xpos[body*3+2]));const points=cell.map(q=>new THREE.Vector3(...q));
   for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);assert(Object.values(u.contactApproximation).every(r=>r.maximumError<=.0005+1e-12));t.diagnostic(JSON.stringify({vertices,compiledVertexErrorPixels:100*error,maximumBoundaryApproximationPixels:100*Math.max(...Object.values(u.contactApproximation).map(r=>r.maximumError))}));
 }finally{v.dispose();}
});

test('123 transfers each rack reversal through both stops and maintains continuous forward output',t=>{
 const v=makeMujocoSectorHandoff(mujoco),p=v.physics,j=p.joints,f=v.root.userData.profile;
 try{
  let maximumPenetration=0,maximumRackError=0,maximumRolling=0,retreat=0,peak=0;const pairs=new Set();
  for(let i=0;i<18250;i++){
   p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);
   for(const n of ['left','right','center'])assert.equal(p.data.qfrc_actuator[j[n].v],0);
   const center=p.data.qpos[j.center.q];peak=Math.max(peak,center);retreat=Math.max(retreat,peak-center);maximumRackError=Math.max(maximumRackError,100*Math.abs(p.data.qpos[j.rack.q]-p.description.input(p.data.time).position));
   for(const n of ['left','right'])maximumRolling=Math.max(maximumRolling,100*f.D/2*Math.abs(p.data.qpos[j[n].q]+center));
   const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{maximumPenetration=Math.max(maximumPenetration,-100*c.dist);pairs.add([p.geomGroups[c.geom1],p.geomGroups[c.geom2]].sort().join('/'));}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(Math.abs(p.data.qpos[j.center.q]-6*Math.PI)<.004);assert.equal(retreat,0);assert(maximumPenetration<.05);assert(maximumRackError<.7);assert(maximumRolling<.15);
  for(const pair of ['centerSpur/leftSpur','centerSpur/rightSpur','leftSector/rack','rack/rightSector','lowerStop/transferCam','transferCam/upperStop'])assert(pairs.has(pair),pair);
  t.diagnostic(JSON.stringify({maximumPenetrationPixels:maximumPenetration,maximumRackErrorPixels:maximumRackError,maximumRollingPixels:maximumRolling,maximumRetreatRadians:retreat}));
 }finally{v.dispose();}
});

test('123 rack and stop contacts drive the passive rotors',()=>{
 const v=makeMujocoSectorHandoff(mujoco,{load:0,gravity:0}),p=v.physics;
 try{
  for(const[id,n]of Object.entries(p.geomGroups))if(['rack','upperStop','lowerStop'].includes(n))p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
  v.update(1.25);assert(Math.abs(p.data.qpos[p.joints.rack.q])>1);
  for(const n of ['left','right','center'])assert.equal(p.data.qpos[p.joints[n].q],0);
 }finally{v.dispose();}
});

test('123 unrelieved sector ends obstruct the rack near the first reversal',()=>{
 const v=makeMujocoSectorHandoff(mujoco,{endRelief:false}),p=v.physics;
 try{v.update(2.25);assert(Math.abs(p.data.qpos[p.joints.rack.q]-p.description.input(p.data.time).position)>.01||p.data.qpos[p.joints.center.q]<1.5);}finally{v.dispose();}
});

test('123 the transfer cam and its corrected phase are necessary for the handoff',()=>{
 for(const kind of ['no-cam','engraved-phase']){
  const v=makeMujocoSectorHandoff(mujoco,kind==='engraved-phase'?{camPhase:Math.PI}:{}),p=v.physics;
  try{
   if(kind==='no-cam')for(const[id,n]of Object.entries(p.geomGroups))if(n==='transferCam')p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
   let maximumRackError=0;
   for(let i=0;i<6250;i++){p.step();maximumRackError=Math.max(maximumRackError,Math.abs(p.data.qpos[p.joints.rack.q]-p.description.input(p.data.time).position));}
   assert(p.data.qpos[p.joints.center.q]<2,kind);assert(maximumRackError>.1,kind);
  }finally{v.dispose();}
 }
});

test('123 section view, restart, seeking, frame partitioning and disposal preserve native state',()=>{
 const v=makeMujocoSectorHandoff(mujoco),p=v.physics,u=v.root.userData;
 try{
  v.update(6.25);const state=[...p.data.qpos,...p.data.qvel];
  for(const enabled of [true,false]){u.setSectionView(enabled);assert.equal(u.sectionView,enabled);assert.equal(u.parts.rack.visible,!enabled);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
  v.reset();for(let i=1;i<=375;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(6.25);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
