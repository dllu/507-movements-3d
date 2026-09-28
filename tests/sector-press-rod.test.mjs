import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];
const box=o=>new THREE.Box3().setFromObject(o);
test('133 bored rod eyes stay on their pins with axial clearance and retention',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry,r=b.connectingRod,q=r.userData.eyeRod;
 try{
  assert.equal(r.children[0].geometry.parameters.shapes.holes.length,2);
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);const rb=box(r.children[0]);
   for(const [index,pin,cap,radius] of [[0,b.sectorPinBody,b.sectorPinCap,b.sectorPinBody.geometry.parameters.radiusTop],[1,b.platenWristPin,b.wristCap,.15]]){
    const p=pin.getWorldPosition(new THREE.Vector3());r.worldToLocal(p);
    assert(Math.hypot(p.x-index*q.length,p.y)<1e-12,'pin axis must coincide with bored eye');
    assert(q.bores[index]*Math.cos(Math.PI/128)-radius>.0029,'polygonal bore must clear the pin');
    const pb=box(pin),cb=box(cap);assert(pb.min.z<rb.min.z&&pb.max.z>rb.max.z);assert(cb.min.z-rb.max.z>.009,'head must clear eye face');
    assert(cap.geometry.parameters.radiusTop>q.bores[index],'head must retain the eye');
   }
   if(box(b.crankGrip).max.z >= rb.min.z){
   const grip = b.crankGrip.getWorldPosition(new THREE.Vector3());
   r.worldToLocal(grip);
   const nearestX = Math.max(0, Math.min(q.length, grip.x));
   const gripRadius = d.crankGripRadius * 1.08;
   assert(Math.hypot(grip.x-nearestX, grip.y)>q.width/2+gripRadius,'crank grip must clear rod shank');
   for(const x of [0,q.length])assert(Math.hypot(grip.x-x,grip.y)>q.eyeRadius+gripRadius,'crank grip must clear rod eyes');
   }
   for(const part of [b.platenHanger,b.sectorRim,b.pinionBody])assert(box(part).max.z<rb.min.z,'rod must pass in front of adjacent bodies');
  }
 }finally{disposeObject3D(v.root);}
});
