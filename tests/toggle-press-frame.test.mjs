import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
const box=o=>new THREE.Box3().setFromObject(o);
const joins=(a,b)=>{const intersection=box(a).intersect(box(b));if(intersection.isEmpty())return false;const size=intersection.getSize(new THREE.Vector3());return Math.min(size.x,size.y,size.z)>.0001;};
test('132 frame members join their supports and the platen clears them through its full stroke',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 try{
  v.root.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
   const column=b.frameColumns[i],foot=b.frameFeet[i?2:0];assert(joins(column,foot));assert(joins(column,b.topFrameRails[0]));
   const [rear,front,web]=[b.platenGuides[i].children[0],b.platenGuides[i].children[1],b.platenGuides[i].children[2]];
   assert(joins(rear,column));assert(joins(rear,web));assert(joins(front,web));
   const oldBottom=box(column).clone();oldBottom.min.y=d.bedTopY-.12;assert(!oldBottom.intersectsBox(box(foot)),'former column bottom must fail');
  }
  assert(joins(b.topFrameRails[0],b.topFrameRails[1]));assert(joins(b.topFrameRails[1],b.topFrameRails[2]));
  const fixed=[...b.frameColumns,...b.topFrameRails,...b.frameFeet,b.bed,b.upperBearingCollar,...b.platenGuides.flatMap(g=>g.children)];
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);
   const moving=box(b.lowerAssembly);
   for(const part of fixed)assert(!moving.intersectsBox(box(part)),`platen assembly intersects ${part.userData.role}`);
   for(const guide of b.platenGuides){const g=box(guide);assert(Math.min(g.max.y,moving.max.y)-Math.max(g.min.y,moving.min.y)>.2,'guide must overlap the moving platen vertically');}
  }
 }finally{disposeObject3D(v.root);}
});
