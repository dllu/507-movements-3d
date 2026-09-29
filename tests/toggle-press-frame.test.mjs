import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
const box=o=>new THREE.Box3().setFromObject(o);
const joins=(a,b)=>{const intersection=box(a).intersect(box(b));if(intersection.isEmpty())return false;const size=intersection.getSize(new THREE.Vector3());return Math.min(size.x,size.y,size.z)>.0001;};
test('132 round columns stand on their feet under the head, the platen ears wrap the columns, and every other platen part clears the frame',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 try{
  v.root.updateMatrixWorld(true);
  assert.equal(b.platenGuides,undefined);
  let guides=0;v.root.traverse(o=>{if(/guide-at-platen-edge|wear-shoe-constraining-platen|web-joining-guide-shoes/.test(o.userData.role??''))guides++;});assert.equal(guides,0);
  for(let i=0;i<2;i++){
   const column=b.frameColumns[i],foot=b.frameFeet[i];assert(joins(column,foot));assert(joins(column,b.topFrameRails[0]));
   const size=box(column).getSize(new THREE.Vector3());assert(Math.abs(size.x-size.z)<1e-6,'column is turned round');
   const oldBottom=box(column).clone();oldBottom.min.y=d.bedTopY-.12;assert(!oldBottom.intersectsBox(box(foot)),'former column bottom must fail');
  }
  // Pass 99: the bed stands on the plinths' ground; no separate centre foot.
  assert.equal(b.frameFeet.length,2);
  let centreFeet=0;v.root.traverse(o=>{if(/center-anvil-foot/.test(o.userData.role??''))centreFeet++;});assert.equal(centreFeet,0);
  for(const foot of b.frameFeet)assert(Math.abs(box(b.bed).min.y-box(foot).min.y)<1e-6,'bed and plinths share the ground');
  assert(Math.abs(box(b.bed).max.y-d.bedTopY)<1e-6);
  assert(joins(b.topFrameRails[0],b.topFrameRails[1]));assert(joins(b.topFrameRails[1],b.topFrameRails[2]));
  const fixed=[...b.frameColumns,...b.topFrameRails,...b.frameFeet,b.bed,b.upperBearingCollar];
  const moving=[],ears=[];b.lowerAssembly.traverse(o=>{if(!o.isMesh||!o.visible)return;(o.userData.role==='platen-guide-ear-wrapping-round-column'?ears:moving).push(o);});
  // Pass 96: one bored guide ear per platen end wraps its round column.
  assert.equal(ears.length,2);
  const earPoint=new THREE.Vector3();
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);
   for(const mesh of moving){const m=box(mesh);for(const part of fixed)assert(!m.intersectsBox(box(part)),`${mesh.userData.role} intersects ${part.userData.role}`);}
   if(i%24)continue;
   for(const ear of ears){
    const column=b.frameColumns[ear.userData.side==='left'?0:1],c=column.position,eb=box(ear),cb=box(column);
    assert(eb.min.x<c.x-.225&&eb.max.x>c.x+.225&&eb.min.z<c.z-.225,'ear wraps its column');
    let nearest=Infinity;const pos=ear.geometry.attributes.position;
    for(let k=0;k<pos.count;k++){earPoint.fromBufferAttribute(pos,k).applyMatrix4(ear.matrixWorld);nearest=Math.min(nearest,Math.hypot(earPoint.x-c.x,earPoint.z-c.z));}
    assert(nearest>.225+.003&&nearest<.225+.005,`ear bore running clearance ${nearest-.225}`);
    assert(eb.min.y>c.y-cb.getSize(new THREE.Vector3()).y/2+.2&&eb.max.y<c.y+cb.getSize(new THREE.Vector3()).y/2-.3,'ear rides on the plain shaft');
    for(const part of fixed.filter(p=>!b.frameColumns.includes(p)))assert(!eb.intersectsBox(box(part)),`ear intersects ${part.userData.role}`);
   }
  }
 }finally{disposeObject3D(v.root);}
});
