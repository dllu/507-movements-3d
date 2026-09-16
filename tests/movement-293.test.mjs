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

test('movement 293 is a two-tooth-system single-beat duplex escapement, not bevel gearing', () => {
  const movement = catalog.movements[292];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 293);
  assert.equal(movement.number, '293');
  assert.equal(movement.title, 'Duplex escapement, for watches…');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-tooth-single-beat-duplex-watch-escapement');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /long in-plane locking teeth C\/D/);
  assert.match(mechanism, /short axial crown impulse pins a/);
  assert.match(mechanism, /notched frictional-rest roller A/);
  assert.match(mechanism, /silent beat/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.lockingToothCount, 15);
  assert.equal(transmission.impulsePinCount, 15);
  assert.equal(transmission.singleBeat, true);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.balance.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.lockingWheel.parent, blocks.wheelRotor);
  assert.equal(blocks.lockingRoller.parent, blocks.balance);
  assert.equal(blocks.impulsePalletBody.parent, blocks.balance);
  assert.equal(blocks.impulsePalletArm.parent, blocks.balance);
  assert.equal(blocks.impulsePins.length, 15);
  assert.equal(blocks.spokeMeshes.length, 4);
  assert.equal(blocks.balanceSpokes.length, 3);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.balance.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'balance axis');

  for (let index = 0; index < blocks.impulsePins.length; index += 1) {
    assert.equal(blocks.impulsePins[index].userData.index, index);
    assert.equal(blocks.impulsePins[index].position.z > 0, true);
  }
  assert.ok(blocks.impulsePalletBody.position.z > 0);
  assert.ok(blocks.lockingRoller.position.z < blocks.impulsePalletBody.position.z);
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'short-axial-crown-impulse-pin-a').length, 15);
  assert.equal(roles.filter((role) =>
    role === 'fifteen-long-in-plane-locking-teeth-C-D').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'notched-frictional-rest-locking-roller-A').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'working-face-of-impulse-pallet-B').length, 1);
  assert.equal(roles.some((role) => /generic|procedural|bevel/.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 293 records Brown’s measured roller, pallet, two tooth rows, and source limits', () => {
  const movement = catalog.movements[292];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate293;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /two wheel-tooth systems/);
  assert.match(sourceAnimation.referenceScope, /notched roller A/);
  assert.match(sourceAnimation.referenceScope, /silent return beat/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_293.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.rasterBalanceCenterA,
    new THREE.Vector2(268, 110));
  assert.deepEqual(plate.rasterWheelCenter,
    new THREE.Vector2(264, 649));
  assert.deepEqual(plate.rasterNotchMouth,
    new THREE.Vector2(247, 151));
  assert.deepEqual(plate.rasterPalletTipB,
    new THREE.Vector2(328, 303));
  assert.deepEqual(plate.rasterLeftLockingToothD,
    new THREE.Vector2(70, 198));
  assert.deepEqual(plate.rasterRightLockingToothC,
    new THREE.Vector2(461, 202));
  assert.deepEqual(plate.rasterCrownPins, [
    new THREE.Vector2(198, 308),
    new THREE.Vector2(326, 303),
    new THREE.Vector2(439, 362),
  ]);
  assert.equal(plate.rasterLockingTipRadius, 493);
  assert.equal(plate.rasterImpulsePinRadius, 354);
  assert.match(plate.inferredTopology, /long radial locking teeth C\/D/);
  assert.match(plate.inferredTopology, /axial crown pins a/);
  vectorNear(sourcePointToModel(plate.rasterBalanceCenterA),
    geometry.balanceCenter, 0, 'source balance center A');
  vectorNear(sourcePointToModel(plate.rasterWheelCenter),
    geometry.wheelCenter, 0, 'source wheel center');
  near(geometry.lockingToothTipRadius + geometry.rollerRadius,
    geometry.centerDistance + .06, 1e-12, 'finite side-lock overlap');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.match(sourceReference.periodReference.description,
    /short upright pins impulse pallet P once per oscillation/);
  disposeModel(model.root);
});

test('movement 293 production law advances one tooth and renderer binds the finite branch', () => {
 const model=createMovementModel(catalog.movements[292]),d=model.root.userData,b=d.blocks;
 for(let i=0;i<513;i++){
  const time=i*4/513,state=d.stateAtTime(time),next=d.stateAtTime(time+4);
  near(next.wheelAngle-state.wheelAngle,-d.geometry.toothPitch,2e-12,'one-tooth advance');
  near(next.balanceAngle,state.balanceAngle,2e-12,'balance closure');
  model.update(time);near(b.wheelRotor.rotation.z,state.wheelAngle,0,'wheel transform');near(b.balance.rotation.z,state.balanceAngle,0,'balance transform');
  assert.equal(d.kinematics.contactMode,state.contactMode);assert.equal(b.lockContactMarker.visible,false);assert.equal(b.impulseContactMarker.visible,false);
 }
 assert.ok(d.workingDuplex293.bake.samples.some(row=>row[2]===2));assert.ok(d.workingDuplex293.bake.samples.some(row=>row[2]===3));
 disposeModel(model.root);
});
test('movement 293 reported rates match interpolation away from event knots', () => {
 const model=createMovementModel(catalog.movements[292]),d=model.root.userData,rows=d.workingDuplex293.bake.samples;
 for(let i=0;i<rows.length-1;i+=17){const time=((rows[i][0]+rows[i+1][0])/2-.30)*4,epsilon=(rows[i+1][0]-rows[i][0])*4e-3,s=d.stateAtTime(time),before=d.stateAtTime(time-epsilon),after=d.stateAtTime(time+epsilon);
 near((after.wheelAngle-before.wheelAngle)/(2*epsilon),s.wheelAngularSpeed,2e-6,'piecewise wheel speed');near((after.balanceAngle-before.balanceAngle)/(2*epsilon),s.balanceAngularSpeed,2e-6,'balance speed');}
 assertReadableTiming(d.animationTiming);disposeModel(model.root);
});
