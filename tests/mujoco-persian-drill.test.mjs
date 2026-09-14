import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makePersianDrillGeometry} from '../src/simulation/mujoco-persian-drill/geometry.js';
import {makeMujocoPersianDrill} from '../src/simulation/mujoco-persian-drill/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();
test('112 has closed grooved stock, a bored grip and bearing, and a centered flat bit',()=>{
 const v=makePersianDrillGeometry(),u=v.root.userData,f=u.profile;
 try {
  assert.equal(Object.keys(u.parts).length,17);
  for(const [name,m]of Object.entries(u.parts)){const a=inspectWeightedClutchSolid(m.geometry);assert(a.volume>0,name);assert.equal(a.components,1,name);assert.equal(a.unmatchedEdges+a.degenerate+a.wrongNormals+a.nonfinite,0,name);}
  assert.equal(f.external.length,6);assert.equal(f.internal.length,6);
  for(let i=0;i<6;i++){assert.equal(f.external[i].lead,f.internal[i].lead);assert(Math.abs(f.external[i].width+f.internal[i].width+2*f.clearance-f.pitch)<1e-12);}
  assert(f.bore>f.crest);assert.equal(u.hideGround,true);
  assert(f.internal[0].high+f.amplitude<f.external[0].high);assert(f.internal[0].low-f.amplitude>f.external[0].low);
 }finally{disposeObject3D(v.root);}
});
test('112 compiles matching thread vertices and actuates only the hand grip',t=>{
 const v=makeMujocoPersianDrill(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try {
  assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);
  assert.deepEqual(Array.from(p.model.actuator_trnid),[p.id('mjOBJ_JOINT','feed'),-1]);
  for(const [family,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()) {
   const id=p.id('mjOBJ_GEOM',family+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   for(let j=0;j<n;j++){const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;}
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({compiledVertices:count,maximumVertexErrorPixels:100*error,geoms:p.model.ngeom}));
 }finally{v.dispose();}
});
test('112 hand motion backdrives the passive stock through repeated reversals by contact',t=>{
 const v=makeMujocoPersianDrill(mujoco),p=v.physics,f=v.root.userData.profile;let inputError=0,screwError=0,penetration=0,minimum=Infinity,maximum=-Infinity;
 try {
  for(let i=0;i<Math.round(12/p.timestep);i++) {
   p.step();const d=p.data;assert([...d.qpos,...d.qvel].every(Number.isFinite));inputError=Math.max(inputError,Math.abs(d.qpos[1]-p.description.input(d.time).position));screwError=Math.max(screwError,Math.abs(d.qpos[1]+f.lead*d.qpos[0]));minimum=Math.min(minimum,d.qpos[0]);maximum=Math.max(maximum,d.qpos[0]);
   const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  assert(inputError<.01);assert(screwError<.001);assert(penetration<.001);assert(minimum<-6.8&&maximum>6.8);
  t.diagnostic(JSON.stringify({inputErrorPixels:100*inputError,screwErrorPixels:100*screwError,penetrationPixels:100*penetration,angleRange:[minimum,maximum]}));
  v.reset();p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);v.update(1.5);
  assert(p.data.qpos[1]>.8);assert(Math.abs(p.data.qpos[0])<1e-10,'without contact the stock must remain still');
 }finally{v.dispose();v.dispose();}
 assert(p.model.isDeleted()&&p.data.isDeleted());
});
test('112 restart and seeking are independent of render partitions and section presentation',()=>{
 const v=makeMujocoPersianDrill(mujoco),p=v.physics;
 try {
  v.update(2);const expected=[...p.data.qpos,...p.data.qvel];
  v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
  v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
  v.root.userData.setSectionView(true);v.sync();v.root.userData.setSectionView(false);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
 }finally{v.dispose();}
});
test('112 elliptic contacts retain both strokes with modest sliding friction',t=>{
 const v=makeMujocoPersianDrill(mujoco,{friction:.05}),p=v.physics,f=v.root.userData.profile;let inputError=0,screwError=0,penetration=0,minimum=Infinity,maximum=-Infinity;
 try {
  for(let i=0;i<Math.round(12/p.timestep);i++) {
   p.step();const d=p.data;assert([...d.qpos,...d.qvel].every(Number.isFinite));inputError=Math.max(inputError,Math.abs(d.qpos[1]-p.description.input(d.time).position));screwError=Math.max(screwError,Math.abs(d.qpos[1]+f.lead*d.qpos[0]));minimum=Math.min(minimum,d.qpos[0]);maximum=Math.max(maximum,d.qpos[0]);
   const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  }
  assert(inputError<.01);assert(screwError<.0015);assert(penetration<.001);assert(minimum<-6.8&&maximum>6.8);
  t.diagnostic(JSON.stringify({friction:.05,inputErrorPixels:100*inputError,screwErrorPixels:100*screwError,penetrationPixels:100*penetration,angleRange:[minimum,maximum]}));
 }finally{v.dispose();}
});
