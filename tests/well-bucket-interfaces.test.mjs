import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredCounterbalancedWellSweepMovement} from '../src/simulation/authored-counterbalanced-well-sweeps.js';
import {createAuthoredTwoBucketWellPulleyMovement} from '../src/simulation/authored-two-bucket-well-pulleys.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';

for(const [id,factory] of [[457,createAuthoredCounterbalancedWellSweepMovement],[458,createAuthoredTwoBucketWellPulleyMovement]]){
 test(`${id} finite working solids and bucket contents remain clear over a complete cycle`,()=>{
  const m=factory({id}),d=m.root.userData,b=d.blocks,g=d.geometry;
  const buckets=id===457?[{bucket:b.bucket,water:b.bucketWater}]:[b.leftBucket,b.rightBucket];
  const pairs=id===457?[[b.pivotAxle,b.workingBeam],[b.ropePin,b.workingBeam],...b.forks.map(f=>[b.workingBeam,f]),[b.workingBeam,b.trunk]]:
    [[b.fixedAxle,b.pulley.userData.hub],[b.fixedAxle,b.hanger],...[b.upperArc,b.leftRopeLeg,b.rightRopeLeg].flatMap(r=>[b.pulley.userData.tread,b.pulley.userData.hub,...b.pulley.userData.spokes].map(p=>[r,p]))];
  for(const {bucket,water} of buckets){
    pairs.push([water,bucket.children[0]],[water,bucket.children[1]]);
    const walls=id===457?[b.well,b.wellRim,b.base]:[b.shaftWell];
    for(const child of bucket.children.slice(0,4))for(const wall of walls)pairs.push([child,wall]);
  }
  const surfaces=new Map(pairs.map(([,fixed])=>[fixed,solidSurface(fixed.geometry)]));
  for(let i=0;i<=64;i++){
    m.update(i*g.cycleDuration/64);m.root.updateMatrixWorld(true);
    for(const [moving,fixed]of pairs){
      if(!moving.visible)continue;
      const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld),surface=surfaces.get(fixed);
      for(const p of surfacePoints(moving.geometry)){
        const q=p.applyMatrix4(transform);if(surface.box.distanceToPoint(q)>.005)continue;
        const gap=surface.signedDistance(q,.01);
        assert.ok(gap>=-1e-5,`${id} ${moving.userData.role||moving.id} vs ${fixed.userData.role||fixed.id}: ${gap} pose ${i}/64`);
      }
    }
  }
 });
 test(`${id} fills below source water, connects its bail, and preserves readable production timing`,()=>{
  const m=factory({id}),d=m.root.userData,b=d.blocks,g=d.geometry;
  const times=id===457?[g.descentEndPhase*g.cycleDuration]:[0,g.outwardEndPhase*g.cycleDuration];
  for(const time of times){
    m.update(time);m.root.updateMatrixWorld(true);const state=d.stateAtTime(time);
    const bucket=id===457?b.bucket:(time===0?b.rightBucket.bucket:b.leftBucket.bucket);
    const mouth=bucket.position.y+g.bucketHeight/2;
    const water=b.wellWater;water.geometry.computeBoundingBox();
    const waterTop=water.localToWorld(new THREE.Vector3(0,water.geometry.boundingBox.max.y,0)).y;
    assert.ok(mouth<waterTop,`${id} mouth ${mouth} must be submerged below ${waterTop} when filling`);
    const bail=bucket.localToWorld(new THREE.Vector3(0,g.bucketHeight/2+g.bucketHandleRise,0));
    const endpoint=id===457?state.ropeBottom:new THREE.Vector3(bucket.position.x,time===0?state.rightBailY:state.leftBailY,0);
    assert.ok(bail.distanceTo(endpoint)<1e-10);
  }
  for(let i=0;i<=16;i++){
    const state=d.stateAtTime(i*g.cycleDuration/16);m.update(i*g.cycleDuration/16);
    const contents=id===457?[[b.bucketWater,state.bucketWaterFraction]]:[[b.leftBucket.water,state.leftWaterFraction],[b.rightBucket.water,state.rightWaterFraction]];
    for(const [water,fraction]of contents){
      const volume=Math.abs(surfaceTriangles(water.geometry).reduce((v,t)=>v+t.a.dot(t.b.clone().cross(t.c))/6,0));
      assert.ok(Math.abs(volume/water.userData.fullVolume-fraction)<.004);
    }
  }
  const before=[];m.root.traverse(o=>before.push([o,o.geometry]));
  for(let i=0;i<10;i++)m.update(i*g.cycleDuration/10);
  const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
  applyDisplayTiming(m,{id});assert.ok(d.animationTiming.displayCycleDuration>=g.cycleDuration);
 });
}
