import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeEqualRacksGeometry} from '../src/simulation/mujoco-equal-racks/geometry.js';
import {makeMujocoEqualRacks} from '../src/simulation/mujoco-equal-racks/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();

test('115 has seven closed solids and equal unshifted 20-degree involute pinions',()=>{
 const v=makeEqualRacksGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,7);
  // p60 support policy: Brown draws no stands, guides or back bars here.
  assert.deepEqual(Object.keys(u.parts).filter(n=>/Guide|Pillar|Foot|Bearing|BackBar|Post|Clip|Strap|TieBar/.test(n)),[]);
  for(const [name,mesh]of Object.entries(u.parts)){
   const a=inspectWeightedClutchSolid(mesh.geometry);assert(a.volume>0,name);assert.equal(a.components,1,name);assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,name);
  }
  for(const n of ['upper','lower']){const f=u.parts[n].geometry.userData;assert.equal(f.teeth,12);assert.equal(f.profileShift,0);}
  // p109 (2026-09-29 rule): Brown's square teeth are ideal 20-degree unshifted involutes whose pitch
  // circles are the working circles, cut by a basic rack (dedendum 1.25), with trapezoidal rack teeth
  // (flanks at the pressure angle, flat tips) and a 0.9-module addendum inside the 12:12 interference
  // limit, so the central pair can mesh without undercut contact; contact ratio over 1.2.
  {const g=u.profile,pitch=g.pitch,m=g.module,a=g.pressureAngle,R=g.pitchRadius,rb=R*Math.cos(a),ra=R+g.addendum*m,inv=x=>Math.tan(x)-x,aa=Math.acos(rb/ra);
   assert(Math.abs(R-g.workingRadius)<1e-12);assert(Math.abs(a-20*Math.PI/180)<1e-12);assert.equal(g.addendum,.9);assert.equal(g.dedendum,1.25);
   assert(Math.abs(g.rootY-g.workingRadius-R-(g.addendum+.25)*m)<1e-12);
   assert(2*ra*(Math.PI/24+inv(a)-inv(aa))>.4*m);assert((pitch/2-2*g.dedendum*m*Math.tan(a))/pitch>.2);
   assert(ra*ra<=rb*rb+4*R*R*Math.sin(a)**2);assert(2*(Math.sqrt(ra*ra-rb*rb)-R*Math.sin(a))/(pitch*Math.cos(a))>1.2);}
  assert.deepEqual(u.profile.counts,{upper:8,lower:9});assert.equal(u.hideGround,true);
 }finally{disposeObject3D(v.root);}
});

test('115 native cells reproduce all three toothed plates; one transmission applies equal opposite shaft torques',t=>{
 const v=makeMujocoEqualRacks(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try{
  assert.equal(p.model.nq,3);assert.equal(p.model.neq,0);assert.equal(p.model.nu,1);assert.equal(p.model.ntendon,1);
  assert.deepEqual(Array.from(p.model.tendon_num),[2]);assert.deepEqual(Array.from(p.model.wrap_prm),[-.5,.5]);
  for(const [name,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   const offset=new THREE.Vector3().fromArray(p.data.xpos,p.bodies[name]*3);
   for(let j=0;j<n;j++){const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform).sub(offset);error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;}
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({vertices:count,errorPixels:100*error,geoms:p.model.ngeom}));
 }finally{v.dispose();}
});

test('115 both rack faces engage through two native cycles without prescribed frame motion',t=>{
 const v=makeMujocoEqualRacks(mujoco),p=v.physics,f=v.root.userData.profile,pairs={};let error=0,penetration=0,lo=0,hi=0,maxStep=0,lastTime=-1;
 try{
  for(let i=0;i<Math.round(12/p.timestep);i++){
   const previous=p.data.qpos[2];p.step();const d=p.data;assert(d.time>lastTime);lastTime=d.time;assert([...d.qpos,...d.qvel].every(Number.isFinite));
   error=Math.max(error,Math.abs(d.qpos[2]+f.pitchRadius*d.qpos[0]),Math.abs(d.qpos[2]-f.pitchRadius*d.qpos[1]));lo=Math.min(lo,d.qpos[2]);hi=Math.max(hi,d.qpos[2]);maxStep=Math.max(maxStep,Math.abs(d.qpos[2]-previous));
   assert(Math.abs(d.qfrc_actuator[0]+d.qfrc_actuator[1])<1e-10);assert.equal(d.qfrc_actuator[2],0);
   const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{const key=Array.from(c.geom,id=>p.model.geom_bodyid[id]).sort().join('/');pairs[key]=(pairs[key]??0)+1;penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(lo<-.749&&lo>-.754&&hi>.749&&hi<.754);assert(error<.0025);assert(penetration<.001);assert(maxStep<.0012);assert(pairs['1/3']>1000&&pairs['2/3']>1000);
  // The pinions interleave at the centre (tips overlap by 0.9 module); both are driven, so they need not touch.
  assert(2*(f.cutterPitchRadius+f.addendum*f.module)-2*f.workingRadius>.85*f.module);
  t.diagnostic(JSON.stringify({range:[lo,hi],meshErrorPixels:100*error,penetrationPixels:100*penetration,maxStepPixels:100*maxStep,pairs}));
  v.reset();p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);v.update(1.5);assert(Math.abs(p.data.qpos[2])<1e-10);assert(p.data.qpos[0]<-1&&p.data.qpos[1]>1);
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('115 either rack face can transmit input when the other rack contact is removed',()=>{
 for(const disabled of ['upper','lower']){
  const v=makeMujocoEqualRacks(mujoco),p=v.physics;
  try{
   // Both masks are edited: MuJoCo accepts either direction of a mask pair.
   for(let i=0;i<p.model.ngeom;i++){const body=p.model.geom_bodyid[i];if(body===p.bodies[disabled])p.model.geom_conaffinity[i]&=~4;if(body===p.bodies.frame)p.model.geom_conaffinity[i]&=~(disabled==='upper'?1:2);}
   v.update(1.5);assert(p.data.qpos[2]>.74&&p.data.qpos[2]<.76);v.update(4.5);assert(p.data.qpos[2]<-.74&&p.data.qpos[2]>-.76);
  }finally{v.dispose();}
 }
});

test('115 restart, seeking and frame partitioning preserve native state exactly',()=>{
 const v=makeMujocoEqualRacks(mujoco),p=v.physics;
 try{v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}finally{v.dispose();}
});
