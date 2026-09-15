import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import * as THREE from 'three';
import {makeSilkTraverseAssembly} from '../src/simulation/mujoco-silk-tappet/assembly.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/173-tappet.json.gz',import.meta.url))));
test('173 source wrist, wheel center and guide endpoint fit the measured engraving',()=>{
 const m=makeSilkTraverseAssembly(bundle);try{
 const {parts,geometry:g}=m.root.userData,project=p=>[g.center[0]+p.x/g.scale,g.center[1]-p.y/g.scale];
 const samples=[['wrist',parts.wrist.getWorldPosition(new THREE.Vector3()),[159,310],1.1],
 ['wheel',parts.hub.getWorldPosition(new THREE.Vector3()),[362,187],1e-8],
 ['rod end',parts.guideRod.localToWorld(new THREE.Vector3(340*g.scale,0,0)),[499,283],1.1]];
 for(const [name,p,expected,tolerance]of samples)assert.ok(Math.hypot(...project(p).map((x,i)=>x-expected[i]))<tolerance,name);
 }finally{m.dispose();}
});
test('173 baked assembly retains nut lead, horizontal guide and reset through its adjustment',()=>{
 const m=makeSilkTraverseAssembly(bundle);try{
 const {parts,geometry:g,stateAtTime}=m.root.userData,initial=stateAtTime(0);
 for(let i=0;i<=720;i++){
  const time=g.duration*i/720;m.update(time);const s=m.root.userData.kinematics;
  assert.ok(Math.abs(s.nutStation-g.nutInitial+(s.wheel-initial.wheel)*g.lead/(2*Math.PI))<1e-12);
  const pin=parts.wrist.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(pin.x-s.wrist[0],pin.y-s.wrist[1])<1e-12);
  assert.ok(Math.abs(parts.guideRod.getWorldPosition(new THREE.Vector3()).y)<1e-12);
  for(const mesh of Object.values(parts)){assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));assert.equal(mesh.material.fog,false);}
 }
 const end=stateAtTime(g.duration);m.update(1000);assert.equal(m.root.userData.kinematics.wheel,end.wheel);m.reset();assert.deepEqual(m.root.userData.kinematics,initial);
 assert.equal(Object.keys(parts).length,42);assert.equal(m.root.userData.hideGround,true);
 }finally{m.dispose();}
});
