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

test('movement 294 is Brown’s cutaway cylinder escapement, not bevel gearing', () => {
  const movement = catalog.movements[293];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 294);
  assert.equal(movement.number, '294');
  assert.equal(movement.title, 'Cylinder escapement shown in perspective');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fifteen-pallet-double-beat-cylinder-watch-escapement-perspective');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /hollow balance cylinder/);
  assert.match(mechanism, /offset central working band/);
  assert.match(mechanism, /outside and inside/);
  assert.match(mechanism, /two impulses per oscillation/);
  assert.equal(transmission.toothCount, 15);
  assert.equal(transmission.impulseCountPerOscillation, 2);
  assert.equal(transmission.deadBeatFrictionalRest, true);
  assert.deepEqual(transmission.restSequence,
    ['outside-cylinder', 'inside-cylinder']);
  assert.match(transmission.direction, /clockwise/);

  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.cylinderAssembly.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.workingShell.parent, blocks.cylinderAssembly);
  assert.equal(blocks.leftTube.parent, blocks.cylinderAssembly);
  assert.equal(blocks.rightTube.parent, blocks.cylinderAssembly);
  assert.equal(blocks.balanceRim.parent, blocks.cylinderAssembly);
  assert.equal(blocks.palletAssemblies.length, 15);
  assert.equal(blocks.palletHeads.length, 15);
  assert.equal(blocks.palletStems.length, 15);
  assert.equal(blocks.palletFaceMarks.length, 15);
  assert.equal(blocks.wheelSpokes.length, 5);
  assert.equal(blocks.balanceSpokes.length, 3);
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'escape-wheel axis');
  vectorNear(blocks.cylinderAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'cylinder and balance axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'raised-oblique-beveled-wheel-pallet-a-b-c').length, 15);
  assert.equal(roles.filter((role) =>
    role === 'short-axial-stem-under-raised-wheel-pallet').length, 15);
  assert.equal(roles.filter((role) =>
    role === '196-degree-cylinder-shell-in-central-escape-wheel-band')
    .length, 1);
  assert.equal(roles.filter((role) => /beveled-(entry|exit)-lip/.test(role))
    .length, 2);
  assert.equal(roles.some((role) => /generic|procedural|bevel-gear/.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 294 records the measured perspective plate and its paired operating view', () => {
  const movement = catalog.movements[293];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate294;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /offset working-band window/);
  assert.match(sourceAnimation.referenceScope, /outside\/inside frictional rests/);
  assert.match(sourceAnimation.referenceScope, /two lip impulses/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_294.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterAxisCenter, new THREE.Vector2(271, 252));
  assert.deepEqual(plate.rasterLeftPivotTip, new THREE.Vector2(20, 253));
  assert.deepEqual(plate.rasterBodyStart, new THREE.Vector2(143, 252));
  assert.deepEqual(plate.rasterWorkingBandStart,
    new THREE.Vector2(217, 278));
  assert.deepEqual(plate.rasterWorkingBandEnd,
    new THREE.Vector2(276, 290));
  assert.deepEqual(plate.rasterBodyEnd, new THREE.Vector2(399, 252));
  assert.deepEqual(plate.rasterRightPivotTip,
    new THREE.Vector2(516, 253));
  assert.equal(plate.rasterOuterRadius, 39);
  assert.equal(plate.rasterWorkingBandWidth, 59);
  assert.match(plate.inferredTopology, /complete tubular portions/);
  assert.match(plate.inferredTopology, /central band/);

  vectorNear(sourcePointToModel(plate.rasterAxisCenter),
    new THREE.Vector3(0, geometry.cylinderCenter.y, 0), 0,
    'source cylinder-axis center');
  near(sourcePointToModel(plate.rasterBodyStart).z,
    geometry.cylinderBodyStartZ, 0, 'source body start');
  near(sourcePointToModel(plate.rasterBodyEnd).z,
    geometry.cylinderBodyEndZ, 0, 'source body end');
  near(sourcePointToModel(plate.rasterWorkingBandStart).z,
    geometry.workingBandStartZ, 0, 'source working-band start');
  near(sourcePointToModel(plate.rasterWorkingBandEnd).z,
    geometry.workingBandEndZ, 0, 'source working-band end');
  near(plate.rasterOuterRadius * geometry.sourceRadialScale,
    geometry.cylinderOuterRadius, 0, 'source outer radius');

  assert.equal(sourceReference.pairedPlate295.sourceUrl,
    'https://507movements.com/mm_295.html');
  assert.deepEqual(sourceReference.pairedPlate295.labels,
    ['A', 'B', 'a', 'b', 'c']);
  assert.match(sourceReference.pairedPlate295.relation,
    /outside lock/);
  assert.match(sourceReference.pairedPlate295.relation,
    /inside lock/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1911);
  assert.equal(sourceReference.periodReference.figure, 5);
  assert.match(sourceReference.periodReference.description,
    /dead friction first on the outside and then on the inside/);
  disposeModel(model.root);
});

test('movement 294 reproduces the hollow tube, offset window, and raised pallet planes', () => {
  const model = createMovementModel(catalog.movements[293]);
  const { blocks, geometry } = model.root.userData;

  assert.ok(geometry.cylinderBodyStartZ < geometry.workingBandStartZ);
  assert.ok(geometry.workingBandStartZ < geometry.workingBandEndZ);
  assert.ok(geometry.workingBandEndZ < geometry.cylinderBodyEndZ);
  near(geometry.workingBandWidth,
    geometry.workingBandEndZ - geometry.workingBandStartZ, 0,
  'offset window width');
  near(geometry.leftTubeLength,
    geometry.workingBandStartZ - geometry.cylinderBodyStartZ, 0,
  'left full-tube length');
  near(geometry.rightTubeLength,
    geometry.cylinderBodyEndZ - geometry.workingBandEndZ, 0,
  'right full-tube length');
  assert.ok(geometry.rightTubeLength > geometry.leftTubeLength);
  near(geometry.cylinderWallThickness,
    geometry.cylinderOuterRadius - geometry.cylinderInnerRadius, 0,
  'hollow cylinder wall');
  assert.ok(geometry.cylinderWallThickness > 0.14);
  assert.ok(geometry.cylinderInnerRadius > 0.45);
  near(geometry.cylinderShellSweep, THREE.MathUtils.degToRad(196), 0,
    'working shell sweep');
  near(blocks.workingShell.position.z, geometry.workingPlaneZ, 0,
    'partial shell centered in window');
  near(blocks.leftTube.position.z,
    (geometry.cylinderBodyStartZ + geometry.workingBandStartZ) / 2, 0,
  'left full tube placement');
  near(blocks.rightTube.position.z,
    (geometry.workingBandEndZ + geometry.cylinderBodyEndZ) / 2, 0,
  'right full tube placement');
  assert.equal(blocks.entryLipRail.userData.beveled, true);
  assert.equal(blocks.exitLipRail.userData.beveled, true);

  for (let index = 0; index < geometry.toothCount; index += 1) {
    near(blocks.palletAssemblies[index].rotation.z,
      index * geometry.toothPitch, 0, `pallet pitch ${index}`);
    assert.equal(blocks.palletAssemblies[index].userData.index, index);
    assert.equal(blocks.palletHeads[index].userData.index, index);
    assert.equal(blocks.palletHeads[index].userData.beveled, true);
    assert.equal(blocks.palletHeads[index].userData.obliqueWorkingFace, true);
    near(blocks.palletHeads[index].position.z,
      geometry.workingPlaneZ, 0, `raised head plane ${index}`);
    assert.ok(blocks.palletStems[index].position.z
      > geometry.wheelPlaneZ);
  }
  assert.ok(blocks.wheelRim.position.z < geometry.workingPlaneZ);
  assert.ok(blocks.balanceRim.position.z > geometry.cylinderBodyEndZ);
  disposeModel(model.root);
});

test('movement 294 holds exact dead friction on both cylinder surfaces', () => {
  const model = createMovementModel(catalog.movements[293]);
  const {
    innerLockPoint,
    outerLockPoint,
    stateAtCyclePhase,
  } = model.root.userData;
  const modeCounts = new Map([
    ['outside-frictional-rest', 0],
    ['inside-frictional-rest', 0],
  ]);

  for (let sample = 0; sample <= 16000; sample += 1) {
    const state = stateAtCyclePhase(sample / 16000);
    if (!modeCounts.has(state.contactMode)) continue;
    modeCounts.set(state.contactMode, modeCounts.get(state.contactMode) + 1);
    assert.equal(state.wheelAngularSpeed, 0);
    assert.equal(state.wheelAngularAcceleration, 0);
    near(state.contact.pointError, 0, 2e-15,
      `stationary pallet closure at ${sample}`);
    near(state.contact.surfaceRadiusError, 0, 3e-15,
      `cylinder surface radius at ${sample}`);
    near(state.contact.normalVelocityError, 0, 3e-15,
      `dead-beat normal velocity at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    if (state.contactMode === 'outside-frictional-rest') {
      vectorNear(state.activeToothPoint, outerLockPoint, 6e-15,
        `outside lock point ${sample}`);
    } else {
      vectorNear(state.activeToothPoint, innerLockPoint, 4e-15,
        `inside lock point ${sample}`);
    }
  }
  assert.ok(modeCounts.get('outside-frictional-rest') > 7000);
  assert.ok(modeCounts.get('inside-frictional-rest') > 6000);
  disposeModel(model.root);
});

test('movement 294 enters through one lip, then drops freely across the hollow', () => {
  const model = createMovementModel(catalog.movements[293]);
  const {
    contactFrameAtPhase,
    geometry,
    stateAtCyclePhase,
  } = model.root.userData;

  let impulseSamples = 0;
  for (let sample = 2881; sample < 3680; sample += 1) {
    const phase = sample / 16000;
    const state = stateAtCyclePhase(phase);
    if (state.contactMode !== 'entry-lip-impulse') continue;
    impulseSamples += 1;
    assert.equal(state.entryImpulseActive, true);
    assert.equal(state.exitImpulseActive, false);
    assert.ok(state.balanceAngularSpeed > 0);
    assert.ok(state.wheelAngularSpeed <= 1e-14);
    near(state.contact.pointError, 0, 3e-15,
      `entry lip closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 8e-8,
      `entry lip normal velocity at ${sample}`);
    const frame = contactFrameAtPhase(phase);
    vectorNear(state.contact.localPoint, frame.point, 0,
      `entry material profile point ${sample}`);
  }
  assert.ok(impulseSamples > 790);

  const entryStart = stateAtCyclePhase(geometry.entryStart);
  const entryEnd = stateAtCyclePhase(geometry.entryEnd);
  near(entryEnd.wheelAdvance - entryStart.wheelAdvance,
    geometry.entryImpulseAdvance, 2e-15, 'entry impulse advance');
  for (const phase of [0.231, 0.242, 0.255, 0.269, 0.279]) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.stage,
      'wheel-pallet-drops-through-cylinder-opening');
    assert.equal(state.contactActive, false);
    assert.equal(state.contactMode, null);
    assert.ok(state.wheelAngularSpeed < 0);
  }
  near(stateAtCyclePhase(geometry.innerLanding).wheelAdvance
      - entryEnd.wheelAdvance,
  geometry.freeDropAdvance, 2e-15, 'free drop across cylinder');
  disposeModel(model.root);
});

test('movement 294 exits through the opposite lip and hands off to the next outside lock', () => {
  const model = createMovementModel(catalog.movements[293]);
  const {
    geometry,
    innerLockPoint,
    outerLockPoint,
    stateAtCyclePhase,
  } = model.root.userData;

  let impulseSamples = 0;
  for (let sample = 10881; sample < 11680; sample += 1) {
    const phase = sample / 16000;
    const state = stateAtCyclePhase(phase);
    if (state.contactMode !== 'exit-lip-impulse') continue;
    impulseSamples += 1;
    assert.equal(state.entryImpulseActive, false);
    assert.equal(state.exitImpulseActive, true);
    assert.ok(state.balanceAngularSpeed < 0);
    assert.ok(state.wheelAngularSpeed <= 1e-14);
    near(state.contact.pointError, 0, 3e-15,
      `exit lip closure at ${sample}`);
    near(state.contact.normalVelocityError, 0, 8e-8,
      `exit lip normal velocity at ${sample}`);
  }
  assert.ok(impulseSamples > 790);

  const beforeExit = stateAtCyclePhase(geometry.exitStart - 1e-8);
  vectorNear(beforeExit.activeToothPoint, innerLockPoint, 3e-15,
    'same pallet rests on inside before exit');
  const afterExit = stateAtCyclePhase(geometry.exitEnd + 1e-8);
  assert.equal(afterExit.activeToothIndex, 1);
  assert.equal(afterExit.contactMode, 'outside-frictional-rest');
  vectorNear(afterExit.activeToothPoint, outerLockPoint, 3e-15,
    'next pallet lands on outside');
  near(afterExit.wheelAdvance - beforeExit.wheelAdvance,
    geometry.exitImpulseAdvance, 2e-15, 'exit impulse advance');
  near(geometry.entryImpulseAdvance + geometry.freeDropAdvance
      + geometry.exitImpulseAdvance,
  geometry.toothPitch, 0, 'complete one-pitch event partition');
  disposeModel(model.root);
});

test('movement 294 advances one clockwise pallet per oscillation with analytic rates', () => {
  const model = createMovementModel(catalog.movements[293]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  near(transmission.oscillationAdvance, geometry.toothPitch, 0,
    'one pallet per balance oscillation');
  for (const time of [0.31, 0.93, 1.72, 2.81, 3.74]) {
    near(stateAtTime(time + geometry.balancePeriod).balanceAngle,
      stateAtTime(time).balanceAngle, 7e-16,
    `balance closure at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.toothPitch, 8e-16,
    `clockwise one-pitch advance at ${time}`);
  }

  let previous = stateAtTime(0).wheelAngle;
  for (let sample = 1; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      geometry.balancePeriod * sample / 24000,
    );
    assert.ok(state.wheelAngle <= previous + 2e-15,
      `no wheel recoil at sample ${sample}`);
    assert.ok(state.wheelAngularSpeed <= 1e-13);
    previous = state.wheelAngle;
  }

  const epsilon = 1e-5;
  for (const phase of [0.10, 0.205, 0.255, 0.48, 0.705, 0.86]) {
    const time = phase * geometry.balancePeriod;
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularSpeed, 7e-10,
    `balance speed at ${phase}`);
    near((after.balanceAngularSpeed - before.balanceAngularSpeed)
        / (2 * epsilon),
    state.balanceAngularAcceleration, 2e-9,
    `balance acceleration at ${phase}`);
    near((after.wheelAngle - before.wheelAngle) / (2 * epsilon),
      state.wheelAngularSpeed, 3e-8,
    `wheel speed at ${phase}`);
    near((after.wheelAngularSpeed - before.wheelAngularSpeed)
        / (2 * epsilon),
    state.wheelAngularAcceleration, 2e-6,
    `wheel acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 294 renderer binds the cylinder, both impulses, closure, and next draft', () => {
  const model = createMovementModel(catalog.movements[293]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod, 4);
  assert.deepEqual(timeline.schedule, [
    'pallet-a-outside-frictional-rest',
    'entry-lip-impulse-to-balance',
    'free-drop-across-hollow-cylinder',
    'same-pallet-inside-frictional-rest',
    'exit-lip-impulse-in-opposite-sense',
    'next-pallet-outside-frictional-rest',
  ]);

  for (const phase of [0, 0.10, 0.205, 0.255, 0.48, 0.705, 0.86, 1]) {
    const time = phase * geometry.balancePeriod;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.cylinderAssembly.rotation.z, expected.balanceAngle, 0,
      `rendered cylinder at ${phase}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered escape wheel at ${phase}`);
    assert.equal(blocks.contactMarker.visible, expected.contactActive);
    assert.equal(model.root.userData.contacts.mode, expected.contactMode);
    assert.equal(model.root.userData.contacts.activeToothIndex,
      expected.activeToothIndex);
    if (expected.contactActive) {
      near(model.root.userData.contacts.pointError, 0, 3e-15,
        `rendered contact closure at ${phase}`);
      vectorNear(
        new THREE.Vector2(
          blocks.contactMarker.position.x,
          blocks.contactMarker.position.y,
        ),
        expected.contact.expectedPoint,
        0,
        `rendered marker point at ${phase}`,
      );
      near(blocks.contactMarker.position.z,
        geometry.workingPlaneZ + geometry.palletDepth / 2 + 0.16, 0,
      `rendered marker plane at ${phase}`);
    }
  }

  model.update(0.77);
  const startCylinderAngle = blocks.cylinderAssembly.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.77 + geometry.balancePeriod);
  near(blocks.cylinderAssembly.rotation.z, startCylinderAngle, 8e-16,
    'rendered balance closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 8e-16, 'rendered one-pallet advance');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
