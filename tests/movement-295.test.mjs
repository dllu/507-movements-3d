import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredCylinderEscapementMovement as create} from '../src/simulation/authored-cylinder-escapements.js';
test('295 resolves the three source outlines as successive positions of one cylinder',()=>{
 const m=create({id:295}),d=m.root.userData,b=d.blocks;
 assert.equal(d.transmission.compositeDrawingStateCount,3);assert.equal(d.transmission.physicalCylinderCount,1);assert.equal(d.transmission.sourceStatesAreSequential,true);
 assert.equal(d.sourceAnimation.available,false);assert.equal(b.sectionStaff.parent,null);assert.equal(b.palletHeads.length,15);assert.equal(b.palletLabelMarkers.length,3);assert.equal(b.cylinderSection.parent,b.cylinderAssembly);
});
test('294 and295 share the same finite geometry and motion in different source views',()=>{
 const a=create({id:294}),b=create({id:295});assert.equal(a.root.userData.cylinderContactBake,b.root.userData.cylinderContactBake);
 for(let i=0;i<=128;i++){const time=i/32,x=a.root.userData.stateAtTime(time),y=b.root.userData.stateAtTime(time);assert.equal(x.wheelAngle,y.wheelAngle);assert.equal(x.balanceAngle,y.balanceAngle);assert.equal(x.contactMode,y.contactMode);b.update(time);assert.equal(b.root.userData.blocks.wheelRotor.rotation.z,y.wheelAngle);}
 assert.notDeepEqual(a.cameraDirection.toArray(),b.cameraDirection.toArray());assert.equal(b.root.userData.hideGround,true);assert.ok(b.root.userData.minimumDisplayCycleSeconds>=6);
});
