import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import{createAuthoredHydrostaticPressMovement as a}from'../src/simulation/authored-hydrostatic-presses.js';
import{createAuthoredRobertsonJackMovement as c}from'../src/simulation/authored-robertson-jacks.js';
import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
for(const[id,create]of[[466,a]])test(`${id} selected working solids and newly opened passages clear through the complete cycle`,()=>{
const m=create({id}),d=m.root.userData,b=d.blocks,pairs=[];
const meshes=o=>{const out=[];o.traverseVisible(x=>{if(x.geometry&&!x.userData.role?.match(/water|discharge/))out.push(x);});return out;};
for(const o of[b.pumpPiston,b.pumpPistonRod,b.pumpCrosshead,b.pumpPitman])for(const f of[b.pumpCylinder,b.leverStand,b.inletValve,b.checkSeats[0]])pairs.push([o,f]);
const pin=b.pumpLever.children.find(o=>o.geometry?.type==='CylinderGeometry');pairs.push([b.pumpPitman,pin],[b.pumpPitman,b.crossheadPin],[b.pumpLever.children[0],id===466?b.leverAxle:b.pumpLeverAxle]);
for(let i=0;i<2;i++)pairs.push([[b.inletValve,b.deliveryValve][i],b.checkSeats[i]]);
for(const o of[b.ramPiston,b.ramRod,b.movingPlaten])for(const f of[b.ramCylinder,b.ramFloor,...meshes(b.pressFrame)])pairs.push([o,f]);pairs.push([b.ramCylinderWater,b.ramPiston],[b.pressureWater,b.ramCylinder]);
for(const f of[b.pumpCylinder,b.inletPipe])pairs.push([b.inletValve,f]);
for(const f of[b.deliveryChamber,b.deliveryIntake,b.deliveryCap])pairs.push([b.deliveryValve,f]);pairs.push([b.pumpPiston,b.deliveryIntake]);
pairs.push([b.pressureWater,b.pumpReservoir.children.find(o=>o.position.x===.62)]);
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};let bad={};
for(let i=0;i<=64;i++){m.update(d.geometry.cycleDuration*i/64);m.root.updateMatrixWorld(true);for(const [aa,cc]of pairs){const a=get(aa),c=get(cc);if(!new T.Box3().setFromObject(a.o).intersectsBox(new T.Box3().setFromObject(c.o)))continue;for(const [v,f]of[[a,c],[c,a]]){const tr=f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);for(const p of v.p){const q=p.clone().applyMatrix4(tr);if(f.s.box.distanceToPoint(q)>.001)continue;const gap=f.s.signedDistance(q,.02),key=`${v.o.userData.role||v.o.id} / ${f.o.userData.role||f.o.id}`;if(gap<-.000002&&gap<(bad[key]?.gap||0))bad[key]={i,gap,p:q.toArray()};}}}}
disposeObject3D(m.root);assert.deepEqual(bad,{});});

// 467: every moving body (plunger, lever, swing link, rising cylinder,
// thumb screw, check valves) against the fixed and moving solids it passes.
test('467 selected working solids and newly opened passages clear through the complete cycle',()=>{
const m=c({id:467}),d=m.root.userData,b=d.blocks,pairs=[];
const meshes=o=>{const out=[];o.traverseVisible(x=>{if(x.geometry&&!x.userData.role?.match(/water|chamber-between/))out.push(x);});return out;};
const fixed=[b.fixedRamBody,b.internalPipeWall,b.baseShell,b.baseTopPlate,b.baseFloorPlate,b.gland,b.pumpCylinder,b.inletSeat,b.feedPipe,b.baseLug,b.swingLinkAxle,b.returnSeat,b.returnPassage];
const moving=[b.movingCylinder,b.plunger,b.pumpLever,b.swingLink,b.thumbScrew,b.inletValve,b.deliveryValve];
for(let i=0;i<moving.length;i++){for(const o of meshes(moving[i]))for(const f of fixed)pairs.push([o,f]);for(let j=i+1;j<moving.length;j++)for(const o of meshes(moving[i]))for(const f of meshes(moving[j]))pairs.push([o,f]);}
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};let bad={};
for(let i=0;i<=64;i++){m.update(d.geometry.cycleDuration*i/64);m.root.updateMatrixWorld(true);for(const [aa,cc]of pairs){const a=get(aa),c=get(cc);if(!new T.Box3().setFromObject(a.o).intersectsBox(new T.Box3().setFromObject(c.o)))continue;for(const [v,f]of[[a,c],[c,a]]){const tr=f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);for(const p of v.p){const q=p.clone().applyMatrix4(tr);if(f.s.box.distanceToPoint(q)>.001)continue;const gap=f.s.signedDistance(q,.02),key=`${v.o.userData.role||v.o.id} / ${f.o.userData.role||f.o.id}`;if(gap<-.000002&&gap<(bad[key]?.gap||0))bad[key]={i,gap,p:q.toArray()};}}}}
// Lowest cylinder stays above the gland and plunger rod on the ram's foot.
const low=d.stateAtPhase(0);m.update((0-d.geometry.sourcePhase+1)*d.geometry.cycleDuration);m.root.updateMatrixWorld(true);
assert.ok(Math.abs(b.movingCylinder.position.y-low.cylinderLift)<1e-12&&low.cylinderLift===0);
assert.ok(new T.Box3().setFromObject(b.cylinderShell).min.y>new T.Box3().setFromObject(b.gland).max.y+.1,'cylinder rests clear of the gland');
disposeObject3D(m.root);assert.deepEqual(bad,{});});

for(const[id,create]of[[466,a],[467,c]])test(`${id} playback preserves mesh storage and readable timing`,()=>{
  const m=create({id}),d=m.root.userData;
  try {
    const snapshot=()=>{const out=[];m.root.traverse(o=>out.push([o,o.geometry]));return out;};
    const before=snapshot();for(let i=0;i<200;i++)m.update(i*.137);assert.deepEqual(snapshot(),before);
    assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,d.geometry.cycleDuration);
    assert.match(d.solidReview.residual,/prescribed/);
  } finally {disposeObject3D(m.root);}
});

test('467 actual conical return tip seats and retracts from the conical bore',()=>{
  const m=c({id:467}),d=m.root.userData,b=d.blocks;
  try {
    const point=new T.Vector3(-.15,d.geometry.returnSeatY+.0525,0),tip=solidSurface(b.screwTip.geometry);
    // Phases are converted to playback time, which opens on the hold.
    const gap=phase=>{m.update((phase-d.geometry.sourcePhase)*d.geometry.cycleDuration);m.root.updateMatrixWorld(true);return tip.signedDistance(b.screwTip.worldToLocal(point.clone()),1);};
    assert.ok(Math.abs(gap(0))<2e-6,'closed cone reaches its seat');
    let phase=0;for(let i=0;i<=256;i++)if(d.stateAtPhase(i/256).thumbScrewRetreat>d.stateAtPhase(phase).thumbScrewRetreat)phase=i/256;
    assert.ok(gap(phase)>.015,'withdrawn needle opens a real finite annular gap');
    assert.ok(Math.abs(gap(1))<2e-6,'cycle closes back onto seat');
    assert.equal(solidSurface(b.internalPipeWall.geometry).inside(new T.Vector3(0,0,0)),false,'feed pipe has an actual bore');
    assert.equal(solidSurface(b.fixedRamBody.geometry).inside(new T.Vector3(0,0,0)),false,'fixed ram has an actual axial passage');
  } finally {disposeObject3D(m.root);}
});

test('466 the rendered water ends at the moving piston underside and above the cylinder floor',()=>{
  const m=a({id:466}),d=m.root.userData,b=d.blocks;
  try {for(let i=0;i<=128;i++){
    m.update(i*d.geometry.cycleDuration/128);m.root.updateMatrixWorld(true);
    const water=new T.Box3().setFromObject(b.ramCylinderWater),piston=new T.Box3().setFromObject(b.ramPiston),floor=new T.Box3().setFromObject(b.ramFloor);
    assert.ok(Math.abs(water.max.y-piston.min.y)<1e-6);assert.ok(Math.abs(water.min.y-floor.max.y)<1e-6);
  }}finally{disposeObject3D(m.root);}
});
