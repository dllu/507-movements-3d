import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredDiagonalCatchMovement} from '../src/simulation/authored-diagonal-catches.js';
import {solidSurface} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
for(const id of [181,182])test(`${id} has bored pivots, separate handle planes and retained weight rods`,()=>{
 const m=createAuthoredDiagonalCatchMovement({id}),u=m.root.userData,b=u.blocks;
 try{
  for(const hub of [b.upperHandleHub,b.lowerHandleHub,b.catchHub]){
   const surface=solidSurface(hub.geometry);assert.equal(surface.inside(new THREE.Vector3()),false);
   assert.equal(surface.inside(new THREE.Vector3(.22,0,0)),true);
  }
  for(let i=0;i<=32;i++){
   m.update(u.geometry.cyclePeriod*i/32);m.root.updateMatrixWorld(true);
   const upper=new THREE.Box3().setFromObject(b.upperHandleHub),lower=new THREE.Box3().setFromObject(b.lowerHandleHub),catchHub=new THREE.Box3().setFromObject(b.catchHub);
   assert.ok(upper.max.z<lower.min.z&&lower.max.z<catchHub.min.z);
   for(const [body,rod]of [[b.upperHandle,b.upperWeightAssembly],[b.lowerHandle,b.lowerWeightAssembly],[b.catchGroup,b.catchWeightAssembly]]){
    const pin=body.children.find(c=>c.userData.role==='back-weight-rod-hinge-pin');
    const eye=rod.children.find(c=>c.userData.role?.endsWith('-bored-rod-eye'));
    const pp=pin.getWorldPosition(new THREE.Vector3()),ep=eye.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(pp.x-ep.x,pp.y-ep.y)<1e-12,'eye stays on its hinge pin');
    assert.equal(solidSurface(eye.geometry).inside(new THREE.Vector3()),false);
    const pb=new THREE.Box3().setFromObject(pin),eb=new THREE.Box3().setFromObject(eye);
    assert.ok(pb.min.z<eb.min.z&&pb.max.z>eb.max.z,'pin spans the rod eye');
   }
  }
  assert.equal(u.hideGround,true);assert.equal(u.materialsIgnoreSceneFog,true);
  m.reset();assert.equal(u.kinematics.cyclePhase,0);
 }finally{disposeObject3D(m.root);}
});
