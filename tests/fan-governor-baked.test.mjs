import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeFanGovernorModel} from '../src/simulation/baked/fan-governor.js';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {solidSurface} from './helpers/solid-surface.mjs';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/147.json.gz',import.meta.url))));
test('147 baked interpolation retains track contact and closes the lift cycle',()=>{
 const model=makeFanGovernorModel(bundle),reference=makeFanGovernorGeometry({segments:320});
 try{
  const tracks=Object.entries(reference.root.userData.parts).filter(([n])=>n.startsWith('track_')).map(([,m])=>solidSurface(m.geometry));
  let separation=0,penetration=0;
  for(let i=0;i<=1200;i++){
   model.update(bundle.period*i/1200);
   const {blocks:b}=model.root.userData,center=b.roller0.getWorldPosition(new Vector3()).applyMatrix4(b.shaft.matrixWorld.clone().invert());
   const gap=Math.min(...tracks.map(s=>s.distance(center)))-.21;
   separation=Math.max(separation,gap);penetration=Math.max(penetration,-gap);
  }
  assert.ok(separation<.0005,`interpolated separation ${separation}`);
  assert.ok(penetration<.0005,`interpolated penetration ${penetration}`);
  model.update(bundle.period-1e-7);const before=model.root.userData.state;
  model.update(bundle.period+1e-7);const after=model.root.userData.state;
  assert.ok(Math.abs(before.lift-after.lift)<1e-6&&Math.abs(before.yaw-after.yaw)<1e-6);
 }finally{model.dispose();reference.dispose();}
});
test('147 baked bodies stay framed, ignore fog, and reset deterministically',()=>{
 const model=makeFanGovernorModel(bundle);
 try{
  const bounds=model.root.userData.cameraFitBounds.clone().expandByScalar(1e-6);let count=0;
  model.root.traverse(o=>{if(o.isMesh){count++;assert.equal(o.material.fog,false);}});assert.equal(count,9);
  for(let i=0;i<=64;i++){model.update(bundle.period*i/64);assert.ok(bounds.containsBox(new Box3().setFromObject(model.root,true)));}
  model.reset();const initial=structuredClone(model.root.userData.state);
  model.update(123);model.reset();assert.deepEqual(model.root.userData.state,initial);
 }finally{model.dispose();model.dispose();}
});
