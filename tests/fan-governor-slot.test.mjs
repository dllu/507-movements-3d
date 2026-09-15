import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createAuthoredGovernorMovement} from '../src/simulation/authored-governors.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';
test('147 collar pin clears the actual output-lever slot through the lift cycle',()=>{
 const model=createAuthoredGovernorMovement({id:147});
 try{
  const {blocks:b,geometry:g}=model.root.userData,body=b.valveLeverBody,solid=solidSurface(body.geometry);
  for(let i=0;i<=128;i++){
   model.update(g.cyclePeriod*i/128);model.root.updateMatrixWorld(true);
   const axis=b.outputFollower.getWorldPosition(new Vector3()),inverse=body.matrixWorld.clone().invert();
   for(let j=0;j<48;j++){
    const p=new Vector3(axis.x+.12*Math.cos(j*Math.PI/24),axis.y+.12*Math.sin(j*Math.PI/24),g.leverPlaneZ).applyMatrix4(inverse);
    assert.ok(solid.signedDistance(p)>.0027);
   }
  }
  assert.equal(b.valveLeverSlot.visible,false);
 }finally{disposeObject3D(model.root);}
});
