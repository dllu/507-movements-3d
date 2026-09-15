import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeSelectableCamPhysics} from '../src/simulation/mujoco-selectable-cam/physics.js';
import {syncSelectableCamPhysics} from '../src/simulation/mujoco-selectable-cam/sync.js';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
import * as THREE from 'three';
const mujoco=await loadMujoco();
test('150 visible rod and slider match native pin locations during passive motion',()=>{
 const p=makeSelectableCamPhysics(mujoco),v=makeSelectableCamValve();
 try{
  const ids=['rod-tip','slider-pin'].map(n=>p.id('mjOBJ_SITE',n));
  for(const time of [0,3.3,6,10,18,26]){
   while(p.data.time<time)p.step();mujoco.mj_forward(p.model,p.data);syncSelectableCamPhysics(v,p.state());
   const u=v.root.userData,points=[u.valveBodies.rod.localToWorld(new THREE.Vector3(0,-u.valveGeometry.pinDistance,0)),u.valveBodies.slider.getWorldPosition(new THREE.Vector3())];
   points.forEach((point,i)=>{const expected=new THREE.Vector3(...p.data.site_xpos.slice(ids[i]*3,ids[i]*3+3));assert.ok(point.distanceTo(expected)<1e-11);});
  }
 }finally{v.dispose();p.dispose();}
});
test('150 native bodies match source joints and geometry-derived masses',()=>{
 const p=makeSelectableCamPhysics(mujoco);
 try{
  assert.equal(p.model.nq,6);assert.equal(p.model.nu,2);assert.equal(p.model.neq,1);
  const id=p.id('mjOBJ_GEOM','roller'),expected=p.description.initial.follower.rollerCenter;
  assert.ok(Math.abs(p.data.geom_xpos[3*id]-expected.x)<1e-12);assert.ok(Math.abs(p.data.geom_xpos[3*id+1]-expected.y)<1e-12);
  for(const [name,m] of Object.entries(p.description.mass))assert.ok(Math.abs(p.model.body_mass[p.id('mjOBJ_BODY',name)]-m.volume*p.description.density)<1e-12);
 }finally{p.dispose();}
});
test('150 common-heel selection does not develop the multiple-contact lock',()=>{
 const p=makeSelectableCamPhysics(mujoco);
 try{
  while(p.data.time<3.3)p.step();
  const reference=p.drive(p.data.time);assert.match(reference.stage,/selecting/);
  assert.ok(Math.abs(p.data.qpos[1]-reference.carrierTranslationZ)<.005);
  assert.ok(Math.abs(p.data.qpos[2]-p.description.initial.follower.leverAngle)>.1);
  for(const f of p.data.qfrc_applied)assert.equal(f,0);
 }finally{p.dispose();}
});
test('150 followers are not prescribed when contact and gravity are removed',()=>{
 const p=makeSelectableCamPhysics(mujoco,{gravity:0});
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);const initial=Array.from(p.data.qpos);
  while(p.data.time<4)p.step();assert.ok(p.data.qpos[0]>2);
  assert.ok(Math.abs(p.data.qpos[1]-initial[1])>.5);
  for(const i of [2,3,4,5])assert.ok(Math.abs(p.data.qpos[i]-initial[i])<1e-9);
 }finally{p.dispose();}
});
