import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeCascadedTraverseGeometry} from '../src/simulation/mujoco-cascaded-traverse/geometry.js';
import {makeMujocoCascadedTraverse} from '../src/simulation/mujoco-cascaded-traverse/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
const mujoco=await loadMujoco();

test('125 preserves measured crank pins and constructs closed source hardware',()=>{
 const v=makeCascadedTraverseGeometry(),u=v.root.userData,f=u.profile;
 try{
  assert.equal(Object.keys(u.parts).length,30);assert(u.hideGround);
  for(const n of ['left','middle','right']){const pixel=u.source.circles[n+'Crank'].center,p=f.position[n+'Rod'];assert(Math.hypot(p[0]-(pixel[0]-262.5)/100,p[1]-(262.5-pixel[1])/100)<1e-12);}
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  for(const n of ['left','middle','right']){const shaft=u.parts[n+'Shaft'].geometry,rod=u.parts[n+'Rod'].geometry;shaft.computeBoundingBox();rod.computeBoundingBox();assert(rod.boundingBox.min.z-shaft.boundingBox.max.z>.009);}
 }finally{disposeObject3D(v.root);}
});

test('125 compiles one input, four pin closures and bounded native tooth cells',t=>{
 const v=makeMujocoCascadedTraverse(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;
 try{
  assert.equal(p.model.nq,11);assert.equal(p.model.nu,1);assert.equal(p.model.neq,4);assert.equal(p.model.ntendon,0);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','right'));
  for(const[n,cells]of Object.entries(u.cells))for(const[i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',n+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh],body=p.model.geom_bodyid[id],transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
   transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));transform.premultiply(new THREE.Matrix4().makeTranslation(-p.data.xpos[body*3],-p.data.xpos[body*3+1],-p.data.xpos[body*3+2]));const points=cell.map(q=>new THREE.Vector3(...q));
   for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);assert(Object.values(u.contactApproximation).every(r=>r.maximumError<=.0005+1e-12));t.diagnostic(JSON.stringify({vertices,compiledVertexErrorPixels:100*error,maximumBoundaryApproximationPixels:100*Math.max(...Object.values(u.contactApproximation).map(r=>r.maximumError))}));
 }finally{v.dispose();}
});

test('125 produces varying traverse with passive rods and guided output',t=>{
 const v=makeMujocoCascadedTraverse(mujoco),p=v.physics,j=p.joints,f=v.root.userData.profile;
 try{
  let maximumClosure=0,maximumRolling=0,vmin=Infinity,vmax=-Infinity;const sites=[['middleRodEnd','lowerLeftPin'],['rightRodEnd','lowerRightPin'],['leftRodEnd','upperLeftPin'],['transferRodEnd','upperRightPin']].map(pair=>pair.map(n=>p.id('mjOBJ_SITE',n)));
  for(let i=0;i<8.25/p.timestep;i++){
   p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);
   for(const[n,k]of Object.entries(j))if(n!=='right')assert.equal(p.data.qfrc_actuator[k.v],0);
   vmin=Math.min(vmin,p.data.qvel[j.slider.v]);vmax=Math.max(vmax,p.data.qvel[j.slider.v]);
   for(const[a,b]of [['left','middle'],['middle','right']])maximumRolling=Math.max(maximumRolling,100*Math.abs(f.module/2*(f.teeth[a]*p.data.qpos[j[a].q]+f.teeth[b]*p.data.qpos[j[b].q])));
   for(const[a,b]of sites)maximumClosure=Math.max(maximumClosure,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
  }
  assert(Math.abs(p.data.qpos[j.right.q]-4*Math.PI)<.003);assert(vmin<-.1&&vmax>.1);assert(maximumClosure<.002);assert(maximumRolling<.35);
  t.diagnostic(JSON.stringify({maximumClosurePixels:maximumClosure,maximumRollingPixels:maximumRolling,velocityRange:[vmin,vmax]}));
 }finally{v.dispose();}
});

test('125 native gear contact transmits both meshes with the rod closures released',()=>{
 const v=makeMujocoCascadedTraverse(mujoco),original=v.physics;
 try{for(const contact of [true,false]){
  const p=createMujocoSimulation(mujoco,{xml:original.description.xml.replaceAll('<connect ','<connect active="false" ').replace('gravity="0 -9.81 0"','gravity="0 0 0"'),beforeStep:({data,time})=>{const q=original.description.input(time);data.ctrl[0]=q.position+.02*q.velocity;}});
  try{
   if(!contact)for(const[id,n]of Object.entries(original.geomGroups))if(n==='middleGear')p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
   for(let i=0;i<2.25/p.timestep;i++)p.step();
   const q=Object.fromEntries(['left','middle','right'].map(n=>[n,p.data.qpos[original.joints[n].q]]));assert(q.right>3);
   if(contact){assert(Math.abs(q.middle+29/23*q.right)<.006);assert(Math.abs(q.left-29/19*q.right)<.008);}else{assert.equal(q.left,0);assert.equal(q.middle,0);}
  }finally{p.dispose();}
 }}finally{v.dispose();}
});

test('125 restart, seeking, frame partitioning and disposal are deterministic',()=>{
 const v=makeMujocoCascadedTraverse(mujoco),p=v.physics;try{
  v.update(4.25);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=255;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(4.25);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
