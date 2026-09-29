import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredEngineReverserMovement} from '../src/simulation/authored-engine-reversers.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('179 has open guide/link bores and finite lug clearance at both drive stops',()=>{
 const m=createAuthoredEngineReverserMovement({id:179}),b=m.root.userData.blocks;
 try{
  for(const mesh of [b.stuffingSleeve,...b.stuffingCollars,b.bearingRing,b.leverPedestal,...b.reversingLink.children.slice(1)]){
   assert.equal(solidSurface(mesh.geometry).inside(new THREE.Vector3()),false,'bore remains open');
  }
  const lug=solidSurface(b.shaftLug.geometry),stop=solidSurface(b.semicircularStop.geometry);
  const lugPoints=surfacePoints(b.shaftLug.geometry),stopPoints=surfacePoints(b.semicircularStop.geometry);
  const directions=new Set();
  for(let i=0;i<=128;i++){
   m.update(24*i/128);m.root.updateMatrixWorld(true);const s=m.root.userData.kinematics;
   if(s.activeStopPoint===null)continue;
   directions.add(s.shaftStopContact);
   const toStop=b.semicircularStop.matrixWorld.clone().invert().multiply(b.shaftLug.matrixWorld);
   const toLug=toStop.clone().invert();let gap=Infinity;
   for(const p of lugPoints)gap=Math.min(gap,stop.distance(p.clone().applyMatrix4(toStop)));
   for(const p of stopPoints)gap=Math.min(gap,lug.distance(p.clone().applyMatrix4(toLug)));
   assert.ok(gap>.0005&&gap<.003,'finite drive-stop gap stays below .14 source pixel: '+gap);
  }
  assert.equal(directions.size,2,'both forward and reverse stop configurations checked');
 }finally{disposeObject3D(m.root);}
});

test('179 lifting grip follows the engraved side, gab opens downward, and link pins have heads',()=>{
 const m=createAuthoredEngineReverserMovement({id:179}),u=m.root.userData,b=u.blocks;
 try{
  m.update(0);m.root.updateMatrixWorld(true);
  // Pass 98: the grip is a turned knob whose foot is sunk in the handle's
  // end face (raster 94-95, 197-203) and which points out to the left, past
  // the engraved grip centre (raster 84, 198).
  const grip=b.liftingHandleGrip.getWorldPosition(new THREE.Vector3());
  const raster=u.modelPointToSourceRaster(new THREE.Vector2(grip.x,grip.y));
  assert.ok(raster.distanceTo(new THREE.Vector2(94.5,200))<1.5,`foot at the handle's end: ${raster.toArray()}`);
  const tip=b.liftingHandleGrip.localToWorld(new THREE.Vector3(0,.46,0));
  const tipRaster=u.modelPointToSourceRaster(new THREE.Vector2(tip.x,tip.y));
  assert.ok(tipRaster.x<84&&Math.abs(tipRaster.y-199)<3,`knob reaches past the engraved grip: ${tipRaster.toArray()}`);
  const gab=solidSurface(b.gabBridge.geometry),length=u.geometry.eccentricRodLength;
  assert.equal(gab.inside(new THREE.Vector3(length,.10,0)),false,'open mouth');
  assert.equal(gab.inside(new THREE.Vector3(length,-.30,0)),true,'solid rounded crown');
  for(const [pin,head,eye]of [[b.leverLinkHub,b['lever-link-pin-head'],b.reversingLink.children[1]],
   [b.spindleLinkPin,b['spindle-link-pin-head'],b.reversingLink.children[2]]]){
   const pb=new THREE.Box3().setFromObject(pin),hb=new THREE.Box3().setFromObject(head),eb=new THREE.Box3().setFromObject(eye);
   assert.ok(Math.abs(pb.max.z-hb.min.z)<1e-7,'head touches pin');
   assert.ok(hb.min.z>eb.max.z&&pb.min.z<eb.min.z,'retained eye lies on pin');
  }
  const disk=solidSurface(b.eccentricDisk.geometry),g=u.geometry;
  assert.equal(disk.inside(new THREE.Vector3(-g.stopMeanRadius,0,g.stopPlaneZ-g.stopDepth/2)),true,
   'stop base is attached to the sheave');
  for(const [mark,parent]of [[b.eccentricPhaseIndex,b.eccentricDisk],[b.eccentricOuterRim,b.eccentricDisk],[b.shaftLugIndex,b.shaftLug]]){
   const mb=new THREE.Box3().setFromObject(mark),pb=new THREE.Box3().setFromObject(parent);
   assert.ok(Math.abs(mb.min.z-pb.max.z)<1e-7,'rotation marking touches its face');
  }
  for(const eye of b.reversingLink.children.slice(1)){
   assert.ok(new THREE.Box3().setFromObject(eye).min.z>new THREE.Box3().setFromObject(b.manualLeverBar).max.z,
    'link eyes clear the upright lever in depth');
  }
 }finally{disposeObject3D(m.root);}
});

test('p101: 179 lever pedestal is one cast lug standing on the foundation, with a plain pin',()=>{
 const m=createAuthoredEngineReverserMovement({id:179}),b=m.root.userData.blocks;
 try{
  m.root.updateMatrixWorld(true);
  assert.equal(b.leverSupport,undefined,'no separate support beam');
  assert.equal(b.leverPedestal.geometry.type,'ExtrudeGeometry','pedestal is one extrusion');
  const ped=new THREE.Box3().setFromObject(b.leverPedestal),base=new THREE.Box3().setFromObject(b.baseRail);
  assert.ok(ped.min.y<base.max.y&&base.max.y-ped.min.y<.02,'foot seated on the foundation top');
  assert.ok(base.min.z<=ped.min.z&&base.max.z>=ped.max.z,'foundation runs under the whole foot');
  const pivot=new THREE.Vector3().setFromMatrixPosition(b.leverPedestal.matrixWorld);
  assert.ok(Math.abs(ped.max.y-pivot.y-.30)<.005,'top arc concentric with the pivot');
  const pin=new THREE.Box3().setFromObject(b.leverBaseHub);
  assert.equal(b.leverBaseHub.geometry.parameters.radiusTop,.12,'plain pin, not an oversized eye');
  assert.ok(pin.min.z<ped.min.z&&pin.min.z>ped.min.z-.03,'pin passes through the lug');
 }finally{disposeObject3D(m.root);}
});

test('p104: 179 lever ends in a round eye concentric with the base pin, clear of the foundation',()=>{
 const m=createAuthoredEngineReverserMovement({id:179}),b=m.root.userData.blocks;
 try{
  const pos=b.manualLeverBar.geometry.attributes.position,pinRadius=b.leverBaseHub.geometry.parameters.radiusTop;
  let eye=0;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);if(x<0)eye=Math.max(eye,Math.hypot(x,y));}
  assert.ok(Math.abs(eye-.22)<1e-6,'eye radius 0.22 behind the pin: '+eye);
  assert.ok(eye/pinRadius>1.7,'eye about 1.8x the pin radius');
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);if(x<=0)assert.ok(Math.hypot(x,y)<=.22+1e-6,'round, concentric end');}
  for(let k=0;k<=12;k++){m.update(k);m.root.updateMatrixWorld(true);
   const lever=new THREE.Box3().setFromObject(b.manualLeverBar),base=new THREE.Box3().setFromObject(b.baseRail);
   assert.ok(lever.min.z>base.max.z,'eye passes in front of the foundation');}
 }finally{disposeObject3D(m.root);}
});
