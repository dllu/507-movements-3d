import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredDuplexEscapementMovement as duplex} from '../src/simulation/authored-duplex-escapements.js';
import {createAuthoredLeverEscapementMovement as lever} from '../src/simulation/authored-lever-escapements.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
for(const[id,create]of[[293,duplex],[296,lever]]){
 test(`${id}: finite arbors clear actual journal bores and connected rear supports`,()=>{
  const m=create({id}),d=m.root.userData,p=d.escapementInterfaces;
  const pairs=[...p.pairs,...p.shafts.flatMap(s=>p.supports.map(t=>[s,t]))],points=new Map(),solids=new Map();
  for(const[a,b]of pairs){if(!points.has(a))points.set(a,surfacePoints(a.geometry));if(!solids.has(b))solids.set(b,solidSurface(b.geometry));}
  let count=0,min=.005;const point=new THREE.Vector3();
  for(let i=0;i<=16;i++){m.update(d.geometry.balancePeriod*i/16);m.root.updateMatrixWorld(true);for(const[a,b]of pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const v of points.get(a)){point.copy(v).applyMatrix4(matrix);const gap=solids.get(b).signedDistance(point,.005);min=Math.min(min,gap);count++;assert.ok(gap>=-1e-5,`${id} ${a.userData.role} cuts ${b.userData.role} by ${-gap}`);}}}
  console.log({id,count,min});
 });
 test(`${id}: readable source view and explicit contact limitations retain stable scene buffers`,()=>{
  const m=create({id}),d=m.root.userData,b=d.blocks,saved=[];
  m.root.traverse(o=>{if(o.geometry)saved.push([o,o.geometry,o.geometry.attributes.position.array]);for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});
  for(let i=0;i<=16;i++)m.update(d.geometry.balancePeriod*i/16);
  let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,saved.length);for(const[o,g,a]of saved){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
  assert.equal(b.base.visible,false);assert.equal(b.cameraEnvelope.visible,false);assert.equal(b.balanceRim.visible,false);assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,4);assert.match(d.reconstructionNote,/unresolved/);assert.ok(m.cameraDirection.z>10);
 });
}
test('293 remaining radial lock has zero resisting moment and is not represented as qualified',()=>{
 const d=duplex({id:293}).root.userData,g=d.geometry,s=d.stateAtTime(.1),radial=s.activeLockingToothPoint.clone().sub(g.wheelCenter),normal=s.activeLockingToothPoint.clone().sub(g.balanceCenter).normalize(),tangent=new THREE.Vector2(radial.y,-radial.x).normalize();
 assert.ok(Math.abs(normal.dot(tangent))<1e-12);assert.match(d.escapementInterfaces.contactResidual,/cannot positively lock/);
});
test('296 retained pallet depth gap is recorded instead of falsely qualifying a disconnected mesh',()=>{
 const m=lever({id:296}),d=m.root.userData,b=d.blocks;m.root.updateMatrixWorld(true);
 const wheel=new THREE.Box3().setFromObject(b.wheelTeeth[0]);
 for(const pallet of b.palletBlocks){const bounds=new THREE.Box3().setFromObject(pallet);assert.ok(bounds.min.z-wheel.max.z>.03);}
 assert.match(d.escapementInterfaces.contactResidual,/above the wheel working depth/);
});

test('296 new rigid lever end C clears wheel, balance pin, arbors and fixed banking hardware',()=>{
 const m=lever({id:296}),d=m.root.userData,b=d.blocks,end=d.escapementInterfaces.leverEnd;
 const targets=[b.wheelRim,...b.wheelTeeth,b.impulsePin,b.rollerDisk,b.balanceStaff,b.wheelShaft,...b.bankingPins,...d.escapementInterfaces.supports];
 const pairs=targets.flatMap(target=>[[end,target],[target,end]]),points=new Map(),solids=new Map();
 for(const[a,b]of pairs){if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));}
 const phases=[...Array.from({length:65},(_,i)=>i/64),...['pinEngagementHalfPhase','pinDisengagementHalfPhase','palletReleaseHalfPhase','palletImpulseEndHalfPhase'].flatMap(k=>[d.geometry[k]/2,.5+d.geometry[k]/2])];
 const point=new THREE.Vector3();let min=.005,count=0;
 for(const phase of phases){m.update(d.geometry.balancePeriod*phase);m.root.updateMatrixWorld(true);
  for(const[a,b]of pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const v of points.get(a.geometry)){point.copy(v).applyMatrix4(matrix);const gap=solids.get(b.geometry).signedDistance(point,.005);min=Math.min(min,gap);count++;assert.ok(gap>=-1e-5,`lever C, phase ${phase}: ${a.userData.role} cuts ${b.userData.role} by ${-gap}`);}}
 }console.log({newLeverQueries:count,min});
});


test('296 flat widened C tab is continuous with the original anchor at the same depth',()=>{
 const m=lever({id:296}),d=m.root.userData,b=d.blocks,end=d.escapementInterfaces.leverEnd;
 const geometry=end.geometry.userData.plate;
 assert.equal(geometry.low,-d.geometry.forkDepth/2);assert.equal(geometry.high,d.geometry.forkDepth/2);
 const outline=geometry.polygons[0][0];assert.equal(outline.length,5);assert.ok(outline[1][1]-outline[2][1]>.65);
 m.root.updateMatrixWorld(true);const anchor=solidSurface(b.anchorBody.geometry),matrix=b.anchorBody.matrixWorld.clone().invert().multiply(end.matrixWorld);
 const overlap=Math.min(...surfacePoints(end.geometry).map(p=>anchor.signedDistance(p.clone().applyMatrix4(matrix),.05)));
 assert.ok(overlap<-.02,`flat C tab is disconnected: ${overlap}`);
});
