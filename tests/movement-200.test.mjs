import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,turn=2*Math.PI;
const model=()=>createAuthoredGearMovement(catalog[199]);
const near=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('200 has one inclined driving bevel and two independent loose wheels on one spindle',()=>{
 const m=model(),b=m.root.userData.blocks,u=m.root.userData;
 const gears=[];m.root.traverse(o=>{if(o.userData.toothMeshes)gears.push(o);});assert.equal(gears.length,3);assert.equal(u.transmission.rigidDriverSectionCount,1);
 assert.equal(b.driver.userData.teeth,24);assert.equal(b.upperOutput.userData.teeth,48);assert.equal(b.lowerOutput.userData.teeth,32);
 for(const gear of[b.upperOutput,b.lowerOutput]){assert.equal(gear.userData.looseOnCommonSpindle,true);assert.ok(gear.userData.boreRadius>.115);}
 assert.equal(b.commonSpindle.userData.stationary,true);assert.equal(u.sourceAnimation.available,false);assert.ok(u.geometry.inputAxis.y<0);assert.equal(u.hideGround,true);disposeObject3D(m.root);
});
test('200 three pitch cones share an apex and common module on both contact generators',()=>{
 const m=model(),b=m.root.userData.blocks,g=m.root.userData.geometry;
 near(g.tilt,Math.asin(1/3));
 for(const[output,point]of[[b.upperOutput,g.upperContactPoint],[b.lowerOutput,g.lowerContactPoint]]){
  near(g.inputAxis.angleTo(output.userData.axis),g.driverPitchConeAngle+output.userData.pitchConeAngle);
  near(point.angleTo(g.inputAxis),g.driverPitchConeAngle);near(point.angleTo(output.userData.axis),output.userData.pitchConeAngle);
  near(output.userData.outerDistance/Math.cos(output.userData.pitchConeAngle),g.coneDistance);
  near(2*output.userData.outerPitchRadius/output.userData.teeth,2*b.driver.userData.outerPitchRadius/b.driver.userData.teeth);
 }
 disposeObject3D(m.root);
});
test('200 finite differences and contact-point velocities preserve opposite unequal output speeds',()=>{
 const m=model(),u=m.root.userData,g=u.geometry,b=u.blocks;
 for(let i=0;i<=128;i++){
  const t=u.transmission.inputCyclePeriod*4*i/128,s=u.stateAtTime(t),next=u.stateAtTime(t+1e-5);
  near((next.upperOutputAngle-s.upperOutputAngle)/1e-5/s.inputAngularSpeed,-.5,1e-9);near((next.lowerOutputAngle-s.lowerOutputAngle)/1e-5/s.inputAngularSpeed,-.75,1e-9);
  for(const[output,point,speed]of[[b.upperOutput,g.upperContactPoint,s.upperOutputAngularSpeed],[b.lowerOutput,g.lowerContactPoint,s.lowerOutputAngularSpeed]]){
   const vin=new THREE.Vector3().crossVectors(g.inputAxis.clone().multiplyScalar(s.inputAngularSpeed),point),vout=new THREE.Vector3().crossVectors(output.userData.axis.clone().multiplyScalar(speed),point);assert.ok(vin.distanceTo(vout)<1e-12);
  }
  m.update(t);near(b.driver.userData.rotor.rotation.z,s.inputAngle);near(b.upperOutput.userData.rotor.rotation.z,s.upperOutputAngle);near(b.lowerOutput.userData.rotor.rotation.z,s.lowerOutputAngle);
 }
 const initial=u.stateAtTime(0),end=u.stateAtTime(u.transmission.inputCyclePeriod*4);near((end.inputAngle-initial.inputAngle)/turn,4);near((end.upperOutputAngle-initial.upperOutputAngle)/turn,-2);near((end.lowerOutputAngle-initial.lowerOutputAngle)/turn,-3);disposeObject3D(m.root);
});
