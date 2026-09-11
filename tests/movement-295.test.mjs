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

test('movement 295 animates one enlarged cylinder through Brown’s sequential states', () => {
  const movement = catalog.movements[294];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 295);
  assert.equal(movement.number, '295');
  assert.equal(movement.title, 'Enlarged action of a cylinder escapement');
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'single-cylinder-enlarged-outside-inside-double-beat-action');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one physical hollow cylinder/);
  assert.match(mechanism, /successive time states/);
  assert.match(mechanism, /outside lock a/);
  assert.match(mechanism, /inside lock c/);
  assert.equal(transmission.physicalCylinderCount, 1);
  assert.equal(transmission.compositeDrawingStateCount, 3);
  assert.equal(transmission.sourceStatesAreSequential, true);
  assert.deepEqual(transmission.sourcePalletLabels, ['a', 'b', 'c']);
  assert.equal(transmission.impulseCountPerOscillation, 2);
  assert.equal(transmission.toothCount, 15);

  assert.equal(blocks.cylinderAssembly.parent, model.root);
  assert.equal(blocks.escapeWheel.parent, model.root);
  assert.equal(blocks.cylinderSection.parent, blocks.cylinderAssembly);
  assert.equal(blocks.sectionStaff.parent, blocks.cylinderAssembly);
  assert.equal(blocks.wheelRotor.parent, blocks.escapeWheel);
  assert.equal(blocks.cameraEnvelope.parent, model.root);
  assert.equal(blocks.palletAssemblies.length, 15);
  assert.equal(blocks.palletLabelMarkers.length, 3);
  vectorNear(blocks.cylinderAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'single cylinder axis');
  vectorNear(blocks.escapeWheel.userData.axis,
    new THREE.Vector3(0, 0, 1), 0, 'single wheel axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'balance-carried-hollow-cutaway-cylinder-A-B').length, 1);
  assert.equal(roles.filter((role) =>
    role === '196-degree-cylinder-shell-in-central-escape-wheel-band')
    .length, 1);
  assert.equal(roles.filter((role) =>
    role === 'raised-oblique-beveled-wheel-pallet-a-b-c').length, 15);
  assert.equal(roles.filter((role) =>
    /white-source-label-marker-for-pallet-[abc]/.test(role)).length, 3);
  assert.equal(roles.some((role) => /ghost-cylinder|simultaneous-cylinder/.test(role)),
    false);
  assert.equal(roles.some((role) => /full-hollow-cylinder-tube/.test(role)),
    false);
  assert.equal(roles.some((role) => /balance-wheel-attached/.test(role)),
    false);
  assert.equal(roles.some((role) => /generic|procedural|bevel-gear/.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 295 records the composite plate as three times, not three mechanisms', () => {
  const movement = catalog.movements[294];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate295;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /three successive cylinder positions/);
  assert.match(sourceAnimation.referenceScope, /one moving cylinder and one wheel/);
  assert.match(sourceAnimation.referenceScope, /outside\/inside frictional rests/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_295.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.equal(plate.compositeNotSimultaneous, true);
  assert.equal(plate.sequentialStateCount, 3);
  assert.deepEqual(plate.rasterCylinderStateCenters, [
    new THREE.Vector2(151, 224),
    new THREE.Vector2(280, 224),
    new THREE.Vector2(404, 221),
  ]);
  assert.deepEqual(plate.rasterPalletLabels, {
    a: new THREE.Vector2(68, 232),
    b: new THREE.Vector2(240, 185),
    c: new THREE.Vector2(410, 201),
  });
  assert.deepEqual(plate.rasterCylinderLabels, {
    firstA: new THREE.Vector2(126, 242),
    firstB: new THREE.Vector2(191, 218),
    secondA: new THREE.Vector2(355, 204),
    secondB: new THREE.Vector2(459, 225),
  });
  assert.deepEqual(plate.rasterWheelDirectionArrow,
    new THREE.Vector2(120, 333));
  assert.deepEqual(plate.rasterWheelCrown,
    new THREE.Vector2(276, 290));
  assert.equal(plate.rasterCylinderOuterRadius, 65);
  assert.match(plate.inferredTopology, /successive times/);
  assert.match(plate.inferredTopology, /clockwise wheel arc/);

  vectorNear(sourcePointToModel(plate.rasterCylinderStateCenters[1]),
    geometry.cylinderCenter, 0, 'middle composite origin');
  near(plate.rasterCylinderOuterRadius * geometry.sourcePlanScale,
    geometry.cylinderOuterRadius, 0, 'source plan cylinder radius');
  assert.equal(sourceReference.pairedPlate294.sourceUrl,
    'https://507movements.com/mm_294.html');
  assert.match(sourceReference.pairedPlate294.relation,
    /offset working-band window/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 77,
    edition: 21,
    illustrationPage: 76,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.periodReference.publicationYear, 1904);
  assert.match(sourceReference.periodReference.description,
    /outside and inside/);
  disposeModel(model.root);
});

test('movements 294 and 295 share one exact cylinder contact law in distinct views', () => {
  const perspective = createMovementModel(catalog.movements[293]);
  const action = createMovementModel(catalog.movements[294]);
  const perspectiveData = perspective.root.userData;
  const actionData = action.root.userData;

  assert.notEqual(perspectiveData.archetype, actionData.archetype);
  assert.ok('leftTube' in perspectiveData.blocks);
  assert.ok(!('leftTube' in actionData.blocks));
  assert.ok('balanceRim' in perspectiveData.blocks);
  assert.ok(!('balanceRim' in actionData.blocks));
  assert.equal(perspectiveData.blocks.fixedFrame.parent, perspective.root);
  assert.ok(!('fixedFrame' in actionData.blocks));

  for (const key of [
    'balancePeriod',
    'cylinderInnerRadius',
    'cylinderOuterRadius',
    'entryImpulseAdvance',
    'exitImpulseAdvance',
    'freeDropAdvance',
    'toothCount',
    'toothOrbitRadius',
    'toothPitch',
  ]) {
    near(actionData.geometry[key], perspectiveData.geometry[key], 0,
      `paired geometry ${key}`);
  }
  for (const phase of [0, 0.10, 0.205, 0.255, 0.48, 0.705, 0.86, 1]) {
    const a = actionData.stateAtCyclePhase(phase);
    const b = perspectiveData.stateAtCyclePhase(phase);
    near(a.balanceAngle, b.balanceAngle, 0,
      `paired balance state ${phase}`);
    near(a.wheelAngle, b.wheelAngle, 0,
      `paired wheel state ${phase}`);
    assert.equal(a.stage, b.stage);
    assert.equal(a.contactMode, b.contactMode);
    assert.equal(a.activeToothIndex, b.activeToothIndex);
    if (a.contactActive) {
      vectorNear(a.contact.expectedPoint, b.contact.expectedPoint, 0,
        `paired contact point ${phase}`);
    }
  }
  disposeModel(action.root);
  disposeModel(perspective.root);
});

test('movement 295 exposes the working section, three pallet labels, and source crop', () => {
  const model = createMovementModel(catalog.movements[294]);
  const { blocks, geometry } = model.root.userData;

  near(geometry.cylinderShellSweep, THREE.MathUtils.degToRad(196), 0,
    'section shell sweep');
  near(blocks.cylinderSection.position.z, geometry.workingPlaneZ, 0,
    'working section plane');
  near(blocks.sectionStaff.position.z, geometry.workingPlaneZ, 0,
    'short section staff plane');
  const staffGeometry = blocks.sectionStaff.geometry;
  staffGeometry.computeBoundingBox();
  const staffExtent = new THREE.Vector3();
  staffGeometry.boundingBox.getSize(staffExtent);
  assert.ok(Math.max(staffExtent.x, staffExtent.y, staffExtent.z) < 0.9);
  assert.equal(blocks.palletLabelMarkers.length, 3);
  for (let index = 0; index < 3; index += 1) {
    const marker = blocks.palletLabelMarkers[index];
    assert.equal(marker.parent, blocks.wheelRotor);
    assert.equal(marker.userData.index, index);
    assert.equal(marker.userData.sourceLabel, ['a', 'b', 'c'][index]);
    near(new THREE.Vector2(marker.position.x, marker.position.y).length(),
      geometry.toothOrbitRadius, 5e-16,
    `source pallet marker orbit ${index}`);
  }
  assert.equal(model.root.userData.cameraFitBounds.isBox3, true);
  assert.deepEqual(model.root.userData.cameraFitBounds.min,
    new THREE.Vector3(-3.0, -0.55, -1.20));
  assert.deepEqual(model.root.userData.cameraFitBounds.max,
    new THREE.Vector3(3.0, 3.05, 1.10));
  near(model.root.userData.groundFloorY,
    geometry.wheelCenter.y - geometry.wheelOuterRadius - 0.34, 0,
  'ground remains below the complete wheel despite source crop');
  assert.ok(blocks.outerLockTrace.material.transparent);
  near(blocks.outerLockTrace.material.opacity, 0.34, 0,
    'subdued historic rest guide');
  disposeModel(model.root);
});

test('movement 295 resolves a, b, and c sequentially with one active contact only', () => {
  const model = createMovementModel(catalog.movements[294]);
  const {
    canonicalStates,
    stateAtCyclePhase,
    transmission,
  } = model.root.userData;

  assert.equal(transmission.physicalCylinderCount, 1);
  assert.equal(canonicalStates.outerRest.contactMode,
    'outside-frictional-rest');
  assert.equal(canonicalStates.entryImpulseMiddle.contactMode,
    'entry-lip-impulse');
  assert.equal(canonicalStates.insideDropMiddle.contactMode, null);
  assert.equal(canonicalStates.innerRest.contactMode,
    'inside-frictional-rest');
  assert.equal(canonicalStates.exitImpulseMiddle.contactMode,
    'exit-lip-impulse');
  assert.equal(canonicalStates.nextOuterRest.contactMode,
    'outside-frictional-rest');

  let priorStageIndex = -1;
  const stageOrder = [
    'wheel-pallet-rests-on-cylinder-outside',
    'entry-lip-impulses-balance',
    'wheel-pallet-drops-through-cylinder-opening',
    'same-wheel-pallet-rests-on-cylinder-inside',
    'exit-lip-impulses-balance-in-opposite-sense',
    'next-wheel-pallet-rests-on-cylinder-outside',
  ];
  for (const phase of [0.10, 0.205, 0.255, 0.48, 0.705, 0.86]) {
    const state = stateAtCyclePhase(phase);
    const stageIndex = stageOrder.indexOf(state.stage);
    assert.ok(stageIndex > priorStageIndex,
      `sequential source state at ${phase}`);
    priorStageIndex = stageIndex;
    assert.equal(state.contactActive, state.contact !== null);
    assert.ok(state.contactMode === null || typeof state.contactMode === 'string');
  }
  disposeModel(model.root);
});

test('movement 295 closes every outside, lip, and inside contact exactly', () => {
  const model = createMovementModel(catalog.movements[294]);
  const { stateAtCyclePhase } = model.root.userData;
  const counts = new Map([
    ['outside-frictional-rest', 0],
    ['entry-lip-impulse', 0],
    ['inside-frictional-rest', 0],
    ['exit-lip-impulse', 0],
  ]);

  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtCyclePhase(sample / 20000);
    if (!counts.has(state.contactMode)) continue;
    counts.set(state.contactMode, counts.get(state.contactMode) + 1);
    near(state.contact.pointError, 0, 3e-15,
      `working contact closure at ${sample}`);
    assert.ok(Number.isFinite(state.contact.relativeSlipSpeed));
    if (/frictional-rest/.test(state.contactMode)) {
      near(state.contact.surfaceRadiusError, 0, 3e-15,
        `working cylinder radius at ${sample}`);
      near(state.contact.normalVelocityError, 0, 4e-15,
        `rest normal velocity at ${sample}`);
      assert.equal(state.wheelAngularSpeed, 0);
    } else {
      assert.equal(state.contact.surfaceRadiusError, null);
      near(state.contact.normalVelocityError, 0, 8e-8,
        `generated lip normal velocity at ${sample}`);
      assert.ok(state.wheelAngularSpeed <= 1e-14);
    }
  }
  assert.ok(counts.get('outside-frictional-rest') > 9000);
  assert.ok(counts.get('inside-frictional-rest') > 7900);
  assert.ok(counts.get('entry-lip-impulse') > 990);
  assert.ok(counts.get('exit-lip-impulse') > 990);
  disposeModel(model.root);
});

test('movement 295 advances one clockwise pallet with two opposite-sense impulses', () => {
  const model = createMovementModel(catalog.movements[294]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;

  assert.equal(transmission.impulseCountPerOscillation, 2);
  near(transmission.entryImpulseAdvance, geometry.entryImpulseAdvance, 0,
    'entry impulse share');
  near(transmission.exitImpulseAdvance, geometry.exitImpulseAdvance, 0,
    'exit impulse share');
  near(transmission.freeDropAdvance, geometry.freeDropAdvance, 0,
    'free drop share');
  near(transmission.oscillationAdvance, geometry.toothPitch, 0,
    'one pallet per oscillation');
  assert.ok(stateAtTime(0.205 * geometry.balancePeriod)
    .balanceAngularSpeed > 0);
  assert.ok(stateAtTime(0.705 * geometry.balancePeriod)
    .balanceAngularSpeed < 0);

  for (const time of [0.19, 0.83, 1.54, 2.66, 3.81]) {
    near(stateAtTime(time + geometry.balancePeriod).balanceAngle,
      stateAtTime(time).balanceAngle, 8e-16,
    `balance closure at ${time}`);
    near(stateAtTime(time + geometry.balancePeriod).wheelAngle
        - stateAtTime(time).wheelAngle,
    -geometry.toothPitch, 9e-16,
    `one-pallet wheel advance at ${time}`);
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

test('movement 295 renderer shows one contact sequence and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[294]);
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
  assert.deepEqual(timeline.sourceCompositeResolution, [
    'left paper state: pallet a outside the cylinder',
    'middle paper state: pallet b passes the entry lip',
    'right paper state: pallet c rests inside then exits',
    'animation: those states occur sequentially on one cylinder',
  ]);

  for (const phase of [0, 0.10, 0.205, 0.255, 0.48, 0.705, 0.86, 1]) {
    const time = phase * geometry.balancePeriod;
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.cylinderAssembly.rotation.z, expected.balanceAngle, 0,
      `rendered section cylinder at ${phase}`);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      `rendered enlarged wheel at ${phase}`);
    assert.equal(blocks.contactMarker.visible, expected.contactActive);
    assert.equal(model.root.userData.contacts.mode, expected.contactMode);
    assert.equal(model.root.userData.contacts.activeToothIndex,
      expected.activeToothIndex);
    if (expected.contactActive) {
      near(model.root.userData.contacts.pointError, 0, 3e-15,
        `rendered action contact at ${phase}`);
    }
  }

  model.update(0.63);
  const startCylinderAngle = blocks.cylinderAssembly.rotation.z;
  const startWheelAngle = blocks.wheelRotor.rotation.z;
  model.update(0.63 + geometry.balancePeriod);
  near(blocks.cylinderAssembly.rotation.z, startCylinderAngle, 8e-16,
    'rendered section closure');
  near(blocks.wheelRotor.rotation.z - startWheelAngle,
    -geometry.toothPitch, 9e-16, 'rendered one-pallet closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
