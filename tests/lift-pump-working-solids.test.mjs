import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredLiftPumpMovement} from '../src/simulation/authored-lift-pumps.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const id of [448,449])test(`${id} finite bucket, valve, rod and fixed-wall interfaces clear throughout the cycle`,()=>{
  const model=createAuthoredLiftPumpMovement({id}),d=model.root.userData,b=d.blocks;
  const pairs=[[b.pistonBody,b.barrel],[b.yoke,b.barrel],[b.yoke,b.pistonValveDisk],
    [b.pistonValveDisk,b.pistonValveSeat],[b.footValveDisk,b.footValveSeat],
    [b.footValveDisk,b.suctionPipe]];
  if(id===449)pairs.push([b.pumpRod,b.topCover],...[...b.stuffingBox.children].map(o=>[b.pumpRod,o]),
    [b.pumpRod,b.pistonValveDisk],[b.yoke,b.topCover],
    [b.deliveryFlap,b.deliveryFlapSeat],[b.deliveryFlap,b.deliveryBell],
    [b.deliveryFlap,b.deliveryPipe],[b.deliveryFlap,b.flapHinge],[b.flapLug,b.flapHinge],
    [b.flapLug,b.deliveryFlapSeat],[b.flapLug,b.deliveryBell],
    ...b.flapBearings.flatMap(o=>[[b.flapHinge,o],[b.flapLug,o],[b.deliveryFlap,o]]));
  else pairs.push([b.connectingRod,b.barrel],[b.connectingRod,b.yoke],
    [b.lever.children[1],b.leverSupport],[b.lever.children[2],b.connectingRod],[b.jointPin,b.connectingRod]);
  const data=pairs.map(([moving,fixed])=>({moving,fixed,points:surfacePoints(moving.geometry),surface:solidSurface(fixed.geometry)}));
  for(let i=0;i<=64;i++){
    model.update(d.geometry.cycleDuration*i/64);model.root.updateMatrixWorld(true);
    for(const {moving,fixed,points,surface} of data){
      const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
      for(const p of points){const local=p.clone().applyMatrix4(transform);
        if(surface.box.distanceToPoint(local)>.005)continue;
        const gap=surface.signedDistance(local,.01);
        assert.ok(gap>=-1e-5,`${id} ${moving.userData.role||moving.id} / ${fixed.userData.role||fixed.id}: ${gap} at ${i}/64, ${local.toArray()}`);
      }
    }
  }
  assert.equal(d.hideGround,true);assert.equal(d.animationTiming.targetCycleDuration,d.geometry.cycleDuration);
});

for(const id of [448,449])test(`${id} water passages are open through the rendered barrel and valve seats`,()=>{
  const model=createAuthoredLiftPumpMovement({id}),d=model.root.userData,b=d.blocks;
  model.update(d.geometry.cycleDuration*.25);model.root.updateMatrixWorld(true);
  const shell=solidSurface(b.barrel.geometry),flow=id===448?b.spoutWater:b.deliveryWater;
  const transform=b.barrel.matrixWorld.clone().invert().multiply(flow.matrixWorld);
  for(const p of surfacePoints(flow.geometry)) {
    const local=p.clone().applyMatrix4(transform);
    assert.ok(shell.signedDistance(local,.01)>=-1e-5,`${id} side outlet blocked at ${local.toArray()}`);
  }
  for(const seat of [b.pistonBody,b.pistonValveSeat,b.footValveSeat]) {
    const surface=solidSurface(seat.geometry);
    const center=new THREE.Vector3(0,0,0);
    assert.equal(surface.inside(center),false,`${id} valve bore is filled`);
    // Guard the surface-query orientation: material outside the bore is solid.
    assert.equal(surface.inside(new THREE.Vector3(.33,0,0)),true);
  }
});
