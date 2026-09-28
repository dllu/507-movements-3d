import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
test('150 ordinary rod pins close on a vertical output through every selection',()=>{
 const m=makeSelectableCamValve(),u=m.root.userData,g=u.valveGeometry;
 try{
  const first=u.stateAtTime(0).valve;assert.ok(Math.abs(first.angle)<1e-12);
  const box=new THREE.Box3().setFromObject(u.valveParts['pinned-valve-rod']);
  assert.ok(Math.abs(272-box.min.y/.016-354)<.001);
  for(let i=0;i<=2048;i++){
   const t=u.geometry.demonstrationPeriod*i/2048;m.update(t);const s=u.kinematics.valve;
   const top=u.valveBodies.rod.getWorldPosition(new THREE.Vector3()),bottom=u.valveBodies.rod.localToWorld(new THREE.Vector3(0,-g.pinDistance,0)),slide=u.valveBodies.slider.getWorldPosition(new THREE.Vector3()),upperPin=u.blocks.outputPin.getWorldPosition(new THREE.Vector3());
   assert.ok(Math.hypot(top.x-upperPin.x,top.y-upperPin.y)<1e-12);
   assert.ok(bottom.distanceTo(slide)<1e-12);assert.equal(slide.x,g.guideX);
   const h=1e-5,a=u.stateAtTime(t-h).valve,b=u.stateAtTime(t+h).valve;
   assert.ok(Math.abs((b.bottom.y-a.bottom.y)/(2*h)-s.velocityY)<1e-6);
  }
  m.reset();assert.ok(u.kinematics.valve.top.distanceTo(first.top)<1e-12);
 }finally{m.dispose();}
});
test('150 valve rod ends plainly: no lower eye or cross-pin (pass 93)',()=>{
 const m=makeSelectableCamValve();try{const names=[];m.root.traverse(o=>{if(o.isMesh)names.push(o.name);});
  assert.ok(!names.includes('lower-pin')&&!names.includes('lower-pin-retainer'));
  const rod=m.root.userData.valveParts['pinned-valve-rod'];rod.geometry.computeBoundingBox();assert.ok(rod.geometry.boundingBox.max.x-rod.geometry.boundingBox.min.x<.35);
 }finally{m.dispose();}
});
