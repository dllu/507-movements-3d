import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredCycloidalPendulumMovement } from '../src/simulation/authored-cycloidal-pendulums.js';
import { createAuthoredSelfRecordingLevelMovement } from '../src/simulation/authored-self-recording-levels.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

function audit(model, pairs, period) {
  const solids=new Map(), points=new Map();
  for(const mesh of new Set(pairs.flat())) {
    solids.set(mesh,solidSurface(mesh.geometry));
    const all=surfacePoints(mesh.geometry);
    points.set(mesh,all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/700))===0));
  }
  const gearGaps=[];
  for(let i=0;i<=64;i++) {
    let gearGap=.01;
    model.update(period*i/64);model.root.updateMatrixWorld(true);
    for(const[a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]) {
      const transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      let min=.01;
      for(const p of points.get(from))min=Math.min(min,solids.get(to).signedDistance(p.clone().applyMatrix4(transform),.01));
      if(from.userData.bevelTooth && to.userData.bevelTooth)gearGap=Math.min(gearGap,min);
      assert.ok(min>-2e-5,`${i}: ${from.userData.role||from.id} in ${to.userData.role||to.id}: ${min}`);
    }
    gearGaps.push(gearGap);
  }
  return gearGaps;
}
test('369 finite cord clears both offset cheek plates and contact rails over a complete swing',()=>{
  const model=createAuthoredCycloidalPendulumMovement({id:369}),b=model.root.userData.blocks;
  audit(model,b.cord.children.flatMap(segment=>[...b.cheekPlates,...b.cheekContactRails,b.suspensionBoss].map(cheek=>[segment,cheek])),model.root.userData.geometry.isochronousPeriod);
  const state=model.root.userData.stateAtTime(model.root.userData.geometry.isochronousPeriod/4);
  const rail=solidSurface(b.cheekContactRails[1].geometry);
  // A finite contact surface stays beside the cord at tangency, not behind it.
  assert.ok(Math.abs(rail.distance(state.contactPoint)-model.root.userData.geometry.cordRadius)<.001);
});
test('411 finite tires, pencil, journals, drum and bevel teeth clear their mating solids throughout travel',()=>{
  const model=createAuthoredSelfRecordingLevelMovement({id:411}),b=model.root.userData.blocks;
  const gearMeshes=[b.bevelDriveCone,b.bevelDrumCone].map(group=>group.children);
  const gaps=audit(model,[...gearMeshes[0].flatMap(a=>gearMeshes[1].map(b=>[a,b])),
    [b.paperDrum,b.pencilTip],[b.paperDrum,b.pendulumRod],[b.paperDrum,b.pencilCarrier],[b.paperDrum,b.baseBrace],
    [b.paperDrum,b.drumShaft],[b.drumShaft,b.verticalDrumGuide],[b.drumShaft,b.drumBearing],
    [b.pendulumPivotAxle,b.pendulumEye],
    ...[b.leftWheel,b.rightWheel].flatMap((wheel,i)=>[[wheel.tire,b.groundBeam],[wheel.hub,b.wheelAxles[i]]])],8);
  assert.ok(Math.max(...gaps)<0.003,`maximum sampled bevel gap: ${Math.max(...gaps)}`);
  for(const wheel of[b.leftWheel,b.rightWheel]) {
    const radius=wheel.tire.geometry.parameters.radius+wheel.tire.geometry.parameters.tube;
    assert.ok(Math.abs(radius-model.root.userData.geometry.wheelRadius)<1e-12);
  }
});
