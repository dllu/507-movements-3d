import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
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

test('150 p104: the rocking lever is 0.054 thick and clears every sliding cam and its roller',()=>{
 const m=makeSelectableCamValve(),u=m.root.userData,g=u.geometry,lever=u.valveParts['pinned-lever'];
 lever.geometry.computeBoundingBox();const box=lever.geometry.boundingBox;
 assert.ok(Math.abs(box.max.z-box.min.z-.054)<1e-6);assert.equal(u.valveParts['roller-axle-retainer'],undefined);
 const cams=[];m.root.traverse(o=>{if(o.isMesh&&/working-cam-plate|common-heel|keyed-hub/.test(o.userData.role??''))cams.push(o);});
 cams.push(u.blocks.followerRoller.tread);assert.ok(cams.length>=6);
 const L={s:solidSurface(lever.geometry),p:surfacePoints(lever.geometry)},cache=new Map();
 const S=o=>{if(!cache.has(o.geometry))cache.set(o.geometry,{s:solidSurface(o.geometry),p:surfacePoints(o.geometry)});return cache.get(o.geometry);};
 for(let i=0;i<=64;i++){m.update(g.demonstrationPeriod*(i+.37)/65);m.root.updateMatrixWorld(true);
  for(const o of cams){const B=S(o);
   for(const [A,from,C,to] of [[L,lever,B,o],[B,o,L,lever]]){const T=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
    if(!A.s.box.clone().applyMatrix4(T).intersectsBox(C.s.box))continue;
    for(const v of A.p){const q=v.clone().applyMatrix4(T);if(C.s.inside(q))assert.ok(C.s.distance(q)<=1e-6,`lever meets ${o.userData.role} at pose ${i}`);}}}}
 m.dispose();
});
