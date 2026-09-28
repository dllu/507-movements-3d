import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeReversibleClickGeometry} from '../src/simulation/mujoco-reversible-click/geometry.js';
import {makeMujocoReversibleClick} from '../src/simulation/mujoco-reversible-click/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('121 has closed source hardware and separate rod-eye and cog planes',()=>{
 const v=makeReversibleClickGeometry(),u=v.root.userData;try{
  assert.equal(Object.keys(u.parts).length,10);assert.equal(u.profile.teeth,24);assert.equal(u.profile.toothStyle,'radial');assert(u.hideGround);
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  const cog=u.parts.cog.geometry,rod=u.parts.rod.geometry;cog.computeBoundingBox();rod.computeBoundingBox();assert(rod.boundingBox.min.z-cog.boundingBox.max.z>.039);
 }finally{disposeObject3D(v.root);}
});

test('121 compiles one slider actuator, an ideal rod pin and bounded tooth/click surfaces',t=>{
 const v=makeMujocoReversibleClick(mujoco),p=v.physics,u=v.root.userData;let error=0,vertices=0;try{
  assert.equal(p.model.nq,5);assert.equal(p.model.nu,1);assert.equal(p.model.neq,1);assert.equal(p.model.ntendon,0);
  assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','slider'));
  for(const[n,cells]of Object.entries(u.cells))for(const[i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',n+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh],body=p.model.geom_bodyid[id],transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
   transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));transform.premultiply(new THREE.Matrix4().makeTranslation(-p.data.xpos[body*3],-p.data.xpos[body*3+1],-p.data.xpos[body*3+2]));const points=cell.map(q=>new THREE.Vector3(...q));
   for(let j=0;j<count;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...points.map(v=>q.distanceTo(v))));vertices++;}
  }
  assert(error<2e-6);assert(Object.values(u.contactApproximation).every(r=>r.maximumError<=.0002+1e-12));t.diagnostic(JSON.stringify({vertices,compiledVertexErrorPixels:100*error,maximumBoundaryApproximationPixels:100*Math.max(...Object.values(u.contactApproximation).map(r=>r.maximumError))}));
 }finally{v.dispose();}
});

test('121 either click end indexes one tooth per cycle with a physical return and dwell',t=>{
 for(const mode of ['forward','reverse']){const v=makeMujocoReversibleClick(mujoco,{mode}),p=v.physics,j=p.joints,sign=mode==='forward'?-1:1;try{
  let maximumPenetration=0,maximumLinkageError=0,maximumRetreat=0,furthest=0,firstEnd,secondEnd,pawlMin=Infinity,pawlMax=-Infinity;const a=p.id('mjOBJ_SITE','rodEnd'),b=p.id('mjOBJ_SITE','sliderPin');
  for(let i=0;i<6/p.timestep;i++){
   p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);const angle=sign*p.data.qpos[j.output.q];furthest=Math.max(furthest,angle);maximumRetreat=Math.max(maximumRetreat,furthest-angle);pawlMin=Math.min(pawlMin,p.data.qpos[j.pawl.q]);pawlMax=Math.max(pawlMax,p.data.qpos[j.pawl.q]);
   for(const name of ['carrier','rod','pawl','output'])assert.equal(p.data.qfrc_actuator[j[name].v],0);
   maximumLinkageError=Math.max(maximumLinkageError,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
   const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{maximumPenetration=Math.max(maximumPenetration,-100*c.dist);}finally{c.delete();}}}finally{cs.delete();}
   if(Math.abs(p.data.time-3)<1e-8)firstEnd=p.data.qpos[j.output.q];
  }secondEnd=p.data.qpos[j.output.q];assert(Math.abs((secondEnd-firstEnd)/v.root.userData.profile.pitch-sign)<.005);assert(pawlMax-pawlMin>.15);assert(maximumRetreat/v.root.userData.profile.pitch<.02);assert(maximumPenetration<.12);assert(maximumLinkageError<.001);
  t.diagnostic(JSON.stringify({mode,firstEnd,secondEnd,maximumPenetrationPixels:maximumPenetration,maximumLinkageErrorPixels:maximumLinkageError,maximumRetreatTeeth:maximumRetreat/v.root.userData.profile.pitch}));
 }finally{v.dispose();}}
});

test('121 disabling tooth contact disconnects the cog from the driven rod and disk',()=>{
 const v=makeMujocoReversibleClick(mujoco),p=v.physics;try{for(const[id,n]of Object.entries(p.geomGroups))if(n==='cog')p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;v.update(1.5);assert(p.data.qpos[p.joints.carrier.q]<-.26);assert(p.data.qpos[p.joints.slider.q]<-.37);assert.equal(p.data.qpos[p.joints.output.q],0);}finally{v.dispose();}
});

test('121 restart, reverse selection, seeking and frame partitioning preserve deterministic playback',()=>{
 const v=makeMujocoReversibleClick(mujoco),p=v.physics,u=v.root.userData;try{v.update(3);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=180;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(3);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  u.setConfiguration('reverse');assert.equal(p.data.time,0);assert.equal(p.data.qpos[p.joints.pawl.q],3.3);v.update(3);assert(p.data.qpos[p.joints.output.q]>.1);u.setConfiguration('forward');v.update(3);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('121 after each return the click drops back into a root in both modes, not onto a tooth flank',()=>{
 for(const mode of ['forward','reverse']){const v=makeMujocoReversibleClick(mujoco,{mode}),u=v.root.userData,pos=u.parts.click.geometry.attributes.position;try{
  const reach=()=>{const e=u.parts.click.matrixWorld.elements;let r=Infinity;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);r=Math.min(r,Math.hypot(e[0]*x+e[4]*y+e[12],e[1]*x+e[5]*y+e[13]));}return r;};
  const P=v.physics.description.options.period,[drive,rest]=mode==='forward'?[.5,0]:[0,.5];
  for(const cycle of [4,8]){v.update((cycle+drive)*P);const driving=reach();v.update((cycle+1+rest)*P);const resting=reach();
   assert(resting<driving+.02,`${mode}: click rests ${resting-driving} above its driving depth`);assert(resting<u.profile.tipRadius-.05);}
 }finally{v.dispose();}}
});
