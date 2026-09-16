import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 296 is one detached roller-pin lever escapement, not a generic anchor', () => {
  const movement = catalog.movements[295];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 296);
  assert.equal(movement.number, '296');
  assert.equal(movement.title, 'Lever escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-tooth-detached-double-beat-roller-pin-lever-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /15-tooth clockwise escape wheel/);
  assert.match(mechanism, /two pallets on anchor B/);
  assert.match(mechanism, /single roller pin on D enters fork notch E/);
  assert.match(mechanism, /detached for the remainder/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.palletCount, 2);
  assert.equal(transmission.oneRollerPin, true);
  assert.equal(transmission.balanceImpulseCountPerOscillation, 2);
  assert.equal(transmission.balanceIsDetachedOutsideForkWindow, true);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.palletFork.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.anchorBody.parent, blocks.palletFork);
  assert.equal(blocks.forkLever.parent, blocks.palletFork);
  assert.equal(blocks.impulsePin.parent, blocks.balance);
  assert.equal(blocks.wheelTeeth.length, 15);
  assert.equal(blocks.palletBlocks.length, 2);
  assert.equal(blocks.palletLockEdges.length, 2);
  assert.equal(blocks.palletImpulseEdges.length, 2);
  assert.equal(blocks.forkTines.length, 2);
  assert.equal(blocks.forkTineEdges.length, 2);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.palletFork.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'pallet-fork axis B');
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis D');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'pointed-lever-escape-wheel-tooth').length, 15);
  assert.equal(roles.filter((role) => /jewelled-pallet-block$/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) =>
    /working-face-of-fork-notch-E$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'balance-roller-impulse-pin-entering-notch-E').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 296 records Brown’s A–E layout, arrows, and unavailable animation', () => {
  const movement = catalog.movements[295];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate296;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /wheel A/);
  assert.match(sourceAnimation.referenceScope, /anchor B/);
  assert.match(sourceAnimation.referenceScope, /fork notch E/);
  assert.match(sourceAnimation.referenceScope, /15-degree detached fork window/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_296.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.rasterPalletPivotB, new THREE.Vector2(297, 51));
  assert.deepEqual(plate.rasterWheelCenterA, new THREE.Vector2(300, 286));
  assert.deepEqual(plate.rasterBalanceCenterD, new THREE.Vector2(76, 76));
  assert.deepEqual(plate.rasterForkNotchE, new THREE.Vector2(116, 76));
  assert.deepEqual(plate.rasterLeverEndC, new THREE.Vector2(485, 75));
  assert.deepEqual(plate.rasterLeftPallet, new THREE.Vector2(177, 119));
  assert.deepEqual(plate.rasterRightPallet, new THREE.Vector2(401, 119));
  assert.deepEqual(plate.rasterBalanceDirectionArrow,
    new THREE.Vector2(15, 82));
  assert.deepEqual(plate.rasterWheelDirectionArrow,
    new THREE.Vector2(483, 156));
  assert.equal(plate.rasterWheelOuterRadius, 198);
  assert.equal(plate.visibleWheelToothCount, 15);
  assert.match(plate.inferredTopology, /one clockwise 15-tooth wheel A/);
  assert.match(plate.inferredTopology, /one rigid E-C lever/);

  vectorNear(sourcePointToModel(plate.rasterPalletPivotB),
    geometry.palletPivot, 0, 'source pivot B');
  vectorNear(sourcePointToModel(plate.rasterWheelCenterA),
    geometry.wheelCenter, 0, 'source wheel center A');
  vectorNear(sourcePointToModel(plate.rasterBalanceCenterD),
    geometry.balanceCenter, 0, 'source balance center D');
  near(plate.rasterWheelOuterRadius * geometry.sourceScale,
    geometry.wheelToothTipRadius, 0,
  'source wheel radius');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.equal(sourceReference.periodReference.figure, 4);
  assert.match(sourceReference.periodReference.description,
    /15 degrees past center/);
  disposeModel(model.root);
});

test('movement 296 uses finite corner engagement and both prescribed pallet impulses', () => {
  const model = createMovementModel(catalog.movements[295]);
  const d=model.root.userData, sides=new Set(), stages=new Set();
  for(let i=0;i<=2048;i++) {
    const s=d.stateAtTime(4*i/2048); stages.add(s.stage);
    assert.equal(s.pinEngaged, Math.abs(s.balanceAngle)<=15*Math.PI/180);
    assert.equal(s.pinContactActive, s.pinEngaged);
    if(s.pinEngaged) near(s.pinContact.radiusError,0,1e-12,'finite corner touches circular pin');
    if(s.stage==='pallet-impulse') {sides.add(s.activePallet); assert.ok(s.pinEngaged); assert.ok(s.wheelAngularSpeed<0);}
  }
  assert.deepEqual([...sides].sort(),['left','right']);
  assert.ok(stages.has('free-drop')&&stages.has('locked')&&stages.has('next-pallet-lock'));
  assert.ok(d.nominal296.forkTineFacePoints); assert.equal(d.forkTineFacePoints,undefined);
  assert.match(d.reconstructionNote,/prescribed/);
  disposeModel(model.root);
});

test('movement 296 advances monotonically by one tooth per oscillation across repeated cycles', () => {
 const model=createMovementModel(catalog.movements[295]),d=model.root.userData,p=d.stateAtTime;
 let previous=p(0).wheelAngle;
 for(let i=1;i<=4096;i++){const s=p(12*i/4096);assert.ok(s.wheelAngle<=previous+1e-12);previous=s.wheelAngle;}
 for(const t of[-.3,.03,.1,.4,1.7,2.1,3.9,8]){
  near(p(t+2).wheelAngle-p(t).wheelAngle,-Math.PI/15,2e-14,'half-pitch each beat');
  near(p(t+4).forkAngle,p(t).forkAngle,2e-14,'fork closes');
  near(p(t+4).balanceAngle,p(t).balanceAngle,2e-14,'balance closes');
 }
 for(const t of[.01,.03,.08,.10,.12,2.01,2.08,2.12]){
  const h=1e-6,a=p(t-h),s=p(t),b=p(t+h);
  near((b.forkAngle-a.forkAngle)/(2*h),s.forkAngularSpeed,3e-8,'fork rate');
  near((b.wheelAngle-a.wheelAngle)/(2*h),s.wheelAngularSpeed,3e-8,'wheel rate');
  assert.equal(s.forkAngularAcceleration,null);assert.equal(s.wheelAngularAcceleration,null);
 }
 disposeModel(model.root);
});

test('movement 296 renderer exposes corrected state and a readable six-second cycle',()=>{
 const model=createMovementModel(catalog.movements[295]),d=model.root.userData,b=d.blocks;
 assert.equal(d.animationTiming.authoredCyclePeriod,4);assert.ok(d.animationTiming.displayCycleDuration>=6);assertReadableTiming(d.animationTiming);
 for(const time of[0,.03,.12,.4,1.2,2.08,3.7,4,8]){
  const s=d.stateAtTime(time);model.update(time);
  near(b.balance.rotation.z,s.balanceAngle,0,'balance');near(b.palletFork.rotation.z,s.forkAngle,0,'fork');near(b.wheelRotor.rotation.z,s.wheelAngle,0,'wheel');
  assert.equal(b.palletContactMarker.visible,false);assert.equal(b.pinContactMarker.visible,false);
  assert.equal(d.contacts.pallet,s.activePallet);assert.equal(d.contacts.stage,s.stage);
 }
 assert.equal(d.stateAtTime(.2).activePallet,'right');assert.equal(d.stateAtTime(2.2).activePallet,'left');
 disposeModel(model.root);
});
