import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const bounds=o=>new THREE.Box3().setFromObject(o,true);
function clearZ(mesh,center,radius){
 const ray=new THREE.Raycaster();
 for(let i=0;i<24;i++){
  ray.set(new THREE.Vector3(center.x+radius*Math.cos(i*Math.PI/12),center.y+radius*Math.sin(i*Math.PI/12),3),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(mesh,true).length,0,mesh.userData.role);
 }
}

test('401 finite guide slots, pitman eyes and shaft bearings clear their pins for a full revolution',()=>{
 const {root,update}=createMovementModel(catalog[400]),{blocks:b,geometry:g}=root.userData;
 for(let i=0;i<=128;i++){
  update(i*6/128);root.updateMatrixWorld(true);
  for(const pin of b.guidePins){
   clearZ(b.slideBody,pin.getWorldPosition(new THREE.Vector3()),g.guidePinRadius);
   assert.ok(bounds(pin).min.z<bounds(b.slideBody).min.z);
   assert.ok(bounds(pin).max.z>bounds(b.slideBody).max.z);
  }
  for(const pin of [b.wristPin,b.rearJointBoss]){
   clearZ(b.pitmanBar,pin.getWorldPosition(new THREE.Vector3()),pin.geometry.parameters.radiusTop);
   assert.ok(bounds(pin).min.z<bounds(b.pitmanBar).min.z);
   assert.ok(bounds(pin).max.z>bounds(b.pitmanBar).max.z);
  }
  assert.ok(bounds(b.pitmanBar).min.z>bounds(b.wristBoss).max.z);
  for(const [bearing,shaft,r] of [[b.wheelBearing,b.wheelShaft,.12],[b.treadleBearing,b.treadleShaft,.09],[b.faceDisc,b.wheelShaft,.12],[b.hub,b.wheelShaft,.12],[b.treadleBeam,b.treadleShaft,.09],[b.treadlePivotBoss,b.treadleShaft,.09]]){
   clearZ(bearing,shaft.getWorldPosition(new THREE.Vector3()),r);
  }
 }
 update(1.5);root.updateMatrixWorld(true);
 assert.ok(Math.abs(b.tangentSlide.position.x)<1e-12);
 assert.ok(Math.abs(b.slideStop.position.x-.06-g.slideHalfLength)<1e-12);
});

test('417 socket centres match the analytic state and the captured slide clears every guide face',()=>{
 const {root,update}=createMovementModel(catalog[416]),d=root.userData,b=d.blocks;
 for(let i=0;i<=128;i++){
  update(i*6/128);root.updateMatrixWorld(true);const state=d.stateAtTime(i*6/128);
  assert.ok(b.lowerBall.getWorldPosition(new THREE.Vector3()).distanceTo(state.lowerSocket)<1e-12);
  assert.ok(b.upperBall.getWorldPosition(new THREE.Vector3()).distanceTo(state.upperSocket)<1e-12);
  // Slide C's sectioned bar lies on the plank bed, clear of standard D.
  const slide=bounds(b.slideBody).union(bounds(b.slideFront)).union(bounds(b.slideBridge)),plank=bounds(b.base);
  assert.ok(slide.min.y>=plank.max.y-1e-6&&slide.min.y-plank.max.y<.02);
  assert.ok(slide.min.x>plank.min.x&&slide.max.x<bounds(b.bearingD).getCenter(new THREE.Vector3()).x-.42,'slide clears the foot of standard D');
  assert.ok(bounds(b.lowerSocketCup).min.x>bounds(b.slideBody).max.x&&bounds(b.lowerSocketCup).max.x<bounds(b.slideFront).min.x);
  // B's rounded end stays above the plank.
  assert.ok(bounds(b.rodTip).min.y>plank.max.y+.005);
 }
 // Real annular journal bore, bush and head bores, measured from meshes.
 for(const mesh of [b.bearingD,b.bearingBore]){
  const p=mesh.geometry.attributes.position;let minimum=Infinity;
  for(let i=0;i<p.count;i++)minimum=Math.min(minimum,Math.hypot(p.getX(i),p.getZ(i)));
  assert.ok(minimum>.13);
 }
 {
  const p=b.upperBall.geometry.attributes.position;let minimum=Infinity;
  for(let i=0;i<p.count;i++)minimum=Math.min(minimum,Math.hypot(p.getX(i),p.getZ(i)));
  assert.ok(minimum>.12);
 }
 {
  // Head A's bore about its own (rod-local X) axis clears the 0.12 bent end.
  const p=b.upperSocketCup.geometry.attributes.position;let minimum=Infinity;
  for(let i=0;i<p.count;i++)minimum=Math.min(minimum,Math.hypot(p.getY(i),p.getZ(i)));
  assert.ok(minimum>.13);
 }
 // The swivel ball's bore clears B's shank.
 {
  const p=b.lowerBall.geometry.attributes.position;let minimum=Infinity;
  for(let i=0;i<p.count;i++)minimum=Math.min(minimum,Math.hypot(p.getX(i),p.getZ(i)));
  assert.ok(minimum>.10);
 }
});

test('417 rod B and head A clear the rotating shaft, collar, standard D, slide blocks and socket over the full orbit',async()=>{
 const {solidSurface,surfacePoints}=await import('./helpers/solid-surface.mjs');
 const {root,update}=createMovementModel(catalog[416]),b=root.userData.blocks;
 const targets=[b.bearingPost,b.bearingD,b.slideBody,b.slideFront,b.slideBridge,b.lowerSocketCup,b.socketWeb,b.lowerBall,b.base];
 b.shaftRotor.traverse(o=>{if(o.geometry)targets.push(o);});
 const moving=[b.rodB,b.headBoss,b.rodTip,b.upperSocketCup].map(o=>[o,surfacePoints(o.geometry)]);
 const surfaces=targets.map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=128;i++){
  update(i*6/128);root.updateMatrixWorld(true);
  for(const [part,points] of moving)for(const [mesh,surface] of surfaces){
   const transform=mesh.matrixWorld.clone().invert().multiply(part.matrixWorld);
   for(const point of points){
    const p=point.clone().applyMatrix4(transform);
    if(surface.box.containsPoint(p))assert.ok(surface.signedDistance(p)>=-1e-6,`${part.userData.role} into ${mesh.userData.role}`);
   }
  }
 }
});

test('419 bored connecting rod spans both actual crank pins and clears wheel faces',()=>{
 const {root,update}=createMovementModel(catalog[418]),b=root.userData.blocks;
 for(let i=0;i<=128;i++){
  update(i*4/128);root.updateMatrixWorld(true);
  for(const pin of [b.inputPinMarker,b.outputPinMarker]){
   clearZ(b.connectingRodBody,pin.getWorldPosition(new THREE.Vector3()),.07);
   assert.ok(bounds(pin).min.z<bounds(b.connectingRodBody).min.z);
   assert.ok(bounds(pin).max.z>bounds(b.connectingRodBody).max.z);
  }
  assert.ok(bounds(b.connectingRodBody).min.z>bounds(b.outputCrankArm).max.z);
  assert.ok(bounds(b.cradleBed).max.z<bounds(b.inputWheelA).min.z);
 }
});

test('419 visible rocker shoe meets its floor and finite bands occupy the drum tread depth',()=>{
 const {root,update}=createMovementModel(catalog[418]),d=root.userData,{blocks:b,geometry:g}=d;
 let largestGap=0;
 for(let i=0;i<=128;i++){
  update(i*4/128);root.updateMatrixWorld(true);
  const gap=bounds(b.rockerShoe).min.y-bounds(b.ground).max.y;
  assert.ok(gap>=-2e-4&&gap<.008,`shoe/floor ${gap}`);largestGap=Math.max(largestGap,gap);
  const center=b.outputWheelB.getWorldPosition(new THREE.Vector3());
  const top=center.clone().setY(center.y+g.bandPitchRadius).setZ(g.bandZ);
  const endC=b.flexibleBandC.children.at(-1).localToWorld(new THREE.Vector3(0,.5,0));
  const startD=b.flexibleBandD.children[0].localToWorld(new THREE.Vector3(0,-.5,0));
  assert.ok(endC.distanceTo(top)<1e-12&&startD.distanceTo(top)<1e-12,'signed wrap reaches the shared drum top');
  for(const band of [b.flexibleBandC,b.flexibleBandD]){
   assert.ok(bounds(band).min.z>center.z-.21&&bounds(band).max.z<center.z+.21);
   for(const segment of band.children){
    const p=segment.geometry.attributes.position;
    for(let j=0;j<p.count;j++){
     const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(segment.matrixWorld);
     assert.ok(Math.hypot(v.x-center.x,v.y-center.y)>g.outputWheelRadius-1e-5);
    }
   }
  }
 }
 assert.ok(largestGap<.008);
});


test('417 spatial rod clears the rotating shaft, crank, standard D and slide blocks over its full orbit',async()=>{
 const {solidSurface,surfacePoints}=await import('./helpers/solid-surface.mjs');
 const {root,update}=createMovementModel(catalog[416]),b=root.userData.blocks;
 const targets=[b.bearingPost,b.bearingD,b.slideBody,b.slideFront];
 b.shaftRotor.traverse(o=>{if(o.geometry&&o!==b.bentJournal)targets.push(o);});
 const surfaces=targets.map(o=>[o,solidSurface(o.geometry)]),points=surfacePoints(b.rodB.geometry);
 for(let i=0;i<=128;i++){
  update(i*6/128);root.updateMatrixWorld(true);
  for(const [mesh,surface] of surfaces){
   const transform=mesh.matrixWorld.clone().invert().multiply(b.rodB.matrixWorld);
   for(const point of points){
    const p=point.clone().applyMatrix4(transform);
    if(surface.box.containsPoint(p))assert.ok(surface.signedDistance(p)>=-1e-6,mesh.userData.role);
   }
  }
 }
});
