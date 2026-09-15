import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeWaveCamModel} from '../src/simulation/baked/wave-cam.js';
import {makeWaveCamContactSolver} from '../src/simulation/mujoco-wave-cam/quasistatic.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/165.json.gz',import.meta.url))));

test('165 baked motion follows independently refined contact poses',()=>{
 const v=makeWaveCamModel(bundle),solver=makeWaveCamContactSolver({samples:512});
 try{
  for(let i=0;i<97;i++){
   const time=12*((i*.6180339887498949)%1);v.update(time);const s=v.root.userData.state,reference=solver.solve(2*Math.PI*time/12);
   assert.ok(Math.abs(s.rocker-reference.rocker)<3e-6);
   const actual=new THREE.Vector3();v.root.userData.parts.rollerPin.getWorldPosition(actual);
   assert.ok(Math.hypot(actual.x-s.rollerCenter[0],actual.y-s.rollerCenter[1])<1e-10);
   assert.ok(s.shoeX>=-.12&&s.shoeX<=.015);
  }
 }finally{v.dispose();}
});

test('165 playback loops, restarts, and remains inside its framing bounds',()=>{
 const v=makeWaveCamModel(bundle);try{
  const initial=v.root.userData.state;v.update(12);assert.ok(Math.abs(v.root.userData.state.outputY-initial.outputY)<1e-10);
  for(let i=0;i<=32;i++){v.update(12*i/32);const actual=new THREE.Box3().setFromObject(v.root,true);assert.ok(v.root.userData.cameraFitBounds.containsBox(actual));}
  v.reset();assert.deepEqual(v.root.userData.state,initial);assert.equal(v.root.userData.simulationBackend,'baked-quasistatic');
 }finally{v.dispose();}
 assert.throws(()=>v.update(0),/disposed/);
});
