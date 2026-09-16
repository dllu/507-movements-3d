import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
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
test('389 finite pawls clear every rendered rack tooth throughout power, return and released reset',()=>{
 const model=createMovementModel(catalog[388]),d=model.root.userData,b=d.blocks;
 sweep(model,checks([[b.driveBody,b.rackTeeth],[b.holdingPawlBody,b.rackTeeth]]),d.timeline.cycleDuration,257);
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
test('389 candidate pawl paths have bounded travel at two time resolutions',()=>{
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
