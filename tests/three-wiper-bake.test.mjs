import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {sampleBakedMotion,makeBakedRigidMovement} from '../src/simulation/baked/playback.js';
import {makeThreeWiperGeometry} from '../src/simulation/mujoco-three-wiper/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const bytes=fs.readFileSync(new URL('../src/simulation/baked/assets/128.json.gz',import.meta.url)),b=JSON.parse(gunzipSync(bytes));
const provenance=JSON.parse(fs.readFileSync(new URL('../src/simulation/baked/assets/128.provenance.json',import.meta.url)));
test('128 collision prisms cover the connected visible frame without filling its opening',()=>{
 const v=makeThreeWiperGeometry(),u=v.root.userData;
 try{
  assert.equal(u.polygon.length,1);
  const ringArea=r=>Math.abs(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
  const visibleArea=u.polygon.reduce((sum,rings)=>sum+ringArea(rings[0])-rings.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
  const collisionArea=u.cells.reduce((sum,cell)=>{const [a,b,c]=cell;const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;assert(area>5e-13);return sum+area;},0);
  assert(Math.abs(visibleArea-collisionArea)<1e-10);
 }finally{disposeObject3D(v.root);}
});
test('128 asset retains its native source provenance and a continuous unwrapped loop',()=>{
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),provenance.assetSha256);
 for(const s of b.source.simulationSources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const t of [b.loopEnd,b.loopEnd+6,b.loopEnd+600]){
  const a=sampleBakedMotion(b,t-1e-7),c=sampleBakedMotion(b,t+1e-7);assert(Math.max(...a.map((x,k)=>Math.abs(x-c[k])))<1e-5);
 }
 assert(b.source.maximumPenetrationPixels<.1);
 assert(b.object.geometries.every(g=>g.type==='BufferGeometry'));
});
test('128 playback translates only the frame along X and stays framed for its full recorded motion',()=>{
 const v=makeBakedRigidMovement(b,{slideAxes:{frame:'x'}}),frame=v.root.getObjectByName('body:frame'),rotor=v.root.getObjectByName('body:rotor');
 try{
  for(let i=0;i<b.motion.length;i+=20){
   const row=b.motion[i];v.update(row[0]);assert(Math.abs(frame.position.x-row[2])<1e-10);assert(Math.abs(rotor.rotation.z-row[1])<1e-10);
   assert(Math.abs(frame.position.y)<1e-12);assert(Math.abs(frame.rotation.z)<1e-12);
   const box=new THREE.Box3().setFromObject(v.root);assert(v.root.userData.cameraFitBounds.containsBox(box));
  }
  v.reset();assert.equal(frame.position.x,.03);assert.equal(rotor.rotation.z,Math.PI/6);
 }finally{v.dispose();v.dispose();}
});
test('128 cached rotor preserves every source mesh transform, including its three arms and heads',()=>{
 const source=makeThreeWiperGeometry(),cached=makeBakedRigidMovement(b,{slideAxes:{frame:'x'}});
 try{
  source.root.userData.blocks.frame.position.x=.03;source.root.updateMatrixWorld(true);
  const original=source.root.userData.blocks.rotor.children,copy=cached.root.getObjectByName('body:rotor').children;
  assert.equal(original.length,8);assert.equal(copy.length,original.length);
  original.forEach((mesh,i)=>{
   assert(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).distanceTo(new THREE.Vector3().setFromMatrixPosition(copy[i].matrixWorld))<1e-10);
   assert(new THREE.Quaternion().setFromRotationMatrix(mesh.matrixWorld).angleTo(new THREE.Quaternion().setFromRotationMatrix(copy[i].matrixWorld))<1e-7);
  });
 }finally{disposeObject3D(source.root);cached.dispose();}
});
