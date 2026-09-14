import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeConjugateInternalRack,internalRackPitchPose,internalRackPitchDimensions} from '../src/simulation/mujoco-internal-rack/profile.js';
import {internalRackSuspension} from '../src/simulation/mujoco-internal-rack/suspension.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
test('139 tooth review records actual intersections in the previous geometry',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/139-tooth-review.json'));
 assert.equal(report.interferingPoses,360);assert(report.worst.area>.1);
 for(const s of report.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256);
});
test('139 generated nine-tooth pinion clears its conjugate opening between cutter samples',()=>{
 const p=makeConjugateInternalRack();
 let tips=0;const threshold=p.radius+.99*p.module;
 p.pinion.forEach((a,i)=>{const prev=p.pinion[(i+p.pinion.length-1)%p.pinion.length];if(Math.hypot(...a)>threshold&&Math.hypot(...prev)<=threshold)tips++;});
 assert.equal(tips,9);assert.equal(p.body.length,1);assert.equal(p.opening.length,1);
 for(let i=0;i<180;i++)assert.deepEqual(clip.intersection(p.body,p.at(p.pinion,(i+.173)/180)),[]);
 for(const phase of [p.span/p.length,1/2,.5+p.span/p.length,1]){
  const a=internalRackPitchPose(phase-1e-8),b=internalRackPitchPose(phase+1e-8);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-6);
 }
 const initial=internalRackPitchPose(p.sourcePhase);assert(Math.abs(initial.x+.05)<1e-12);assert.equal(initial.y,p.orbit);
 assert(Math.abs(p.rotationPerCycle/(2*Math.PI)-23/9)<1e-12);
});
test('139 fitted unequal cranks preserve the measured joints and close through the stroke',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/139-dimensions.json'));
 assert(report.maximumLandmarkErrorPixels<2.501);
 const d=internalRackPitchDimensions();
 for(let i=0;i<=360;i++){
  const s=internalRackSuspension(internalRackPitchPose(i/360).y);
  for(const side of ['left','right']){
   const p=s[side],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
   assert(Math.abs(distance(p.rackPin,p.wrist)-s.rodLength)<1e-12);
   assert(Math.abs(distance(p.pivot,p.wrist)-s.crankRadius)<1e-12);
   assert(Math.abs(distance(p.pivot,p.top)-s.topRadius)<1e-12);
  }
  assert(Math.abs(s.right.top[0]-s.left.top[0]-2.54)<1e-12);assert.equal(s.right.top[1],s.left.top[1]);
 }
 assert(Math.abs(100*(d.radius+d.module)-32)<.5);
});
test('139 native candidate has measured contact and closure evidence without claiming convergence',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/139-native-review.json'));
 for(const s of report.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 const candidate=report.runs.find(r=>r.counterMass===8&&r.timestep===.000125);
 assert(candidate);assert.equal(candidate.resets,0);
 assert(candidate.maximumPenetrationPixels<.05);
 assert(candidate.maximumSampledRodClosureErrorPixels<.05);
 assert(candidate.maximumPitchPathErrorPixels<1.1);
});
