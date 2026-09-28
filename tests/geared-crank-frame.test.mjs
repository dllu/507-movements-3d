import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {gearedCrankState,gearedCrankSource as g,grooveRadius,sourcePoint,crankEye0} from '../src/simulation/geared-crank-source.js';
import {makeGearedCrankFrame,gearedCrankGroove as G} from '../src/simulation/geared-crank-frame.js';
import {solidSurface} from './helpers/solid-surface.mjs';
test('148 lever pin starts at the drawn pin and runs once round the gear groove per turn',()=>{
 const first=gearedCrankState(0);assert.ok(first.pin.distanceTo(sourcePoint(g.pin))<.02);
 let previous=first,travel=0,low=Infinity,high=-Infinity;
 for(let i=1;i<=2048;i++){
  const s=gearedCrankState(8*i/2048),local=s.pin.clone().rotateAround({x:0,y:0},-s.rotation);
  assert.ok(Math.abs(local.length()-grooveRadius(Math.atan2(local.y,local.x)))<1e-9,'pin left the groove centre line');
  assert.ok(Math.abs(s.pivot.distanceTo(s.pin)-first.pivot.distanceTo(first.pin))<1e-12);
  assert.ok(Math.abs(s.leverAngle-previous.leverAngle)<.004,'lever jumps');
  travel+=Math.atan2(Math.sin(s.grooveAngle-previous.grooveAngle),Math.cos(s.grooveAngle-previous.grooveAngle));
  low=Math.min(low,s.leverAngle);high=Math.max(high,s.leverAngle);previous=s;
 }
 assert.ok(Math.abs(Math.abs(travel)-2*Math.PI)<1e-6,'pin does not go round the groove once per turn');
 // The groove's outer lobe is eased inside the rim, so the lever rocks about 0.28 rad.
 assert.ok(high-low>.26,'lever does not rock');
 assert.ok(Math.abs(previous.leverAngle-first.leverAngle)<1e-9);
});
test('148 groove walls, lever bore and pin clear each other throughout the turn',()=>{
 const v=makeGearedCrankFrame();
 try{
  const parts=v.root.userData.parts,walls=['oblong-groove-band'].map(n=>[parts[n],solidSurface(parts[n].geometry)]);
  const lever=parts['rocking-lever'],leverSolid=solidSurface(lever.geometry);let pinClearance=Infinity,pivotClearance=Infinity;
  for(let i=0;i<=128;i++){
   const s=v.update(i*8/128);
   for(let j=0;j<96;j++){
    const a=2*Math.PI*j/96;
    for(const z of [-.05,0,.05]){
     const point=new Vector3(s.pin.x+G.pinRadius*Math.cos(a),s.pin.y+G.pinRadius*Math.sin(a),z);
     for(const [mesh,solid] of walls)pinClearance=Math.min(pinClearance,solid.signedDistance(point.clone().applyMatrix4(mesh.matrixWorld.clone().invert())));
    }
    const pivot=new Vector3(s.pivot.x+.16*Math.cos(a),s.pivot.y+.16*Math.sin(a),.15);
    pivotClearance=Math.min(pivotClearance,leverSolid.signedDistance(pivot.applyMatrix4(lever.matrixWorld.clone().invert())));
   }
  }
  assert.ok(pinClearance>.004,`pin-to-groove clearance ${pinClearance}`);
  assert.ok(pivotClearance>.002,`pivot clearance ${pivotClearance}`);
 }finally{v.dispose();}
});
test('148 groove band stays inside the large gear rim',()=>{
 let crest=0;for(let i=0;i<4096;i++)crest=Math.max(crest,grooveRadius(2*Math.PI*i/4096));
 // The rim's bore (inner edge of the toothed band) is 3.64 in geared-crank.js.
 assert.ok(crest+G.bandHalfWidth<3.64-.12,`outer groove wall reaches ${crest+G.bandHalfWidth}`);
});
test('148 short link joins the lever pin to a crank on the large gear axle, which swings to and fro',()=>{
 const v=makeGearedCrankFrame();
 try{
  const {parts,blocks}=v.root.userData,link=parts['crank-link'],crank=parts['axle-crank'];
  assert.equal(parts['groove-pin-head'],undefined);
  assert.equal(link.parent,blocks.link);assert.equal(crank.parent,blocks.crank);
  let low=Infinity,high=-Infinity;
  for(let i=0;i<=256;i++){
   const s=v.update(8*i/256);
   // Link ends sit on the crank pin and the lever pin at every pose.
   const pinEnd=new Vector3(s.pin.distanceTo(s.eye),0,0).applyMatrix4(link.matrixWorld),eyeEnd=new Vector3().applyMatrix4(link.matrixWorld);
   assert.ok(Math.hypot(pinEnd.x-s.pin.x,pinEnd.y-s.pin.y)<1e-9);assert.ok(Math.hypot(eyeEnd.x-s.eye.x,eyeEnd.y-s.eye.y)<1e-9);
   // The eye rides with the crank: its crank-frame position never changes.
   const local=new Vector3(s.eye.x,s.eye.y,0).applyMatrix4(crank.matrixWorld.clone().invert()),first=crankEye0;
   assert.ok(Math.hypot(local.x-first.x,local.y-first.y)<1e-9);
   assert.ok(Math.abs(Math.hypot(s.eye.x,s.eye.y)-1.75)<1e-9,'the eye stays on the crank circle');
   assert.ok(Math.abs(Math.hypot(s.pin.x-s.eye.x,s.pin.y-s.eye.y)-1.75)<1e-9,'the link keeps its length');
   low=Math.min(low,s.crankAngle);high=Math.max(high,s.crankAngle);
  }
  assert.ok(high-low>.8,'the crank swings');
 }finally{v.dispose();}
});
