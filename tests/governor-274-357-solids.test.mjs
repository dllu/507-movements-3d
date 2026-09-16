import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {createAuthoredParabolicGovernorMovement as parabolic} from '../src/simulation/authored-parabolic-governors.js';
import {createAuthoredAndersonGovernorMovement as anderson} from '../src/simulation/authored-anderson-governors.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
for(const[id,make]of[[274,parabolic],[357,anderson]])test(`${id}: selected finite working interfaces clear over the authored cycle`,()=>{
 const m=make({id}),d=m.root.userData,p=d.governorWorkingParts,samples=new Map(),solids=new Map();
 for(const[a,b]of p.pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(b))solids.set(b,solidSurface(b.geometry));}
 for(const[a,points]of samples){const q=a.geometry.parameters;if(a.geometry.type!=='CylinderGeometry')continue;for(let i=1;i<32;i++)for(let j=0;j<q.radialSegments;j++){const theta=j*2*Math.PI/q.radialSegments;points.push(new THREE.Vector3(q.radiusTop*Math.sin(theta),q.height*(i/32-.5),q.radiusTop*Math.cos(theta)));}}
 let count=0,min=.01;const point=new THREE.Vector3();
 for(let i=0;i<=16;i++){m.update(d.geometry.cyclePeriod*i/16);m.root.updateMatrixWorld(true);for(const[a,b]of p.pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const v of samples.get(a)){point.copy(v).applyMatrix4(matrix);const gap=solids.get(b).signedDistance(point,.01);min=Math.min(min,gap);count++;assert.ok(gap>=-1e-5,`${id} pose${i}: ${a.userData.role} cuts ${b.userData.role} by${-gap} at${point.toArray()}`);}}}
 console.log({id,count,min});
});
function assembledGear(gear){const rotor=gear.userData.rotor;rotor.updateWorldMatrix(true,true);const inv=rotor.matrixWorld.clone().invert();const pieces=[gear.userData.body,...gear.userData.toothMeshes].map(o=>o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)).toNonIndexed().deleteAttribute('uv'));const result=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return result;}
test('357: both actual conical tooth pairs clear and remain close over a tooth period',()=>{
 const m=anderson({id:357}),d=m.root.userData,b=d.blocks;
 m.update(0);m.root.updateMatrixWorld(true);
 const pairs=d.governorWorkingParts.gearPairs.map(([a,b])=>({a,b,sample:surfacePoints(assembledGear(a)),solid:solidSurface(assembledGear(b))}));
 let count=0;const results=[];
 for(const {a,b,sample,solid}of pairs){let min=.02,maxClosest=0;
  for(let i=0;i<=32;i++){
   // Monotonic carrier angle: solve time for exactly one crown/drive tooth pitch.
   const angle=d.geometry.sourceCarrierYaw+i/32*2*Math.PI/(a===d.blocks.pinion?60:18);let lo=0,hi=d.geometry.cyclePeriod;
   for(let j=0;j<48;j++){const mid=(lo+hi)/2;if(d.stateAtTime(mid).carrierAngle<angle)lo=mid;else hi=mid;}m.update((lo+hi)/2);m.root.updateMatrixWorld(true);
   const matrix=b.userData.rotor.matrixWorld.clone().invert().multiply(a.userData.rotor.matrixWorld);let closest=.02;
   for(const v of sample){const q=v.clone().applyMatrix4(matrix),gap=solid.signedDistance(q,.02);count++;min=Math.min(min,gap);closest=Math.min(closest,gap);assert.ok(gap>=-1e-5,`${a.userData.role} pose${i} cuts mate by${-gap} at${q.toArray()}`);}maxClosest=Math.max(maxClosest,closest);
  }
  results.push({gear:a.userData.role,min,maxClosest});assert.ok(maxClosest<.01,'working profiles must remain close, not simply separate');
 }
 console.log({count,results});
});
for(const[id,make]of[[274,parabolic],[357,anderson]])test(`${id}: playback preserves scene and GPU buffers with explicit dynamics limits`,()=>{
 const m=make({id}),d=m.root.userData,meshes=[];m.root.traverse(o=>{if(o.geometry)meshes.push([o,o.geometry,o.geometry.attributes.position.array]);for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
 for(let i=0;i<=16;i++)m.update(d.geometry.cyclePeriod*i/16);
 let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,meshes.length);for(const[o,g,a]of meshes){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
 assert.equal(d.minimumDisplayCycleSeconds,12);assert.equal(d.hideGround,true);assert.match(d.reconstructionNote,/prescribed/);
 if(id===357){const spring=d.blocks.springL,coil=spring.children[0],path=coil.geometry.parameters.path;const p=coil.geometry.attributes.position;for(let i=0;i<=192;i++){const center=path.getPointAt(i/192);for(let j=0;j<9;j++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(p,i*9+j).distanceTo(center)-.027)<1e-6);}assert.deepEqual(spring.scale.toArray(),[1,1,1]);}
});
