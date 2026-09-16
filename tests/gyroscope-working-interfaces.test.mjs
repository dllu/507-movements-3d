import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredGyroscopeMovement as make } from '../src/simulation/authored-gyroscopes.js';
import { surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
for(const id of[355,356]){
 test(`${id}: actual working shafts, bearings and ring solids clear over a full cycle`,()=>{
  const m=make({id}),d=m.root.userData,p=d.gyroscopeParts;
  const samples=new Map(),solids=new Map();
  for(const[a,b]of p.pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(b))solids.set(b,solidSurface(b.geometry));}
  const point=new THREE.Vector3();let count=0,min=.01;
  for(let i=0;i<=16;i++){
   m.update(d.geometry.cyclePeriod*i/16);m.root.updateMatrixWorld(true);
   for(const[a,b]of p.pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(b);
    for(const v of samples.get(a)){point.copy(v).applyMatrix4(matrix);const distance=solid.signedDistance(point,.01);count++;min=Math.min(min,distance);assert.ok(distance>=-1e-5,`${id} pose ${i}: ${a.userData.role} cuts ${b.userData.role} by ${-distance}, ${point.toArray()}`);}
   }
  }
  console.log(JSON.stringify({id,count,minimumCappedGap:min}));
 });
 test(`${id}: finite bores, stable buffers, readable timing and explicit dynamics limits`,()=>{
  const m=make({id}),d=m.root.userData,meshes=[];
  for(const{housing,pin,bore}of d.gyroscopeParts.journals){assert.equal(housing.geometry.userData.boreRadius,bore);assert.ok(bore>pin.geometry.parameters.radiusTop);}
  m.root.traverse(o=>{if(o.geometry)meshes.push([o,o.geometry,o.geometry.attributes.position.array]);for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
  for(let i=0;i<=16;i++)m.update(d.geometry.cyclePeriod*i/16);
  let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,meshes.length);
  for(const[o,g,a]of meshes){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
  assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,12);assert.match(d.dynamics.validationScope,/Prescribed/);assert.match(d.reconstructionNote,/not simulated/);
 });
}

test('fixed bearing bodies actually join their carrying rings',()=>{
 for(const id of[355,356]){
  const m=make({id}),b=m.root.userData.blocks;
  const sets=id===355?[[b.bearingHousings,b.ringBody,'x','z',.13]]:[
   [b.middlePivotBearings,b.outerRing,'y','x',.10],
   [b.innerPivotBearings,b.middleRing,'x','y',.10],
   [b.rotorBearingHousings,b.innerRing,'z','x',.10],
  ];
  m.root.updateMatrixWorld(true);
  for(const[bearings,ring,axis,offsetAxis,offset]of sets){const solid=solidSurface(ring.geometry);
   for(const h of bearings){
    const length=h.geometry.userData.outerProfile.at(-1).axial*2;
    const point=h.position.clone();point[axis]+=h.userData.side*(length/2-.0005);
    point[offsetAxis]+=offset;
    // Both objects are fixed in the same parent, including the 355 ring offset.
    point.applyMatrix4(h.parent.matrixWorld).applyMatrix4(ring.matrixWorld.clone().invert());
    assert.ok(solid.signedDistance(point,.03)<0,`${id} ${h.userData.role} must join its frame`);
   }
  }
 }
});
