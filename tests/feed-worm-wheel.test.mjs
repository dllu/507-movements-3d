import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {generateWormWheelProfile} from '../src/simulation/worm-wheel-profile.js';
import {feedWormWheelParameters as p,feedWormWheelCut as cut} from '../src/data/feed-worm-wheel-profile.js';
import {makeFeedWormWheel} from '../src/simulation/feed-worm-wheel.js';

test('optional hob dimensions preserve the legacy generator when omitted',()=>{
 const {wormRootRadius, wormTipRadius,...legacy}=p;
 const options={angularSteps:16,axialSteps:4,phaseSteps:60,radialSteps:20};
 const old=generateWormWheelProfile(legacy,options);
 const explicit=generateWormWheelProfile({...legacy,wormRootRadius:p.wormPitchRadius-1.25/12,wormTipRadius:p.wormPitchRadius+1.25/12},options);
 assert.deepEqual(old.radii,explicit.radii);
 assert.deepEqual(old.generatingPhases,explicit.generatingPhases);
 assert.equal(old.key,JSON.stringify(legacy));
});

test('207 baked envelope has continuous seams, a real shaft bore and opposite throat hands',()=>{
 assert.equal(cut.radii.length,(cut.angularSteps+1)*(cut.axialSteps+1));
 assert.ok(cut.radii.every(r=>r>.8&&r<1.09));
 assert.equal(cut.maximumSeamResidual,0);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const left=makeFeedWormWheel(-1,.093,material),right=makeFeedWormWheel(1,.093,material);
 const a=left.geometry.attributes.position,b=right.geometry.attributes.position;
 for(let i=0;i<a.count;i++){
  assert.ok(Math.abs(a.getX(i)-b.getX(i))<1e-7);
  assert.ok(Math.abs(a.getY(i)+b.getY(i))<1e-7);
  assert.ok(Math.abs(a.getZ(i)-b.getZ(i))<1e-7);
  assert.ok(Math.hypot(a.getX(i),a.getY(i))>=.093-1e-7);
 }
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1));
 for(const mesh of[left,right]){mesh.updateMatrixWorld(true);assert.equal(ray.intersectObject(mesh).length,0);mesh.geometry.dispose();}
 material.dispose();
});

test('207 envelope cutter matches both visible worms and production wheel dimensions',async()=>{
 const {createAuthoredGearMovement}=await import('../src/simulation/authored-gears.js');
 const {disposeObject3D}=await import('../src/simulation/dispose-model.js');
 const model=createAuthoredGearMovement({id:207}),u=model.root.userData,g=u.geometry;
 assert.equal(p.teeth,g.wheelTeeth);assert.equal(p.pitchRadius,g.wheelPitchRadius);assert.equal(p.depth,g.wheelDepth);
 for(const worm of[u.blocks.leftWorm,u.blocks.rightWorm]){
  assert.ok(Math.abs(p.wormLength-worm.userData.length)<1e-14);
  assert.ok(Math.abs(p.wormPitchRadius-worm.userData.radius)<1e-14);
  assert.ok(Math.abs(p.wormRootRadius-worm.userData.rootRadius)<1e-14);
  assert.ok(Math.abs(p.wormTipRadius-(worm.userData.radius+worm.userData.pitch/Math.PI))<1e-14);
 }
 disposeObject3D(model.root);
});
