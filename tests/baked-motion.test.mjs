import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBakedBundle,sampleBakedMotion,makeBakedRigidMovement} from '../src/simulation/baked/playback.js';
test('baked assets load from raw gzip and browser-decoded HTTP responses',async()=>{
 const original=globalThis.fetch,expected={version:1},json=JSON.stringify(expected);
 try{
  for(const body of [gzipSync(json),json]){
   globalThis.fetch=async()=>new Response(body);
   assert.deepEqual(await loadBakedBundle('test-asset'),expected);
  }
  globalThis.fetch=async()=>new Response('',{status:404});
  await assert.rejects(loadBakedBundle('missing-asset'),/404/);
 }finally{globalThis.fetch=original;}
});
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/123.json.gz',import.meta.url))));
test('123 recording reproduces every native sample and preserves a continuous loop',()=>{
 for(const row of bundle.motion){const actual=sampleBakedMotion(bundle,row[0]);row.slice(1).forEach((x,i)=>assert(Math.abs(actual[i]-x)<1e-10));}
 for(const seam of [bundle.loopEnd,bundle.loopEnd+bundle.period,100*bundle.period+bundle.loopEnd]){
  const a=sampleBakedMotion(bundle,seam-1e-7),b=sampleBakedMotion(bundle,seam+1e-7);assert(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))<1e-5);
 }
 assert.throws(()=>sampleBakedMotion(bundle,-1),RangeError);
});
test('123 cached geometry has no procedural constructors and supports independent seeking and disposal',()=>{
 assert(bundle.object.geometries.every(g=>g.type==='BufferGeometry'&&!g.parameters));
 const v=makeBakedRigidMovement(bundle,{slideBodies:['rack']});
 try{v.update(123.4);const q={...v.root.userData.state.qpos};v.update(.2);v.update(123.4);assert.deepEqual(v.root.userData.state.qpos,q);v.reset();assert(Object.values(v.root.userData.state.qpos).every(x=>x===0));assert(v.root.getObjectByName('section-outline-of-double-rack'));assert.equal(v.root.userData.simulationBackend,'baked-mujoco');}finally{v.dispose();v.dispose();}
});
