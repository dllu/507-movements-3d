import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeConjugateInternalRack,internalRackPitchPose} from '../src/simulation/mujoco-internal-rack/profile.js';
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
 for(const phase of [1/3,1/2,5/6,1]){
  const a=internalRackPitchPose(phase-1e-8),b=internalRackPitchPose(phase+1e-8);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-6);
 }
 const initial=internalRackPitchPose(2/3);assert(Math.abs(initial.x)<1e-12);assert.equal(initial.y,p.radius);
});
