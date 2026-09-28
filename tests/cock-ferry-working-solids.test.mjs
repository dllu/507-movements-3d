import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredFourWayCockMovement as cock} from '../src/simulation/authored-four-way-cocks.js';
import {createAuthoredReactionFerryMovement as ferry} from '../src/simulation/authored-reaction-ferries.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

function audit(model,pairs,period,poses=33){
 const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
 let worst=0,description='';
 for(let i=0;i<poses;i++){
  model.update(period*(i+.17)/poses);model.root.updateMatrixWorld(true);
  for(const[a,b]of pairs)for(const[moving,fixed]of[[a,b],[b,a]]){
   const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld),target=get(fixed).surface;
   for(const p of get(moving).points){const q=p.clone().applyMatrix4(transform);if(target.box.distanceToPoint(q)>.001)continue;const gap=target.signedDistance(q,.015);if(gap<worst){worst=gap;description=`${i}: ${moving.userData.role}/${fixed.userData.role}`;}}
  }
 }
 assert.ok(worst>=-2e-6,`${description}: ${worst}`);
}

test('395 plug passages and body ducts are closed square bores that meet face to face at both indexed positions',()=>{
 const m=cock({id:395}),d=m.root.userData,b=d.blocks,g=d.geometry;
 try{
  const plug=solidSurface(b.plug.geometry),housing=solidSurface(b.housing.geometry);
  // Pass 90: the passages are closed inside the plug (see-through), not
  // open channels in its face.
  for(const channel of Object.values(b.channels)){
   const path=channel.userData.curve;
   for(let i=0;i<=64;i++){
    const p=path.getPoint(i/64);if(p.length()>g.plugRadius-.01)continue;
    assert.equal(plug.inside(p.clone().setZ(0)),false,'passage bored through the plug');
    for(const z of[-.25,.25])assert.equal(plug.inside(p.clone().setZ(z)),true,'passage covered on both faces');
   }
   assert.equal(channel.userData.flowCore.visible,false,'no tinted fluid core stands in for the passage');
  }
  assert.equal(b.plug.userData.seeThrough,true,'the plug is see-through so its passages show');
  for(const a of[0,Math.PI/2,Math.PI,3*Math.PI/2])for(let r=g.bodyInnerRadius+.01;r<g.bodyOuterRadius;r+=.02){
   const at=z=>new T.Vector3(r*Math.cos(a),r*Math.sin(a),z);
   assert.equal(housing.inside(at(0)),false,'open port duct');
   for(const z of[-.25,.25])assert.equal(housing.inside(at(z)),true,'port duct closed on both faces');
  }
  // The four pipe ends are the body's only openings.
  for(const end of d.pipeEnds){
   assert.equal(housing.inside(end.point.clone().addScaledVector(end.tangent,-.05)),false,'bore reaches the pipe end');
   assert.equal(housing.inside(end.point.clone().addScaledVector(end.tangent,-.05).setZ(.25)),true,'pipe wall');
  }
  audit(m,[[b.plug,b.housing]],d.motion.cycleDuration);
 }finally{disposeObject3D(m.root);}
});

test('395 moving passage markers stay inside the closed plug passages',()=>{
 const m=cock({id:395}),d=m.root.userData,b=d.blocks;
 try{
  const plug=solidSurface(b.plug.geometry);
  for(const time of[.13,.61,1.37,4.31,5.19,6.43]){
   m.update(time);m.root.updateMatrixWorld(true);
   for(const channel of Object.values(b.channels))for(const marker of channel.userData.markers){
    assert.equal(marker.visible,true);if(marker.position.length()<d.geometry.plugRadius-.1)assert.ok(plug.signedDistance(marker.position,.2)>=.094);
   }
  }
 }finally{disposeObject3D(m.root);}
});

test('447 finite stock and swivels articulate clear of the hull, line and bearings',()=>{
 const m=ferry({id:447}),d=m.root.userData,b=d.blocks,p=d.ferryWorkingParts;
 try{
  audit(m,[[p.post,p.bearing],[p.post,b.hull],[p.bladeBracket,b.hull],[b.rudderBlade,b.hull],[b.rudderBlade,b.deck],[b.rope,p.anchorEye],[b.rope,b.bowRing],[b.ropeStartMarker,p.anchorEye],[b.ropeEndMarker,b.bowRing],[b.ropeEndMarker,b.hull],[b.ropeEndMarker,p.bowFoot]],d.geometry.cycleDuration);
 }finally{disposeObject3D(m.root);}
});

test('447 hull is immersed, cockpit floors stay dry and a vertical rudder reaches the current',()=>{
 const m=ferry({id:447}),d=m.root.userData,b=d.blocks,g=d.geometry;
 try{
  for(let i=0;i<=32;i++){
   m.update(g.cycleDuration*i/32);m.root.updateMatrixWorld(true);
   const hull=new T.Box3().setFromObject(b.hull),deck=new T.Box3().setFromObject(b.deck),rudder=new T.Box3().setFromObject(b.rudderBlade),water=new T.Box3().setFromObject(b.river);
   assert.ok(hull.min.y<water.max.y&&hull.max.y>water.max.y);
   assert.ok(deck.min.y>water.max.y);
   assert.ok(rudder.min.y<water.max.y-.15);
   const cockpitFloor=b.hull.localToWorld(new T.Vector3(1.1,0,.17));assert.ok(cockpitFloor.y>water.max.y+.03);
   for(const part of[b.hull,b.rudderBlade,d.ferryWorkingParts.tiller]){
    const box=new T.Box3().setFromObject(part);assert.ok(box.min.z>-g.riverHalfWidth&&box.max.z<g.riverHalfWidth);
   }
  }
 }finally{disposeObject3D(m.root);}
});

for(const[id,create,period]of[[395,cock,8],[447,ferry,6.2]])test(`${id} keeps geometry buffers and readable display timing`,()=>{
 const m=create({id}),before=[];
 try{m.root.traverse(o=>before.push([o,o.geometry,o.geometry?.attributes.position.array]));for(let i=0;i<80;i++)m.update(i*.17);
  const after=[];m.root.traverse(o=>after.push(o));assert.equal(after.length,before.length);for(const[o,g,a]of before){assert.equal(o.geometry,g);assert.equal(o.geometry?.attributes.position.array,a);}
  assert.equal(m.root.userData.minimumDisplayCycleSeconds,period);assert.equal(m.root.userData.hideGround,true);
 }finally{disposeObject3D(m.root);}
});

test('447 deck, stock bearing and water share no coplanar faces with hull or banks',()=>{
 const model=ferry({id:447}),r=model.root,b=r.userData.blocks;
 try{
  model.update(0);r.updateMatrixWorld(true);
  const box=o=>new T.Box3().setFromObject(o);
  let hull,deck,bearing,river,bank;
  r.traverse(o=>{const role=o.userData.role;if(role==='boat-hull-radial-to-anchor')hull=o;if(role==='ferry-deck')deck=o;if(role==='bored-rudder-stock-bearing')bearing=o;if(role==='river-current-driving-rudder-downstream')river=o;if(role==='fixed-river-bank')bank=o;});
  assert.ok(Math.abs(box(deck).min.y-box(hull).max.y)<1e-6,'deck stands on the hull top');
  assert.ok(Math.abs(box(bearing).max.y-(box(hull).max.y-.17))<1e-6,'bearing hangs from the band');
  assert.ok(Math.abs(box(bank).max.x-box(river).max.x-.004)<1e-6,'water ends inside the banks');
 }finally{disposeObject3D(r);}
});
