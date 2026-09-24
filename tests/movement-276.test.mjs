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

test('movement 276 is one equal-diameter cam inside one two-roller translating yoke', () => {
  const movement = catalog.movements[275];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 276);
  assert.equal(movement.number, '276');
  assert.equal(
    movement.title,
    'Equal-Diameter Cam and Opposed-Roller Yoke',
  );
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'equal-diameter-three-lobe-cam-opposed-roller-yoke',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one fixed-axis three-lobe cam/);
  assert.match(mechanism, /one rigid rectilinear yoke/);
  assert.match(mechanism, /exactly two opposed rollers/);
  assert.match(mechanism, /simultaneously engaged/);
  assert.match(mechanism, /three smooth reciprocations/);
  assert.equal(transmission.camTurnsPerCycle, 1);
  assert.equal(transmission.reciprocationsPerCamTurn, 3);
  assert.equal(transmission.simultaneousContact, true);
  assert.match(transmission.constraintLaw, /A cos\(3\*camAngle\)/);

  assert.equal(blocks.cam.parent, model.root);
  assert.equal(blocks.camRotor.parent, blocks.cam);
  assert.equal(blocks.camBody.parent, blocks.camRotor);
  assert.equal(blocks.camShaft.parent, blocks.camRotor);
  assert.equal(blocks.yoke.parent, model.root);
  assert.equal(blocks.bar.parent, blocks.yoke);
  assert.equal(blocks.leftRoller.parent, blocks.yoke);
  assert.equal(blocks.rightRoller.parent, blocks.yoke);
  // The rod ends just past the right roller as drawn, so only the long
  // broken-off left run can carry a guide.
  assert.equal(blocks.straightGuides.length, 1);
  // Brown draws no bar guides; source presentation detaches them.
  assert.ok(blocks.straightGuides.every((guide) => guide.parent === null));
  vectorNear(blocks.cam.userData.axis, Z_AXIS, 0, 'cam axis');
  vectorNear(blocks.yoke.userData.axis, X_AXIS, 0, 'bar axis');
  vectorNear(blocks.leftRoller.userData.axis, Z_AXIS, 0,
    'left roller axis');
  vectorNear(blocks.rightRoller.userData.axis, Z_AXIS, 0,
    'right roller axis');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /captive-follower-roller$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^fixed-(left|right)-straight-bar-guide$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    /roller-radius-inward-offset/.test(role)).length, 1);
  assert.equal(roles.filter((role) =>
    /belt|pulley|second-cam/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 276 records the available reference animation and fits the measured source pose', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtCamAngle,
  } = model.root.userData;
  const plate = sourceReference.plate276;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.behaviorReferenced, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.match(sourceAnimation.referenceScope, /single translating two-roller yoke/);
  assert.match(sourceAnimation.referenceScope, /three bar reciprocations/);
  assert.match(sourceAnimation.referenceScope, /no proprietary curve coordinates/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[275].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 3);
  assert.equal(plate.profileShapeUncertaintyPixels, 18);
  assert.deepEqual(plate.rasterCamCenter, { x: 272, y: 266 });
  assert.deepEqual(plate.rasterLeftRollerCenter, { x: 191, y: 266 });
  assert.deepEqual(plate.rasterRightRollerCenter, { x: 464, y: 266 });
  assert.deepEqual(plate.rasterLeftContact, { x: 209, y: 266 });
  assert.deepEqual(plate.rasterRightContact, { x: 446, y: 266 });
  assert.deepEqual(plate.rasterBarTop, { x: 327.5, y: 246 });
  assert.deepEqual(plate.rasterBarBottom, { x: 327.5, y: 286 });
  assert.match(plate.inferredTopology, /one fixed-axis three-lobe cam/);
  assert.match(plate.inferredTopology, /two opposed follower rollers/);
  assert.match(plate.inferredTopology, /no belt or second cam/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });

  const source = stateAtCamAngle(0);
  const expected = {
    barBottom: sourcePointToModel(plate.rasterBarBottom),
    barTop: sourcePointToModel(plate.rasterBarTop),
    camCenter: sourcePointToModel(plate.rasterCamCenter),
    leftContact: sourcePointToModel(plate.rasterLeftContact),
    leftRollerCenter: sourcePointToModel(plate.rasterLeftRollerCenter),
    rightContact: sourcePointToModel(plate.rasterRightContact),
    rightRollerCenter: sourcePointToModel(plate.rasterRightRollerCenter),
  };
  const actual = {
    barBottom: new THREE.Vector2(
      source.yokeDisplacement,
      -geometry.barHalfHeight,
    ),
    barTop: new THREE.Vector2(
      source.yokeDisplacement,
      geometry.barHalfHeight,
    ),
    camCenter: new THREE.Vector2(0, 0),
    leftContact: new THREE.Vector2(
      source.leftContact.contactPoint.x,
      source.leftContact.contactPoint.y,
    ),
    leftRollerCenter: new THREE.Vector2(
      source.leftRollerCenter.x,
      source.leftRollerCenter.y,
    ),
    rightContact: new THREE.Vector2(
      source.rightContact.contactPoint.x,
      source.rightContact.contactPoint.y,
    ),
    rightRollerCenter: new THREE.Vector2(
      source.rightRollerCenter.x,
      source.rightRollerCenter.y,
    ),
  };
  for (const key of Object.keys(expected)) {
    const pixelError = actual[key].distanceTo(expected[key])
      / geometry.sourceScale;
    near(pixelError, plate.sourceIdealizationPixelErrors[key], 2e-14,
      `${key} recorded source-pose error`);
    assert.ok(pixelError <= plate.measurementUncertaintyPixels,
      `${key} remains within plate uncertainty`);
  }
  disposeModel(model.root);
});

test('movement 276 has one smooth three-lobe pitch curve with an exact opposite-radius diameter', () => {
  const model = createMovementModel(catalog.movements[275]);
  const { geometry, profile } = model.root.userData;
  let maximumDiameterError = 0;
  let maximumNormalLengthError = 0;
  let maximumNormalTangentError = 0;
  let maximumOffsetError = 0;
  let minimumRadius = Infinity;
  let maximumRadius = -Infinity;

  for (let index = 0; index <= 32768; index += 1) {
    const theta = index / 32768 * FULL_TURN;
    const radius = profile.pitchRadiusAt(theta);
    const oppositeRadius = profile.pitchRadiusAt(theta + Math.PI);
    const derivative = profile.pitchDerivativeAt(theta);
    const normal = profile.outwardNormalAt(theta);
    const pitchPoint = profile.pitchPointAt(theta);
    const camPoint = profile.camProfilePointAt(theta);
    maximumDiameterError = Math.max(
      maximumDiameterError,
      Math.abs(radius + oppositeRadius - geometry.equalDiameter),
    );
    maximumNormalLengthError = Math.max(
      maximumNormalLengthError,
      Math.abs(normal.length() - 1),
    );
    maximumNormalTangentError = Math.max(
      maximumNormalTangentError,
      Math.abs(normal.dot(derivative)),
    );
    maximumOffsetError = Math.max(
      maximumOffsetError,
      Math.abs(pitchPoint.distanceTo(camPoint) - geometry.rollerRadius),
    );
    minimumRadius = Math.min(minimumRadius, radius);
    maximumRadius = Math.max(maximumRadius, radius);
  }

  assert.ok(maximumDiameterError < 4e-15,
    `opposite-radius error ${maximumDiameterError}`);
  assert.ok(maximumNormalLengthError < 4e-16,
    `normal-length error ${maximumNormalLengthError}`);
  assert.ok(maximumNormalTangentError < 2e-15,
    `normal-tangent error ${maximumNormalTangentError}`);
  assert.ok(maximumOffsetError < 8e-16,
    `roller-offset error ${maximumOffsetError}`);
  near(minimumRadius,
    geometry.pitchMeanRadius - geometry.pitchAmplitude,
    2e-15,
    'minimum pitch radius',
  );
  near(maximumRadius,
    geometry.pitchMeanRadius + geometry.pitchAmplitude,
    2e-15,
    'maximum pitch radius',
  );
  assert.equal(geometry.lobeCount, 3);
  assert.match(profile.constantDiameterLaw, /r\(theta \+ pi\) = 2R/);
  assert.match(profile.rollerOffsetLaw, /rollerRadius/);
  disposeModel(model.root);
});

test('movement 276 keeps both fixed-spacing rollers tangent without another lobe entering either roller', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    geometry,
    profile,
    stateAtCamAngle,
  } = model.root.userData;
  let maximumDiameterError = 0;
  let maximumSeparationError = 0;
  let maximumContactGap = 0;
  let maximumPitchClosureError = 0;
  let minimumSampledClearance = Infinity;

  for (let angleIndex = 0; angleIndex < 144; angleIndex += 1) {
    const camAngle = angleIndex / 144 * FULL_TURN;
    const state = stateAtCamAngle(camAngle);
    maximumDiameterError = Math.max(
      maximumDiameterError,
      Math.abs(state.equalDiameterError),
    );
    maximumSeparationError = Math.max(
      maximumSeparationError,
      Math.abs(state.rollerCenterSeparationError),
    );
    for (const contact of [state.leftContact, state.rightContact]) {
      maximumContactGap = Math.max(
        maximumContactGap,
        Math.abs(contact.contactGap),
      );
      maximumPitchClosureError = Math.max(
        maximumPitchClosureError,
        contact.pitchPointClosureError,
      );
      const expectedRadiusVector = contact.outwardNormal.clone()
        .multiplyScalar(-geometry.rollerRadius);
      vectorNear(
        contact.contactPoint.clone().sub(contact.rollerCenter),
        expectedRadiusVector,
        2e-15,
        `${contact.side} roller radius follows the cam normal`,
      );

      for (let profileIndex = 0; profileIndex < 720; profileIndex += 1) {
        const theta = profileIndex / 720 * FULL_TURN;
        const worldProfilePoint = profile.camProfilePointAt(theta)
          .applyAxisAngle(Z_AXIS, camAngle);
        minimumSampledClearance = Math.min(
          minimumSampledClearance,
          worldProfilePoint.distanceTo(contact.rollerCenter),
        );
      }
    }
  }

  assert.ok(maximumDiameterError < 2e-15,
    `diameter closure ${maximumDiameterError}`);
  assert.ok(maximumSeparationError < 2e-15,
    `roller separation closure ${maximumSeparationError}`);
  assert.ok(maximumContactGap < 2e-15,
    `contact gap ${maximumContactGap}`);
  assert.ok(maximumPitchClosureError < 2e-15,
    `pitch-center closure ${maximumPitchClosureError}`);
  assert.ok(minimumSampledClearance >= geometry.rollerRadius - 2e-14,
    `another cam point entered a roller: clearance ${minimumSampledClearance}`);
  near(
    model.root.userData.blocks.rightRoller.position.x
      - model.root.userData.blocks.leftRoller.position.x,
    geometry.equalDiameter,
    0,
    'roller centers are fixed in one rigid yoke',
  );
  disposeModel(model.root);
});

test('movement 276 makes three smooth full bar reciprocations per clockwise cam turn', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    geometry,
    stateAtPhase,
    timeline,
    transmission,
  } = model.root.userData;
  const expectedReversals = [
    [0, 1],
    [Math.PI / 3, -1],
    [2 * Math.PI / 3, 1],
    [Math.PI, -1],
    [4 * Math.PI / 3, 1],
    [5 * Math.PI / 3, -1],
    [FULL_TURN, 1],
  ];
  for (const [phase, sign] of expectedReversals) {
    const state = stateAtPhase(phase);
    near(state.yokeDisplacement, sign * geometry.pitchAmplitude, 2e-15,
      `bar reversal at phase ${phase}`);
    near(state.yokeSpeed, 0, 9e-15,
      `zero bar speed at reversal ${phase}`);
    near(state.barOffsetClosureError, 0, 2e-15,
      `bar law at reversal ${phase}`);
  }

  for (let index = 0; index < 6; index += 1) {
    const phase = Math.PI / 6 + index * Math.PI / 3;
    const state = stateAtPhase(phase);
    near(state.yokeDisplacement, 0, 3e-15,
      `bar center crossing ${index}`);
    near(
      Math.abs(state.yokeSpeed),
      geometry.lobeCount * geometry.pitchAmplitude
        * timeline.camAngularFrequency,
      3e-15,
      `bar peak speed ${index}`,
    );
  }

  assert.equal(transmission.reciprocationsPerCamTurn, 3);
  near(
    stateAtPhase(Math.PI / 3).yokeDisplacement
      - stateAtPhase(0).yokeDisplacement,
    -2 * geometry.pitchAmplitude,
    2e-15,
    'full bar stroke',
  );
  assert.match(stateAtPhase(0).stage, /rightward-bar-reversal/);
  assert.match(stateAtPhase(Math.PI / 3).stage, /leftward-bar-reversal/);
  assert.match(stateAtPhase(Math.PI / 6).stage, /translating-left/);
  assert.match(stateAtPhase(Math.PI / 2).stage, /translating-right/);
  disposeModel(model.root);
});

test('movement 276 gives each free follower roller its own exact no-slip spin rate', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    geometry,
    stateAtCamAngle,
  } = model.root.userData;
  const commandedCamSpeed = 0.83;
  let maximumVelocityError = 0;
  let maximumNormalVelocityError = 0;
  let maximumTangentialVelocityError = 0;

  for (let index = 0; index <= 16384; index += 1) {
    const camAngle = index / 16384 * FULL_TURN;
    const state = stateAtCamAngle(camAngle, commandedCamSpeed, 0);
    for (const contact of [state.leftContact, state.rightContact]) {
      const expectedAngularSpeed = commandedCamSpeed
        * (1 - contact.pitchSpeed / geometry.rollerRadius);
      near(contact.rollerAngularSpeed, expectedAngularSpeed, 0,
        `${contact.side} instantaneous rolling law`);
      maximumVelocityError = Math.max(
        maximumVelocityError,
        contact.velocityError.length(),
      );
      maximumNormalVelocityError = Math.max(
        maximumNormalVelocityError,
        Math.abs(contact.normalVelocityError),
      );
      maximumTangentialVelocityError = Math.max(
        maximumTangentialVelocityError,
        Math.abs(contact.tangentialVelocityError),
      );
    }
  }

  assert.ok(maximumVelocityError < 1.5e-14,
    `full contact velocity closure ${maximumVelocityError}`);
  assert.ok(maximumNormalVelocityError < 1.5e-14,
    `normal velocity closure ${maximumNormalVelocityError}`);
  assert.ok(maximumTangentialVelocityError < 1.5e-14,
    `tangential velocity closure ${maximumTangentialVelocityError}`);
  const unequalRateState = stateAtCamAngle(0.4, commandedCamSpeed, 0);
  assert.notEqual(
    unequalRateState.leftRollerAngularSpeed,
    unequalRateState.rightRollerAngularSpeed,
  );
  const closed = stateAtCamAngle(FULL_TURN, commandedCamSpeed, 0);
  const expectedNetRoll = FULL_TURN
    - geometry.pitchPerimeter / geometry.rollerRadius;
  near(closed.leftRollerAngle, expectedNetRoll, 3e-13,
    'left roller accumulated pitch-arc roll');
  near(closed.rightRollerAngle, expectedNetRoll, 3e-13,
    'right roller accumulated pitch-arc roll');
  assert.match(
    model.root.userData.transmission.noSlipRollerLaw,
    /signedPitchArcLength\/rollerRadius/,
  );
  disposeModel(model.root);
});

test('movement 276 update drives only the cam rotor, translating yoke, and two roller rotors', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.camTurnsPerCycle, 1);

  for (const time of [0, 0.37, 1.12, 2.99, 4]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.camRotor.rotation.z, expected.camAngle, 0,
      `cam rotation at ${time}`);
    near(blocks.yoke.position.x, expected.yokeDisplacement, 0,
      `bar translation at ${time}`);
    near(
      blocks.leftRoller.userData.rotor.rotation.z,
      expected.leftRollerAngle,
      0,
      `left roller rotation at ${time}`,
    );
    near(
      blocks.rightRoller.userData.rotor.rotation.z,
      expected.rightRollerAngle,
      0,
      `right roller rotation at ${time}`,
    );
    vectorNear(
      blocks.yoke.userData.velocity,
      new THREE.Vector3(expected.yokeSpeed, 0, 0),
      0,
      `bar velocity at ${time}`,
    );
    assert.equal(
      model.root.userData.contacts.leftRollerCam,
      model.root.userData.kinematics.leftContact,
    );
    assert.equal(
      model.root.userData.contacts.rightRollerCam,
      model.root.userData.kinematics.rightContact,
    );
    assert.ok(expected.minimumGuideCoverage > 0.32);
  }

  assert.equal(blocks.leftRoller.userData.blocks.axle.parent,
    blocks.leftRoller);
  assert.equal(blocks.leftRoller.userData.blocks.tread.parent,
    blocks.leftRoller.userData.rotor);
  assert.equal(blocks.rightRoller.userData.blocks.axle.parent,
    blocks.rightRoller);
  assert.equal(blocks.rightRoller.userData.blocks.tread.parent,
    blocks.rightRoller.userData.rotor);
  assert.equal(
    blocks.leftRoller.userData.blocks.rotationIndices.length,
    2,
  );
  assert.equal(
    blocks.rightRoller.userData.blocks.rotationIndices.length,
    2,
  );
  disposeModel(model.root);
});

test('movement 276 closes its cam and bar cycle exactly while movement 339 remains authored', () => {
  const model = createMovementModel(catalog.movements[275]);
  const {
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closed = stateAtTime(timeline.cyclePeriod);

  near(closed.camAngle - start.camAngle, -FULL_TURN, 0,
    'one clockwise cam turn');
  near(closed.yokeDisplacement, start.yokeDisplacement, 0,
    'bar position closure');
  near(closed.yokeSpeed, start.yokeSpeed, 4e-15,
    'bar speed closure');
  near(closed.yokeAcceleration, start.yokeAcceleration, 0,
    'bar acceleration closure');
  vectorNear(closed.leftRollerCenter, start.leftRollerCenter, 0,
    'left roller center closure');
  vectorNear(closed.rightRollerCenter, start.rightRollerCenter, 0,
    'right roller center closure');
  near(closed.equalDiameterError, 0, 2e-15,
    'closed equal diameter');
  near(closed.rollerCenterSeparationError, 0, 2e-15,
    'closed roller spacing');
  near(
    closed.leftRollerAngle - start.leftRollerAngle,
    -FULL_TURN + geometry.pitchPerimeter / geometry.rollerRadius,
    3e-13,
    'left roller continues physically without a visual reset',
  );
  near(
    closed.rightRollerAngle - start.rightRollerAngle,
    -FULL_TURN + geometry.pitchPerimeter / geometry.rollerRadius,
    3e-13,
    'right roller continues physically without a visual reset',
  );

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
