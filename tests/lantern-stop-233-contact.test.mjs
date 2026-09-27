import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {nearest390Outline} from '../src/simulation/dual-band-pawl-contact.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const make=()=>create({id:233}),pose=(m,p)=>{m.update(p*8);m.root.updateMatrixWorld(true);return m.root.userData.kinematics;};

test('233 complete trundle circles clear the finite latch and roller throughout withdrawal and both strokes',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,g=d.geometry,outline=b.latchBody.geometry.userData.plate.polygons[0][0].map(p=>p.map(Math.fround));let latchMinimum=Infinity,rollerMinimum=Infinity,workingMaximum=0,borne=0,active=0;
 for(let i=0;i<=512;i++){
  const state=pose(m,i/512),inverse=b.latchBody.matrixWorld.clone().invert(),r=b.rollerWheel.getWorldPosition(new THREE.Vector3());
  for(const pin of b.wheel.userData.trundles){
   const p=pin.getWorldPosition(new THREE.Vector3()),q=p.clone().applyMatrix4(inverse),gap=nearest390Outline([q.x,q.y],outline).distance-g.trundleRadius;
   latchMinimum=Math.min(latchMinimum,gap);assert.ok(gap>-1e-7,`latch ${i/512}/${pin.userData.index}: ${gap}`);
   const rollerGap=Math.hypot(r.x-p.x,r.y-p.y)-g.rollerRadius-g.trundleRadius;rollerMinimum=Math.min(rollerMinimum,rollerGap);assert.ok(rollerGap>-1e-12);
   if(state.latchActive&&pin.userData.index===state.latchContact?.trundleIndex){workingMaximum=Math.max(workingMaximum,gap);borne+=gap<.0045?1:0;active+=1;}
  }
 }
 // The bar rests on (or rides) a trundle except while it falls off the tip.
 assert.ok(borne>=.85*active,`latch borne in ${borne}/${active} states`);
 console.log({latchMinimum,rollerMinimum,maximumWorkingLatchGap:workingMaximum,borne,active});
});

test('233 rendered latch, roller disk and inset rim clear actual trundle solids',()=>{
 const m=make(),b=m.root.userData.blocks,w=m.root.userData.lanternStop233Parts,targets=b.wheel.userData.trundles,fields=targets.map(t=>solidSurface(t.geometry));let minimum=Infinity;
 for(let i=0;i<=64;i++){
  pose(m,i/64);
  for(const part of [b.latchBody,w.disk,w.rim,w.armPlate])for(let j=0;j<targets.length;j++){
   const transform=targets[j].matrixWorld.clone().invert().multiply(part.matrixWorld);
   for(const p of surfacePoints(part.geometry)){const gap=fields[j].signedDistance(p.clone().applyMatrix4(transform),.1);minimum=Math.min(minimum,gap);assert.ok(gap>-1e-7,`${i/64} part ${part.id} pin${j}: ${gap}`);}
  }
 }
 console.log({minimumRenderedSurfaceGap:minimum});
});

test('233 actual latch flank and roller surface retain meaningful resisting normals',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.lanternStop233Parts,triangles=surfaceTriangles(b.latchBody.geometry),near=new THREE.Vector3();let latchMoment=Infinity,normalDot=1;
 for(const progress of [.01,.08,.2,.3]){
  const c=d.latchEnvelopeAtProgress(progress),target=new THREE.Vector3(c.localContactPoint.x,c.localContactPoint.y,0);let distance=Infinity,n,point;
  for(const triangle of triangles){triangle.closestPointToPoint(target,near);const gap=target.distanceTo(near);if(gap<distance){distance=gap;n=triangle.getNormal(new THREE.Vector3());point=near.clone();}}
  // Outward latch normal faces the pin; the force on the wheel follows it.
  normalDot=Math.min(normalDot,-n.x*c.localNormal.x-n.y*c.localNormal.y);assert.ok(distance<.000024);assert.ok(normalDot>.9999);
  n.applyAxisAngle(new THREE.Vector3(0,0,1),c.latchAngle);point.applyAxisAngle(new THREE.Vector3(0,0,1),c.latchAngle);point.x+=d.geometry.latchPivot.x;point.y+=d.geometry.latchPivot.y;
  const moment=point.x*n.y-point.y*n.x;assert.ok(moment<-.55);latchMoment=Math.min(latchMoment,-moment);
 }
 const roller=d.rollerContactAtProgress(0),circleMoment=-(roller.pinContactPoint.x*roller.contactNormal.y-roller.pinContactPoint.y*roller.contactNormal.x);assert.ok(circleMoment>1.7);
 const rollerField=solidSurface(w.disk.geometry),angle=Math.atan2(-roller.contactNormal.y,-roller.contactNormal.x);
 assert.ok(rollerField.signedDistance(new THREE.Vector3(.43*Math.cos(angle),.43*Math.sin(angle),0))<.00007);
 console.log({minimumLatchResistingMoment:latchMoment,rollerSeatedResistingMoment:circleMoment,minimumFaceNormalAgreement:normalDot});
});

test('233 actual shaft passages and separate free-roller layers remain clear',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.lanternStop233Parts;
 for(const [geometry,centers,radius]of[[b.latchBody.geometry,[0],.095],[w.disk.geometry,[0],.095],[w.armPlate.geometry,[0,d.geometry.rollerArmLength],.095]]){
  const f=solidSurface(geometry);for(const x of centers)for(let i=0;i<64;i++){const a=i*Math.PI/32;assert.ok(f.signedDistance(new THREE.Vector3(x+radius*Math.cos(a),radius*Math.sin(a),0))>.0038);}
 }
 for(const phase of[0,.2,.3,.5,.7,.9]){
  pose(m,phase);const arm=new THREE.Box3().setFromObject(w.armPlate),disk=new THREE.Box3().setFromObject(w.disk);assert.ok(arm.min.z-disk.max.z>.0449);
  const spindle=w.spindle.getWorldPosition(new THREE.Vector3()),roller=b.rollerWheel.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(spindle.x-roller.x,spindle.y-roller.y)<1e-14);
  const latch=new THREE.Box3().setFromObject(b.latchBody),pin=new THREE.Box3().setFromObject(b.wheel.userData.trundles[11]);assert.ok(Math.min(latch.max.z,pin.max.z)-Math.max(latch.min.z,pin.min.z)>.1499);
 }
});

test('233 continuous demonstrations fit visible bounds, retain readable speed and allocate no meshes per update',()=>{
 const m=make(),d=m.root.userData,snapshot=()=>{const x=[];m.root.traverse(o=>x.push([o,o.geometry]));return x;},before=snapshot(),p=new THREE.Vector3();
 for(let i=0;i<=64;i++){pose(m,i/64);d.stateAtTime(i*.021);m.root.traverseVisible(o=>{if(!o.isMesh)return;assert.equal(o.material.fog,false);const a=o.geometry.attributes.position;for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld);assert.ok(d.cameraFitBounds.containsPoint(p));}});}
 for(const t of[0,.08,.16,.4,.46,.52,.58,.82,.88,.94,1]){const a=d.stateAtCycleCoordinate(t-1e-8),b=d.stateAtCycleCoordinate(t+1e-8);for(const key of['wheelAngle','latchAngle','rollerLeverDelta'])assert.ok(Math.abs(a[key]-b[key])<1e-7);for(const key of['wheelAngularSpeed','latchAngularSpeed','rollerLeverAngularSpeed'])assert.ok(Math.abs(a[key]-b[key])<1e-6);}
 for(const cycle of[0,1,3]){assert.equal(d.stateAtCycleCoordinate(cycle+.25).rollerContact.trundleIndex,0);assert.equal(d.stateAtCycleCoordinate(cycle+.70).latchContact.trundleIndex,11);}
 assert.deepEqual(snapshot(),before);assert.equal(d.minimumDisplayCycleSeconds,8);assert.equal(d.hideGround,true);assert.match(d.reconstructionNote,/not dynamically solved/);
});
