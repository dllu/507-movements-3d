import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredOldRotaryPumpMovement} from '../src/simulation/authored-old-rotary-pumps.js';

// Independently measure the visible plate edges against Brown's square
// abutment block, including the contact point's moment arm about the moving hinge.
const closest=(p,a,b)=>new THREE.Line3(a,b).closestPointToPoint(p,true,new THREE.Vector3());
const inside=(p,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;};

test('455 finite contact closes the vane against the square block with an opposing normal and releases without crossing it',()=>{
  const model=createAuthoredOldRotaryPumpMovement({id:455}),d=model.root.userData,b=d.blocks,g=d.solidReview.contact;
  const block=g.block.map(([x,y])=>new THREE.Vector3(x,y,0));
  const faces=[[block[1],block[0]],[block[0],block[97]]],ends=[block[0],block[1],block[97]];
  const v=b.valves[0];
  let engaged=0,minimumMoment=Infinity,maximumContactGap=0,forward=0,minimumShaftMoment=Infinity;
  for(let i=0;i<1440;i++){
    const time=d.geometry.cycleDuration*i/1440,state=d.stateAtTime(time).valves[0];
    model.update(time);model.root.updateMatrixWorld(true);
    const hinge=v.hinge.getWorldPosition(new THREE.Vector3());
    let distance=Infinity,nearest,from;
    const rings=[];
    for(const mesh of [v.blade,v.flexibleLip])for(const polygon of mesh.geometry.userData.plate.polygons)
      rings.push(polygon[0].map(p=>new THREE.Vector3(...p,0).applyMatrix4(mesh.matrixWorld)));
    for(const ring of rings){
      for(let k=0;k<ring.length-1;k++){
        for(const [a,z] of faces){const q=closest(ring[k],a,z),value=q.distanceTo(ring[k]);if(value<distance){distance=value;nearest=ring[k];from=q;}}
        for(const e of ends){const q=closest(e,ring[k],ring[k+1]),value=q.distanceTo(e);if(value<distance){distance=value;nearest=q;from=e;}}
        assert.ok(!inside(ring[k],block),`vane vertex inside block at ${i}`);
      }
      for(const e of block)assert.ok(!inside(e,ring),`block vertex inside vane at ${i}`);
    }
    assert.ok(distance>0,`finite vane/abutment at ${i}: ${distance}`);
    if(state.contactEngaged){
      engaged++;
      const normal=nearest.clone().sub(from).normalize(),arm=nearest.clone().sub(hinge),moment=arm.x*normal.y-arm.y*normal.x;
      minimumMoment=Math.min(minimumMoment,moment);maximumContactGap=Math.max(maximumContactGap,distance);
      assert.ok(moment>.6,`closing moment at ${i}: ${moment}`);
      const shaftMoment=nearest.x*normal.y-nearest.y*normal.x;
      // While the folded tip slips past the block's square corner (the last
      // few degrees of closing) the push has a small forward shaft moment;
      // the contact stays compressive and never pulls the vane.
      if(shaftMoment<-.001)forward++;
      minimumShaftMoment=Math.min(minimumShaftMoment,shaftMoment);
      assert.ok(distance<.0003,`contact remains engaged at ${i}: ${distance}`);
    }
  }
  assert.ok(forward<=30&&minimumShaftMoment>-.3,`forward shaft moment ${forward} samples, minimum ${minimumShaftMoment}`);
  assert.ok(engaged>300);assert.ok(minimumMoment>.6);assert.ok(maximumContactGap<.0003);
});
