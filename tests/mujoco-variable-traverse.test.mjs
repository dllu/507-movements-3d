import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeVariableTraverseGeometry} from '../src/simulation/mujoco-variable-traverse/geometry.js';
import {makeMujocoVariableTraverse} from '../src/simulation/mujoco-variable-traverse/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
const mujoco=await loadMujoco();

test('122 restores the unequal rods and closed source hardware with clear shaft ends',()=>{
 const v=makeVariableTraverseGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,25);assert(u.hideGround);assert(u.profile.upperRodLength-u.profile.lowerRodLength>.2);
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  for(const n of ['upper','lower']){const shaft=u.parts[n+'Shaft'].geometry,rod=u.parts[n+'Rod'].geometry;shaft.computeBoundingBox();rod.computeBoundingBox();assert(rod.boundingBox.min.z-shaft.boundingBox.max.z>.009);}
 }finally{disposeObject3D(v.root);}
});

test('122 compiles one gear input, two rod-pin closures and bounded involute contact cells',t=>{
 const v=makeMujocoVariableTraverse(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;
 try{
  assert.equal(p.model.nq,6);assert.equal(p.model.nu,1);assert.equal(p.model.neq,2);assert.equal(p.model.ntendon,0);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','lower'));
  for(const[n,cells]of Object.entries(u.cells))for(const[i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',n+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh],body=p.model.geom_bodyid[id],transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
   transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));transform.premultiply(new THREE.Matrix4().makeTranslation(-p.data.xpos[body*3],-p.data.xpos[body*3+1],-p.data.xpos[body*3+2]));const points=cell.map(q=>new THREE.Vector3(...q));
   for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);assert(Object.values(u.contactApproximation).every(r=>r.maximumError<=.0005+1e-12));t.diagnostic(JSON.stringify({vertices,compiledVertexErrorPixels:100*error,maximumBoundaryApproximationPixels:100*Math.max(...Object.values(u.contactApproximation).map(r=>r.maximumError))}));
 }finally{v.dispose();}
});

test('122 completes the full 29:23 pattern with variable alternating travel and passive outputs',t=>{
 const v=makeMujocoVariableTraverse(mujoco),p=v.physics,j=p.joints,f=v.root.userData.profile;
 try{
  let maximumPenetration=0,maximumClosure=0,maximumRolling=0,vmin=Infinity,vmax=-Infinity;const windows=new Map(),sites=[['upperRodEnd','topPin'],['lowerRodEnd','bottomPin']].map(pair=>pair.map(n=>p.id('mjOBJ_SITE',n)));
  for(let i=0;i<116.25/p.timestep;i++){
   p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-7);
   for(const name of ['upper','upperRod','lowerRod','floating','slider'])assert.equal(p.data.qfrc_actuator[j[name].v],0);
   const lower=p.data.qpos[j.lower.q],upper=p.data.qpos[j.upper.q],x=p.data.qpos[j.slider.q],turn=Math.floor(lower/(2*Math.PI));if(!windows.has(turn))windows.set(turn,[Infinity,-Infinity]);const range=windows.get(turn);range[0]=Math.min(range[0],x);range[1]=Math.max(range[1],x);
   vmin=Math.min(vmin,p.data.qvel[j.slider.v]);vmax=Math.max(vmax,p.data.qvel[j.slider.v]);maximumRolling=Math.max(maximumRolling,100*Math.abs(f.module/2*(f.upperTeeth*upper+f.lowerTeeth*lower)));
   for(const[a,b]of sites)maximumClosure=Math.max(maximumClosure,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
   const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{maximumPenetration=Math.max(maximumPenetration,-100*c.dist);}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(Math.abs(p.data.qpos[j.lower.q]-58*Math.PI)<.003);assert(Math.abs(p.data.qpos[j.upper.q]+46*Math.PI)<.003);assert(Math.abs(p.data.qpos[j.slider.q])<.003);assert(Math.abs(p.data.qpos[j.floating.q])<.003);
  const strokes=[...windows].filter(([n])=>n<29).map(([,r])=>r[1]-r[0]);assert(Math.max(...strokes)-Math.min(...strokes)>.3);assert(vmin<-.1&&vmax>.1);assert(maximumPenetration<.05);assert(maximumClosure<.002);assert(maximumRolling<.2);
  t.diagnostic(JSON.stringify({maximumPenetrationPixels:maximumPenetration,maximumClosurePixels:maximumClosure,maximumRollingPixels:maximumRolling,strokeRange:[Math.min(...strokes),Math.max(...strokes)],velocityRange:[vmin,vmax]}));
 }finally{v.dispose();}
});

test('122 gear contact independently transmits rotation with the rod closures released',()=>{
 const v=makeMujocoVariableTraverse(mujoco),original=v.physics;
 try{for(const contact of [true,false]){
  // The WASM binding does not expose the boolean eq_active memory view.
  // Compile the same model with inactive closures to isolate tooth transmission.
  const p=createMujocoSimulation(mujoco,{xml:original.description.xml.replaceAll('<connect ','<connect active="false" ').replace('gravity="0 -9.81 0"','gravity="0 0 0"'),beforeStep:({data,time})=>{const q=original.description.input(time);data.ctrl[0]=q.position+.02*q.velocity;}});
  try{
   if(!contact)for(const[id,n]of Object.entries(original.geomGroups))if(n==='upperGear')p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
   for(let i=0;i<2.25/p.timestep;i++)p.step();
   const lower=p.data.qpos[original.joints.lower.q],upper=p.data.qpos[original.joints.upper.q];assert(lower>3);
   if(contact)assert(Math.abs(upper+23/29*lower)<.005);else assert.equal(upper,0);
  }finally{p.dispose();}
 }}finally{v.dispose();}
});

test('122 unreduced source cranks encounter the documented assembly-branch toggle',()=>{
 const v=makeMujocoVariableTraverse(mujoco,{crankScale:1}),p=v.physics;try{v.update(2);assert(p.description.input(2).position>2.7);assert(p.data.qpos[p.joints.lower.q]<2);assert(p.data.qfrc_actuator[p.joints.lower.v]>1000);}finally{v.dispose();}
});

test('122 restart, seeking, frame partitioning and disposal are deterministic',()=>{
 const v=makeMujocoVariableTraverse(mujoco),p=v.physics;try{
  v.update(4.25);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=255;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(4.25);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
