import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {compassGripProfile} from '../src/simulation/compass-grip-profile.js';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const make=id=>createMovementModel(catalog[id-1]);
const bounds=m=>new THREE.Box3().setFromObject(m,true);
function prepare(pairs){return pairs.flatMap(([a,b])=>[[a,b],[b,a]]).map(([a,b])=>({a,b,points:surfacePoints(a.geometry),surface:solidSurface(b.geometry)}));}
function clear(prepared){for(const {a,b,points,surface} of prepared){
 if(!bounds(a).intersectsBox(bounds(b)))continue;
 const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
 for(const p of points){const q=p.clone().applyMatrix4(transform);assert.ok(!surface.inside(q)||surface.distance(q)<2e-6,`${a.userData.role} enters ${b.userData.role}`);}
}}

test('408 finite pin cylinders touch the working leg faces and clear the whole head over the usable sweep',()=>{
 const m=make(408),d=m.root.userData,b=d.blocks;
 const pairs=[];
 for(const pin of Object.values(b.fixedPins))for(const mesh of [b.head,b.centralJoint,b.blade,...Object.values(b.legs).flatMap(l=>[l.body,l.backEdge,...l.clamp.children])])pairs.push([pin.axle,mesh]);
 pairs.push([b.legs.lower.body,b.legs.upper.body],[b.centralJoint,b.head],
  [b.centralJoint,b.legs.lower.body],[b.centralJoint,b.legs.upper.body],
  [b.head,b.legs.lower.body],[b.head,b.legs.upper.body]);
 const prepared=prepare(pairs);
 for(let i=0;i<=64;i++){
  m.update(d.geometry.cycleDuration*i/64);m.root.updateMatrixWorld(true);
  for(const key of ['upper','lower']){
   const local=b.legs[key].body.worldToLocal(b.fixedPins[key].axle.getWorldPosition(new THREE.Vector3()));
   assert.ok(Math.abs(Math.abs(local.y)-.12-.075)<1e-12);
  }
  clear(prepared);
 }
 assert.equal(b.board.parent,null);assert.equal(b.boardFrame.parent,null);
});

test('409 recovered grip is source-bound and actual through-slots accept separate bored sliders',()=>{
 assert.equal(compassGripProfile.sourceSha256,createHash('sha256').update(readFileSync('public/engravings/mm_409.png')).digest('hex'));
 const m=make(409),d=m.root.userData,b=d.blocks;
 const prepared=prepare([[b.legA.spine,b.legB.spine],[b.pivotAxle,b.legA.pivotShoe],[b.pivotAxle,b.legB.pivotShoe],
  [b.legA.spine,b.legA.pivotShoe],[b.legB.spine,b.legB.pivotShoe],
  [b.pivotAxle,b.legA.spine],[b.pivotAxle,b.legB.spine]]);
 for(let i=0;i<=32;i++){
  m.update(d.geometry.cycleDuration*i/32);m.root.updateMatrixWorld(true);clear(prepared);
  for(const leg of [b.legA,b.legB]){
   // A ray through either open end must miss the rendered leg, from either side.
   for(const y of [d.geometry.slotMinimumCoordinate,d.geometry.slotMaximumCoordinate]){
    const origin=leg.group.localToWorld(new THREE.Vector3(0,y,2));
    const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(leg.spine,false).length,0);
   }
   const p=leg.spine.geometry.attributes.position;let tips=0;
   for(let j=0;j<p.count;j++)if(Math.abs(p.getY(j)-d.geometry.shortArmLength)<1e-6||Math.abs(p.getY(j)+d.geometry.longArmLength)<1e-6){
    const world=leg.spine.localToWorld(new THREE.Vector3().fromBufferAttribute(p,j));assert.ok(Math.abs(world.z)<1e-7);tips++;
   }
   assert.ok(tips>0);
  }
 }
});

test('410 outward setup never cuts the wood and rendered links, guides and marker occupy compatible layers',()=>{
 const m=make(410),d=m.root.userData,b=d.blocks;
 const pairs=[[b.leftLink,b.rightLink],[b.leftLink,b.crossbar],[b.rightLink,b.crossbar],
  [b.leftLink,b.fixedCheek.plate],[b.rightLink,b.adjustableCheek.plate],
  [b.crossbar,b.adjustableCheek.plate],[b.thumbStem,b.crossbar],[b.thumbStem,b.adjustableCheek.plate],
  [b.markerPin,b.leftLink],[b.markerPin,b.rightLink],[b.fixedLinkAnchor,b.leftLink],[b.adjustableLinkAnchor,b.rightLink]];
 const prepared=prepare(pairs);
 for(let i=0;i<=128;i++){
  m.update(d.geometry.cycleDuration*i/128);m.root.updateMatrixWorld(true);clear(prepared);
  const inModel=mesh=>{
   const box=new THREE.Box3(),p=mesh.geometry.attributes.position;
   const transform=m.root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
   for(let j=0;j<p.count;j++)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(transform));return box;
  };
  const wood=inModel(b.workpiece);
  for(const part of [b.fixedCheek.plate,b.fixedCheek.innerContact,b.fixedCheek.lowerFoot])assert.ok(inModel(part).max.x<=wood.min.x+1e-7);
  for(const part of [b.adjustableCheek.plate,b.adjustableCheek.innerContact,b.adjustableCheek.lowerFoot])assert.ok(inModel(part).min.x>=wood.max.x-1e-7);
  const tip=m.root.worldToLocal(b.markerNeedle.localToWorld(new THREE.Vector3(0,b.markerNeedle.geometry.parameters.height/2,0)));
  assert.ok(Math.abs(tip.z-wood.max.z)<1e-7);
 }
 assert.ok(d.geometry.setupAdjustableCheekX>d.geometry.fittedAdjustableCheekX);
});

for(const id of [408,409,410])test(`${id} omits ground/fog and has finite whole-cycle framing`,()=>{
 const {root,cameraDirection}=make(id);assert.equal(root.userData.hideGround,true);assert.ok(cameraDirection);
 root.traverseVisible(o=>{for(const material of [o.material].flat().filter(Boolean))assert.equal(material.fog,false);});
 assert.ok(!root.userData.cameraFitBounds.isEmpty());
});
