import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamModel} from '../src/simulation/baked/twin-cam.js';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {twinCamLevers} from '../src/simulation/mujoco-twin-cam/source.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/149.json.gz')));
test('149 interpolated bake tracks native motion and keeps output pins aligned',async()=>{
 const p=makeTwinCamPhysics(await loadMujoco(),{timestep:.00025}),v=makeTwinCamModel(bundle);
 let maxPin=0,maxPosition=0;
 try{
  for(let tick=0;tick<=240000;tick++){
   if(tick>=216000&&(tick-216000)%10===0){
    const time=(tick-216000)*.00025;v.update(time);const actual=p.state(),state=v.root.userData.state.qpos;
    for(const name of bundle.names)maxPosition=Math.max(maxPosition,Math.abs(actual[name]-state[name]));
    for(const [i,side] of ['upper','lower'].entries()){
     const blocks=v.root.userData.blocks,a=blocks[side+'Rod'].localToWorld(new THREE.Vector3(0,-twinCamLevers[i].rodPinDistance,0)),b=blocks[side+'Slide'].getWorldPosition(new THREE.Vector3());
     maxPin=Math.max(maxPin,a.distanceTo(b));
     assert.ok(Math.abs(b.x-twinCamLevers[i].guideX)<1e-12);
    }
   }
   if(tick<240000)p.step();
  }
  console.log({maxPin,maxPosition});assert.ok(maxPin<.0001);assert.ok(maxPosition<.002);
 }finally{v.dispose();p.dispose();}
});
test('149 bake frames the whole cycle, disables fog and restarts exactly',()=>{
 const v=makeTwinCamModel(bundle);
 try{
  const initial=JSON.stringify(v.root.userData.state);
  for(let i=0;i<=120;i++){
   v.update(i*.05);const box=new THREE.Box3().setFromObject(v.root,true),fit=v.root.userData.cameraFitBounds;
   assert.ok(fit.clone().expandByScalar(1e-5).containsBox(box));
  }
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
  v.update(6-1e-7);const a=v.root.userData.state.qpos;v.update(6+1e-7);const b=v.root.userData.state.qpos;
  for(const n of bundle.names)assert.ok(Math.abs(a[n]-b[n])<1e-5,n);
 }finally{v.dispose();}
});
