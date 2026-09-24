import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredEccentricConeDriveMovement} from '../src/simulation/authored-eccentric-cone-drives.js';
import {createAuthoredConeFrictionDriveMovement} from '../src/simulation/authored-cone-friction-drives.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const make=id=>(id===265?createAuthoredConeFrictionDriveMovement:createAuthoredEccentricConeDriveMovement)({id});
const box=o=>new THREE.Box3().setFromObject(o,true);
function assertClear(a,b,cache,label){
 if(!box(a).intersectsBox(box(b)))return;
 for(const o of[a,b])if(!cache.has(o))cache.set(o,{surface:solidSurface(o.geometry),points:surfacePoints(o.geometry)});
 for(const[from,to]of[[a,b],[b,a]]){
  const transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),surface=cache.get(to).surface;
  for(const point of cache.get(from).points){const p=point.clone().applyMatrix4(transform);
   if(surface.inside(p))assert.ok(surface.distance(p,.03)<1e-6,label);
  }
 }
}
function openBore(object,center,axis,radius){
 const u=(Math.abs(axis.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).cross(axis).normalize(),v=axis.clone().cross(u);
 for(let i=0;i<32;i++){
  const p=center.clone().addScaledVector(u,radius*Math.cos(i*Math.PI/16)).addScaledVector(v,radius*Math.sin(i*Math.PI/16));
  const ray=new THREE.Raycaster(p.addScaledVector(axis,-10),axis,0,20);
  assert.equal(ray.intersectObject(object,true).length,0,`${object.userData.role}: bore blocked`);
 }
}

for(const id of[262,263])test(`${id}: finite cone, thread/nut, footed standard E and roller C clear through a full traverse`,()=>{
 const m=make(id);try{
  const b=m.root.userData.blocks,cache=new Map();
  // The plates draw no guide, spring or base; only standard E is fixed.
  for(const key of['base','guideRails','guideTop','carriageBlocks','carriageBridge','contactSpring'])assert.equal(b[key],undefined,key);
  const pairs=[b.nut,b.nutThread,b.nutPost,b.rollerAxle,b.rollerBody,b.rollerFaceRim].map(o=>[b.coneBody,o]);
  pairs.push(...b.eccentricConnectors.map(o=>[o,b.nutPost]),...b.coneRims.map(o=>[o,b.nutPost]));
  pairs.push([b.screwThread,b.nutThread],[b.screwThread,b.nut],[b.screwThread,b.nutPost],[b.screwThread,b.rollerAxle],[b.rightScrewCore,b.rollerBody],[b.rollerBody,b.rollerAxle]);
  const cone=solidSurface(b.coneBody.geometry),roller=solidSurface(b.rollerBody.geometry);
  for(let i=0;i<=64;i++){
   m.update(i*12/64);m.root.updateMatrixWorld(true);
   for(const[a,c]of pairs)assertClear(a,c,cache,`${a.userData.role}/${c.userData.role} at ${i}`);
   const point=m.root.localToWorld(m.root.userData.kinematics.contactPoint.clone());
   assert.ok(cone.distance(b.coneBody.worldToLocal(point.clone()))<.001,'roller lifted clear of cone');
   assert.ok(roller.distance(b.rollerBody.worldToLocal(point.clone()))<.001,'nominal contact outside actual roller');
   assert.ok(box(b.rollerAxle).intersectsBox(box(b.rollerBody)),'roller C detached from its axle');
  }
  assert.ok(box(b.nutPost).intersectsBox(box(b.nut)),'nut unsupported');
  assert.ok(b.screwThread.geometry.userData.thread,'solid helical thread missing');
  // Plate 262: low footed cradle whose foot lies just under B's rim, and a
  // plain round boss (no carrier bar or joint balls) on B's large-end face.
  if(id===262){const g=m.root.userData.geometry;assert.ok(box(b.nutPost).min.y>(g.coneEccentricity-1.4*g.coneLargeRadius)*m.root.scale.y,'cradle E too tall');const boss=b.eccentricConnectors[0];assert.equal(boss.children.length,2);assert.equal(boss.children[0].material,b.coneBody.material);}
 }finally{disposeMovementModel(m);}
});

test('265: finite roller and hub clear their guide and remain on the cone',()=>{
 const m=make(265);try{
  const b=m.root.userData.blocks,g=m.root.userData.geometry,cache=new Map();
  const cone=solidSurface(b.coneBody.geometry),tread=solidSurface(b.rollerTread.geometry);
  for(let i=0;i<=64;i++){
   m.update(i*8/64);m.root.updateMatrixWorld(true);
   for(const part of[b.rollerBody,b.rollerTread,b.rollerHub])assertClear(b.coneBody,part,cache,`265 roller/cone at ${i}`);
   // The concave drum tilts the roller axle to the local generator.
   for(const part of[b.rollerBody,b.rollerHub])openBore(part,b.roller.getWorldPosition(new THREE.Vector3()),m.root.userData.kinematics.generatorAxis,.057*.88);
   const point=m.root.localToWorld(m.root.userData.kinematics.contactPoint.clone());
   assert.ok(cone.distance(b.coneBody.worldToLocal(point.clone()))<.001);
   assert.ok(tread.distance(b.rollerTread.worldToLocal(point.clone()))<.002);
  }
  assert.equal(b.baseRail,undefined,'invented frame still constructed');
 }finally{disposeMovementModel(m);}
});

test('cone family: source-uniform drive, readable cycles, complete framing and no ground/fog',()=>{
 for(const id of[262,263,265]){
  const m=make(id);try{
   const d=m.root.userData,period=d.timeline.demonstrationPeriod;
   assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=(id===265?8:12));
   m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
   for(let i=0;i<=64;i++){m.update(period*i/64);m.root.updateMatrixWorld(true);assert.ok(d.cameraFitBounds.containsBox(box(m.root)));}
   if(id!==265){
    const rate=d.stateAtTime(1).inputAngularSpeed;
    for(const time of[2,3,4,5])assert.equal(d.stateAtTime(time).inputAngularSpeed,rate);
    for(const time of[7,8,9,10,11])assert.equal(d.stateAtTime(time).inputAngularSpeed,-rate);
    assert.ok(Math.abs(d.stateAtTime(12-1e-7).inputAngularSpeed)<1e-10);
   }
  }finally{disposeMovementModel(m);}
 }
});
