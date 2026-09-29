import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {sampleBakedMotion,makeBakedRigidMovement} from '../src/simulation/baked/playback.js';
import {expansionEccentricProfile} from '../src/simulation/expansion-eccentric-profile.js';
const bytes=fs.readFileSync(new URL('../src/simulation/baked/assets/137.json.gz',import.meta.url)),b=JSON.parse(gunzipSync(bytes));
const provenance=JSON.parse(fs.readFileSync(new URL('../src/simulation/baked/assets/137.provenance.json',import.meta.url)));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('137 baked source provenance and loop position/velocity are checked',()=>{
 assert.equal(hash(bytes),provenance.assetSha256);
 for(const s of [...b.source.simulationSources,...b.source.geometrySources])assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert(b.source.maximumLoopSeamPixels<.05);
 assert(b.source.maximumLoopVelocitySeamPixelsPerSecond<.5);
 assert(b.source.maximumPenetrationPixels<.1);
 for(const t of [b.loopEnd,b.loopEnd+8,b.loopEnd+800]){
  const a=sampleBakedMotion(b,t-1e-7),c=sampleBakedMotion(b,t+1e-7);
  assert(Math.max(...a.map((x,k)=>Math.abs(x-c[k])))<.0003);
 }
 assert(b.object.geometries.every(g=>g.type==='BufferGeometry'));
 // Pass 97: one steady-state cycle only, starting at the engraved cam pose;
 // both rollers turn from the first frame.
 assert.equal(b.loopStart,0);assert(Math.abs(b.loopEnd-b.period)<1e-6);
 assert(Math.abs(b.motion[0][1])<.002);
 assert(b.source.steadyStateStart>=16);
 assert(b.source.kinematic.minimumLowerGapPixels>0&&b.source.kinematic.maximumLowerGapPixels<1.5);
 assert(b.source.kinematic.maximumUpperSimulatedSlipPixelsPerSecond<1);
 for(let t=0;t<b.period;t+=.25){
  const a=sampleBakedMotion(b,t),c=sampleBakedMotion(b,t+.1);
  for(const k of [2,3])assert(c[k]-a[k]<-.1,`roller ${k} stalls at ${t}s`);
 }
});
test('137 interpolated playback clears the cam and keeps the rod pin connected',()=>{
 const v=makeBakedRigidMovement(b,{}),profile=expansionEccentricProfile(b.source.options.samples),tip=new THREE.Vector3();
 let minimum=Infinity;
 try{
  for(let i=0;i<=800;i++){
   const t=i*.047123;v.update(t);const q=sampleBakedMotion(b,t),c=Math.cos(q[0]),s=Math.sin(q[0]);
   const polygon=profile.map(([x,y])=>[c*x-s*y,s*x+c*y]);
   for(const [name,radius] of [['upper',31],['lower',32]]){
    const block=v.root.userData.blocks[name],center=block.getWorldPosition(new THREE.Vector3()).multiplyScalar(100);
    let distance=Infinity;
    for(let j=0;j<polygon.length;j++){
     const a=polygon[j],z=polygon[(j+1)%polygon.length],dx=z[0]-a[0],dy=z[1]-a[1];
     const u=Math.max(0,Math.min(1,((center.x-a[0])*dx+(center.y-a[1])*dy)/(dx*dx+dy*dy)));
     distance=Math.min(distance,Math.hypot(center.x-a[0]-u*dx,center.y-a[1]-u*dy));
    }
    minimum=Math.min(minimum,distance-radius);
   }
   const lower=v.root.userData.blocks.lower.getWorldPosition(new THREE.Vector3());
   v.root.userData.blocks.rod.getWorldPosition(tip);assert(tip.distanceTo(lower)<1e-10);
   assert(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root)));
  }
  assert(minimum>-.1,`maximum penetration: ${-minimum} px`);
  v.update(1);v.reset();assert.deepEqual(Object.values(v.root.userData.state.qpos),b.motion[0].slice(1));
 }finally{v.dispose();}
});
