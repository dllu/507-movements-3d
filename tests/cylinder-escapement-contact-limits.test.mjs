import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredCylinderEscapementMovement as create} from '../src/simulation/authored-cylinder-escapements.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

test('294/295 nominal impulse point is inside the actual tooth, not a qualified working surface',()=>{
 for(const id of[294,295]){
  const m=create({id}),d=m.root.userData,b=d.blocks;
  for(const q of[.1,.205,.48,.705,.86]){
   m.update(q*4);m.root.updateMatrixWorld(true);const s=d.kinematics,p=new T.Vector3(s.contact.expectedPoint.x,s.contact.expectedPoint.y,d.geometry.workingPlaneZ),head=b.palletHeads[s.activeToothIndex];
   const gap=solidSurface(head.geometry).signedDistance(p.applyMatrix4(head.matrixWorld.clone().invert()),.1);
   assert.ok(gap<-.016&&gap>-.018,`nominal point is embedded ${gap}; a near-zero point residual cannot validate its normal`);
   assert.equal(d.contacts.contactKind,'prescribed-reference-point');assert.equal(d.contacts.finiteSurfaceValidated,false);
  }
  assert.equal(d.finiteContactReview.loadedLockingValidated,false);assert.equal(d.finiteContactReview.oppositeFiniteImpulsesValidated,false);assert.equal(d.transmission.loadedImpulseValidated,false);
  assert.match(d.reconstructionNote,/finite teeth still intersect/);
 }
});

test('294 retained actual-shell and lip witnesses remain explicit, including neighboring teeth',()=>{
 const m=create({id:294}),d=m.root.userData,b=d.blocks,points=surfacePoints(b.palletHeads[0].geometry);
 for(const[q,part,lower,upper]of[[89/128,b.workingShell,-.082,-.080],[98/128,b.exitLipRail,-.027,-.025],[95/128,b.entryLipRail,-.025,-.023]]){
  m.update(q*4);m.root.updateMatrixWorld(true);const solid=solidSurface(part.geometry);let minimum=Infinity,tooth;
  // All 15 teeth, not only the index selected by the nominal point schedule.
  for(const head of b.palletHeads){const transform=part.matrixWorld.clone().invert().multiply(head.matrixWorld);for(const point of points){const gap=solid.signedDistance(point.clone().applyMatrix4(transform),.1);if(gap<minimum){minimum=gap;tooth=head.userData.index;}}}
  assert.ok(minimum>lower&&minimum<upper,`${part.userData.role}: ${minimum}`);
  console.log({q,tooth,activeTooth:d.kinematics.activeToothIndex,surface:part.userData.role,minimum});
 }
});
