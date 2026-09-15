import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadleModel} from '../src/simulation/baked/spring-treadle.js';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/160.json.gz')));
test('160 interpolated bake tracks native motion and preserves leaf lengths',async()=>{
 const p=makeSpringTreadlePhysics(await loadMujoco(),bundle.parameters),v=makeSpringTreadleModel(bundle);let maximum=0;
 try{
  for(let tick=0;tick<=256000;tick++){
   if(tick>=192000&&tick%32===16){const t=(tick-192000)*p.timestep;v.update(t);const native=p.state(),s=v.root.userData.state;
    for(const name of ['upper','lower','foot'])maximum=Math.max(maximum,Math.hypot(...native[name].map((x,i)=>x-s[name][i])));
    s.leafPoints.slice(1).forEach((x,i)=>assert.ok(Math.abs(Math.hypot(...x.map((v,k)=>v-s.leafPoints[i][k]))-bundle.rest.lengths[i])<1e-12));
   }
   if(tick<256000)p.step();
  }
  console.log({maximumNativeInterpolationError:maximum});assert.ok(maximum<.00005);
 }finally{v.dispose();p.dispose();}
});
test('160 baked bounds, buffers, loop seam and restart remain stable',()=>{
 const v=makeSpringTreadleModel(bundle);try{
  const initial=JSON.stringify(v.root.userData.state),band=v.root.getObjectByName('band').geometry,leaf=v.root.getObjectByName('leaf').geometry;
  for(let i=0;i<257;i++){v.update(4*(i+.317)/257);assert.ok(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));}
  assert.equal(v.root.getObjectByName('band').geometry,band);assert.equal(v.root.getObjectByName('leaf').geometry,leaf);
  v.update(4-1e-8);const before=v.root.userData.state;v.update(4+1e-8);const after=v.root.userData.state;
  for(const n of ['upper','lower','foot'])assert.ok(Math.hypot(...before[n].map((x,i)=>x-after[n][i]))<1e-6);
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});
