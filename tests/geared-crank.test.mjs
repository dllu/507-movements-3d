import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeGearedCrank} from '../src/simulation/geared-crank.js';
import {solidSurface} from './helpers/solid-surface.mjs';
test('148 rebuilt gear hubs clear fixed axles throughout rotation',()=>{
 const v=makeGearedCrank();
 try{
  const hubs=['large-bored-hub','pinion-bored-hub'].map(n=>v.root.userData.parts[n]),solids=hubs.map(h=>solidSurface(h.geometry));let minimum=Infinity;
  for(let i=0;i<=64;i++){
   v.update(i*8/64);
   for(let k=0;k<hubs.length;k++){
    const hub=hubs[k],center=hub.getWorldPosition(new Vector3()),inverse=hub.matrixWorld.clone().invert();
    for(let j=0;j<96;j++){
     const a=2*Math.PI*j/96,p=new Vector3(center.x+.18*Math.cos(a),center.y+.18*Math.sin(a),0).applyMatrix4(inverse);
     minimum=Math.min(minimum,solids[k].signedDistance(p));
    }
   }
  }
  assert.ok(minimum>.0027,`minimum axle clearance ${minimum}`);
 }finally{v.dispose();}
});
test('148 complete motion stays framed, ignores fog and restarts',()=>{
 const v=makeGearedCrank();
 try{
  const initial=v.root.userData.state;
  for(let i=0;i<=256;i++){v.update(i*8/256);assert.ok(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(v.root,true)));}
  v.reset();assert.deepEqual(v.root.userData.state,initial);
  assert.equal(v.root.userData.hideGround,true);
  v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});
 }finally{v.dispose();}
});
