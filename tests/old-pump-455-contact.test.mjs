import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredOldRotaryPumpMovement} from '../src/simulation/authored-old-rotary-pumps.js';

// Independently measure the visible plate edges against the actual rounded
// abutment, including the contact point's moment arm about the moving hinge.
test('455 finite contact closes the vane with an opposing normal and releases without crossing the abutment',()=>{
  const model=createAuthoredOldRotaryPumpMovement({id:455}),d=model.root.userData,b=d.blocks,g=d.solidReview.contact;
  const center=new THREE.Vector3(...g.center,0),v=b.valves[0];
  let engaged=0,minimumMoment=Infinity,maximumContactGap=0;
  for(let i=0;i<1440;i++){
    const time=d.geometry.cycleDuration*i/1440,state=d.stateAtTime(time).valves[0];
    model.update(time);model.root.updateMatrixWorld(true);
    const hinge=v.hinge.getWorldPosition(new THREE.Vector3());let nearest;
    let distance=Infinity;
    for(const mesh of [v.blade,v.flexibleLip])for(const polygon of mesh.geometry.userData.plate.polygons){
      const ring=polygon[0];
      for(let k=0;k<ring.length-1;k++){
        const a=new THREE.Vector3(...ring[k],0).applyMatrix4(mesh.matrixWorld),z=new THREE.Vector3(...ring[k+1],0).applyMatrix4(mesh.matrixWorld);
        const point=new THREE.Line3(a,z).closestPointToPoint(center,true,new THREE.Vector3()),value=point.distanceTo(center);
        if(value<distance){distance=value;nearest=point;}
      }
    }
    const gap=distance-g.radius;
    assert.ok(gap>0,`finite vane/abutment at ${i}: ${gap}`);
    if(state.contactEngaged){
      engaged++;
      const normal=nearest.clone().sub(center).normalize(),arm=nearest.clone().sub(hinge),moment=arm.x*normal.y-arm.y*normal.x;
      minimumMoment=Math.min(minimumMoment,moment);maximumContactGap=Math.max(maximumContactGap,gap);
      assert.ok(moment>.78,`closing moment at ${i}: ${moment}`);
      const shaftMoment=nearest.x*normal.y-nearest.y*normal.x;
      assert.ok(shaftMoment>-.001,`normal opposes clockwise input at ${i}: ${shaftMoment}`);
      assert.ok(gap<.0003,`contact remains engaged at ${i}: ${gap}`);
    }
  }
  assert.ok(engaged>350);assert.ok(minimumMoment>.78);assert.ok(maximumContactGap<.0003);
});
