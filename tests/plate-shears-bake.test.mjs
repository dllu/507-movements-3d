import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {sampleBakedMotion,makeBakedRigidMovement} from '../src/simulation/baked/playback.js';
import {makePlateShearsGeometry} from '../src/simulation/mujoco-plate-shears/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const bytes=fs.readFileSync(new URL('../src/simulation/baked/assets/130.json.gz',import.meta.url)),b=JSON.parse(gunzipSync(bytes));
const provenance=JSON.parse(fs.readFileSync(new URL('../src/simulation/baked/assets/130.provenance.json',import.meta.url)));
test('130 bake matches its source provenance and loops continuously',()=>{
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),provenance.assetSha256);
 for(const s of b.source.simulationSources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const t of [b.loopEnd,b.loopEnd+4,b.loopEnd+400]){
  const a=sampleBakedMotion(b,t-1e-7),c=sampleBakedMotion(b,t+1e-7);assert(Math.max(...a.map((x,k)=>Math.abs(x-c[k])))<1e-5);
 }
 assert(b.source.maximumPenetrationPixels<.01);
 assert(b.object.geometries.every(g=>g.type==='BufferGeometry'));
});
test('130 gravity opens the jaw and blades have axial clearance throughout the stroke',()=>{
 const v=makeBakedRigidMovement(b,{}),jaw=v.root.getObjectByName('body:jaw');
 const [x,y]=b.source.mass.jaw.centroid;
 try{
  for(let i=0;i<b.motion.length;i+=20){
   const row=b.motion[i];v.update(row[0]);
   assert(x*Math.cos(row[2])-y*Math.sin(row[2])<0,'gravity must produce opening torque');
   const moving=new THREE.Box3().setFromObject(jaw);
   for(const name of ['fixed-jaw','base']){
    const fixed=new THREE.Box3().setFromObject(v.root.getObjectByName(name));
    assert(moving.min.z-fixed.max.z>.0029);
   }
   assert(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root)));
  }
 }finally{v.dispose();}
});
test('130 serialization preserves all source mesh transforms',()=>{
 const source=makePlateShearsGeometry(),cached=makeBakedRigidMovement(b,{});
 try{
  const original=[],copy=[];source.root.updateMatrixWorld(true);cached.root.updateMatrixWorld(true);
  source.root.traverse(o=>{if(o.isMesh)original.push(o);});cached.root.traverse(o=>{if(o.isMesh)copy.push(o);});
  assert.equal(original.length,copy.length);
  original.forEach((mesh,i)=>mesh.matrixWorld.elements.forEach((n,k)=>assert(Math.abs(n-copy[i].matrixWorld.elements[k])<1e-10)));
 }finally{disposeObject3D(source.root);cached.dispose();}
});
