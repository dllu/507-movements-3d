import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

test('movement 277 is one hammer-carried dog indexing one six-tooth cylinder ratchet', () => {
  const movement = catalog.movements[276];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 277);
  assert.equal(movement.number, '277');
  assert.equal(
    movement.title,
    'Colt Hammer-Driven Cylinder Indexing Ratchet',
  );
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'hammer-carried-spring-dog-six-step-cylinder-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one pivoted hammer and tumbler/);
  assert.match(mechanism, /one rigid dog a/);
  assert.match(mechanism, /spring c biases that dog/);
  assert.match(mechanism, /six-tooth face ratchet b/);
  assert.match(mechanism, /receiver lock holds the indexed cylinder/);
  assert.equal(transmission.ratchetTeeth, 6);
  near(transmission.cylinderStepPerCock, FULL_TURN / 6, 0,
    'one-chamber step');

  assert.ok(blocks.cylinder.parent === model.root, 'cylinder parent');
  assert.ok(blocks.cylinderRotor.parent === blocks.cylinder, 'cylinderRotor parent');
  assert.ok(blocks.cylinderBody.parent === blocks.cylinderRotor, 'cylinder body on the rotor');
  assert.ok(blocks.ratchet.parent === blocks.cylinderRotor, 'ratchet parent');
  assert.equal(blocks.lockingWards.length, 6);
  assert.ok(blocks.lockingWards.every((ward) =>
    ward.parent === blocks.cylinderRotor));
  assert.ok(blocks.hammer.parent === model.root, 'hammer parent');
  assert.ok(blocks.hammerRotor.parent === blocks.hammer, 'hammerRotor parent');
  assert.ok(blocks.hammerBody.parent === blocks.hammerRotor, 'hammerBody parent');
  assert.ok(blocks.dogPivotPin.parent === blocks.hammerRotor, 'dogPivotPin parent');
  assert.ok(blocks.dog.parent === model.root, 'dog parent');
  assert.ok(blocks.spring.parent === model.root, 'spring parent');
  assert.ok(blocks.lockBolt.parent === model.root, 'lockBolt parent');
  vectorNear(blocks.cylinder.userData.axis, X_AXIS, 0, 'cylinder axis');
  vectorNear(blocks.cylinderRotor.userData.axis, X_AXIS, 0,
    'cylinder rotor axis');
  vectorNear(blocks.hammer.userData.axis, Z_AXIS, 0, 'hammer axis');
  vectorNear(blocks.hammerRotor.userData.axis, Z_AXIS, 0,
    'hammer rotor axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /six-tooth-face-ratchet-b/.test(role))
    .length, 1);
  assert.equal(roles.filter((role) => /spring-biased-rigid-indexing-dog-a/
    .test(role)).length, 1);
  assert.equal(roles.filter((role) => /receiver-lock-required/.test(role))
    .length, 1);
  assert.equal(roles.filter((role) => /belt|pulley/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 277 records Brown’s plate, unavailable animation, and Colt patent evidence', () => {
  const model = createMovementModel(catalog.movements[276]);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate277;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /official Movement 277 page marks its animation unavailable/);
  assert.match(sourceAnimation.reason, /Colt patent USX9430/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[276].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.ratchetContactProjectionUncertaintyPixels, 18);
  assert.deepEqual(plate.rasterCylinderFrontTop, { x: 7, y: 98 });
  assert.deepEqual(plate.rasterCylinderRearTop, { x: 112, y: 98 });
  assert.deepEqual(plate.rasterCylinderFrontBottom, { x: 7, y: 469 });
  assert.deepEqual(plate.rasterCylinderRearBottom, { x: 112, y: 469 });
  assert.deepEqual(plate.rasterDogPivot, { x: 212, y: 389 });
  assert.deepEqual(plate.rasterHammerPivot, { x: 301, y: 394 });
  assert.deepEqual(plate.rasterSpringAnchor, { x: 166, y: 132 });
  assert.deepEqual(plate.rasterRatchetContactProjection, { x: 128, y: 247 });
  assert.match(plate.inferredTopology, /one hammer\/tumbler/);
  assert.match(plate.inferredTopology, /one pivoted dog a/);
  assert.match(plate.inferredTopology, /mechanically required receiver lock/);

  vectorNear(sourcePointToModel(plate.rasterHammerPivot),
    new THREE.Vector2(0, 0), 0, 'source hammer pivot');
  const source = model.root.userData.stateAtTime(0);
  const projectedContact = new THREE.Vector2(source.dogTip.x, source.dogTip.y);
  const measuredContact = sourcePointToModel(
    plate.rasterRatchetContactProjection,
  );
  near(
    projectedContact.distanceTo(measuredContact) / geometry.sourceScale,
    plate.sourceIdealizationPixelErrors.ratchetContactProjection,
    2e-14,
    'source ratchet contact projection error',
  );
  for (const [key, error] of Object.entries(
    plate.sourceIdealizationPixelErrors,
  )) {
    const tolerance = key === 'ratchetContactProjection'
      ? plate.ratchetContactProjectionUncertaintyPixels
      : plate.measurementUncertaintyPixels;
    assert.ok(error <= tolerance, `${key} remains inside source uncertainty`);
  }

  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 71,
    edition: 21,
    illustrationPage: 70,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.primaryPatent.patentNumber, 'USX9430');
  assert.equal(sourceReference.primaryPatent.patentDate, '1836-02-25');
  assert.equal(sourceReference.primaryPatent.title, 'Revolving Gun');
  assert.equal(
    sourceReference.primaryPatent.url,
    'https://patents.google.com/patent/USX9430/en',
  );
  assert.match(sourceReference.primaryPatent.evidence, /next chamber aligns/);
  assert.match(sourceReference.primaryPatent.evidence, /cylinder key holds/);
  disposeModel(model.root);
});

test('movement 277 rigid-dog closure advances monotonically to an exact full-cock toggle', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { geometry, transmission } = model.root.userData;
  const closureAt = transmission.engagedClosureAtHammerAngle;
  let previousPhase = -Infinity;
  let maximumLengthError = 0;
  let maximumReverseIncrement = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const hammerAngle = -geometry.hammerStroke * index / 32768;
    const closure = closureAt(hammerAngle);
    maximumLengthError = Math.max(
      maximumLengthError,
      Math.abs(closure.dogLengthError),
    );
    maximumReverseIncrement = Math.max(
      maximumReverseIncrement,
      previousPhase - closure.worldPhase,
    );
    assert.ok(closure.cosineArgument >= -1);
    assert.ok(closure.cosineArgument <= 1);
    if (index < 32768) assert.ok(closure.phasePerHammer < 0);
    previousPhase = closure.worldPhase;
  }

  const rest = closureAt(0);
  const fullCock = closureAt(-geometry.hammerStroke);
  assert.ok(maximumLengthError < 9e-16,
    `rigid dog length error ${maximumLengthError}`);
  assert.ok(maximumReverseIncrement < 4e-15,
    `ratchet phase reversal ${maximumReverseIncrement}`);
  near(rest.worldPhase, geometry.ratchetContactPhase, 0,
    'rest tooth phase');
  near(
    fullCock.worldPhase - rest.worldPhase,
    geometry.ratchetPitch,
    2e-15,
    'one exact tooth of closure',
  );
  near(fullCock.phasePerHammer, 0, 2e-15,
    'zero output ratio at full-cock toggle');
  near(rest.dogBase.distanceTo(rest.dogTip), geometry.dogLength, 3e-16,
    'rest dog length');
  near(fullCock.dogBase.distanceTo(fullCock.dogTip), geometry.dogLength,
    3e-16, 'full-cock dog length');
  assert.match(transmission.stepLaw, /monotonic rigid-dog closure/);
  assert.match(transmission.stepLaw, /zero-speed full-cock toggle/);
  disposeModel(model.root);
});

test('movement 277 makes one non-reversing 60-degree cylinder step per cock and six per turn', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let previousAngle = -Infinity;
  let minimumSpeed = Infinity;
  let maximumReverseIncrement = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtTime(
      timeline.inputCyclePeriod * index / 32768,
    );
    maximumReverseIncrement = Math.max(
      maximumReverseIncrement,
      previousAngle - state.cylinderAngle,
    );
    minimumSpeed = Math.min(minimumSpeed, state.cylinderAngularSpeed);
    previousAngle = state.cylinderAngle;
  }

  assert.ok(maximumReverseIncrement < 4e-15,
    `cylinder reverse increment ${maximumReverseIncrement}`);
  assert.ok(minimumSpeed >= -2e-15,
    `negative cylinder speed ${minimumSpeed}`);
  const start = stateAtTime(0);
  const oneStep = stateAtTime(timeline.inputCyclePeriod);
  near(oneStep.cylinderAngle - start.cylinderAngle,
    geometry.ratchetPitch, 0, 'one exact cylinder step');
  near(geometry.ratchetPitch, FULL_TURN / geometry.ratchetTeeth, 0,
    'six-tooth pitch');

  for (let index = 0; index <= geometry.ratchetTeeth; index += 1) {
    const indexed = stateAtTime(index * timeline.inputCyclePeriod);
    near(indexed.cylinderAngle, index * geometry.ratchetPitch, 2e-15,
      `indexed chamber ${index}`);
    near(indexed.cylinderAngularSpeed, 0, 0,
      `stationary cylinder at chamber ${index}`);
    near(indexed.indexAlignmentError, 0, 2e-15,
      `lock alignment at chamber ${index}`);
  }
  near(
    stateAtTime(timeline.fullCylinderPeriod).cylinderAngle,
    FULL_TURN,
    2e-15,
    'six cocking strokes make one cylinder turn',
  );
  disposeModel(model.root);
});

test('movement 277 unlocks before drive and holds the cylinder while its rigid dog clears on return', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  let maximumResetLengthError = 0;
  let maximumClearance = 0;

  for (let index = 0; index <= 32768; index += 1) {
    const normalized = index / 32768;
    const state = stateAtTime(normalized * geometry.inputCyclePeriod);
    if (state.lockEngagement > 1e-12) {
      near(state.indexAlignmentError, 0, 2e-14,
        `engaged lock alignment at ${normalized}`);
    }
    if (state.cylinderAngularSpeed > 1e-10) {
      near(state.lockEngagement, 0, 0,
        `lock fully clear during drive at ${normalized}`);
    }
    if (state.resetting) {
      near(state.cylinderIncrement, geometry.ratchetPitch, 0,
        `cylinder held during dog reset at ${normalized}`);
      near(state.cylinderAngularSpeed, 0, 0,
        `zero cylinder speed during reset at ${normalized}`);
      near(state.lockEngagement, 1, 0,
        `receiver lock engaged during reset at ${normalized}`);
      near(
        state.dogTip.x - geometry.ratchetContactX,
        state.dogAxialClearance,
        4e-16,
        `dog axial offset at ${normalized}`,
      );
      maximumResetLengthError = Math.max(
        maximumResetLengthError,
        Math.abs(state.dogLengthError),
      );
      maximumClearance = Math.max(
        maximumClearance,
        state.dogAxialClearance,
      );
    }
  }

  const beforeUnlock = stateAtTime(geometry.unlockStart
    * geometry.inputCyclePeriod);
  const drive = stateAtTime(0.34 * geometry.inputCyclePeriod);
  const fullCock = stateAtTime(geometry.cockEnd
    * geometry.inputCyclePeriod);
  const relocked = stateAtTime(geometry.relockEnd
    * geometry.inputCyclePeriod);
  const midReset = stateAtTime((geometry.fallStart + geometry.fallEnd) / 2
    * geometry.inputCyclePeriod);
  assert.equal(beforeUnlock.cylinderIncrement, 0);
  assert.equal(drive.driving, true);
  assert.equal(drive.lockEngagement, 0);
  near(fullCock.cylinderIncrement, geometry.ratchetPitch, 2e-15,
    'full-cock cylinder index');
  near(relocked.lockEngagement, 1, 3e-16, 'lock re-engaged');
  near(midReset.dogAxialClearance, geometry.resetClearance, 0,
    'maximum return clearance');
  assert.ok(maximumResetLengthError < 9e-16,
    `reset dog length error ${maximumResetLengthError}`);
  near(maximumClearance, geometry.resetClearance, 2e-8,
    'sampled maximum return clearance');
  assert.match(transmission.resetLaw, /dog remains rigid/);
  assert.match(transmission.resetLaw, /clears axially/);
  assert.match(transmission.resetLaw, /receiver lock holds the cylinder/);
  disposeModel(model.root);
});

test('movement 277 analytic speeds, accelerations, and engaged contact velocity match finite differences', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { stateAtTime } = model.root.userData;
  const derivativeStep = 1e-4;
  const contactStep = 1e-5;

  for (const time of [0.8, 1.1, 1.4, 1.8, 2.7, 3.0, 3.3]) {
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    const hammerSpeed = (after.hammerAngle - before.hammerAngle)
      / (2 * derivativeStep);
    const hammerAcceleration = (
      after.hammerAngle - 2 * state.hammerAngle + before.hammerAngle
    ) / derivativeStep ** 2;
    near(hammerSpeed, state.hammerAngularSpeed, 6e-8,
      `hammer speed at ${time}`);
    near(hammerAcceleration, state.hammerAngularAcceleration, 6e-7,
      `hammer acceleration at ${time}`);

    const cylinderSpeed = (after.cylinderAngle - before.cylinderAngle)
      / (2 * derivativeStep);
    const cylinderAcceleration = (
      after.cylinderAngle - 2 * state.cylinderAngle + before.cylinderAngle
    ) / derivativeStep ** 2;
    near(cylinderSpeed, state.cylinderAngularSpeed, 6e-8,
      `cylinder speed at ${time}`);
    near(cylinderAcceleration, state.cylinderAngularAcceleration, 6e-7,
      `cylinder acceleration at ${time}`);
  }

  for (const time of [0.8, 1.1, 1.4, 1.8]) {
    const before = stateAtTime(time - contactStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + contactStep);
    const finiteDogTipVelocity = after.dogTip.clone()
      .sub(before.dogTip)
      .multiplyScalar(1 / (2 * contactStep));
    vectorNear(finiteDogTipVelocity, state.dogTipVelocity, 8e-10,
      `dog-tip velocity at ${time}`);
    vectorNear(state.dogTipVelocity, state.ratchetContactVelocity, 0,
      `engaged surface velocity at ${time}`);
    near(state.rigidLengthVelocityError, 0, 2e-16,
      `rigid-link velocity closure at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 277 update binds the hammer, cylinder, dog, spring, lock, and motion indices', () => {
  const model = createMovementModel(catalog.movements[276]);
  const {
    animationTiming,
    blocks,
    cameraFitBounds,
    stateAtTime,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.ok(cameraFitBounds.max.x >= 4.56);
  assert.ok(blocks.cylinderRotationIndex.parent === null, 'undrawn cylinder index removed');
  assert.ok(blocks.hammerRotationIndex.parent === null, 'undrawn hammer index removed');

  model.update(0);
  const engagedLockY = blocks.lockBolt.position.y;
  const springAnchor = blocks.spring.userData.anchor.clone();
  for (const time of [0, 1.1, 2.08, 3.04, 4, 24]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.hammerRotor.rotation.z, expected.hammerAngle, 0,
      `rendered hammer at ${time}`);
    near(blocks.cylinderRotor.rotation.x, expected.cylinderAngle, 0,
      `rendered cylinder at ${time}`);
    vectorNear(blocks.dog.children[1].position, expected.dogBase, 0,
      `rendered dog base at ${time}`);
    vectorNear(blocks.dog.children[2].position, expected.dogTip, 0,
      `rendered dog tip at ${time}`);
    vectorNear(blocks.dogTipIndex.position, expected.dogTip, 0,
      `white dog-tip index at ${time}`);
    near(blocks.dog.userData.axialClearance,
      expected.dogAxialClearance, 0, `rendered dog clearance at ${time}`);
    near(blocks.lockBolt.position.y,
      engagedLockY - expected.lockRetraction, 0,
      `rendered lock bolt at ${time}`);
    near(blocks.lockBolt.userData.engagement,
      expected.lockEngagement, 0, `lock engagement at ${time}`);
    vectorNear(blocks.spring.userData.anchor, springAnchor, 0,
      `fixed spring anchor at ${time}`);
    vectorNear(
      blocks.spring.userData.contactPoint,
      expected.dogBase.clone().lerp(expected.dogTip, 0.58),
      0,
      `spring follows dog at ${time}`,
    );
    near(model.root.userData.contacts.dogRatchet.axialClearance,
      expected.dogAxialClearance, 0, `contact clearance at ${time}`);
    near(model.root.userData.contacts.cylinderLock.engagement,
      expected.lockEngagement, 0, `contact lock state at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 277 closes after six cocks while movement 339 remains the next authored draft', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const oneStep = stateAtTime(timeline.inputCyclePeriod);
  const closure = stateAtTime(timeline.fullCylinderPeriod);

  near(oneStep.cylinderAngle - start.cylinderAngle, FULL_TURN / 6, 0,
    'first chamber step');
  near(closure.cylinderAngle - start.cylinderAngle, FULL_TURN, 0,
    'full cylinder turn');
  near(closure.hammerAngle, start.hammerAngle, 0,
    'hammer pose closure');
  vectorNear(closure.dogBase, start.dogBase, 0, 'dog base closure');
  vectorNear(closure.dogTip, start.dogTip, 0, 'dog tip closure');
  near(closure.dogAxialClearance, 0, 0, 'dog reseated at closure');
  near(closure.lockEngagement, 1, 0, 'cylinder locked at closure');
  assert.equal(closure.indexNumber, 6);

  model.update(0);
  const sourceHammer = blocksQuaternion(model.root.userData.blocks.hammerRotor);
  model.update(timeline.fullCylinderPeriod);
  near(
    model.root.userData.blocks.hammerRotor.quaternion.angleTo(sourceHammer),
    0,
    0,
    'rendered hammer closes',
  );
  near(model.root.userData.blocks.cylinderRotor.rotation.x,
    FULL_TURN, 0, 'rendered cylinder accumulates one physical turn');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

function blocksQuaternion(object) {
  return object.quaternion.clone();
}
