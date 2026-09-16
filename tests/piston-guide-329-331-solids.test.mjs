import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import{createAuthoredEpicyclicPistonGuide as create329}from'../src/simulation/authored-epicyclic-piston-guides.js';
import{createAuthoredSlottedCrossheadEngineMovement as create331}from'../src/simulation/authored-slotted-crosshead-engines.js';
import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
const models=[create329({id:329}),create331({id:331})];
function audit(m,pairs,steps=32,period=m.root.userData.geometry.cyclePeriod){
  const fields=pairs.map(([a,b])=>({a,b,points:surfacePoints(a.geometry),field:solidSurface(b.geometry),min:Infinity,maxNear:0}));
  for(let i=0;i<=steps;i++){m.update(period*i/steps);m.root.updateMatrixWorld(true);for(const f of fields){const tr=f.b.matrixWorld.clone().invert().multiply(f.a.matrixWorld);let gap=Infinity;for(const p of f.points){const q=p.clone().applyMatrix4(tr);if(f.field.box.distanceToPoint(q)>.06)continue;gap=Math.min(gap,f.field.signedDistance(q));}f.min=Math.min(f.min,gap);if(Number.isFinite(gap))f.maxNear=Math.max(f.maxNear,gap);}}
  return fields;
}
test('329 matching internal involutes retain finite clearance and nearby working flanks',()=>{
  const m=models[0],b=m.root.userData.blocks,g=m.root.userData.geometry;
  const[f]=audit(m,[[b.planetGearBody,b.fixedRingD.userData.rotor.children[0]]],24,g.cyclePeriod/48);
  assert.ok(f.min>.0001,`gear minimum ${f.min}`);assert.ok(f.maxNear<.002,`gear working proximity ${f.maxNear}`);
  assert.equal(b.fixedRingD.userData.teeth,48);assert.equal(b.planetGearB.userData.teeth,24);
});
test('329 carried pin and piston wrist enter real bored joints',()=>{
  const m=models[0],b=m.root.userData.blocks;
  for(const f of audit(m,[[b.carrierCrankPin,b.planetGearBody],[b.carrierCrankPin,b.planetHub],[b.planetWristPin,b.wristBoss],[b.planetWristPin,b.wristRing],[b.inputShaft,b.centralBearing],[b.inputShaft,b.centralBore],[b.inputShaft,b.bearingWeb],[b.carrierCrankPin,b.bearingWeb],[b.planetWristPin,b.inputShaft],[b.planetWristPin,b.fixedRingD.userData.rotor.children[0]]]))assert.ok(f.min>.0005,`${f.a.userData.role}/${f.b.userData.role} ${f.min}`);
  for(const[pin,eye]of[[b.carrierCrankPin,b.planetGearBody],[b.planetWristPin,b.wristBoss],[b.inputShaft,b.centralBearing]]){
    const a=new THREE.Box3().setFromObject(pin),c=new THREE.Box3().setFromObject(eye);
    assert.ok(Math.min(a.max.z,c.max.z)-Math.max(a.min.z,c.min.z)>.1,'bored joint retains finite axial engagement');
  }
});
test('329 piston stays inside the continued barrel and clears the real rod passages',()=>{
  const m=models[0],d=m.root.userData,b=d.blocks,g=d.geometry;
  for(const f of audit(m,[[b.pistonHead,b.cylinderBody],[b.pistonRodA,b.gland],[b.pistonRodA,b.cylinderTop]]))assert.ok(f.min>.001,`${f.b.userData.role} ${f.min}`);
  for(let i=0;i<=64;i++){m.update(g.cyclePeriod*i/64);m.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(b.pistonHead);assert.ok(box.min.y>d.finiteGuideReview.cylinderBottom+.08);assert.ok(box.max.y<d.finiteGuideReview.cylinderTop-.1);}
});
test('331 finite slot/journal, pillars/shoes and rod/gland remain clear through the stroke',()=>{
  const m=models[1],b=m.root.userData.blocks,pairs=[[b.wristJournal,b.yokeBody],[b.wristJournal,b.slotOutline],[b.crankshaft,b.bearingHousing],[b.crankshaft,b.bearingBore],[b.pistonRod,b.cylinderTop],[b.pistonRod,b.cylinderBore],[b.pistonRod,b.glandNeck]];
  for(let i=0;i<2;i++)for(const shoePart of (i===0?b.leftGuideShoe:b.rightGuideShoe).children)pairs.push([shoePart,b.guidePosts[i]]);
  const fields=audit(m,pairs,64);for(const f of fields)assert.ok(f.min>.0002,`${f.a.userData.role}/${f.b.userData.role} ${f.min}`);
  assert.ok(fields[0].maxNear<.005,'journal retains close engagement with slot');
  for(const shoe of[b.leftGuideShoe,b.rightGuideShoe]){const f=fields.find(f=>f.a===shoe.userData.contactLiner);assert.ok(f.min<.0021,'pillar working liner retains guiding proximity');}
});
test('329/331 keep complete cycle framing, readable speed and stable playback objects',()=>{
  for(const m of models){const d=m.root.userData,objects=[];m.root.traverse(o=>objects.push([o,o.geometry]));for(let i=0;i<32;i++){d.stateAtTime(i*.37);m.update(i*.37);}const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,objects);assert.equal(d.minimumDisplayCycleSeconds,4);assert.equal(d.hideGround,true);m.root.traverse(o=>{for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});}
});
