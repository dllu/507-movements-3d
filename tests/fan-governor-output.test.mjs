import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

test('147 candidate collar, slot and pivot have actual mesh clearance across lift and rotation',()=>{
 const visual=makeFanGovernorGeometry(),{parts,blocks}=visual.root.userData;
 try{
  const neck=solidSurface(parts['upper-neck'].geometry),lever=solidSurface(parts['output-lever'].geometry);
  const collarPoints=surfacePoints(parts['output-collar'].geometry);
  let minimumCollar=Infinity,minimumSlot=Infinity,minimumPivot=Infinity;
  for(let i=0;i<=64;i++){
   const lift=-.34+.84*i/64;
   visual.sync({shaft:i*.71,lift,yaw:i*.53});
   assert.equal(blocks.collar.rotation.y,0);
   const toNeck=parts['upper-neck'].matrixWorld.clone().invert().multiply(parts['output-collar'].matrixWorld);
   for(const point of collarPoints)minimumCollar=Math.min(minimumCollar,neck.signedDistance(point.clone().applyMatrix4(toNeck)));
   const toLever=parts['output-lever'].matrixWorld.clone().invert();
   // Cross sections through the actual cylindrical pins, within the lever's
   // thickness. Pin end vertices alone would miss a blocked bore or slot.
   for(let j=0;j<96;j++){
    const a=2*Math.PI*j/96;
    minimumSlot=Math.min(minimumSlot,lever.signedDistance(new Vector3(.045*Math.cos(a),2.94+lift+.045*Math.sin(a),.38).applyMatrix4(toLever)));
    minimumPivot=Math.min(minimumPivot,lever.signedDistance(new Vector3(3+.06*Math.cos(a),2.94+.06*Math.sin(a),.38).applyMatrix4(toLever)));
   }
  }
  assert.ok(minimumCollar>.0045,`collar clearance ${minimumCollar}`);
  assert.ok(minimumSlot>.0045,`slot clearance ${minimumSlot}`);
  assert.ok(minimumPivot>.0028,`pivot clearance ${minimumPivot}`);
 }finally{visual.dispose();}
});
