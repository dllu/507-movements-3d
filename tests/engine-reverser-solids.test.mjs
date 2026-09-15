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
  const grip=b.liftingHandleGrip.getWorldPosition(new THREE.Vector3());
  const raster=u.modelPointToSourceRaster(new THREE.Vector2(grip.x,grip.y));
  assert.ok(raster.distanceTo(new THREE.Vector2(84,198))<1e-10);
  const gab=solidSurface(b.gabBridge.geometry),length=u.geometry.eccentricRodLength;
  assert.equal(gab.inside(new THREE.Vector3(length,.10,0)),false,'open mouth');
  assert.equal(gab.inside(new THREE.Vector3(length,-.30,0)),true,'solid rounded crown');
  for(const [pin,head,eye]of [[b.leverLinkHub,b['lever-link-pin-head'],b.reversingLink.children[1]],
   [b.spindleLinkPin,b['spindle-link-pin-head'],b.reversingLink.children[2]]]){
   const pb=new THREE.Box3().setFromObject(pin),hb=new THREE.Box3().setFromObject(head),eb=new THREE.Box3().setFromObject(eye);
   assert.ok(Math.abs(pb.max.z-hb.min.z)<1e-7,'head touches pin');
   assert.ok(hb.min.z>eb.max.z&&pb.min.z<eb.min.z,'retained eye lies on pin');
  }
 }finally{disposeObject3D(m.root);}
});
