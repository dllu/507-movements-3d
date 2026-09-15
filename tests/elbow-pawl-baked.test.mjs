import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeElbowPawlModel} from '../src/simulation/baked/elbow-pawl.js';
import {makeElbowPawlGeometry} from '../src/simulation/mujoco-elbow-pawl/geometry.js';
import {makeElbowPawlPhysics} from '../src/simulation/mujoco-elbow-pawl/physics.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/155.json.gz'))),mujoco=await loadMujoco();
test('155 both baked installations track native startup and between-sample motion',()=>{
 const model=makeElbowPawlModel(bundle);
 try{for(const side of ['right','left']){
  const v=makeElbowPawlGeometry({side}),p=makeElbowPawlPhysics(mujoco,v,{timestep:.00025}),errors=[0,0,0,0,0];model.root.userData.setConfiguration(side);
  try{for(let tick=0;tick<=35200;tick++){
   if(tick%2===0){model.update(tick*p.timestep);bundle.installations[side].names.forEach((name,k)=>{errors[k]=Math.max(errors[k],Math.abs(model.root.userData.state.qpos[name]-p.data.qpos[k]));});}
   if(tick%800===0){mujoco.mj_forward(p.model,p.data);for(const name of ['carrier','rod','pawl','output','slider']){const b=p.bodies[name],position=model.root.userData.blocks[name].getWorldPosition(new THREE.Vector3());assert.ok(position.distanceTo(new THREE.Vector3(...p.data.xpos.slice(b*3,b*3+3)))<.0001,name);}}
   if(tick<35200)p.step();
  }
  console.log({side,maximumInterpolationErrors:errors});errors.forEach(e=>assert.ok(e<.002));
  }finally{p.dispose();v.dispose();}
 }}finally{model.dispose();}
});
test('155 configuration, bounds, fog, loop and restart are preserved',()=>{
 const model=makeElbowPawlModel(bundle);try{
  for(const side of ['right','left']){
   model.root.userData.setConfiguration(side);const initial=JSON.stringify(model.root.userData.state);
   for(let i=0;i<129;i++){model.update(8.8*(i+.137)/129);const active=model.root.children.find(r=>r.visible);assert.ok(model.root.userData.cameraFitBounds.clone().expandByScalar(1e-5).containsBox(new THREE.Box3().setFromObject(active,true)));}
   model.update(8.8-1e-8);const before=model.root.userData.state.qpos;model.update(8.8+1e-8);for(const [name,q]of Object.entries(before))assert.ok(Math.abs(q-model.root.userData.state.qpos[name])<1e-6);
   model.reset();assert.equal(JSON.stringify(model.root.userData.state),initial);
  }
  model.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
  assert.throws(()=>model.root.userData.setConfiguration('unknown'),RangeError);
 }finally{model.dispose();}
});
