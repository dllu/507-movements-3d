import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createAuthoredParabolaDrawingMovement as parabola} from '../src/simulation/authored-parabola-drawing.js';
import {createAuthoredPointedArchMovement as arch} from '../src/simulation/authored-pointed-arch-instruments.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const[id,create]of[[406,parabola],[407,arch]]) {
 test(`${id} finite guide, pencil, cord and selected working neighbors clear across the full cycle`,()=>{
  const model=create({id}),d=model.root.userData,b=d.blocks,pairs=[];
  try {
   const barrel=b.workingPencil.barrel;
   const bight=b.pencil.children.find(o=>o.userData.role==='white-thread-bight-around-pencil');
   if(id===406){
    for(const o of[b.blade,b.bladeEnd])for(const f of[barrel,...b.focusPin.children])pairs.push([o,f]);
    pairs.push([b.focusCord,b.bladeCord],[b.focusCord,bight],[b.bladeCord,bight]);
    for(const o of[b.focusCord,b.bladeCord,bight])for(const f of[barrel,b.blade,...b.focusPin.children])pairs.push([o,f]);
   }else{
    const pin=b.slide.children.find(o=>o.userData.role==='slide-pin-carrying-cord-loop');
    pairs.push([b.slideBlock,b.baseBar],[pin,b.slideBlock],[b.cord,barrel],[b.cord,pin],[b.tipEye,barrel],[b.elasticBar,barrel],[b.elasticBar,b.fulcrumPiece.children[0]],[b.elasticBar,b.baseBar]);
   }
   const cache=new Map(),dynamic=new Set([b.elasticBar,bight]);
   const get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
   let worst=0,description='';
   for(let i=0;i<=32;i++){
    model.update(d.geometry.cycleDuration*i/32);model.root.updateMatrixWorld(true);
    // Both the flexible strip and pencil bight mutate their retained GPU buffer.
    for(const o of dynamic)cache.delete(o);
    for(const pair of pairs)for(const[moving,fixed]of[pair,[...pair].reverse()]){
     const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld),target=get(fixed).surface;
     for(const point of get(moving).points){const q=point.clone().applyMatrix4(transform);if(target.box.distanceToPoint(q)>1e-6)continue;const gap=target.signedDistance(q,.03);if(gap<worst){worst=gap;description=`${i}: ${moving.userData.role} / ${fixed.userData.role}`;}}
    }
   }
   assert.ok(worst>-2e-6,`${description}: ${worst}`);
  }finally{disposeObject3D(model.root);}
 });
 test(`${id} retains scene and GPU geometry with a readable source-facing cycle`,()=>{
  const model=create({id}),d=model.root.userData;
  try{const snapshot=()=>{const out=[];model.root.traverse(o=>out.push([o,o.geometry]));return out;},before=snapshot();for(let i=0;i<=128;i++)model.update(i*d.geometry.cycleDuration/128);assert.deepEqual(snapshot(),before);assert.equal(d.minimumDisplayCycleSeconds,d.geometry.cycleDuration);assert.equal(d.hideGround,true);assert.ok(model.cameraDirection.z>model.cameraDirection.x*10);assert.match(d.workingPartsReview.residual,/not/);}
  finally{disposeObject3D(model.root);}
 });
}

test('406 traverses the whole specified parabola and bears against the actual blade edge',()=>{
 const model=parabola({id:406}),d=model.root.userData,b=d.blocks,g=d.geometry;
 try{
  assert.equal(g.maximumSquareOffset,g.targetHalfWidth);
  for(const phase of[.25,.75]){
   model.update((phase-g.sourcePhaseOffset)*g.cycleDuration);model.root.updateMatrixWorld(true);
   const s=d.kinematics;
   assert.ok(Math.abs(Math.abs(s.pencilPoint.x)-g.targetHalfWidth)<1e-12);
   assert.ok(Math.abs(s.pencilPoint.y-g.targetBaseY)<1e-12);
   const edge=b.blade.getWorldPosition(new T.Vector3()).x+g.bladeWidth/2;
   assert.ok(Math.abs(s.pencilPoint.x-.085-edge)<1e-12,'finite pencil is tangent to the guide');
  }
  const bight=b.pencil.children.find(o=>o.userData.role==='white-thread-bight-around-pencil');
  const positions=bight.geometry.attributes.position,k=48*13;
  const center=new T.Vector3().fromBufferAttribute(positions,k).add(new T.Vector3().fromBufferAttribute(positions,k+6)).multiplyScalar(.5);
  assert.equal(solidSurface(bight.geometry).inside(center),true,'closed cord has outward-facing walls');
  assert.ok(b.bladeCord.position.x>b.blade.position.x+b.square.position.x+g.bladeWidth/2,'vertical cord remains visible beside the blade');
 }finally{disposeObject3D(model.root);}
});

test('407 real slot passes through the base and captures the bored slide between cheeks',()=>{
 const model=arch({id:407}),b=model.root.userData.blocks;
 try{
  const base=solidSurface(b.baseBar.geometry),slide=solidSurface(b.slideBlock.geometry);
  assert.equal(base.inside(new T.Vector3(0,-.02,0)),false,'open slot');
  assert.equal(base.inside(new T.Vector3(0,.16,0)),true,'material above slot');
  assert.equal(slide.inside(new T.Vector3(0,0,0)),false,'actual pin bore');
  assert.equal(slide.inside(new T.Vector3(.12,0,0)),true,'finite slider body');
  b.slideBlock.geometry.computeBoundingBox();
  assert.ok(b.slideBlock.geometry.boundingBox.max.z>.19&&b.slideBlock.geometry.boundingBox.min.z<-.19,'slider spans the base thickness');
  assert.equal(b.slideRetainers.length,2);
  for(const cheek of b.slideRetainers){cheek.geometry.computeBoundingBox();assert.ok(cheek.geometry.boundingBox.max.y-cheek.geometry.boundingBox.min.y>.15,'retaining cheek cannot fall through slot');}
 }finally{disposeObject3D(model.root);}
});

test('407 prescribed arch preserves material length and remains below its apex',()=>{
 const model=arch({id:407}),d=model.root.userData,g=d.geometry;
 try{
  for(const bend of[0,.25,.5,.75,1]){
   let length=0,previous=d.pointOnWorkingEdge(0,bend);
   for(let i=1;i<=2048;i++){const p=d.pointOnWorkingEdge(i/2048,bend);length+=p.distanceTo(previous);if(bend===1)assert.ok(p.y>=previous.y&&p.y<=g.apex.y+1e-12,'monotone crown');previous=p;}
   assert.ok(Math.abs(length-g.elasticBarLength)<2e-7,'independent arclength sum');
  }
  const p=d.pointOnWorkingEdge(.25,1),t=d.tangentOnWorkingEdge(.25,1),q=p.clone().addScaledVector(new T.Vector2(t.y,-t.x),g.barDepth/2);
  assert.equal(solidSurface(d.blocks.elasticBar.geometry).inside(new T.Vector3(q.x,q.y,0)),true,'finite strip has correct winding');
 }finally{disposeObject3D(model.root);}
});
