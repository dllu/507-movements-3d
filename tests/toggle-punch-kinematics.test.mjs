import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {togglePunchGeometry as g,togglePunchAtAngle as at,togglePunchAtTime} from '../src/simulation/toggle-punch-kinematics.js';
test('140 diagnosis measures the engraving mismatch in the old handle',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/140-dimensions.json'));
 for(const s of report.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 assert(report.legacyLandmarks.find(p=>p.key==='handleEnd').errorPixels>60);
 assert(report.fitted.maximumClosureError<1e-12);assert.equal(report.fitted.maximumRamReversal,0);
});
test('140 engraving-fitted unequal toggle closes monotonically without branch jumps',()=>{
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let previous=at(0);
 for(let i=1;i<=2000;i++){
  const p=at(g.closedAngle*i/2000);
  assert(Math.abs(distance(g.top,p.knee)-g.upperLength)<1e-12);
  assert(Math.abs(distance(p.ram,p.knee)-g.lowerLength)<1e-12);
  assert(Math.abs(distance(p.pin,p.knee)-g.connectorLength)<1e-12);
  assert(p.ram[1]<=previous.ram[1]+1e-12);assert(distance(p.knee,previous.knee)<.002);
  previous=p;
 }
 assert(distance(previous.knee,g.closedKnee)<1e-12);assert(distance(previous.ram,g.closedRam)<1e-12);
 assert.deepEqual(togglePunchAtTime(6),togglePunchAtTime(0));
 assert.deepEqual(togglePunchAtTime(2.5),togglePunchAtTime(2.8));
});
