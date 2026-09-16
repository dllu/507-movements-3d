import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredSlottedDiskLeverMovement} from '../src/simulation/authored-slotted-disk-levers.js';
import {createAuthoredRackPumpMovement} from '../src/simulation/authored-rack-pumps.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const role=(root,name)=>{let mesh;root.traverse(o=>{if(o.userData.role===name)mesh=o;});assert.ok(mesh,name);return mesh;};
function audit(model,pairs,frames=65) {
 const solids=new Map(),points=new Map();
 for(const o of new Set(pairs.flat())) {solids.set(o,solidSurface(o.geometry));const all=surfacePoints(o.geometry);points.set(o,all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/1000))===0));}
 for(let i=0;i<frames;i++) {
  model.update(4*i/(frames-1));model.root.updateMatrixWorld(true);
  for(const[a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]) {
   const mat=to.matrixWorld.clone().invert().multiply(from.matrixWorld);let min=.01;
   for(const p of points.get(from))min=Math.min(min,solids.get(to).signedDistance(p.clone().applyMatrix4(mat),.01));
   assert.ok(min>-2e-5,`${i}: ${from.userData.role} in ${to.userData.role}: ${min}`);
  }
 }
}
test('282 actual slot, guide, teeth and pulley solids clear throughout a crank revolution',()=>{
 const model=createAuthoredSlottedDiskLeverMovement({id:282}),b=model.root.userData.blocks;
 audit(model,[[b.leverBody,b.diskRim],[b.leverBody,b.diskHub],[b.drivePin,b.leverBody],[b.guidePin,b.topGuide],[b.sector,b.pivotPin],
  ...b.rackTeeth.map(t=>[t,b.sector]),[b.rackBody,b.sector],
  ...[b.pulleySheave,...b.pulleyFlanges].flatMap(p=>[b.incomingCord,b.verticalCord,...b.wrappedCordSegments].map(c=>[c,p]))]);
});
test('283 both racks mesh with the pinion and remain clear in actual guides and pump bores',()=>{
 const model=createAuthoredRackPumpMovement({id:283}),{root}=model,b=root.userData.blocks,pinion=b.pinionRotor.children[0];
 audit(model,[...b.leftRackTeeth.concat(b.rightRackTeeth).map(t=>[t,pinion]),
  [b.leftRackBody,pinion],[b.rightRackBody,pinion],[b.pinionAxle,pinion],[b.pinionAxle,b.pinionRotor.children[1]],
  ...['left','right'].flatMap(side=>{
   const body=b[side+'RackBody'],rod=b[side+'PistonRod'];
   return [[pinion,role(root,`${side}-fixed-rack-slide-guide`)],[body,role(root,`${side}-fixed-rack-slide-guide`)],[body,b.baseSlab],[rod,b.baseSlab],
    [b[side+'Piston'],b.pumpCylinders[side==='left'?0:1]]];
  })]);
});
