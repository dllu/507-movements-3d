import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
const box=o=>new THREE.Box3().setFromObject(o);
const joins=(a,b)=>{const intersection=box(a).intersect(box(b));if(intersection.isEmpty())return false;const size=intersection.getSize(new THREE.Vector3());return Math.min(size.x,size.y,size.z)>.0001;};
test('132 round columns stand on their feet under the head, no undrawn platen guides are built, and every platen part clears the frame',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 try{
  v.root.updateMatrixWorld(true);
  assert.equal(b.platenGuides,undefined);
  let guides=0;v.root.traverse(o=>{if(/guide-at-platen-edge|wear-shoe-constraining-platen|web-joining-guide-shoes/.test(o.userData.role??''))guides++;});assert.equal(guides,0);
  for(let i=0;i<2;i++){
   const column=b.frameColumns[i],foot=b.frameFeet[i?2:0];assert(joins(column,foot));assert(joins(column,b.topFrameRails[0]));
   const size=box(column).getSize(new THREE.Vector3());assert(Math.abs(size.x-size.z)<1e-6,'column is turned round');
   const oldBottom=box(column).clone();oldBottom.min.y=d.bedTopY-.12;assert(!oldBottom.intersectsBox(box(foot)),'former column bottom must fail');
  }
  assert(joins(b.topFrameRails[0],b.topFrameRails[1]));assert(joins(b.topFrameRails[1],b.topFrameRails[2]));
  const fixed=[...b.frameColumns,...b.topFrameRails,...b.frameFeet,b.bed,b.upperBearingCollar];
  const moving=[];b.lowerAssembly.traverse(o=>{if(o.isMesh&&o.visible)moving.push(o);});
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);
   for(const mesh of moving){const m=box(mesh);for(const part of fixed)assert(!m.intersectsBox(box(part)),`${mesh.userData.role} intersects ${part.userData.role}`);}
  }
 }finally{disposeObject3D(v.root);}
});
