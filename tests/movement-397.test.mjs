import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentShuttleDriveMovement as create} from '../src/simulation/authored-intermittent-shuttle-drives.js';
const m=create({id:397}),d=m.root.userData,g=d.geometry,T=d.motion.cycleDuration;
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('397 restores the source open crescent instead of a synthesized closed two-dwell loop',()=>{
 const curve=d.slotSynthesis.curve;assert.equal(curve.closed,false);
 assert.ok(curve.points[0].distanceTo(curve.points.at(-1))>2);
 for(let i=1;i<curve.points.length;i++)assert.ok(Math.hypot(curve.points[i].x,curve.points[i].y)>Math.hypot(curve.points[i-1].x,curve.points[i-1].y));
 assert.equal(d.sourceAnimation.available,false);assert.match(d.sourceReference.constructionEvidence.reconstructionDisclosure,/open crescent/);
 assert.equal(create({id:398}),null);
});
test('397 constant-speed crank and rigid output link retain exact closure through the full open-slot cycle',()=>{
 for(let i=0;i<=2048;i++){const s=d.stateAtTime(T*i/2048);near(s.inputPinWorld.distanceTo(g.crankCenter),g.crankRadius,1e-13);near(s.inputAngularSpeed,2*Math.PI/T,1e-13);
  near(s.topJointWorld.distanceTo(s.sliderJointWorld),g.connectingRodLength,1e-12);near(s.sliderJointWorld.y,g.guideY,1e-13);
  const point=s.slotLocalPoint.clone().rotateAround(new THREE.Vector2(),s.rockerAngle).add(g.rockerPivot);assert.ok(point.distanceTo(s.inputPinWorld)<1e-12);
 }
});
test('397 both crank branches traverse the same single-valued crescent, forward and backward',()=>{
 const law=d.openCrescentLaw;
 for(let i=1;i<128;i++){
  const a=law.beta+Math.PI*i/128,opposite=2*law.beta-a;
  const states=[a,opposite].map(angle=>d.stateAtTime((angle-g.crankReferenceAngle)*T/(2*Math.PI)));
  assert.ok(states[0].slotLocalPoint.distanceTo(states[1].slotLocalPoint)<1e-12);
 }
});
test('397 circular middle groove supplies a real dwell while the input continues moving',()=>{
 let count=0;
 for(let i=0;i<4096;i++){const s=d.stateAtTime(T*i/4096);if(!s.dwellActive)continue;count++;near(s.rockerAngle,0,1e-12);near(s.rockerAngularSpeed,0,1e-12);near(s.sliderVelocity,0,1e-12);}
 assert.ok(count/4096>.29&&count/4096<.32);
 assert.ok(d.motion.outputStroke>4.5);
});
test('397 rounded-end closure is continuous and agrees with independent velocity differences',()=>{
 const h=1e-5;
 for(let i=0;i<2048;i++){
  const t=T*i/2048,s=d.stateAtTime(t),before=d.stateAtTime(t-h),after=d.stateAtTime(t+h);
  near((after.rockerAngle-before.rockerAngle)/(2*h),s.rockerAngularSpeed,2e-6);
  near((after.rockerAngularSpeed-before.rockerAngularSpeed)/(2*h),s.rockerAngularAcceleration,2e-4);
  near((after.sliderJointWorld.x-before.sliderJointWorld.x)/(2*h),s.sliderVelocity,1e-5);
 }
 const a=d.stateAtTime(-h),b=d.stateAtTime(h);assert.ok(Math.abs(a.rockerAngle-b.rockerAngle)<1e-3);
});
test('397 real bored rod eyes coincide with their finite pin axes',()=>{
 const b=d.blocks;
 for(let i=0;i<32;i++){const t=T*i/32;m.update(t);m.root.updateMatrixWorld(true);const s=d.stateAtTime(t);
  const start=b.connectingRod.localToWorld(new THREE.Vector3()),end=b.connectingRod.localToWorld(new THREE.Vector3(g.connectingRodLength,0,0));
  assert.ok(start.distanceTo(new THREE.Vector3(s.topJointWorld.x,s.topJointWorld.y,.8))<1e-12);
  assert.ok(end.distanceTo(new THREE.Vector3(s.sliderJointWorld.x,s.sliderJointWorld.y,.8))<1e-12);
 }
});
