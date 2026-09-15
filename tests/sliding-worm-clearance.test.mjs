import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Box3} from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const movement=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements[142];
const bounds=object=>new Box3().setFromObject(object,true);

test('143 carriage plates clear the actual guide throughout a complete traverse',()=>{
 const model=createMovementModel(movement);
 try {
  const {blocks:b,geometry:g}=model.root.userData;
  for(let i=0;i<=720;i++){
   model.update(g.completePatternPeriod*i/720);model.root.updateMatrixWorld(true);
   const rail=bounds(b.fixedGuideBar);
   for(const plate of [b.carriageBackplate,...b.guideShoes,...b.sideRetainers]){
    const overlap=rail.clone().intersect(bounds(plate));
    assert.ok(overlap.isEmpty()||Math.min(overlap.max.x-overlap.min.x,overlap.max.y-overlap.min.y,overlap.max.z-overlap.min.z)<1e-7,`guide interference at pose ${i}: ${plate.userData.role}`);
   }
   const front=bounds(b.carriageBackplate);
   assert.ok(front.min.z>rail.max.z+.02,'front plate has a running clearance');
   assert.ok(front.min.x>rail.min.x&&front.max.x<rail.max.x,'carriage stays on guide');
  }
 }finally{disposeObject3D(model.root);}
});

test('143 fixed rod pin reaches its supporting post and front pivot eye',()=>{
 const model=createMovementModel(movement);
 try{
  model.root.updateMatrixWorld(true);
  const b=model.root.userData.blocks,pin=bounds(b.fixedPivotPin),post=bounds(b.framePosts[1]),eye=bounds(b.fixedPivotRing);
  assert.ok(pin.min.z<post.max.z&&pin.max.z>post.max.z,'pin seats inside the post');
  assert.ok(pin.min.x>post.min.x&&pin.max.x<post.max.x);
  assert.ok(pin.min.y>post.min.y&&pin.max.y<post.max.y);
  assert.ok(pin.max.z>=eye.max.z,'pin spans the front eye');
 }finally{disposeObject3D(model.root);}
});
