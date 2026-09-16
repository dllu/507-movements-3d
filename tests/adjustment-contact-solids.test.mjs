import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const bounds=o=>new THREE.Box3().setFromObject(o,true);
function clear(moving,points,target,surface){
 const matrix=target.matrixWorld.clone().invert().multiply(moving.matrixWorld);
 let gap=Infinity,count=0;
 for(const point of points){const p=point.clone().applyMatrix4(matrix);if(surface.box.distanceToPoint(p)>.02)continue;
  const distance=surface.signedDistance(p,.02);assert.ok(distance>=-1e-6,`${moving.userData.role} into ${target.userData.role}: ${distance}`);gap=Math.min(gap,distance);count++;
 }
 return {gap,count};
}
test('381 wedges actually overlap the board, match the inclined dovetail and reach finite-area contact without intrusion',()=>{
 const {root,update}=createMovementModel(catalog[380]),b=root.userData.blocks,g=root.userData.geometry;
 const targets=[...b.cheeks,b.workpiece].map(o=>[o,solidSurface(o.geometry)]);
 const points=b.wedges.map(o=>surfacePoints(o.geometry));
 for(let i=0;i<=64;i++){
  update(g.demonstrationPeriod*i/64);root.updateMatrixWorld(true);
  for(let j=0;j<2;j++){
   for(const [target,surface]of targets)clear(b.wedges[j],points[j],target,surface);
   const wb=bounds(b.wedges[j]),wood=bounds(b.workpiece);
   assert.ok(Math.min(wb.max.x,wood.max.x)-Math.max(wb.min.x,wood.min.x)>.44);
  }
 }
 update(g.demonstrationPeriod/2);root.updateMatrixWorld(true);
 for(let j=0;j<2;j++){
  const w=bounds(b.wedges[j]),wood=bounds(b.workpiece);
  assert.ok(Math.abs(j===0?w.max.z-wood.min.z:w.min.z-wood.max.z)<1e-6);
 }
 assert.equal(root.userData.hideGround,true);
});
test('382 stem, hinge pin and offset mirror clear their real bored supports across all three adjustments',()=>{
 const {root,update}=createMovementModel(catalog[381]),b=root.userData.blocks;
 const checks=[
  [b.stemCore,[b.pillar,b.socketCollar,b.socketBoss,b.socketScrewCore,b.mirrorGlass,...b.mirrorFrameBars,b.centerHingeBarrel]],
  [b.hingeScrewCore,[...b.hingeOuterBarrels,b.centerHingeBarrel,b.mirrorBackBracket]],
  [b.socketScrewCore,[b.socketCollar,b.socketBoss]],
  [b.socketThread,[b.socketCollar,b.socketBoss,b.stemCore]],
  [b.hingeThread,[...b.hingeOuterBarrels,b.centerHingeBarrel]],
  [b.mirrorBackBracket,[b.stemCore,b.yokeBridge]],
 ].map(([moving,targets])=>[moving,surfacePoints(moving.geometry),targets.map(o=>[o,solidSurface(o.geometry)])]);
 for(let i=0;i<=64;i++){
  update(6*i/64);root.updateMatrixWorld(true);
  for(const [moving,points,targets]of checks)for(const [target,surface]of targets)clear(moving,points,target,surface);
 }
 assert.equal(root.userData.hideGround,true);
});
test('399 both finite male/female thread pairs remain phased without penetration through two full tightening turns',()=>{
 const {root,update}=createMovementModel(catalog[398]),b=root.userData.blocks;
 const pairs=[[b.bottomHalf,b.leftNut],[b.topHalf,b.rightNut]].map(([half,nut])=>{
  const male=half.userData.screw.userData.thread,female=nut.userData.threadedBore;
  return [male,surfacePoints(male.geometry).filter((_,i)=>i%8===0),female,solidSurface(female.geometry)];
 });
 let count=0,gap=Infinity;
 for(let i=0;i<=32;i++){
  update(8*i/32);root.updateMatrixWorld(true);
  for(const [male,points,female,surface]of pairs){const result=clear(male,points,female,surface);count+=result.count;gap=Math.min(gap,result.gap);}
 }
 assert.ok(count>1000);assert.ok(gap>.002&&gap<.006,`thread gap ${gap}`);
});
test('399 swivel journals pass through their nut cages while heads retain them and opposing screw tips keep clearance',()=>{
 const {root,update}=createMovementModel(catalog[398]),b=root.userData.blocks;
 const pairs=[[b.topHalf,b.leftNut,b.bottomHalf],[b.bottomHalf,b.rightNut,b.topHalf]];
 const checks=[];
 for(const [half,nut,opposite]of pairs){
  for(const moving of [half.userData.body,half.userData.swivelJournal,half.userData.swivelHead,opposite.userData.screw.userData.tip]){
   const targets=[nut.userData.handle,nut.userData.captiveBearing];
   if(moving===opposite.userData.screw.userData.tip)targets.push(half.userData.swivelJournal,half.userData.swivelHead);
   checks.push([moving,surfacePoints(moving.geometry),targets.map(o=>[o,solidSurface(o.geometry)])]);
  }
 }
 for(let i=0;i<=64;i++){
  update(8*i/64);root.updateMatrixWorld(true);
  for(const [moving,points,targets]of checks)for(const [target,surface]of targets)clear(moving,points,target,surface);
 }
 assert.equal(root.userData.hideGround,true);
});
