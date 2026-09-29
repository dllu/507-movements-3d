import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentShuttleDriveMovement as create} from '../src/simulation/authored-intermittent-shuttle-drives.js';
const m=create({id:397}),d=m.root.userData,g=d.geometry,T=d.motion.cycleDuration;
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('397 restores the source open crescent instead of a synthesized closed two-dwell loop',()=>{
 const curve=d.slotSynthesis.curve;assert.equal(curve.closed,false);
 assert.ok(curve.points[0].distanceTo(curve.points.at(-1))>1.9*g.crankRadius);
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
test('397 plain crescent gives a near-rest while the input continues moving, then a full stroke',()=>{
 let count=0,maxAngle=0,peak=0;
 for(let i=0;i<4096;i++){const s=d.stateAtTime(T*i/4096);peak=Math.max(peak,Math.abs(s.rockerAngularSpeed));if(!s.dwellActive)continue;count++;maxAngle=Math.max(maxAngle,Math.abs(s.rockerAngle));}
 // The rocker nearly rests (under a twentieth of the crank speed) for about a quarter of the turn,
 assert.ok(count/4096>.25&&count/4096<.45,`near-rest fraction ${count/4096}`);
 // creeping only a few degrees there, against a swing of about sixty.
 assert.ok(maxAngle<.12,`creep ${maxAngle}`);
 assert.ok(peak>10*(2*Math.PI/T)*.05);
 assert.ok(d.motion.outputStroke>3.8);
 // No hooks: the slot is one circular arc with rounded ends.
 const law=d.openCrescentLaw;for(let i=0;i<=64;i++){const q=law.pointAtRadius(law.low+(law.high-law.low)*i/64);near(q.distanceTo(law.arcCenter),law.arcRadius,1e-9,'slot centreline on one arc');}
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

test('397 crank pin stands on the crank eye\'s front face instead of sharing its wall', () => {
  m.update(0); m.root.updateMatrixWorld(true);
  const box = (role) => { let o; m.root.traverse((x) => { if (x.isMesh && x.userData.role === role) o = x; }); return new THREE.Box3().setFromObject(o); };
  const eye = box('eyed-input-crank-arm'), pin = box('crank-pin-running-in-synthesized-curved-slot');
  assert.ok(Math.abs(pin.min.z - eye.max.z) < 1e-6, `${pin.min.z} ${eye.max.z}`);
  assert.ok(Math.abs(pin.max.z - 0.61) < 1e-6);
});

test('397 p99: the crescent is Brown\'s slot arc, with the rocker upright at the drawn pose', () => {
  // Brown's slot centreline: an arc of radius 93.38 px about (380.52, 239.89) px from 127.4 to 239 degrees;
  // rocker pivot (325.9, 406.0) px; 79.7 px per unit.
  const S = 79.7, u = ([x, y]) => new THREE.Vector2((x - 325.9) / S, (406.0 - y) / S);
  const A = u([380.519, 239.893]), R = 93.38 / S;
  const brown = Array.from({length: 121}, (_, i) => { const t = (127.4 + (239 - 127.4) * i / 120) * Math.PI / 180; return A.clone().add(new THREE.Vector2(Math.cos(t), Math.sin(t)).multiplyScalar(R)); });
  const law = d.openCrescentLaw;
  const model = Array.from({length: 121}, (_, i) => law.pointAtRadius(law.low + (law.high - law.low) * i / 120));
  const dist = (P, Q) => Math.max(...P.map((p) => Math.min(...Q.map((q) => p.distanceTo(q)))));
  const hausdorff = Math.max(dist(brown, model), dist(model, brown)) * S;
  assert.ok(hausdorff < 19.5, `slot misfit ${hausdorff} px (p84 arc: 48)`);
  // The crank centre and drawn pin share the misfit: his are (380.1, 241.3) and (298.9, 193.8) px.
  const s0 = d.stateAtTime(0);
  assert.ok(g.crankCenter.clone().sub(g.rockerPivot).distanceTo(u([380.1, 241.3])) * S < 19.5);
  assert.ok(s0.inputPinWorld.clone().sub(g.rockerPivot).distanceTo(u([298.9, 193.8])) * S < 1);
  assert.ok(Math.abs(s0.rockerAngle) < 1e-6 && s0.dwellActive);
});
