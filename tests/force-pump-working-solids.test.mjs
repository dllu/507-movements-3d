import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredForcePumpMovement} from '../src/simulation/authored-force-pumps.js';
import {surfacePoints,solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';

for(const id of [450,451])test(`${id} actual moving piston, rod journals and check valves clear the fixed solids`,()=>{
  const m=createAuthoredForcePumpMovement({id}),d=m.root.userData,b=d.blocks;
  // Handle pinned to the rod clevis; its fulcrum rides a swing link pinned
  // in a lug on the barrel (Brown's 450; 451 is the same pump).
  const pairs=[[b.pistonBody,b.barrel],[b.pumpRod,b.barrel],[b.rodClevis,b.barrel],[b.swingLink,b.barrel],
    [b.swingLink,b.pivotSupport],[b.swingLink,b.lugPin],[b.swingLink,b.lever.children[0]],[b.swingLink,b.lever.children[1]],
    [b.lever.children[0],b.rodClevis],[b.lever.children[2],b.rodClevis],[b.lever.children[1],b.lever.children[0]],
    [b.lever.children[0],id===450?b.deliveryPipe:b.barrel],
    [b.suctionValveDisk,b.suctionValveSeat],[b.deliveryValveDisk,b.deliveryValveSeat],
    [b.deliveryValveDisk,id===450?b.deliveryValveBody:b.chamberNeck]];
  // Pass 82: both checks are hinged clack flaps (plate, knob, bored lug and
  // pin on two journals standing on the seat ring).
  for(const [f,seat,wall] of [[b.suctionFlap,b.suctionValveSeat,b.barrel],[b.deliveryFlap,b.deliveryValveSeat,id===450?b.deliveryValveBody:b.chamberNeck]]){
    const moving=[f.pivot.children.find(o=>o.userData.role?.startsWith('suction-check')||o.userData.role?.startsWith('delivery-check')||o.userData.role?.startsWith('outlet-check')),f.dome,f.lug];
    for(const o of moving)pairs.push([o,seat],[o,wall],[o,f.pin],...f.bearings.map(j=>[o,j]));
    for(const j of f.bearings)pairs.push([f.pin,j]);
    pairs.push([f.dome,b.pistonBody],[moving[0],b.pistonBody]);
  }
  const data=pairs.map(([moving,fixed])=>({moving,fixed,points:surfacePoints(moving.geometry),surface:solidSurface(fixed.geometry)}));
  for(let i=0;i<=64;i++){
    m.update(i*d.geometry.cycleDuration/64);m.root.updateMatrixWorld(true);
    for(const {moving,fixed,points,surface} of data){
      const matrix=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
      for(const p of points){const q=p.clone().applyMatrix4(matrix);if(surface.box.distanceToPoint(q)>.005)continue;
        const gap=surface.signedDistance(q,.01);
        assert.ok(gap>=-1e-5,`${id}: ${moving.userData.role||moving.id}/${fixed.userData.role||fixed.id} ${gap} at ${i}/64, ${q.toArray()}`);
      }
    }
  }
  applyDisplayTiming(m,{id});assert.ok(d.animationTiming.displayCycleDuration>=d.geometry.cycleDuration);
  assert.equal(d.hideGround,true);
});

for(const id of [450,451])test(`${id} delivery water passes through the actual open barrel port`,()=>{
  const m=createAuthoredForcePumpMovement({id}),b=m.root.userData.blocks;
  m.root.updateMatrixWorld(true);const surface=solidSurface(b.barrel.geometry);
  const water=id===450?b.deliveryWater:b.pumpDeliveryWater;
  const matrix=b.barrel.matrixWorld.clone().invert().multiply(water.matrixWorld);
  for(const p of surfacePoints(water.geometry))assert.ok(surface.signedDistance(p.clone().applyMatrix4(matrix),.01)>=-1e-5);
  const seat=solidSurface(b.suctionValveSeat.geometry);
  assert.equal(seat.inside(new THREE.Vector3(0,0,0)),false);
  assert.equal(seat.inside(new THREE.Vector3(.4,0,0)),true);
});

test('451 rendered water and air stay inside the chamber and preserve the prescribed volume fractions',()=>{
  const m=createAuthoredForcePumpMovement({id:451}),d=m.root.userData,b=d.blocks;
  const walls=[b.chamberShell,b.chamberNeck].map(mesh=>({mesh,surface:solidSurface(mesh.geometry)}));
  const snapshot=[];m.root.traverse(o=>snapshot.push([o,o.geometry]));
  const actualVolume=g=>Math.abs(surfaceTriangles(g).reduce((sum,t)=>sum+t.a.dot(t.b.clone().cross(t.c))/6,0));
  for(let i=0;i<=32;i++){
    const time=d.geometry.cycleDuration*i/32,state=d.stateAtTime(time);
    m.update(time);m.root.updateMatrixWorld(true);
    for(const content of [b.chamberWater,b.compressedAir]){
      const points=surfacePoints(content.geometry);
      for(const {mesh,surface}of walls){const transform=mesh.matrixWorld.clone().invert().multiply(content.matrixWorld);
        for(const p of points){const q=p.clone().applyMatrix4(transform);
          assert.ok(surface.signedDistance(q,.01)>=-1e-5,`${content.userData.role} through ${mesh.userData.role} at ${i}`);
        }
      }
    }
    const expected=state.chamberWaterVolume/d.geometry.chamberTotalInternalVolume;
    // Pass 55: the water is cut in half on the camera plane with the walls.
    const rendered=(b.chamberWater.userData.cutawaySection?2:1)*actualVolume(b.chamberWater.geometry)/d.chamberEnvelope.total;
    assert.ok(Math.abs(rendered-expected)<.004,`water fraction ${rendered}/${expected}`);
    const renderedAir=actualVolume(b.compressedAir.geometry)/d.chamberEnvelope.total;
    assert.ok(Math.abs(renderedAir-(1-expected))<.004,`air fraction ${renderedAir}/${1-expected}`);
  }
  const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,snapshot);
});

// Pass 82: each clack flap lies flat on its seat when shut (no lift, no gap)
// and turns about its hinge pin, whose journals stand on the seat ring.
for(const id of [450,451])test(`${id} clack flaps seat flat when shut and turn about their hinge pins`,()=>{
  const m=createAuthoredForcePumpMovement({id}),d=m.root.userData,b=d.blocks,g=d.geometry;
  const bottomY=mesh=>{mesh.updateMatrixWorld(true);return new THREE.Box3().setFromObject(mesh).min.y;};
  let shut={suction:0,delivery:0},opened={suction:0,delivery:0};
  for(let i=0;i<=64;i++){const t=g.cycleDuration*i/64,st=d.stateAtTime(t);m.update(t);m.root.updateMatrixWorld(true);
    for(const [key,f,seat,open] of [['suction',b.suctionFlap,b.suctionValveSeat,st.suctionValveOpen],['delivery',b.deliveryFlap,b.deliveryValveSeat,st.deliveryValveOpen]]){
      const disk=key==='suction'?b.suctionValveDisk:b.deliveryValveDisk,seatTop=new THREE.Box3().setFromObject(seat).max.y;
      assert.ok(Math.abs(f.pivot.rotation.z-g.maximumFlapAngle*open)<1e-12);
      if(open===0){shut[key]++;assert.ok(Math.abs(bottomY(disk)-seatTop)<2e-3,`${id} ${key} flat on its seat`);}
      if(open>.99)opened[key]++;
      for(const j of f.bearings.filter(j=>j.parent))assert.ok(Math.abs(j.position.x-f.pivot.position.x)<1e-9&&Math.abs(j.position.y-f.pivot.position.y)<1e-9,'journal on the hinge axis');
    }}
  assert.ok(shut.suction>8&&shut.delivery>8&&opened.suction>0&&opened.delivery>0);
});
