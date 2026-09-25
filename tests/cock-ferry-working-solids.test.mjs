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

test('395 sectioned passages are open through plug and housing at both indexed positions',()=>{
 const m=cock({id:395}),d=m.root.userData,b=d.blocks,g=d.geometry;
 try{
  const plug=solidSurface(b.plug.geometry),housing=solidSurface(b.housing.geometry);
  for(const channel of Object.values(b.channels)){
   const path=channel.userData.curve;
   for(let i=0;i<=64;i++){
    const p=path.getPoint(i/64);
    for(const z of[-.12,.12])assert.equal(plug.inside(p.clone().setZ(z)),false,'passage is cut into both plug faces');
    if(p.length()<g.plugRadius-1e-5)assert.equal(plug.inside(p),true,'finite mid-plane web');
   }
   for(const p of surfacePoints(channel.userData.flowCore.geometry))assert.ok(plug.signedDistance(p,.01)>-2e-6,'flow core clears the plug');
  }
  for(const a of[0,Math.PI/2,Math.PI,3*Math.PI/2])for(let r=g.bodyInnerRadius+.01;r<g.bodyOuterRadius;r+=.02)assert.equal(housing.inside(new T.Vector3(r*Math.cos(a),r*Math.sin(a),0)),false,'open housing mouth');
  const pipes=Object.values(b.pipes).map(p=>p.children[0]);
  audit(m,[[b.plug,b.housing],...pipes.map(p=>[b.plug,p])],d.motion.cycleDuration);
 }finally{disposeObject3D(m.root);}
});

test('395 moving passage and pipe markers stay inside the actual cutaway bores',()=>{
 const m=cock({id:395}),d=m.root.userData,b=d.blocks;
 try{
  const plug=solidSurface(b.plug.geometry),housing=solidSurface(b.housing.geometry);
  for(const time of[.13,.61,1.37,4.31,5.19,6.43]){
   m.update(time);m.root.updateMatrixWorld(true);
   for(const channel of Object.values(b.channels))for(const marker of channel.userData.markers){
    assert.equal(marker.visible,true);assert.ok(plug.signedDistance(marker.position,.2)>=.094);
   }
   for(const group of b.externalFlow.children)for(const marker of group.userData.markers){
    assert.equal(housing.inside(marker.position),false);
    for(const pipe of Object.values(b.pipes))assert.equal(solidSurface(pipe.children[0].geometry).inside(marker.position),false);
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
