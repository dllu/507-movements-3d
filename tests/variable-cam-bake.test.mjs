import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Box3,Vector3} from 'three';
import {makeBakedRigidMovement,sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {variableCamProfile} from '../src/simulation/mujoco-variable-cam/profile.js';
const bytes=fs.readFileSync('src/simulation/baked/assets/138.json.gz'),b=JSON.parse(gunzipSync(bytes));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('138 source trace and baked provenance match the reviewed reconstruction',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/138-outline-review.json'));
 assert(report.maximumErrorPixels<2.5);assert.equal(report.landmarks.length,20);
 assert.equal(hash(bytes),JSON.parse(fs.readFileSync('src/simulation/baked/assets/138.provenance.json')).assetSha256);
 for(const s of [...b.source.simulationSources,...b.source.geometrySources])assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert(b.source.maximumLoopSeamPixels<.01);assert(b.source.maximumLoopVelocitySeamPixelsPerSecond<.1);
 for(const t of [b.loopEnd,b.loopEnd+8,b.loopEnd+800]){
  const a=sampleBakedMotion(b,t-1e-7),z=sampleBakedMotion(b,t+1e-7);assert(Math.max(...a.map((v,i)=>Math.abs(v-z[i])))<1e-5);
 }
});
test('138 interpolated finite tip clears the cam and stays inside its guides and framing',()=>{
 const v=makeBakedRigidMovement(b,{slideBodies:['follower']}),profile=variableCamProfile(128).points;
 let minimumGap=Infinity;
 try{
  for(let i=0;i<=1200;i++){
   const t=i*.029713;v.update(t);const [angle,y]=sampleBakedMotion(b,t),c=Math.cos(angle),s=Math.sin(angle);
   const p=profile.map(([x,y])=>[c*x-s*y,s*x+c*y]);let top=-Infinity;
   for(let j=0;j<p.length;j++){
    const a=p[j],z=p[(j+1)%p.length],candidates=[a,z];
    for(const x of [-.12,0,.12])if((x-a[0])*(x-z[0])<0)candidates.push([x,a[1]+(x-a[0])/(z[0]-a[0])*(z[1]-a[1])]);
    for(const [x,y]of candidates)if(Math.abs(x)<=.1200000001)top=Math.max(top,y-2*Math.abs(x));
   }
   minimumGap=Math.min(minimumGap,y-top);
   assert(y+.24<201/51.25-11/51.25,'tip must remain below the lower guide');
   assert(y+309/51.25>312/51.25+11/51.25,'rod must reach through the upper guide');
   assert(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(v.root)));
   assert.equal(v.root.userData.blocks.follower.getWorldPosition(new Vector3()).x,0);
  }
  assert(minimumGap*51.25>-.1,`tip penetration ${-minimumGap*51.25} pixels`);
  v.update(1);v.reset();assert.deepEqual(Object.values(v.root.userData.state.qpos),b.motion[0].slice(1));
 }finally{v.dispose();}
});
