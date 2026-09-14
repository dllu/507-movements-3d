import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {bandSawPathDimensions as d,bandSawPathLength as length,bandSawPoint as at,bandSawMotion} from '../src/simulation/band-saw-path.js';
test('141 measured review records finite teeth penetrating the old wheel tread',()=>{
 const r=JSON.parse(fs.readFileSync('docs/validation/141-review.json'));
 for(const s of r.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 assert.equal(r.contact.interferingPoses,64);assert(r.contact.maximumToothVertexDepthPixels>.46);
 assert(r.contact.rimRadialExcess>.005);assert(r.legacyWheelPitchRadiusPixels<47);assert.equal(r.measuredWheelRadiusPixels,50);
});
test('141 measured path has continuous tangents and constant-speed straight runs',()=>{
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 for(const s of [0,d.spacing,d.spacing+Math.PI*d.radius,2*d.spacing+Math.PI*d.radius,length]){
  const a=at(s-1e-8),b=at(s+1e-8);assert(distance(a.point,b.point)<3e-8);assert(distance(a.tangent,b.tangent)<1e-7);
 }
 for(let i=0;i<1000;i++){
  const s=(i+.371)*length/1000,a=at(s),b=at(s+1e-6);
  assert(Math.abs(distance(a.point,b.point)/1e-6-1)<1e-7);
  assert(Math.abs(a.tangent[0]*a.normal[0]+a.tangent[1]*a.normal[1])<1e-14);
  if(a.section==='cutting')assert.deepEqual(a.tangent,[0,-1]);
  if(a.section==='return')assert.deepEqual(a.tangent,[0,1]);
 }
 const motion=bandSawMotion(d.period);assert(Math.abs(motion.travel-length)<1e-12);
 assert(Math.abs(motion.speed+d.radius*motion.wheelAngularSpeed)<1e-14);
 assert(d.width/2>d.wheelFront,'tooth roots overhang the front of the tread');
});
