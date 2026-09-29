import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeStudReverserModel} from '../src/simulation/baked/stud-reverser.js';
import {makeStudReverserPhysics} from '../src/simulation/mujoco-stud-reverser/physics.js';
import {FLAT_INPUT_ARM} from '../src/simulation/mujoco-stud-reverser/geometry.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/153.json.gz')));
test('153 interpolated baked motion tracks passive native dynamics between samples',async()=>{
 const p=makeStudReverserPhysics(await loadMujoco(),{...FLAT_INPUT_ARM,barFriction:2,timestep:.000125}),v=makeStudReverserModel(bundle),errors=[0,0,0];
 try{for(let tick=0;tick<=576000;tick++){
  if(tick>=480000&&(tick-480000)%4===0){const time=(tick-480000)*.000125;v.update(time);const s=v.root.userData.state.qpos;['disk','bar','lever'].forEach((name,k)=>{errors[k]=Math.max(errors[k],Math.abs(s[name]-p.data.qpos[k]));});}
  if(tick<576000)p.step();
 }
 console.log({maximumInterpolationErrors:errors});assert.ok(errors[0]<.001);assert.ok(errors[1]<.001);assert.ok(errors[2]<.003);
 }finally{v.dispose();p.dispose();}
});
test('153 bake preserves bounds, fog settings, periodic closure and exact restart',()=>{
 const v=makeStudReverserModel(bundle);try{
  const initial=JSON.stringify(v.root.userData.state);
  // The plain back support (behind and below the recorded bounds) is not framed.
  const moving=()=>{const box=new THREE.Box3();v.root.traverse(o=>{if(o.isMesh&&!o.userData.runsPastCrop)box.expandByObject(o,true);});return box;};
  assert.ok(v.root.userData.backSupport?.parent===v.root);
  for(let i=0;i<129;i++){v.update(12*(i+.317)/129);assert.ok(v.root.userData.cameraFitBounds.clone().expandByScalar(1e-5).containsBox(moving()));}
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
  v.update(12-1e-8);const before=v.root.userData.state.qpos;v.update(12+1e-8);const after=v.root.userData.state.qpos;for(const name of bundle.names)assert.ok(Math.abs(before[name]-after[name])<1e-6,name);
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});
