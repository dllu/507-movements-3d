import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createAuthoredStrokeCrankMovement} from '../src/simulation/authored-stroke-cranks.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('175 engraving-fit linkage closes and crosses both tangencies continuously',()=>{
 const m=createAuthoredStrokeCrankMovement({id:175}),d=m.root.userData,g=d.geometry;try{
  for(const turn of [0,1e-7,.2,.5,.9999999,1,1.0000001,1.5,2]){
   const state=d.stateAtCrankTurnCoordinate(turn),h=1e-5,left=d.stateAtCrankTurnCoordinate(turn-h),right=d.stateAtCrankTurnCoordinate(turn+h);
   assert.ok(Math.abs(state.crankPin.distanceTo(state.sliderPin)-g.rodLength)<1e-12);
   assert.ok(Math.abs((right.pistonPosition-left.pistonPosition)/(2*h)-state.pistonVelocityPerTurn)<1e-7);
   assert.ok(Math.abs(state.sliderPin.x-g.guideOffset)<1e-12);
  }
  m.update(0);m.root.updateMatrixWorld(true);const b=d.blocks;
  const crank=b.crankPinAnchor.getWorldPosition(new THREE.Vector3()),rod=b.rodCrankEyeAnchor.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.hypot(crank.x-rod.x,crank.y-rod.y)<1e-12);
  const slider=b.sliderPinAnchor.getWorldPosition(new THREE.Vector3()),end=b.rodSliderEyeAnchor.getWorldPosition(new THREE.Vector3());assert.ok(slider.distanceTo(end)<1e-12);
 }finally{disposeObject3D(m.root);}
});
test('175 fitted pose preserves the engraved shaft and guide with documented crank departure',()=>{
 const m=createAuthoredStrokeCrankMovement({id:175}),d=m.root.userData;try{
  const s=d.stateAtTime(0),project=p=>[199+p.x/.012,235-p.y/.012],crank=project(s.crankPin),slider=project(s.sliderPin);
  assert.ok(Math.hypot(crank[0]-246,crank[1]-296)<32.4);assert.ok(Math.abs(slider[0]-354)<1e-12);assert.ok(Math.abs(slider[1]-419)<4.8);
  assert.equal(d.minimumDisplayCycleSeconds,8);assert.equal(d.hideGround,true);
 }finally{disposeObject3D(m.root);}
});
