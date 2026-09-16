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
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
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

test('movement 238 is one seven-tooth wheel and one rigid B-C pallet carrier', () => {
  const movement = catalog.movements[237];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 238);
  assert.equal(movement.number, '238');
  assert.equal(movement.title, 'Seven-Tooth Anchor Escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'seven-tooth-star-wheel-two-pallet-anchor-escapement',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.palletsShareRigidCarrier, true);
  assert.equal(transmission.escapeWheelDirection, 'counterclockwise');
  assert.equal(transmission.beatsPerCycle, 2);
  near(transmission.outputAdvancePerBeatInToothPitches, 0.5, 0,
    'half a tooth per beat');
  near(transmission.outputAdvancePerOscillationInToothPitches, 1, 2e-15,
    'one tooth per pallet oscillation');
  near(transmission.contactAdvancePerBeatInToothPitches, 5 / (360 / 7), 2e-15,
    'working-face impulse advance');
  near(transmission.dropPerBeatInToothPitches, 0.5 - 5 / (360 / 7), 2e-15,
    'positive free drop');
  assert.equal(blocks.escapeWheel.userData.teeth, 7);
  assert.equal(blocks.escapeWheel.userData.tipRidges.length, 7);
  assert.equal(blocks.palletBody.parent, blocks.palletCarrier);
  assert.equal(blocks.bPallet.face.parent, blocks.palletCarrier);
  assert.equal(blocks.cPallet.face.parent, blocks.palletCarrier);
  assert.equal(blocks.palletHub.parent, blocks.palletCarrier);
  assert.equal(blocks.palletShaft.parent, model.root);
  let carrierCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role === 'rigid-two-pallet-carrier-pivoted-at-A') {
      carrierCount += 1;
    }
  });
  assert.equal(carrierCount, 1);
  disposeModel(model.root);
});

test('movement 238 preserves source axes and B root with an explicitly shortened reconstructed face', () => {
  const model = createMovementModel(catalog.movements[237]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate238;

  assert.deepEqual(plate.rasterWheelCenterD.toArray(), [214, 210]);
  assert.deepEqual(plate.rasterPalletPivotA.toArray(), [264, 354]);
  assert.deepEqual(plate.rasterBRootContact.toArray(), [163, 253]);
  assert.deepEqual(plate.rasterBFaceEnd.toArray(), [207, 244]);
  assert.deepEqual(plate.rasterCInnerTip.toArray(), [290, 185]);
  assert.deepEqual(plate.rasterCOuterTip.toArray(), [331, 161]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredEscapeWheelTeeth, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one rigid anchor pivoted at A/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  vectorNear(
    geometry.palletPivot,
    new THREE.Vector2(0.825, -2.376),
    2e-15,
    'source A-to-D offset',
  );
  const sourceBRoot = new THREE.Vector2(-0.8415, -0.7095);
  near(geometry.contactRadius, sourceBRoot.length(), 2e-15,
    'source D-to-B tooth-tip radius');
  near(geometry.wheelMountPhase, Math.atan2(-0.7095, -0.8415), 2e-15,
    'source star mounting phase');
  const source = model.root.userData.nominalKinematics238.stateAtCycleCoordinate(0);
  assert.equal(source.stage, 'B-root-lock');
  assert.equal(source.activePallet, 'B');
  assert.equal(source.activeToothIndex, 0);
  assert.equal(source.dwell, true);
  assert.equal(source.drivingContact, false);
  near(source.palletAngle, geometry.lowPalletAngle, 0,
    'source carrier angle');
  near(source.wheelAngle, 0, 0, 'source wheel angle');
  near(source.contact.contactCoordinate, 0, 2e-15,
    'source tooth sits at B root');
  near(source.contact.lineSeparation, 0, 2e-15,
    'source tooth lies on B face');
  const sourceBTipRaster = new THREE.Vector2(
    214 + geometry.sourceBTipWorld.x / geometry.sourceScale,
    210 - geometry.sourceBTipWorld.y / geometry.sourceScale,
  );
  assert.ok(
    sourceBTipRaster.distanceTo(plate.rasterBFaceEnd) > 25 && sourceBTipRaster.distanceTo(plate.rasterBFaceEnd) < 27,
    `derived B face end ${sourceBTipRaster.toArray()} is shorter than the drawn face to accommodate finite clearance`,
  );
  assert.ok(geometry.sourceNearestCTooth.segmentClearance > 0.39);
  assert.ok(geometry.sourceNearestCTooth.segmentClearance < 0.40);
  disposeModel(model.root);
});

test('movement 238 builds seven equally spaced star tips in the source phase', () => {
  const model = createMovementModel(catalog.movements[237]);
  const { blocks, geometry } = model.root.userData;
  const { escapeWheel, palletCarrier } = blocks;

  vectorNear(escapeWheel.userData.axis, new THREE.Vector3(0, 0, 1), 0,
    'escape-wheel axis');
  vectorNear(palletCarrier.userData.axis, new THREE.Vector3(0, 0, 1), 0,
    'pallet-carrier axis');
  near(geometry.toothPitch, FULL_TURN / 7, 0, 'seven-tooth pitch');
  near(geometry.halfToothPitch, Math.PI / 7, 0, 'half pitch per beat');
  near(geometry.dropAngle, geometry.toothPitch / 2 - THREE.MathUtils.degToRad(5), 2e-16,
    'positive drop angle');
  near(geometry.contactAdvance, THREE.MathUtils.degToRad(5), 2e-16,
    'contact advance');
  for (const [index, point] of escapeWheel.userData.toothTips.entries()) {
    near(point.length(), geometry.contactRadius, 3e-16,
      `tooth ${index} contact radius`);
    near(
      Math.atan2(point.y, point.x),
      THREE.MathUtils.euclideanModulo(
        geometry.wheelMountPhase + index * geometry.toothPitch + Math.PI,
        FULL_TURN,
      ) - Math.PI,
      2e-15,
      `tooth ${index} source angle`,
    );
    assert.equal(escapeWheel.userData.tipRidges[index].userData.index, index);
  }
  assert.equal(
    escapeWheel.userData.body.userData.role,
    'seven-point-source-star-wheel-body-D',
  );
  assert.equal(
    blocks.bPallet.face.userData.role,
    'B-straight-working-pallet-face',
  );
  assert.equal(
    blocks.cPallet.face.userData.role,
    'C-straight-working-pallet-face',
  );
  disposeModel(model.root);
});

test('movement 238 B nominal point law runs root-to-tip without reversal (finite support checked separately)', () => {
  const model = createMovementModel(catalog.movements[237]);
  const { geometry } = model.root.userData;
  const { stateAtCycleCoordinate } = model.root.userData.nominalKinematics238;
  const { start, end } = geometry.phases.bDrive;
  let previousCoordinate = -Infinity;
  let previousWheelAngle = -Infinity;
  let maximumSpeed = 0;

  for (let sample = 0; sample < 8192; sample += 1) {
    const coordinate = THREE.MathUtils.lerp(start, end, sample / 8192);
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'B-tooth-slides-root-to-tip');
    assert.equal(state.activePallet, 'B');
    assert.equal(state.activeToothIndex, 0);
    assert.equal(state.drivingContact, true);
    assert.equal(state.dwell, false);
    assert.ok(state.contact.contactCoordinate >= previousCoordinate - 2e-14);
    assert.ok(state.contact.contactCoordinate >= -2e-14);
    assert.ok(state.contact.contactCoordinate <= 1 + 2e-14);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-14);
    assert.ok(state.wheelAngularSpeed >= -2e-13);
    near(state.contact.point.length(), geometry.contactRadius, 5e-16,
      `B tooth-tip orbit at ${coordinate}`);
    near(state.contact.lineSeparation, 0, 8e-16,
      `B face contact at ${coordinate}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `B contact normal velocity at ${coordinate}`);
    previousCoordinate = state.contact.contactCoordinate;
    previousWheelAngle = state.wheelAngle;
    maximumSpeed = Math.max(maximumSpeed, state.wheelAngularSpeed);
  }
  const rootLock = stateAtCycleCoordinate(start);
  const release = stateAtCycleCoordinate(end);
  near(rootLock.contact.contactCoordinate, 0, 2e-15,
    'B impulse begins at root');
  near(release.wheelAngle, geometry.contactAdvance, 4e-16,
    'B release advance');
  near(release.palletAngle, geometry.highPalletAngle, 0,
    'B release carrier angle');
  assert.equal(release.stage, 'B-releases-free-drop-to-C-root');
  assert.ok(maximumSpeed > 0.15);
  disposeModel(model.root);
});

test('movement 238 has two prescribed positive nominal drops and stationary lock intervals', () => {
  const model = createMovementModel(catalog.movements[237]);
  const { geometry } = model.root.userData;
  const { stateAtCycleCoordinate } = model.root.userData.nominalKinematics238;
  const first = geometry.phases.firstDrop;
  const second = geometry.phases.secondDrop;

  const bLock = stateAtCycleCoordinate(0.05);
  assert.equal(bLock.stage, 'B-root-lock');
  assert.equal(bLock.activePallet, 'B');
  assert.equal(bLock.dwell, true);
  near(bLock.wheelAngularSpeed, 0, 0, 'B lock wheel speed');
  near(bLock.contact.contactCoordinate, 0, 2e-15,
    'B lock at working-face root');

  const cLock = stateAtCycleCoordinate(0.49);
  assert.equal(cLock.stage, 'C-root-lock');
  assert.equal(cLock.activePallet, 'C');
  assert.equal(cLock.activeToothIndex, 3);
  assert.equal(cLock.dwell, true);
  near(cLock.wheelAngle, geometry.halfToothPitch, 4e-16,
    'C lock follows one half-pitch beat');
  near(cLock.wheelAngularSpeed, 0, 0, 'C lock wheel speed');
  near(cLock.contact.contactCoordinate, 0, 2e-15,
    'C lock at working-face root');

  for (const [name, segment] of [['first', first], ['second', second]]) {
    const start = stateAtCycleCoordinate(segment.start);
    const end = stateAtCycleCoordinate(segment.end);
    near(end.wheelAngle - start.wheelAngle, geometry.dropAngle, 5e-16,
      `${name} free-drop advance`);
    near(end.palletAngle, start.palletAngle, 0,
      `${name} carrier holds through free drop`);
    for (let sample = 1; sample < 4096; sample += 1) {
      const coordinate = THREE.MathUtils.lerp(
        segment.start,
        segment.end,
        sample / 4096,
      );
      const state = stateAtCycleCoordinate(coordinate);
      assert.equal(state.freeDrop, true);
      assert.equal(state.activePallet, null);
      assert.equal(state.contact, null);
      assert.ok(state.wheelAngularSpeed > 0);
      assert.ok(state.freeDropState.escapingClearance > 0);
      assert.ok(state.freeDropState.approachingClearance > 0);
    }
  }
  const firstMiddle = stateAtCycleCoordinate((first.start + first.end) / 2);
  const secondMiddle = stateAtCycleCoordinate((second.start + second.end) / 2);
  near(firstMiddle.freeDropState.escapingClearance, 0.19869631963948048,
    2e-15, 'B release midpoint clearance');
  near(firstMiddle.freeDropState.approachingClearance,
    firstMiddle.freeDropState.escapingClearance, 2e-15,
    'first drop has equal midpoint clearances');
  near(secondMiddle.freeDropState.escapingClearance,
    firstMiddle.freeDropState.escapingClearance, 2e-15,
    'opposed drop has the same clearance');
  disposeModel(model.root);
});

test('movement 238 C nominal point law is opposed and completes one pitch', () => {
  const model = createMovementModel(catalog.movements[237]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const { start, end } = geometry.phases.cDrive;
  let previousCoordinate = -Infinity;
  let previousWheelAngle = -Infinity;
  let maximumSpeed = 0;

  for (let sample = 0; sample < 8192; sample += 1) {
    const coordinate = THREE.MathUtils.lerp(start, end, sample / 8192);
    const state = stateAtCycleCoordinate(coordinate);
    assert.equal(state.stage, 'C-tooth-slides-root-to-tip');
    assert.equal(state.activePallet, 'C');
    assert.equal(state.activeToothIndex, 3);
    assert.equal(state.drivingContact, true);
    assert.equal(state.dwell, false);
    assert.ok(state.contact.contactCoordinate >= previousCoordinate - 2e-14);
    assert.ok(state.contact.contactCoordinate >= -2e-14);
    assert.ok(state.contact.contactCoordinate <= 1 + 2e-14);
    assert.ok(state.wheelAngle >= previousWheelAngle - 2e-14);
    assert.ok(state.wheelAngularSpeed >= -2e-13);
    near(state.contact.point.length(), geometry.contactRadius, 5e-16,
      `C tooth-tip orbit at ${coordinate}`);
    near(state.contact.lineSeparation, 0, 8e-16,
      `C face contact at ${coordinate}`);
    near(state.contact.normalVelocityError, 0, 2e-15,
      `C contact normal velocity at ${coordinate}`);
    previousCoordinate = state.contact.contactCoordinate;
    previousWheelAngle = state.wheelAngle;
    maximumSpeed = Math.max(maximumSpeed, state.wheelAngularSpeed);
  }
  const rootLock = stateAtCycleCoordinate(start);
  const release = stateAtCycleCoordinate(end);
  near(rootLock.contact.contactCoordinate, 0, 2e-15,
    'C impulse begins at root');
  near(
    release.wheelAngle,
    geometry.toothPitch - geometry.dropAngle,
    5e-16,
    'C release leaves only the second positive drop',
  );
  near(release.palletAngle, geometry.lowPalletAngle, 0,
    'C release carrier angle');
  assert.equal(release.stage, 'C-releases-free-drop-to-B-root');
  assert.ok(maximumSpeed > 0.15);
  disposeModel(model.root);
});

test('movement 238 analytic wheel and pallet derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[237]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-5;

  for (const cyclePhase of [
    0.14, 0.19, 0.25, 0.3,
    0.36, 0.38,
    0.62, 0.68, 0.74, 0.79,
    0.84, 0.86,
  ]) {
    const time = cyclePhase * geometry.cyclePeriod;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    for (const [name, angleKey, speedKey, accelerationKey] of [
      ['wheel', 'wheelAngle', 'wheelAngularSpeed', 'wheelAngularAcceleration'],
      ['pallet', 'palletAngle', 'palletAngularSpeed',
        'palletAngularAcceleration'],
    ]) {
      const finiteSpeed = (after[angleKey] - before[angleKey]) / (2 * h);
      const finiteAcceleration = (
        after[angleKey] - 2 * state[angleKey] + before[angleKey]
      ) / h ** 2;
      near(finiteSpeed, state[speedKey], 1e-7,
        `${name} speed at phase ${cyclePhase}`);
      near(finiteAcceleration, state[accelerationKey], 5e-6,
        `${name} acceleration at phase ${cyclePhase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 238 remains one-way, renders its constraints, and closes before 252', () => {
  const model = createMovementModel(catalog.movements[237]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtCycleCoordinate,
    stateAtTime,
  } = model.root.userData;
  let previousWheelAngle = stateAtCycleCoordinate(0).wheelAngle;
  let dwellSamples = 0;
  for (let sample = 1; sample <= 65_536; sample += 1) {
    const state = stateAtCycleCoordinate(7 * sample / 65_536);
    assert.ok(state.wheelAngle >= previousWheelAngle - 3e-14,
      `escape wheel does not reverse at sample ${sample}`);
    assert.ok(state.wheelAngularSpeed >= -3e-13);
    if (state.dwell) dwellSamples += 1;
    previousWheelAngle = state.wheelAngle;
  }
  assert.ok(dwellSamples > 25_000,
    `escapement includes visible locks (${dwellSamples} samples)`);
  for (let cycle = 0; cycle <= 14; cycle += 1) {
    const closure = stateAtCycleCoordinate(cycle);
    near(closure.wheelAngle, cycle * geometry.toothPitch + model.root.userData.bContactBranch.initialWheelAngle, 1e-7,
      `accumulated tooth index ${cycle}`);
    near(closure.palletAngle, geometry.lowPalletAngle, 0,
      `carrier closes cycle ${cycle}`);
    assert.equal(closure.activePallet, 'B');
    assert.equal(closure.activeToothIndex, (7 - cycle % 7) % 7);
  }
  near(stateAtCycleCoordinate(7).wheelAngle - stateAtCycleCoordinate(0).wheelAngle, FULL_TURN, 2e-15,
    'seven oscillations close one wheel revolution');
  near(stateAtCycleCoordinate(14).wheelAngle - stateAtCycleCoordinate(0).wheelAngle, 2 * FULL_TURN, 4e-15,
    'fourteen oscillations close two wheel revolutions');

  for (const time of [0, 0.5, 0.88, 1.48, 1.96, 2.8, 3.4, 4]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.escapeWheel.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered escape wheel at ${time}`);
    near(blocks.escapeShaft.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered escape arbor at ${time}`);
    near(blocks.palletCarrier.rotation.z, state.palletAngle, 0,
      `rendered pallet carrier at ${time}`);
    assert.equal(blocks.bContactMarker.visible, false);
    assert.equal(blocks.cContactMarker.visible, false);
    if (state.contact) {
      const marker = state.activePallet === 'B'
        ? blocks.bContactMarker
        : blocks.cContactMarker;
      vectorNear(
        new THREE.Vector2(marker.position.x, marker.position.y),
        state.contact.point,
        0,
        `rendered ${state.activePallet} contact at ${time}`,
      );
    }
    assert.equal(
      model.root.userData.contacts.freeDrop !== null,
      state.freeDrop,
    );
  }
  assert.equal(animationTiming.authoredCyclePeriod, geometry.cyclePeriod);
  assert.ok(model.root.userData.minimumDisplayCycleSeconds >= 6);
  assertReadableTiming(animationTiming);
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 4.8);
  assert.ok(size.y > 5.2);
  assert.ok(size.z > 1.1);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 25); // Replaced multi-mesh beams with single finite plates.

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
