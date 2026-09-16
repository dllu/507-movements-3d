import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredBoatDetacherMovement} from '../src/simulation/authored-boat-detachers.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const make=()=>createAuthoredBoatDetacherMovement({id:492});
function clearance(a,points,b,surface){const t=b.matrixWorld.clone().invert().multiply(a.matrixWorld);let minimum=Infinity;
 for(const p of points){const q=p.clone().applyMatrix4(t);if(surface.box.distanceToPoint(q)>.01)continue;minimum=Math.min(minimum,surface.signedDistance(q,.01));}return minimum;}
function data(o){return{mesh:o,points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)};}
function gap(a,b){return clearance(a.mesh,a.points,b.mesh,b.surface);}

test('492 finite tongue and hook clear each other through release and reverse demonstration',()=>{
 const m=make(),u=m.root.userData.blocks.units[0];
 const moving=[u.tongueBody,u.lockingStud,...u.tongue.children.filter(o=>o.userData.role==='tongue-end-offset-neck')].map(data);
 const targets=[u.tackleHook,u.tackleHeadRing,u.upperEye,u.standardPlate].map(data);
 for(let i=0;i<=256;i++){
  m.update(10*i/256);m.root.updateMatrixWorld(true);
  for(const a of moving)for(const b of targets){
   assert.ok(gap(a,b)>=-1e-6,`${a.mesh.userData.role} enters ${b.mesh.userData.role} at ${i}/256`);
   assert.ok(gap(b,a)>=-1e-6,`${b.mesh.userData.role} enters ${a.mesh.userData.role} at ${i}/256`);
  }
 }
});
test('492 locked hook carries upward load and the retained eye blocks tongue rotation',()=>{
 const m=make(),u=m.root.userData.blocks.units[0],tongue=data(u.tongueBody),hook=data(u.tackleHook),stud=data(u.lockingStud),eye=data(u.upperEye);
 m.update(0);m.root.updateMatrixWorld(true);
 assert.ok(Math.abs(gap(tongue,hook))<1e-6,'the seat actually meets the tongue rather than floating below it');
 u.tackleHookAssembly.position.y=.015;m.root.updateMatrixWorld(true);
 assert.ok(gap(tongue,hook)<-.005,'upward tackle motion must be blocked by the locked tongue');
 m.update(0);u.tongue.rotation.z=-.10;m.root.updateMatrixWorld(true);
 assert.ok(Math.min(gap(stud,eye),gap(eye,stud))<-.003,'the eye captures the tongue before a significant load-driven rotation');
 // An upward force on this seat acts left of the hinge: its moment is
 // clockwise, matching the corrected release direction.
 const p=tongue.points.reduce((a,b)=>b.y<a.y?b:a).clone().applyMatrix4(u.tongueBody.matrixWorld);
 const pivot=u.tongue.getWorldPosition(new THREE.Vector3());
 assert.ok(p.x-pivot.x<-.25);
 assert.ok(m.root.userData.geometry.tongueReleaseAngle<0);
});
test('492 released tongue permits upward tackle withdrawal after losing capture',()=>{
 const m=make(),u=m.root.userData.blocks.units[0];
 const tongue=data(u.tongueBody),hook=data(u.tackleHook);
 m.update(5.8);
 for(let i=0;i<=32;i++){
  u.tackleHookAssembly.position.y=m.root.userData.geometry.tackleHookLift+1.5*i/32;
  m.root.updateMatrixWorld(true);
  assert.ok(gap(tongue,hook)>=-1e-6);
  assert.ok(gap(hook,tongue)>=-1e-6);
 }
});
