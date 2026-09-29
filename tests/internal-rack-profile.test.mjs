import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {assertHistoricalSources} from './helpers/historical-source.mjs';
import {makeConjugateInternalRack,internalRackPitchPose,internalRackPitchDimensions} from '../src/simulation/mujoco-internal-rack/profile.js';
import {internalRackSuspension} from '../src/simulation/mujoco-internal-rack/suspension.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
test('139 tooth review records actual intersections in the previous geometry',t=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/139-tooth-review.json'));
 assert.equal(report.interferingPoses,360);assert(report.worst.area>.1);
 assertHistoricalSources(report,t);
});
test('139 generated ten-tooth pinion (Brown draws about ten) clears its conjugate opening between cutter samples',()=>{
 const p=makeConjugateInternalRack();
 let tips=0;const threshold=p.radius+.99*p.module;
 p.pinion.forEach((a,i)=>{const prev=p.pinion[(i+p.pinion.length-1)%p.pinion.length];if(Math.hypot(...a)>threshold&&Math.hypot(...prev)<=threshold)tips++;});
 assert.equal(tips,10);assert.equal(p.body.length,1);assert.equal(p.opening.length,1);
 for(let i=0;i<180;i++)assert.deepEqual(clip.intersection(p.body,p.at(p.pinion,(i+.173)/180)),[]);
 for(const phase of [p.span/p.length,1/2,.5+p.span/p.length,1]){
  const a=internalRackPitchPose(phase-1e-8),b=internalRackPitchPose(phase+1e-8);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-6);
 }
 const initial=internalRackPitchPose(p.sourcePhase);assert(Math.abs(initial.x+.05)<1e-12);assert.equal(initial.y,p.orbit);
 assert(Math.abs(p.rotationPerCycle/(2*Math.PI)-26/10)<1e-12);
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
 // p107 (20-degree involute): rod closure 0.036 px; the passive rack lags
 // the ideal pitch path by up to 1.32 px in the end turns.
 assert(candidate.maximumSampledRodClosureErrorPixels<.06);
 assert(candidate.maximumPitchPathErrorPixels<1.4);
});
test('p107: 139 is an ideal 20-degree involute pinion with trapezoidal basic-rack teeth on the straight runs',()=>{
 const p=makeConjugateInternalRack({sweepSteps:512});
 assert.equal(p.options.tooth.pressureAngle,20*Math.PI/180);assert.equal(p.options.tooth.cutterTipRadius,undefined);
 // Rack material along thin strips across the upper straight row: the teeth
 // (pointing down from the rim towards the pinion's pitch line) are wider at
 // their roots than at their tips, by the 20-degree flank taper.
 const {radius,module,orbit,halfSpan}=p,pitchY=orbit+radius;
 const width=y=>{const strip=[[[[-halfSpan+.1,y-.0005],[halfSpan-.1,y-.0005],[halfSpan-.1,y+.0005],[-halfSpan+.1,y+.0005],[-halfSpan+.1,y-.0005]]]];
  return clip.intersection(p.body,strip).reduce((sum,q)=>{const xs=q[0].map(v=>v[0]);return sum+Math.max(...xs)-Math.min(...xs);},0);};
 const n=(2*halfSpan-.2)/(Math.PI*module),nearRoot=width(pitchY+.6*module)/n,nearTip=width(pitchY-.8*module)/n;
 const expected=2*Math.tan(20*Math.PI/180)*1.4*module;
 assert(Math.abs(nearRoot-nearTip-expected)<.25*expected,`taper ${nearRoot-nearTip} vs ${expected}`);
 assert(nearRoot<Math.PI*module*.75&&nearTip>Math.PI*module*.25,'trapezoid, neither pointed nor square');
});
