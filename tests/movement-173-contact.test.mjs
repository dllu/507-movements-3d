import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSilkTappetPhysics} from '../src/simulation/mujoco-silk-tappet/physics.js';
import {makeSilkTappetSolids} from '../src/simulation/mujoco-silk-tappet/solids.js';
import {sampleSilkTappetMotion} from '../src/simulation/mujoco-silk-tappet/playback.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/173-tappet.json.gz',import.meta.url))));

test('173 visible tappet teeth match MuJoCo positions, axes and dimensions',async()=>{
 const m=await loadMujoco(),p=makeSilkTappetPhysics(m),v=makeSilkTappetSolids(p.parameters);
 try {
  for(const time of [0,.19,.22,.4,4.2]){
   while(p.data.time<time-p.timestep/2)p.step();
   m.mj_kinematics(p.model,p.data);v.update(p.state());
   for(const [name,mesh] of Object.entries(v.parts)){
    const id=p.id('mjOBJ_GEOM',name),center=mesh.getWorldPosition(new THREE.Vector3());
    assert.ok(center.distanceTo(new THREE.Vector3(...p.data.geom_xpos.slice(id*3,id*3+3)))<1e-11,name+' center');
    if(name.startsWith('tooth')){
     const basis=new THREE.Matrix4().extractRotation(mesh.matrixWorld);
     for(let row=0;row<3;row++)for(let col=0;col<3;col++)assert.ok(Math.abs(basis.elements[col*4+row]-p.data.geom_xmat[id*9+row*3+col])<1e-11,name+' axes');
     const size=mesh.geometry.parameters;
     [size.width,size.height,size.depth].forEach((x,i)=>assert.ok(Math.abs(x/2-p.model.geom_size[id*3+i])<1e-12,name+' size'));
    }
   }
  }
 }finally{v.dispose();p.dispose();}
});

test('173 contact bake is monotone and stops at finite screw travel',()=>{
 let previous=-Infinity;
 for(let i=0;i<=144000;i++){
  const state=sampleSilkTappetMotion(bundle,i*.0005);
  assert.ok(Number.isFinite(state.carrier)&&Number.isFinite(state.wheel));
  assert.ok(state.wheel>=previous-1e-12);previous=state.wheel;
 }
 assert.deepEqual(sampleSilkTappetMotion(bundle,72),sampleSilkTappetMotion(bundle,1000));
 assert.throws(()=>sampleSilkTappetMotion(bundle,-1),RangeError);
 assert.throws(()=>sampleSilkTappetMotion(bundle,NaN),RangeError);
});
