import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredMangleWheelMovement as mangle} from '../src/simulation/authored-mangle-wheels.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const fields=new WeakMap(),samples=new WeakMap(),faces=new WeakMap();
const field=g=>{if(!fields.has(g))fields.set(g,solidSurface(g));return fields.get(g);};
const points=g=>{if(!samples.has(g))samples.set(g,surfacePoints(g));return samples.get(g);};
const triangles=g=>{if(!faces.has(g))faces.set(g,surfaceTriangles(g));return faces.get(g);};
function minimum(a,b){
 const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld),f=field(b.geometry);let distance=.03;
 for(const p of points(a.geometry))distance=Math.min(distance,f.signedDistance(p.clone().applyMatrix4(matrix),.03));
 return distance;
}
function usefulFace(m,id){
 const d=m.root.userData,b=d.blocks,s=d.kinematics,pinion=id===371?b.pinion.userData.rotor.children[0]:b.outputRotor.userData.pinion;
 const targets=id===371?[...b.frontFaceTeeth,...b.rearFaceTeeth]:b.rackCarrier.userData.teeth;
 const center=pinion.getWorldPosition(new THREE.Vector3()),inverse=pinion.matrixWorld.clone().invert(),p=new THREE.Vector3(),n=new THREE.Vector3();let best={gap:Infinity};
 for(const mesh of targets){
  if(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(center)>(id===371?.8:1.8))continue;
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(const t of triangles(mesh.geometry)){
   t.getMidpoint(p).applyMatrix4(mesh.matrixWorld);t.getNormal(n).applyNormalMatrix(normalMatrix);
   const outputMoment=id===371?-(p.x*n.y-p.y*n.x):(p.x-center.x)*n.y-(p.y-center.y)*n.x;
   const inputMoment=id===371?(p.y-center.y)*n.z-(p.z-center.z)*n.y:-(n.x*s.rackVelocity.x+n.y*s.rackVelocity.y);
   const useful=id===371?outputMoment*s.wheelAngularSpeed>.02:outputMoment>.03;
   if(!useful||inputMoment>=-1e-5)continue;
   const gap=field(pinion.geometry).signedDistance(p.clone().applyMatrix4(inverse),.04);
   if(gap>=-1e-5&&gap<best.gap)best={gap,outputMoment,inputMoment,tooth:mesh.userData.index,point:p.toArray(),normal:n.toArray()};
  }
 }
 return best;
}
for(const[id,create,cycle]of[[371,mangle,27]])test(`${id} actual finite teeth clear in both directions through both terminal transfers`,()=>{
 const m=create({id}),b=m.root.userData.blocks,pinion=id===371?b.pinion.userData.rotor.children[0]:b.outputRotor.userData.pinion;
 const teeth=id===371?[...b.frontFaceTeeth,...b.rearFaceTeeth]:b.rackCarrier.userData.teeth;
 const targets=id===371?[b.wheelBody,...teeth]:[b.rackCarrier.userData.outerRim,...teeth];let gap=Infinity;
 for(const phase of[...Array.from({length:73},(_,i)=>i/72),.0625,.3125,.458333333333,.9375,.958333333333]){
  m.update(cycle*phase);m.root.updateMatrixWorld(true);const center=pinion.getWorldPosition(new THREE.Vector3());
  for(const mesh of targets){
   if(mesh!==targets[0]&&mesh.getWorldPosition(new THREE.Vector3()).distanceTo(center)>(id===371?.8:1.8))continue;
   gap=Math.min(gap,minimum(pinion,mesh),minimum(mesh,pinion));
  }
 }
 console.log({id,bidirectionalToothGap:gap});assert.ok(gap>-.0001,`${id}: ${gap}`);
});
test('371 finite working faces supply opposing input and useful output moments on both runs and crossover',()=>{
 const m=mangle({id:371});let largest=0;
 for(const phase of[.0625,.2,.4375,.458333333333,.5,.625,.75,.9375,.958333333333]){
  m.update(27*phase);m.root.updateMatrixWorld(true);const witness=usefulFace(m,371);largest=Math.max(largest,witness.gap);
  // p94: uniform-section bars (the common part of every cut station) leave
  // up to 0.0075 backlash at the crossovers (was 0.0044 with the varying envelope).
  assert.ok(witness.gap<.008,JSON.stringify({phase,...witness}));assert.ok(Math.abs(witness.outputMoment)>.2);assert.ok(witness.inputMoment<-.03);
 }
 console.log({mangleUsefulFaceMaximum:largest});
 const data=m.root.userData.finiteToothProfiles.data;assert.ok(data.profiles.every(p=>Math.min(...p.heights.flat())>.006));
 let count=0;m.root.traverseVisible(o=>{if(o.isMesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.ok(count<150000,`${count} triangles`);
});
test('generated profiles preserve continuous prescribed motion and perform no per-frame mesh allocation',()=>{
 for(const[id,create,cycle]of[[371,mangle,27]]){
  const m=create({id}),d=m.root.userData,objects=[];m.root.traverse(o=>objects.push([o,o.geometry]));
  for(let i=0;i<=128;i++){const s=d.stateAtTime(cycle*i/128),a=d.stateAtTime(cycle*i/128-1e-7),b=d.stateAtTime(cycle*i/128+1e-7);assert.ok(Number.isFinite(s.wheelAngle??s.outputAngle));const delta=(b.wheelAngle??b.outputAngle)-(a.wheelAngle??a.outputAngle);assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<1e-5);m.update(cycle*i/128);}
  const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,objects);
 }
});
