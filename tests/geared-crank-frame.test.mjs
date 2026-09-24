import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {gearedCrankState,gearedCrankSource as g,grooveRadius,sourcePoint} from '../src/simulation/geared-crank-source.js';
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
 assert.ok(high-low>.3,'lever does not rock');
 assert.ok(Math.abs(previous.leverAngle-first.leverAngle)<1e-9);
});
test('148 groove walls, lever bore and pin clear each other throughout the turn',()=>{
 const v=makeGearedCrankFrame();
 try{
  const parts=v.root.userData.parts,walls=['oblong-groove-outer-wall','oblong-groove-inner-wall'].map(n=>[parts[n],solidSurface(parts[n].geometry)]);
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
