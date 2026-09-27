import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import{createAuthoredHydrostaticPressMovement as a}from'../src/simulation/authored-hydrostatic-presses.js';
import{createAuthoredRobertsonJackMovement as c}from'../src/simulation/authored-robertson-jacks.js';
import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
// Pass 73: Brown's plate. Plunger, crosshead, lever, swing link and pins,
// the three valves and the ram assembly against what they pass.
test('466 selected working solids and newly opened passages clear through the complete cycle',()=>{
const m=a({id:466}),d=m.root.userData,b=d.blocks,pairs=[];
const barrel=b.pumpCylinder.children,cylinder=b.ramCylinder.children,chest=b.valveChest.children,crosshead=b.pumpCrosshead.children.filter(o=>o.userData.role==='crosshead-block');
for(const o of[...b.pumpPiston.children,...crosshead,b.inletValve])for(const f of barrel)pairs.push([o,f]);
for(const o of crosshead)pairs.push([o,b.leverBar],[o,b.swingLink]);
pairs.push([b.crossheadPin,b.leverBar],[b.leverAxle,b.leverBar],[b.leverAxle,b.swingLink],[b.lugPin,b.swingLink],[b.swingLink,b.lug],[b.swingLink,b.leverBar],[b.swingLink,b.ballWeight]);
for(const o of[b.deliveryValve,...b.safetyValve.children])for(const f of chest)pairs.push([o,f]);
for(const o of[b.ramBody,b.ramPiston,b.movingPlaten])for(const f of[...cylinder,...b.columns,b.headPlate])pairs.push([o,f]);
for(const o of b.compressibleLoad.children)for(const f of b.columns)pairs.push([o,f]);
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

test('466 the press water fills the bore below the gland and grows by exactly the ram displacement',()=>{
  const m=a({id:466}),d=m.root.userData,b=d.blocks,g=d.geometry;
  const volume=geometry=>{const p=geometry.attributes.position,idx=geometry.index.array;let v=0;const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();
    for(let i=0;i<idx.length;i+=3){A.fromBufferAttribute(p,idx[i]);B.fromBufferAttribute(p,idx[i+1]);C.fromBufferAttribute(p,idx[i+2]);v+=A.dot(B.clone().cross(C))/6;}return Math.abs(v);};
  try {
    m.update(0);const v0=2*volume(b.ramCylinderWater.geometry);
    for(let i=0;i<=64;i++){
      const t=i*g.cycleDuration/64,state=d.stateAtTime(t);m.update(t);
      b.ramCylinderWater.geometry.computeBoundingBox();const box=b.ramCylinderWater.geometry.boundingBox;
      assert.ok(Math.abs(box.max.y-(280-335)/72)<1e-6&&Math.abs(box.min.y-(280-481.8)/72)<1e-6,`water within the bore at ${i}`);
      // Half section: twice the rendered volume is the whole water body.
      const grown=2*volume(b.ramCylinderWater.geometry)-v0;
      assert.ok(Math.abs(grown-g.ramArea*state.ramLift)<0.005*g.ramArea*g.maximumRamLift,`displacement ${grown} vs ${g.ramArea*state.ramLift} at ${i}`);
    }
  }finally{disposeObject3D(m.root);}
});
