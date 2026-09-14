import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {createMovementModel,applyDisplayTiming} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
const box=(mesh,reflection)=>{mesh.geometry.computeBoundingBox();const matrix=mesh.matrixWorld.clone();if(reflection)matrix.premultiply(new THREE.Matrix4().makeScale(1,1,-1));return new OBB().fromBox3(mesh.geometry.boundingBox).applyMatrix4(matrix);};
test('132 handle clears both frame columns, while the former rearward sweep intersects',()=>{
 const v=createMovementModel(movement),u=v.root.userData,d=u.geometry,b=u.blocks,meshes=[];
 for(const group of [b.handLever,b.handleGrip])group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 let oldCollision=false;
 try{
  for(let i=0;i<=720;i++){
   v.update(i*d.cyclePeriod/720);v.root.updateMatrixWorld(true);
   for(const mesh of meshes)for(const column of b.frameColumns){
    assert(!box(mesh).intersectsOBB(box(column)),`handle intersects ${column.userData.side} column at ${i}`);
    oldCollision ||= box(mesh,true).intersectsOBB(box(column));
   }
   assert(Math.max(...u.kinematics.rodLengthErrors.map(Math.abs))<1e-12);
   const visibleBox=new THREE.Box3();v.root.traverse(o=>{if(o.isMesh&&o.visible&&!o.userData.cameraFitGuide)visibleBox.union(new THREE.Box3().setFromObject(o,true));});
   assert(u.cameraFitBounds.containsBox(visibleBox));
  }
  assert(oldCollision,'negative control must detect the original collision');
  assert(u.hideGround);assert(u.supportsRestart);assert(!b.upperRotationIndex.visible);assert(!b.platenMotionIndex.visible);
  applyDisplayTiming(v,movement);assert.equal(u.animationTiming.displayCycleDuration,4);
  v.reset();assert(Math.abs(u.kinematics.downwardDisplacement)<1e-12);
 }finally{disposeObject3D(v.root);}
});
