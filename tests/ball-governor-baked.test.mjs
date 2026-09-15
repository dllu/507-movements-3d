import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorModel} from '../src/simulation/baked/ball-governor.js';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/161.json.gz')));
test('161 baked midpoint interpolation agrees with native governor coordinates',async()=>{
 const p=makeBallGovernorPhysics(await loadMujoco()),v=makeBallGovernorModel(bundle);let phase,maximum=0;
 try{
  const start=Math.round(1592/p.timestep),end=Math.round(1600/p.timestep);
  for(let tick=0;tick<=end;tick++){
   if(tick===start)phase=p.state().spindle;
   if(tick>=start&&tick%8===4){
    v.update((tick-start)*p.timestep);const s=p.state(),b=v.root.userData.state;
    maximum=Math.max(maximum,Math.abs(s.spindle-phase-b.spindle),Math.abs(s.leftSpread-b.leftSpread),Math.abs(s.rightSpread-b.rightSpread),Math.abs(s.sleeveY-b.sleeveY));
   }
   if(tick<end)p.step();
  }
  console.log({maximumNativeInterpolationError:maximum});assert.ok(maximum<1e-5);
 }finally{v.dispose();p.dispose();}
});
test('161 arbitrary-cycle bounds, unwrapped seam, fog and restart remain correct',()=>{
 const v=makeBallGovernorModel(bundle);try{
  const initial=JSON.stringify(v.root.userData.state);
  for(let i=0;i<257;i++){v.update(32*(i+.317)/257);assert.ok(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));}
  v.update(8-1e-8);const before=v.root.userData.state;v.update(8+1e-8);const after=v.root.userData.state;
  for(const key of ['spindle','leftSpread','rightSpread','sleeveY'])assert.ok(Math.abs(before[key]-after[key])<1e-6);
  v.update(8);assert.ok(Math.abs(v.root.userData.state.spindle-bundle.turns[0])<1e-10);assert.ok(bundle.turns[0]>6*Math.PI);
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});
