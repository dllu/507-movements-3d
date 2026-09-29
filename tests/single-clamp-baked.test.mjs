import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeBakedSingleClampModel} from '../src/simulation/baked/single-clamp.js';
import {solidSurface} from './helpers/solid-surface.mjs';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/180.json.gz',import.meta.url))));
test('180 retains source screw positions, open bores and recessed screw slots',()=>{
 const m=makeBakedSingleClampModel(bundle),p=m.root.userData.parts;
 try{
  for(const[name,target]of [['pivot',[354,300]],['fixed0',[192,180]],['fixed1',[192,450]]]){
   const center=p[name+'-shaft'].getWorldPosition(new THREE.Vector3());
   assert.ok(Math.hypot(280+center.x/.012-target[0],452-center.y/.012-target[1])<1e-10);
   assert.equal(solidSurface(p[name+'-head-cap'].geometry).inside(new THREE.Vector3(0,0,name==='pivot'?.315:.755)),false,'open slot');
  }
  assert.equal(solidSurface(p.jaw.geometry).inside(new THREE.Vector3()),false,'jaw has a pivot bore');
  const side=solidSurface(p['fixed-side'].geometry);
  for(const y of [180,450])assert.equal(side.inside(new THREE.Vector3((192-280)*.012,(452-y)*.012,.4)),false,'fixed plank screw bore');
 }finally{m.dispose();}
});
test('180 plays a continuous contact-driven six-second cycle and restarts exactly',()=>{
 const m=makeBakedSingleClampModel(bundle),u=m.root.userData;
 try{
  const initial=Object.fromEntries(Object.entries(u.parts).map(([n,p])=>[n,[...p.matrixWorld.elements]]));
  let lo=Infinity,hi=-Infinity,jawLo=Infinity,jawHi=-Infinity;
  for(let i=0;i<=180;i++){
   m.update(i/30);lo=Math.min(lo,u.kinematics.boardY);hi=Math.max(hi,u.kinematics.boardY);
   jawLo=Math.min(jawLo,u.kinematics.jaw);jawHi=Math.max(jawHi,u.kinematics.jaw);
   for(const p of Object.values(u.parts)){assert.ok(p.matrixWorld.elements.every(Number.isFinite));assert.equal(p.material.fog,false);}
  }
  assert.ok(hi-lo>.79&&hi-lo<.82,'board withdraws and returns to the clamp');
  assert.ok(jawHi-jawLo>.1,'the jaw visibly opens on withdrawal and turns shut as the board is pushed in');
  assert.ok(Math.abs(u.stateAtTime(0).jaw)<.01,'the jaw is closed on the board at the source pose');
  assert.equal(u.simulationBackend,'baked-mujoco');assert.equal(u.hideGround,true);assert.equal(Object.keys(u.parts).length,16);
  for(const[n,p]of Object.entries(u.parts))p.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-initial[n][i])<1e-12));
  m.update(2);m.reset();for(const[n,p]of Object.entries(u.parts))assert.deepEqual(p.matrixWorld.elements,initial[n]);
 }finally{m.dispose();}
});
test('180 (p109): the jaw tip stays inside the side-piece outline over the whole swing',()=>{
 const m=makeBakedSingleClampModel(bundle),p=m.root.userData.parts;
 try{
  p['fixed-side'].geometry.computeBoundingBox();const face=p['fixed-side'].geometry.boundingBox.min.x;let least=Infinity;
  for(let i=0;i<=240;i++){m.update(6*i/240);least=Math.min(least,new THREE.Box3().setFromObject(p.jaw).min.x);}
  assert.ok(least>face+0.02&&least<face+0.08,`jaw tip ${least} against face ${face}`);
 }finally{m.dispose();}
});
