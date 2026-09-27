import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredEccentricJackMovement as createMovementModel} from '../src/simulation/authored-eccentric-jacks.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
function clear(moving,points,target,surface,tolerance=1e-6){
 const transform=target.matrixWorld.clone().invert().multiply(moving.matrixWorld);
 for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.box.distanceToPoint(p)>.01)continue;
  const gap=surface.signedDistance(p,.01);assert.ok(gap>=-tolerance,`${moving.userData.role} into ${target.userData.role}: ${gap} at ${p.toArray()}`);
 }
}
function checks(pairs){return pairs.map(([moving,targets])=>[moving,surfacePoints(moving.geometry),targets.map(o=>[o,solidSurface(o.geometry)])]);}
function sweep(model,checks,period,poses=65,tolerance=1e-6){for(let i=0;i<poses;i++){
 model.update(period*i/(poses-1));model.root.updateMatrixWorld(true);
 for(const [moving,points,targets]of checks)for(const [target,surface]of targets)clear(moving,points,target,surface,tolerance);
}}
test('389 finite pawls clear every rendered rack tooth throughout power, return and reversed lowering strokes',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData,b=d.blocks;
 sweep(model,checks([[b.driveBody,[b.rackBody,...b.rackTeeth]],[b.holdingPawlBody,[b.rackBody,...b.rackTeeth]],[b.eccentricStrap,[b.rackBody,...b.rackTeeth]],[b.driveBody,[b.holdingPawlBody]]]),d.timeline.cycleDuration,257);
 assert.equal(d.hideGround,true);
});
test('389 eccentric disk, actual strap bore, shaft bearings and guided rack remain physically separated',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData,b=d.blocks;
 sweep(model,checks([
  [b.eccentricDisk,[b.eccentricStrap,b.driveBody]],
  [b.eccentricShaftPin,[b.eccentricDisk,...b.fixedSupports]],
  [b.holdingPivotPin,[b.holdingPawlBody,...b.fixedSupports]],
  [b.rackBody,[b.frame.userData.base,...b.frame.userData.feet,...b.fixedSupports]],
  ...b.rackTeeth.map(o=>[o,[b.frame.userData.base,...b.frame.userData.feet,...b.fixedSupports]]),
 ]),d.timeline.cycleDuration,65);
});

// This experimental regression guards the specific upper-pawl branch jump.
// A finite speed bound must hold when temporal resolution is doubled.
test('389 finite pawl paths have bounded travel at two time resolutions',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData;
 for(const samples of [32768,65536]) {
  const dt=d.timeline.cycleDuration/samples;
  let previous=d.stateAtTime(0);
  for(let i=1;i<=samples;i++) {
   const state=d.stateAtTime(i*dt);
   for(const key of ['driveNose','holdingTip']) {
    const speed=state[key].distanceTo(previous[key])/dt;
    assert.ok(speed<4.3,`${key} discontinuity at ${i*dt}: ${speed}`);
   }
   previous=state;
  }
 }
});

test('389 finite handoff includes overtravel, supported settling and a genuine next-tooth seat', () => {
 const model=createMovementModel(catalog[388]),d=model.root.userData,g=d.geometry,t=d.timeline;
 for(let stroke=0;stroke<3;stroke++) {
  const peak=d.stateAtTime((stroke+.5)*t.strokeDuration);
  const settling=d.stateAtTime((stroke+(.5+g.transferFraction)/2)*t.strokeDuration);
  const seated=d.stateAtTime((stroke+g.transferFraction+1e-6)*t.strokeDuration);
  assert.ok(Math.abs(peak.rackDisplacement-(stroke+1)*g.toothPitch-g.seatingOvertravel)<1e-9);
  assert.equal(settling.drivingEngaged,true);assert.equal(settling.holdingEngaged,false);
  assert.ok(settling.rackSpeed<0 && settling.rackDisplacement>seated.rackDisplacement);
  assert.equal(seated.holdingEngaged,true);assert.equal(seated.drivingEngaged,false);
  assert.ok(Math.abs(seated.holdingToothSeatY-seated.holdingTip.y)<1e-9);
  assert.ok(Math.abs(seated.holdingTip.x-g.rootX)<1e-9);
 }
 assert.equal(g.rackToothCount,19);
 assert.ok(g.holdingBaseAngle>2.35 && g.holdingBaseAngle<2.60, 'upper stop slopes toward its source seat');
 assert.ok(g.toothPitch/g.eccentricDiskRadius>0.4 && g.toothPitch/g.eccentricDiskRadius<0.65);
 assert.ok(g.eccentricity/g.eccentricDiskRadius>0.55 && g.eccentricity/g.eccentricDiskRadius<0.7);
 // Both clicks happen once per stroke and are finite: the stop rides out a
 // full tooth depth before it drops, the lifting nose likewise on return.
 assert.ok(g.stopClick.jump>0.15 && g.driveClick.crest>g.toothDepth-0.01);
 assert.equal(d.minimumDisplayCycleSeconds,t.cycleDuration);
});

test('389 state queries and repeated updates preserve finite mesh allocations',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData;
 const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
 for(let i=0;i<1000;i++){d.stateAtTime(i/47);model.update(i/47);}
 const after=[];model.root.traverse(o=>after.push([o,o.geometry]));
 assert.deepEqual(after,before);
});

test('389 the load head sits directly on the rack top as drawn',()=>{
 const model=createMovementModel(catalog[388]),b=model.root.userData.blocks;
 model.root.updateMatrixWorld(true);
 const rack=new THREE.Box3().setFromObject(b.rackBody),head=new THREE.Box3().setFromObject(b.rackHead);
 assert.ok(Math.abs(head.min.y-rack.max.y)<1e-6);
 assert.ok(head.max.x-head.min.x>1.4);
});

test('389 both pawl noses seat fully in the root corner under a tooth flat face',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData,b=d.blocks,g=d.geometry,t=d.timeline;
 assert.equal(g.rackFaceX,g.rackBodyWidth/2,'the working face is the tooth root, not the tips');
 let driveSamples=0,holdSamples=0;
 for(let i=0;i<=2400;i++){
  const time=t.operatingDuration*i/2400,state=d.stateAtTime(time);
  if(state.drivingEngaged){
   driveSamples++;
   assert.ok(Math.abs(state.driveNose.x-g.rootX)<1e-12);
   assert.ok(Math.abs(state.driveNose.y-state.driveToothSeatY)<1e-9);
  }
  if(state.holdingEngaged){
   holdSamples++;
   assert.ok(state.holdingTip.distanceTo(new THREE.Vector3(g.rootX,state.holdingToothSeatY,0))<1e-9);
  }
 }
 assert.ok(driveSamples>600 && holdSamples>600);
 for(const [time,key,material] of [[.35*t.strokeDuration,'driveNose','driveMaterialToothIndex'],
   [.85*t.strokeDuration,'holdingTip','holdingMaterialToothIndex']]) {
  const state=d.stateAtTime(time);model.update(time);model.root.updateMatrixWorld(true);
  const tooth=b.rackTeeth.find(o=>o.userData.materialToothIndex===state[material]);
  const point=state[key].clone().setZ(0).applyMatrix4(tooth.matrixWorld.clone().invert());
  assert.ok(solidSurface(tooth.geometry).distance(point)<2e-7,'the nose point is the root corner of its tooth');
 }
 // Downward load reaction rotates the upper stop toward its seat. Its
 // clearing rotation has the opposite sign.
 const lever=new THREE.Vector3(g.rootX,g.stopSeatY,0).sub(g.holdingPivot);
 assert.ok(new THREE.Vector3().crossVectors(lever,new THREE.Vector3(0,-1,0)).z>0.5);
});
