import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReverseThread} from '../src/simulation/mujoco-reverse-thread/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
// Regression evidence for the longer-shoe candidate. These tests do not
// qualify its source fit or uniformity through crossings and end transitions.
const options={};
test('108 candidate preserves closed crossing lands and a finite curved shoe in compiled contact geometry',t=>{
 const v=makeMujocoReverseThread(mujoco,options),p=v.physics,u=v.root.userData;let vertices=0;
 try {
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);
  for(const [name,m] of Object.entries(u.parts)) {
   const a=inspectWeightedClutchSolid(m.geometry);assert.ok(a.volume>0);if(name==='lands')assert.ok(a.components>1,'crossing cuts must retain separate land patches');else assert.equal(a.components,1,name);
   for(const key of ['degenerate','wrongNormals','nonfinite','unmatchedEdges'])assert.equal(a[key],0,name+' '+key);
  }
  // Curvature translates both radial surfaces together. The exact shoe volume
  // is its tangent-plane polygon area times thickness, including the noses.
  const expectedShoeVolume=Math.abs(THREE.ShapeUtils.area(u.profile.contour().map(p=>new THREE.Vector2(...p))))*(u.profile.shoeZ(0,1)-u.profile.shoeZ(0,0));
  assert.ok(Math.abs(inspectWeightedClutchSolid(u.parts.shoe.geometry).volume-expectedShoeVolume)<2e-8,'shoe decomposition changes its material volume');
  // A full barrel has no radial end caps at tessellation seams. Separate
  // closed patches alone did not catch the old microscopic gaps at 0 and pi.
  const landPositions=u.parts.lands.geometry.attributes.position;
  for(let i=0;i<landPositions.count;i+=3){const angles=[0,1,2].map(j=>Math.atan2(landPositions.getX(i+j),landPositions.getZ(i+j)));assert.ok(Math.max(...angles)-Math.min(...angles)>1e-9,'spurious radial seam cap');}
  for(const [part,cells] of Object.entries(u.collision)) {
   let volume=0;
   const surface=solidSurface(u.parts[part].geometry),worldToPart=u.parts[part].matrixWorld.clone().invert();
   for(let i=0;i<cells.length;i++) {
    const hull=new ConvexGeometry(cells[i].map(p=>new THREE.Vector3(...p)));volume+=inspectWeightedClutchSolid(hull).volume;hull.dispose();
    const id=p.id('mjOBJ_GEOM',(part==='lands'?'land':'shoe')+i),mesh=p.model.geom_dataid[id],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
    const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
    matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));matrix.premultiply(worldToPart);
    for(let j=0;j<count;j++) {const point=new THREE.Vector3().fromArray(p.model.mesh_vert,3*(start+j)).applyMatrix4(matrix);assert.ok(surface.distance(point)<3e-7,part+' compiled vertex misses rendered surface');vertices++;}
   }
   const visible=inspectWeightedClutchSolid(u.parts[part].geometry).volume;
   assert.ok(Math.abs(volume-visible)<1e-6,part+' collision hulls change the visible material volume');
  }
  const f=u.profile,core=p.id('mjOBJ_GEOM','core');
  assert.equal(p.model.geom_type[core],mujoco.mjtGeom.mjGEOM_CYLINDER.value);
  assert.equal(p.model.geom_size[3*core],f.floor);
  assert.equal(p.model.geom_size[3*core+1],(f.ceiling-f.bottom)/2);
  assert.equal(p.model.geom_pos[3*core+1],(f.ceiling+f.bottom)/2);
  // The analytic core fills the union of the visible 256-sided annulus and
  // coaxial shaft. Its only surface discrepancy is the tessellation sagitta.
  assert.ok(100*f.floor*(1-Math.cos(Math.PI/256))<.004);
  for(const name of ['floor','shaft']) {
   const mesh=u.parts[name];mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
   assert.ok(box.min.y<=f.bottom+1e-7&&box.max.y>=f.ceiling-1e-7);
  }
  for(let i=0;i<=480;i++) {
   const angle=f.period*i/480,s=f.law(f.initialParameter-angle);
   p.data.qpos.set([angle,s.y-f.initialY,f.tilt(f.initialParameter-angle)]);p.data.qvel.fill(0);mujoco.mj_forward(p.model,p.data);
   const cs=p.data.contact;
   for(let j=0;j<cs.size();j++){const c=cs.get(j);assert.ok(c.dist>-.0001,'nominal shoe pose intersects the machined material');c.delete();}cs.delete();
  }
  p.data.qpos.set([0,0,f.initialTilt+.3]);mujoco.mj_forward(p.model,p.data);let coreContacts=0;const cs=p.data.contact;
  for(let j=0;j<cs.size();j++){const c=cs.get(j);if((c.geom1===core||c.geom2===core)&&c.dist<0)coreContacts++;c.delete();}cs.delete();
  assert.ok(coreContacts>0,'a deflected shoe must contact the actual barrel core');
  t.diagnostic(JSON.stringify({compiledVertices:vertices,geoms:p.model.ngeom,solids:Object.keys(u.parts).length}));
 }finally{v.dispose();}
});
test('108 candidate output is passive and releases its native allocations',()=>{
 const v=makeMujocoReverseThread(mujoco,options),p=v.physics;
 try {
  p.model.opt.gravity.fill(0);p.data.qvel[1]=0;p.data.qvel[2]=0;
  for(let i=0;i<v.root.userData.collision.shoe.length;i++){const id=p.id('mjOBJ_GEOM','shoe'+i);p.model.geom_contype[id]=0;p.model.geom_conaffinity[id]=0;}
  v.update(3);assert.ok(p.data.qpos[0]>3);assert.ok(Math.abs(p.data.qpos[1])<1e-10);
 }finally{v.dispose();v.dispose();}
 assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});
test('108 rounded candidate retains the selected groove through two complete output cycles',t=>{
 const v=makeMujocoReverseThread(mujoco,options),p=v.physics,f=v.root.userData.profile;
 let deviation=0,penetration=0,inputError=0,contacts=0,previous;const speedErrors=[];
 try {
  const cycle=Math.round(p.description.options.period/p.timestep),window=Math.round(.1/p.timestep);
  for(let i=1;i<=2*cycle;i++) {
   p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
   deviation=Math.max(deviation,Math.abs(p.data.qpos[1]-(f.law(f.initialParameter-p.data.qpos[0]).y-f.initialY)));
   inputError=Math.max(inputError,Math.abs(p.data.qpos[0]-p.description.omega*p.data.time));
   if(i%window===0){const derivative=f.law(f.initialParameter-p.data.qpos[0]).derivative,onFlank=Math.abs(Math.abs(derivative)-f.lead)<1e-9;if(onFlank&&previous?.derivative===derivative)speedErrors.push(Math.abs((p.data.qpos[1]-previous.q)/.1+p.description.omega*derivative)/(p.description.omega*f.lead));previous=onFlank?{q:p.data.qpos[1],derivative}:undefined;}
   const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);penetration=Math.max(penetration,-c.dist);contacts++;c.delete();}cs.delete();
   if(i%cycle===0){assert.ok(Math.abs(p.data.qpos[0]-i/cycle*f.period)<.01,'input stalled');assert.ok(Math.abs(p.data.qpos[1])<.01,'follower did not return');}
  }
  speedErrors.sort((a,b)=>a-b);const p95=speedErrors[Math.floor(.95*speedErrors.length)],maximum=speedErrors.at(-1);
  t.diagnostic(JSON.stringify({travelErrorPixels:100*deviation,penetrationPixels:100*penetration,inputErrorRadians:inputError,p95SpeedErrorPercent:100*p95,maximumSpeedErrorPercent:100*maximum,contacts}));
  assert.ok(100*deviation<1);assert.ok(100*penetration<.1);assert.ok(inputError<.01);assert.ok(contacts>1000);
  assert.ok(speedErrors.length>300);assert.ok(p95<.03);assert.ok(maximum<.15);
 }finally{v.dispose();}
});
test('108 candidate replay is deterministic across reset, frame partition and backward seeking',()=>{
 const v=makeMujocoReverseThread(mujoco,options),p=v.physics;
 try {
  v.update(2);const state=[...p.data.qpos,...p.data.qvel];
  v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();}
});
