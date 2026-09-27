import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredOscillatingWaterColumnMovement as make } from '../src/simulation/authored-oscillating-water-columns.js';
import { surfacePoints, solidSurface, surfaceTriangles } from './helpers/solid-surface.mjs';
const phases=[0,.10,.18,.28,.40,.52,.60,.64,.70,.76,.77,.78,.80,.84,.88,.92,.96,1];
for(const id of[445,446]){
 test(`${id}: finite fluid envelopes and tracers stay out of fixed walls`,()=>{
  const m=make({id}),d=m.root.userData,b=d.blocks,p=d.oscillatingColumnParts;
  // Pass 69: stream, cone, column, film and sheet are one revolved body.
  const fluids=[b.waterBody,b.lowerWater,b.nozzleWater,b.outletWater,b.reservoirWater,b.topPlume,...b.descendingMarkers,...b.risingMarkers,...b.outletMarkers];
  const samples=new Map(fluids.map(mesh=>[mesh,surfacePoints(mesh.geometry)])),solids=new Map(p.fixed.map(mesh=>[mesh,solidSurface(mesh.geometry)]));
  // Extra sections through long outlet-fluid triangles catch the thin side port.
  for(const tri of surfaceTriangles(b.outletWater.geometry))for(const[a,c]of[[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]])for(let i=1;i<48;i++){
   const y=THREE.MathUtils.lerp(-1.365,1.365,i/48);if(a.y===c.y||(y-a.y)*(y-c.y)>0)continue;
   samples.get(b.outletWater).push(a.clone().lerp(c,(y-a.y)/(c.y-a.y)));
  }
  let checks=0,min=.005;const point=new THREE.Vector3();
  for(const phase of phases){m.update((phase-d.geometry.sourcePhase)*d.geometry.cycleDuration);m.root.updateMatrixWorld(true);
   for(const fluid of fluids){if(!fluid.visible||fluid.scale.lengthSq()<1e-12)continue;
    for(const solid of p.fixed){const matrix=solid.matrixWorld.clone().invert().multiply(fluid.matrixWorld),surface=solids.get(solid);
     for(const q of samples.get(fluid)){point.copy(q).applyMatrix4(matrix);const distance=surface.signedDistance(point,.005);checks++;min=Math.min(min,distance);assert.ok(distance>=-1e-5,`${id} phase ${phase}: ${fluid.userData.role} cuts ${solid.userData.role??solid.geometry.type} by ${-distance} at ${point.toArray()}`);}
    }
   }
  }
  console.log(JSON.stringify({id,checks,minimumCappedGap:min}));
 });
 test(`${id}: marker transport follows integrated discharge and rises during filling`,()=>{
  const m=make({id}),d=m.root.userData,b=d.blocks,g=d.geometry,p=d.oscillatingColumnParts;
  let prior=-Infinity;
  for(let i=0;i<=500;i++){
   const t=g.cycleDuration*i/500;m.update(t);const state=d.stateAtTime(t);
   const expected=g.sourcePhase+t/g.cycleDuration-state.upperStorageVolume/(g.supplyFlowRate*g.cycleDuration);
   assert.ok(Math.abs(p.markerTravelTurns-expected)<1e-14);assert.ok(p.markerTravelTurns>=prior-1e-14);prior=p.markerTravelTurns;
  }
  const t=(.60-g.sourcePhase)*g.cycleDuration;m.update(t);const before=b.risingMarkers.map(o=>o.position.y);m.update(t+1e-4);
  b.risingMarkers.forEach((o,i)=>assert.ok(o.position.y>before[i],`rising tracer ${i} actually moves upward`));
  for(const boundary of [0,.18,.52,.76,.78,.80,.88,.96,1]){
   const t=(boundary-g.sourcePhase)*g.cycleDuration;m.update(t-1e-7);const before=b.descendingMarkers.map(o=>({p:o.position.clone(),s:o.scale.x}));m.update(t+1e-7);
   b.descendingMarkers.forEach((o,i)=>assert.ok(o.position.distanceTo(before[i].p)<1e-4||Math.max(o.scale.x,before[i].s)<1e-5,'visible tracer must not teleport'));
  }
 });
 test(`${id}: fixed hardware, stable geometry and explicit fluid limits`,()=>{
  const m=make({id}),d=m.root.userData,p=d.oscillatingColumnParts,before=[];
  m.root.traverse(o=>{if(o.geometry)before.push([o,o.geometry,o.geometry.attributes.position.array]);for(const mat of[].concat(o.material??[])){assert.equal(mat.fog,false);if(mat.transparent)assert.equal(o.castShadow,false);}});
  const fixed=p.fixed.map(o=>{o.updateMatrix();return o.matrix.clone();});
  for(const phase of phases)m.update(phase*d.geometry.cycleDuration);
  let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,before.length);for(const[o,g,a]of before){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
  p.fixed.forEach((o,i)=>{o.updateMatrix();assert.deepEqual(o.matrix.elements,fixed[i].elements);});
  assert.equal(d.minimumDisplayCycleSeconds,5.6);assert.equal(d.hideGround,true);assert.match(d.reconstructionNote,/prescribed/);assert.match(d.dynamics.fluidModel,/cone volume.*not solved/);
 });
}
