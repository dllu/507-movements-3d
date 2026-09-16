import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredAnchorEscapementMovement as recoil} from '../src/simulation/authored-anchor-escapements.js';
import {createAuthoredDeadbeatEscapementMovement as deadbeat} from '../src/simulation/authored-deadbeat-escapements.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
for(const[id,make]of[[288,recoil],[289,deadbeat]])test(`${id}: corrected finite interfaces clear through the full beat`,()=>{
 const m=make({id}),d=m.root.userData,g=d.geometry,p=d.escapementWorkingParts,samples=new Map(),solids=new Map();
 for(const[a,b]of p.pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(b))solids.set(b,solidSurface(b.geometry));}
 const phases=[...Array.from({length:65},(_,i)=>i/64),...['landingHalfPhase','releaseHalfPhase','impulseStartHalfPhase'].flatMap(k=>g[k]===undefined?[]:[g[k]/2-1e-6,g[k]/2,g[k]/2+1e-6,.5+g[k]/2-1e-6,.5+g[k]/2,.5+g[k]/2+1e-6])];
 const point=new THREE.Vector3();let count=0,min=.005;
 for(const phase of phases){m.update(phase*g.pendulumPeriod);m.root.updateMatrixWorld(true);for(const[a,b]of p.pairs){const mat=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const v of samples.get(a)){point.copy(v).applyMatrix4(mat);const gap=solids.get(b).signedDistance(point,.005);count++;min=Math.min(min,gap);assert.ok(gap>=-1e-5,`${id} phase${phase}: ${a.userData.role} cuts ${b.userData.role} by${-gap}`);}}}
 console.log({id,count,min});
});
function nearestOnPolygons(point,polygons){let distance=Infinity,nearest;
 for(const polygon of polygons)for(const ring of polygon)for(let i=0;i<ring.length-1;i++){const a=new THREE.Vector2(...ring[i]),b=new THREE.Vector2(...ring[i+1]),v=b.clone().sub(a),t=THREE.MathUtils.clamp(point.clone().sub(a).dot(v)/v.lengthSq(),0,1),p=a.addScaledVector(v,t),gap=p.distanceTo(point);if(gap<distance){distance=gap;nearest=p;}}
 return{distance,nearest};
}
test('288: both active finite faces retain close contact and oppose forward wheel torque',()=>{
 const m=recoil({id:288}),d=m.root.userData,g=d.geometry;let maxGap=0,maxReaction=-Infinity,count=0;
 for(let i=0;i<=512;i++){const s=d.stateAtTime(g.pendulumPeriod*i/512);if(!s.contactActive)continue;
  const pallet=s.activeSide===1?d.blocks.leftPallet:d.blocks.rightPallet;
  const point=s.activeToothPoint.clone().sub(g.anchorPivot).rotateAround(new THREE.Vector2(),-s.anchorAngle);
  const result=nearestOnPolygons(point,pallet.userData.body.geometry.userData.plate.polygons);
  const normal=point.clone().sub(result.nearest).normalize().rotateAround(new THREE.Vector2(),s.anchorAngle);
  const radial=s.activeToothPoint.clone().sub(g.wheelCenter),forward=new THREE.Vector2(-radial.y,radial.x).normalize();
  const resistance=normal.dot(forward);maxReaction=Math.max(maxReaction,resistance);maxGap=Math.max(maxGap,result.distance);count++;
  assert.ok(result.distance<.0026,`active ${s.activeSide} face missing at${i}: ${result.distance}`);assert.ok(resistance<-.05,`reaction must oppose forward torque, got ${resistance}`);
 }
 console.log({count,maxGap,maxReaction});
});
for(const[id,make]of[[288,recoil],[289,deadbeat]])test(`${id}: poses stay continuous and scene resources stable`,()=>{
 const m=make({id}),d=m.root.userData,g=d.geometry,meshes=[];m.root.traverse(o=>{if(o.geometry)meshes.push([o,o.geometry,o.geometry.attributes.position.array]);for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});
 for(const key of['landingHalfPhase','releaseHalfPhase','impulseStartHalfPhase'])if(g[key]!==undefined)for(const half of[0,1]){const time=(half+g[key])*g.halfBeatDuration,a=d.stateAtTime(time-1e-7),b=d.stateAtTime(time+1e-7);assert.ok(Math.abs(a.anchorAngle-b.anchorAngle)<1e-6);assert.ok(Math.abs(a.wheelAngle-b.wheelAngle)<1e-5);}
 for(let i=0;i<=16;i++)m.update(g.pendulumPeriod*i/16);let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,meshes.length);for(const[o,geometry,array]of meshes){assert.equal(o.geometry,geometry);assert.equal(o.geometry.attributes.position.array,array);}assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,4);assert.match(d.reconstructionNote,id===288?/prescribed/:/interference.*unresolved/);
});
