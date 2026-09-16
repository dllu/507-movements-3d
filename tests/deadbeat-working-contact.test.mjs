import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredDeadbeatEscapementMovement as create} from '../src/simulation/authored-deadbeat-escapements.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

function nearest(point,polygons){let distance=Infinity,closest;
 for(const polygon of polygons)for(const ring of polygon)for(let i=0;i<ring.length-1;i++){
  const a=new THREE.Vector2(...ring[i]),v=new THREE.Vector2(...ring[i+1]).sub(a);
  const t=THREE.MathUtils.clamp(point.clone().sub(a).dot(v)/v.lengthSq(),0,1),q=a.addScaledVector(v,t),gap=q.distanceTo(point);
  if(gap<distance){distance=gap;closest=q;}
 }return{distance,closest};
}
test('289 actual working faces oppose wheel torque and give positive return impulse',()=>{
 const m=create({id:289}),d=m.root.userData,g=d.geometry,zero=new THREE.Vector2();let count=0,maxGap=0,maxResistance=-Infinity,minPower=Infinity;
 const stages=new Set();
 for(let i=0;i<=2048;i++){
  const s=d.stateAtTime(g.pendulumPeriod*i/2048);if(!s.contactActive)continue;
  const body=(s.activeSide>0?d.blocks.leftPallet:d.blocks.rightPallet).userData.body;
  const p=s.activeToothPoint.clone().sub(g.anchorPivot).rotateAround(zero,-s.anchorAngle);
  const hit=nearest(p,body.geometry.userData.plate.polygons),normal=p.clone().sub(hit.closest).normalize().rotateAround(zero,s.anchorAngle);
  const r=s.activeToothPoint.clone().sub(g.wheelCenter),forward=new THREE.Vector2(-r.y,r.x).normalize();
  const resistance=normal.dot(forward);maxGap=Math.max(maxGap,hit.distance);maxResistance=Math.max(maxResistance,resistance);count++;
  assert.ok(hit.distance<.00065,`face gap ${hit.distance} at ${i}`);
  assert.ok(resistance<-.15,`reaction ${resistance} at ${i}`);
  stages.add(`${s.activeSide}/${s.contactMode}`);
  if(s.contactMode==='impulse'&&s.impulseProgress>.01&&s.impulseProgress<.99){
   const ar=s.activeToothPoint.clone().sub(g.anchorPivot),power=(-ar.x*normal.y+ar.y*normal.x)*s.anchorAngularSpeed;
   minPower=Math.min(minPower,power);assert.ok(power>.01,`impulse removes pendulum energy at ${i}: ${power}`);
  }
 }
 assert.equal(stages.size,4);console.log({count,maxGap,maxResistance,minPower});
});

test('289 both finite working pallets clear the full wheel at dense and event poses',()=>{
 const m=create({id:289}),d=m.root.userData,g=d.geometry,b=d.blocks;
 const points=surfacePoints(b.toothedRim.geometry),pallets=[b.leftPallet.userData.body,b.rightPallet.userData.body],solids=pallets.map(p=>solidSurface(p.geometry));
 const phases=Array.from({length:257},(_,i)=>i/256);
 for(const half of[0,1])for(const event of[g.landingHalfPhase,g.impulseStartHalfPhase,g.releaseHalfPhase])for(const epsilon of[-1e-5,0,1e-5])phases.push((half+event)/2+epsilon);
 const point=new THREE.Vector3();let min=.01,count=0;
 for(const phase of phases){m.update(phase*g.pendulumPeriod);m.root.updateMatrixWorld(true);
  for(let j=0;j<2;j++){const matrix=pallets[j].matrixWorld.clone().invert().multiply(b.toothedRim.matrixWorld);
   for(const v of points){point.copy(v).applyMatrix4(matrix);const gap=solids[j].signedDistance(point,.005);min=Math.min(min,gap);count++;assert.ok(gap>=-1e-5,`pallet ${j}, phase ${phase}: ${gap}`);}
  }
 }console.log({count,min});
});

test('289 full cycle advances without teleportation, rollback, or removal of working faces',()=>{
 const m=create({id:289}),d=m.root.userData,g=d.geometry;
 let before=d.stateAtTime(0),maxStep=0;
 for(let i=1;i<=20000;i++){
  const after=d.stateAtTime(i*g.pendulumPeriod/20000),step=after.wheelAngle-before.wheelAngle;
  assert.ok(step>=-1e-12&&step<.0005,`wheel step ${step} at ${i}`);maxStep=Math.max(maxStep,step);before=after;
 }
 assert.ok(Math.abs(before.wheelAngle-d.stateAtTime(0).wheelAngle-g.toothPitch)<1e-14);
 for(const metric of Object.values(d.escapementWorkingParts.profileQualification.metrics)){
  assert.ok(metric.finalArea/metric.blankArea>.95);assert.ok(metric.maximumWorkingFaceGap<.0006);
 }
 assert.match(d.reconstructionNote,/velocity changes/);assert.match(d.reconstructionNote,/not simulated/);
 console.log({maxStep});
});

test('289 finite pallet bodies remain physically joined to the front structural arch',()=>{
 const m=create({id:289}),b=m.root.userData.blocks;m.root.updateMatrixWorld(true);
 const arch=solidSurface(b.anchorBody.geometry);
 for(const pallet of[b.leftPallet,b.rightPallet]){
  const body=pallet.userData.body,matrix=b.anchorBody.matrixWorld.clone().invert().multiply(body.matrixWorld);
  const overlap=Math.min(...surfacePoints(body.geometry).map(p=>arch.signedDistance(p.clone().applyMatrix4(matrix),.02)));
  assert.ok(overlap<-.01,`${pallet.userData.role} is disconnected: ${overlap}`);
 }
});
