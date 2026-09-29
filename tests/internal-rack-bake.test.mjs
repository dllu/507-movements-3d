import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Box3,Vector3} from 'three';
import {makeBakedRigidMovement,sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {internalRackPitchDimensions} from '../src/simulation/mujoco-internal-rack/profile.js';
const orbit=internalRackPitchDimensions().orbit;
const bytes=fs.readFileSync('src/simulation/baked/assets/139.json.gz'),b=JSON.parse(gunzipSync(bytes));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('139 baked native motion has current provenance and a continuous loop',()=>{
 assert.equal(hash(bytes),JSON.parse(fs.readFileSync('src/simulation/baked/assets/139.provenance.json')).assetSha256);
 for(const s of b.source.sources)assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert(bytes.length<1_300_000);assert(b.source.maximumPenetrationPixels<.05);
 assert(b.source.maximumLoopSeamPixels<.001);assert(b.source.maximumLoopVelocitySeamPixelsPerSecond<.001);
 const contact=JSON.parse(fs.readFileSync('docs/validation/139-playback-contact.json'));
 for(const s of contact.sources)assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert.equal(contact.samples,1600);assert(contact.maximumOverlapSquarePixels<.009);
 const refinement=JSON.parse(fs.readFileSync('docs/validation/139-refinement.json'));
 for(const s of refinement.sources)assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 for(const check of Object.values(refinement.comparisons))assert(check.maximumRackPositionDifferencePixels<.26);
 assert.equal(refinement.runs.long.resets,0);assert(refinement.runs.long.seconds>=32);
 for(const t of [b.loopEnd,b.loopEnd+8,b.loopEnd+800]){
  const a=sampleBakedMotion(b,t-1e-7),z=sampleBakedMotion(b,t+1e-7);assert(Math.max(...a.map((v,i)=>Math.abs(v-z[i])))<1e-5);
 }
});
test('139 interpolated suspension pins fit their bores and moving hardware stays framed',()=>{
 const v=makeBakedRigidMovement(b,{slideAxes:{frame:'x',rack:'y',couplerX:'x',coupler:'y'}}),blocks=v.root.userData.blocks;
 const point=(block,p)=>blocks[block].localToWorld(new Vector3(...p));
 let maxClosure=0;
 try{
  for(let i=0;i<=1200;i++){
   v.update(i*.029713);
   for(const [side,x]of [['left',-1.22],['right',1.32]]){
    const rodEnd=point(side+'Rod',[.01,-.575,0]),rackPin=point('rack',[x,.675-orbit,0]);
    maxClosure=Math.max(maxClosure,rodEnd.distanceTo(rackPin));
    const top=point(side+'Crank',[-.075,.58,0]),couplerEnd=point('coupler',[side==='left'?0:2.54,0,0]);
    assert(top.distanceTo(couplerEnd)<.00002,'interpolated coupler pin alignment');
   }
   assert(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(v.root)));
   const frameX=blocks.frame.position.x;
   for(const x of [-1.28,1.36])assert(x>frameX-2.40&&x<frameX+2.53,'support roller must stay beneath bottom rail');
   // p102: the soft native slide limit yields up to 0.0018 (0.18 px) at the bottom of the stroke.
   assert(Math.abs(blocks.rack.position.y)<orbit+.002,'rack stroke including native limit compliance');
  }
  assert(maxClosure<.0268*Math.cos(Math.PI/48)-.026,`pin misses its bore: ${maxClosure*100} pixels`);
  v.reset();assert.deepEqual(Object.values(v.root.userData.state.qpos),b.motion[0].slice(1));
 }finally{v.dispose();}
});
test('p101: 139 toothed rim is extruded to the collision depth and the backing sits behind it',()=>{
 const v=makeBakedRigidMovement(b,{slideAxes:{frame:'x',rack:'y',couplerX:'x',coupler:'y'}});
 const find=name=>{let found;v.root.traverse(o=>{if(o.name===name)found=o;});return found;};
 const rim=new Box3().setFromBufferAttribute(find('steel-tooth-rim').geometry.attributes.position);
 const backing=new Box3().setFromBufferAttribute(find('rack-backing').geometry.attributes.position);
 const pinion=new Box3().setFromBufferAttribute(find('pinion-teeth').geometry.attributes.position);
 assert(rim.max.z-rim.min.z>=.119,'rim is as deep as the native collision cells');
 assert(rim.min.z<=pinion.min.z&&rim.max.z>=pinion.max.z,'rim spans the pinion face');
 assert(backing.max.z<=rim.min.z+1e-9,'backing lies behind the rim');
});
