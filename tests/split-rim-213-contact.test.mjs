import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const make=()=>create({id:213});

test('213 full pin clears the actual five-tooth sector in both retained directions',()=>{
 const m=make(),d=m.root.userData,g=d.geometry;let minimum=Infinity,maximumGap=0;
 for(const sign of[1,-1])for(let i=0;i<=8192;i++){
  const s=d.stateAtInputTravel(g.forwardInputLimit*i/8192,sign),hit=s.finiteContact;minimum=Math.min(minimum,hit.gap);assert.ok(hit.gap>-1e-7,`${sign}/${i}: ${hit.gap}`);
  if(s.engagement.active){maximumGap=Math.max(maximumGap,hit.gap);assert.ok(hit.gap<.001);assert.ok(-sign*hit.moment>.9);}
 }
 console.log({minimumFullPinClearance:minimum,maximumWorkingGap:maximumGap});
});

test('213 rendered pin surfaces clear actual stop triangles on both indexing faces',()=>{
 const m=make(),d=m.root.userData,g=d.geometry,b=d.blocks,field=solidSurface(b.stopWheelBody.geometry),points=surfacePoints(b.facePin.geometry);let minimum=Infinity;
 for(const sign of[1,-1])for(let turn=0;turn<5;turn++)for(let i=0;i<=12;i++){
  const input=turn*2*Math.PI+5.22+.83*i/12,s=d.stateAtInputTravel(input,sign);
  b.driver.userData.rotor.rotation.z=input;b.stopWheel.userData.rotor.rotation.z=s.stopWheelAngle;m.root.updateMatrixWorld(true);
  const transform=b.stopWheelBody.matrixWorld.clone().invert().multiply(b.facePin.matrixWorld);
  for(const p of points){const gap=field.signedDistance(p.clone().applyMatrix4(transform),.01);minimum=Math.min(minimum,gap);assert.ok(gap>-1e-7,`${sign}/${input}: ${gap}`);}
 }
 console.log({minimumRenderedPinGap:minimum});
});

test('213 useful normals belong to real faces and both uncut rims block further winding',()=>{
 const m=make(),d=m.root.userData,g=d.geometry,b=d.blocks,triangles=surfaceTriangles(b.stopWheelBody.geometry),near=new THREE.Vector3();let smallestMoment=Infinity;
 for(const sign of[1,-1])for(const input of[5.50,5.55,5.70,5.75]){
  const s=d.stateAtInputTravel(input,sign);assert.equal(s.engagement.active,true);
  const p=s.finiteContact.point.clone().sub(g.stopWheelCenter).rotateAround(new THREE.Vector2(),-s.stopWheelAngle),target=new THREE.Vector3(p.x,p.y,0);
  const normals=[];let distance=Infinity;
  for(const triangle of triangles){
   triangle.closestPointToPoint(target,near);const gap=near.distanceTo(target);distance=Math.min(distance,gap);
   if(gap<2e-7){const n=triangle.getNormal(new THREE.Vector3());if(Math.abs(n.z)<1e-6)normals.push(n.applyAxisAngle(new THREE.Vector3(0,0,1),s.stopWheelAngle));}
  }
  assert.ok(distance<2e-7);assert.ok(normals.length>0);
  // At a polygon vertex the circle reaction lies inside the cone of the
  // adjacent rendered face normals, rather than equalling either face alone.
  const desired=s.finiteContact.normal,crosses=[];
  for(const n of normals){
   assert.ok(n.x*desired.x+n.y*desired.y>.98);
   crosses.push(n.x*desired.y-n.y*desired.x);
   const r=s.finiteContact.point.clone().sub(g.stopWheelCenter),moment=-(r.x*n.y-r.y*n.x);
   assert.ok(-sign*moment>.9);smallestMoment=Math.min(smallestMoment,-sign*moment);
  }
  assert.ok(Math.min(...crosses)<1e-5&&Math.max(...crosses)>-1e-5,'reaction is supported by actual adjacent face normals');
 }
 for(const [input,angle,direction]of[[0,g.initialStopWheelAngle,-1],[g.forwardInputLimit,g.finalStopWheelAngle,1]]){
  const seat=d.finiteContactAt(d.pinCenterAtInputTravel(input),angle),past=d.finiteContactAt(d.pinCenterAtInputTravel(input+direction*.0001),angle);
  assert.ok(Math.abs(seat.gap)<1e-6);assert.ok(past.gap<-.0001,'finite retained rim blocks attempted overtravel');
 }
 console.log({minimumActualDrivingMoment:smallestMoment});
});

test('213 retained branches are continuous, account for reversal take-up, and close the demonstration',()=>{
 const m=make(),d=m.root.userData,g=d.geometry;
 for(const reverse of[false,true])for(let k=1;k<5;k++){
  const a=d.stopWheelAngleAtInputTravel(k*2*Math.PI-1e-8,reverse),b=d.stopWheelAngleAtInputTravel(k*2*Math.PI+1e-8,reverse);assert.ok(Math.abs(a-b)<1e-10);
 }
 for(let k=2;k<=5;k++)assert.ok(Math.abs(d.stopWheelAngleAtInputTravel((k-1)*2*Math.PI)-d.stopWheelAngleAtInputTravel(k*2*Math.PI)-g.stopPitchAngle)<1e-10);
 assert.ok(g.reversalTakeup>0&&g.reversalTakeup<.002);
 const a=d.stateAtTime(0),b=d.stateAtTime(d.timeline.demonstrationPeriod);assert.ok(Math.abs(a.stopWheelAngle-b.stopWheelAngle)<1e-14);
 let previous=d.stateAtTime(0),largest=0,peakTime=0;
 const dt=d.timeline.demonstrationPeriod/8192;
 for(let i=1;i<=8192;i++){
  const s=d.stateAtTime(i*dt),jump=Math.abs(s.stopWheelAngle-previous.stopWheelAngle);
  if(jump>largest){largest=jump;peakTime=(i-.5)*dt;}previous=s;
 }
 assert.ok(largest<.02);
 // A shrinking probe distinguishes steep continuous pickup from a jump.
 let last=Infinity;
 for(const h of[1e-3,1e-4,1e-5,1e-6]){
  const jump=Math.abs(d.stateAtTime(peakTime+h).stopWheelAngle-d.stateAtTime(peakTime-h).stopWheelAngle);
  assert.ok(jump<last*.11);assert.ok(jump<8*h);last=jump;
 }
 let hysteresis=0;
 for(let i=0;i<=4096;i++){
  const u=g.forwardInputLimit*i/4096;
  hysteresis=Math.max(hysteresis,Math.abs(d.stopWheelAngleAtInputTravel(u)-d.stopWheelAngleAtInputTravel(u,true)));
 }
 assert.ok(hysteresis<.04);
 console.log({largestPlaybackStep:largest,reversalTakeup:g.reversalTakeup,maximumBranchHysteresis:hysteresis});
});

test('213 corrected playback retains full pin, source limits and stable scene allocations',()=>{
 const m=make(),d=m.root.userData,g=d.geometry,snapshot=()=>{const a=[];m.root.traverse(o=>a.push([o,o.geometry]));return a;},before=snapshot();
 for(let i=0;i<=64;i++){m.update(i*d.timeline.demonstrationPeriod/64);d.stateAtTime(i*.13);}
 assert.deepEqual(snapshot(),before);assert.equal(g.facePinRadius,.1915737438);assert.equal(g.installedStopToothCount,5);assert.ok(Math.abs(g.forwardInputLimit/(2*Math.PI)-5.799901908233082)<1e-12);
 assert.equal(d.minimumDisplayCycleSeconds,18);assert.equal(d.hideGround,true);assert.match(d.reconstructionNote,/shorter/);assert.match(d.reconstructionNote,/not dynamically solved/);
 m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
});
