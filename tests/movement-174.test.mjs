import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import * as THREE from 'three';
import {makeBakedBenchClampModel} from '../src/simulation/baked/bench-clamp.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/174.json.gz',import.meta.url))));
test('174 retains measured screw centers and the source board position',()=>{
 const m=makeBakedBenchClampModel(bundle);try{
  const {parts}=m.root.userData;
  for(const [side,target]of [[0,[268,166]],[1,[274,359]]]){
   const p=parts['shaft'+side].getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(123+p.x/.012-target[0],264-p.y/.012-target[1])<1e-10);
  }
  const left=parts.board.localToWorld(new THREE.Vector3(-2.382,0,0));assert.ok(Math.abs(left.x/.012)<3.1);assert.ok(Math.abs(left.y/.012)<.5);
 }finally{m.dispose();}
});
test('174 completes a continuous six-second baked cycle with finite rendered transforms',()=>{
 const m=makeBakedBenchClampModel(bundle);try{
  const {parts}=m.root.userData,initial=Object.fromEntries(Object.entries(parts).map(([n,p])=>[n,[...p.matrixWorld.elements]]));
  for(let i=0;i<=120;i++){m.update(i/20);for(const p of Object.values(parts)){assert.ok(p.matrixWorld.elements.every(Number.isFinite));assert.equal(p.material.fog,false);}}
  for(const [name,p]of Object.entries(parts))p.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-initial[name][i])<1e-12));
  m.update(2);m.reset();for(const [name,p]of Object.entries(parts))assert.deepEqual(p.matrixWorld.elements,initial[name]);
  assert.equal(Object.keys(parts).length,16);assert.equal(m.root.userData.hideGround,true);
 }finally{m.dispose();}
});
test('174 turns both jaws open on withdrawal and shut on the pushed board each cycle',()=>{
 const m=makeBakedBenchClampModel(bundle);try{
  const {stateAtTime}=m.root.userData;let upper=[Infinity,-Infinity],lower=[Infinity,-Infinity];
  for(let i=0;i<=600;i++){const s=stateAtTime(i/100);upper=[Math.min(upper[0],s.upper),Math.max(upper[1],s.upper)];lower=[Math.min(lower[0],s.lower),Math.max(lower[1],s.lower)];}
  assert.ok(upper[1]-upper[0]>.08,'upper jaw turns on its screw');assert.ok(lower[1]-lower[0]>.08,'lower jaw turns on its screw');
  const s=stateAtTime(0);assert.ok(Math.abs(s.upper)<.01&&Math.abs(s.lower)<.01,'both jaws clamp the board at the source pose');
 }finally{m.dispose();}
});

test('174 (pass 104): the rear jaw contrasts with the front jaw, and the bench planks abut with grooved seams',()=>{
 const model=makeBakedBenchClampModel(bundle),parts=model.root.userData.parts;
 try{
  assert.notEqual(parts.jaw0.material.color.getHex(),parts.jaw1.material.color.getHex(),'jaws differ in colour');
  model.root.updateMatrixWorld(true);
  const boxes=[0,1,2].map(i=>new THREE.Box3().setFromObject(parts['bench'+i]));
  for(let i=0;i<2;i++)assert.ok(Math.abs(boxes[i].max.x-boxes[i+1].min.x)<1e-6,'planks abut: no see-through slit');
  const top=Math.max(...boxes.map(b=>b.max.z));
  const pos=parts.bench1.geometry.attributes.position;let seamTop=-Infinity;
  for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(parts.bench1.matrixWorld);
   if(Math.abs(p.x-boxes[1].min.x)<1e-6)seamTop=Math.max(seamTop,p.z);}
  assert.ok(seamTop<top-0.005&&seamTop>top-0.03,'seam edge chamfered into a shallow groove');
 }finally{model.dispose();}
});
