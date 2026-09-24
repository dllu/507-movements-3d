import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function radialDistance(point, origin, axis) {
  const offset = point.clone().sub(origin);
  offset.addScaledVector(axis, -offset.dot(axis));
  return offset.length();
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

test('movement 265 is the generator-guided traversing-roller cone drive', () => {
  const movement = catalog.movements[264];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 265);
  assert.equal(movement.number, '265');
  assert.equal(
    movement.title,
    'Traversing-Roller Variable-Speed Cone Drive',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'uniform-conical-drum-driving-generator-aligned-axially-traversing-friction-roller',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /constant-speed-conical-drum/);
  assert.match(mechanism, /smooth-lengthwise-traverse/);
  assert.match(mechanism, /local-cone-radius/);
  assert.notEqual(blocks.cone, blocks.roller);
  assert.equal(blocks.coneBody.parent, blocks.coneRotor);
  assert.equal(blocks.rollerBody.parent, blocks.rollerRotor);
  assert.equal(blocks.rollerTread.parent, blocks.rollerRotor);
  // The long shaft Brown draws is the roller's own output axle.
  assert.equal(blocks.rollerGuide.parent, blocks.roller);
  disposeModel(model.root);
});

test('movement 265 preserves the measured unavailable source engraving', () => {
  const movement = catalog.movements[264];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate265;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterConeLargeEnd, {
    bottom: 369,
    centerX: 75,
    centerY: 254,
    top: 139,
  });
  assert.deepEqual(plate.rasterConeSmallEnd, {
    bottom: 294,
    centerX: 335,
    centerY: 253,
    top: 212,
  });
  assert.deepEqual(plate.rasterContactPoint, { x: 243, y: 204 });
  assert.deepEqual(plate.rasterRollerCenter, { x: 260, y: 144 });
  assert.deepEqual(plate.rasterRollerShaftLine, {
    left: { x: 191, y: 126 },
    right: { x: 502, y: 202 },
  });
  assert.deepEqual(plate.rasterShaftEndpointsX, [13, 449]);
  assert.match(plate.inferredTopology, /horizontal concave horn-shaped drum/);
  assert.match(plate.inferredTopology, /parallel to the upper drum generator/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 265 matches the cone taper, contact station, and roller size', () => {
  const model = createMovementModel(catalog.movements[264]);
  const { geometry, sourceReference } = model.root.userData;
  const plate = sourceReference.plate265;
  const rasterLargeRadius = (
    plate.rasterConeLargeEnd.bottom - plate.rasterConeLargeEnd.top
  ) / 2;
  const rasterSmallRadius = (
    plate.rasterConeSmallEnd.bottom - plate.rasterConeSmallEnd.top
  ) / 2;
  const rasterConeLength = plate.rasterConeSmallEnd.centerX
    - plate.rasterConeLargeEnd.centerX;
  const rasterContactFraction = (
    plate.rasterContactPoint.x - plate.rasterConeLargeEnd.centerX
  ) / rasterConeLength;
  const rasterRollerRadius = Math.hypot(
    plate.rasterRollerCenter.x - plate.rasterContactPoint.x,
    plate.rasterRollerCenter.y - plate.rasterContactPoint.y,
  );
  const rasterGuideSlope = -(
    plate.rasterRollerShaftLine.right.y
      - plate.rasterRollerShaftLine.left.y
  ) / (
    plate.rasterRollerShaftLine.right.x
      - plate.rasterRollerShaftLine.left.x
  );
  const rasterNormal = new THREE.Vector2(
    plate.rasterRollerCenter.x - plate.rasterContactPoint.x,
    plate.rasterContactPoint.y - plate.rasterRollerCenter.y,
  ).normalize();

  near(
    geometry.coneSmallRadius / geometry.coneLargeRadius,
    rasterSmallRadius / rasterLargeRadius,
    0.006,
    'small-to-large cone radius ratio',
  );
  near(
    geometry.coneLength / geometry.coneLargeRadius,
    rasterConeLength / rasterLargeRadius,
    0.025,
    'cone length-to-radius ratio',
  );
  // Brown's drum is concave: under the roller its radius is well below the
  // straight line joining the end radii, and the model follows the plate.
  const rasterContactRadius = plate.rasterConeLargeEnd.centerY
    - plate.rasterContactPoint.y;
  const contactRadius = model.root.userData.transmission
    .coneRadiusAtAxialPosition(geometry.sourceContactAxialPosition);
  near(
    contactRadius / geometry.coneLargeRadius,
    rasterContactRadius / rasterLargeRadius,
    0.01,
    'concave drum radius under the roller',
  );
  const straightRadius = geometry.coneLargeRadius
    + (geometry.coneSmallRadius - geometry.coneLargeRadius)
      * rasterContactFraction;
  assert.ok(contactRadius < straightRadius - 0.2, 'drum generator is concave');
  assert.ok(geometry.profileCurvature > 0);
  near(
    geometry.rollerPitchRadius / geometry.coneLargeRadius,
    rasterRollerRadius / rasterLargeRadius,
    0.02,
    'roller-to-cone radius ratio',
  );
  near(
    (geometry.sourceContactAxialPosition - geometry.coneLargeEndX)
      / geometry.coneLength,
    rasterContactFraction,
    0.002,
    'source contact axial fraction',
  );
  // The engraved shaft line and roller radius disagree by a few degrees;
  // the tangent of the fitted concave generator lies within that spread.
  near(
    geometry.coneGeneratorAxis.y / geometry.coneGeneratorAxis.x,
    rasterGuideSlope,
    0.05,
    'roller shaft generator slope',
  );
  near(geometry.coneSurfaceNormal.x, rasterNormal.x, 0.09,
    'source contact normal x');
  near(geometry.coneSurfaceNormal.y, rasterNormal.y, 0.02,
    'source contact normal y');
  disposeModel(model.root);
});

test('movement 265 maintains exact drum and roller tangency along the generator', () => {
  const model = createMovementModel(catalog.movements[264]);
  const {
    contactDefinition,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  let maximumConeSurfaceError = 0;
  let maximumRollerSurfaceError = 0;
  let maximumGuideError = 0;
  let maximumNormalError = 0;

  near(
    geometry.coneGeneratorAxis.dot(geometry.coneSurfaceNormal),
    0,
    6e-17,
    'generator-normal orthogonality',
  );
  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(
      timeline.demonstrationPeriod * sample / 8192,
    );
    near(state.generatorAxis.dot(state.surfaceNormal), 0, 6e-17,
      `local generator-normal orthogonality at ${sample}`);
    maximumConeSurfaceError = Math.max(
      maximumConeSurfaceError,
      Math.abs(
        radialDistance(
          state.contactPoint,
          new THREE.Vector3(),
          geometry.coneAxis,
        ) - state.coneRadiusAtContact,
      ),
    );
    maximumRollerSurfaceError = Math.max(
      maximumRollerSurfaceError,
      Math.abs(
        radialDistance(
          state.contactPoint,
          state.rollerCenter,
          state.generatorAxis,
        ) - geometry.rollerPitchRadius,
      ),
    );
    const expectedCenter = contactDefinition.rollerCenterAtAxialPosition(
      state.contactAxialPosition,
    );
    maximumGuideError = Math.max(
      maximumGuideError,
      expectedCenter.distanceTo(state.rollerCenter),
    );
    const centerToContact = state.contactPoint.clone()
      .sub(state.rollerCenter)
      .normalize();
    maximumNormalError = Math.max(
      maximumNormalError,
      centerToContact.clone().add(state.surfaceNormal).length(),
    );
    assert.ok(state.contactAxialPosition > geometry.coneLargeEndX);
    assert.ok(state.contactAxialPosition < geometry.coneSmallEndX);
  }
  assert.ok(maximumConeSurfaceError < 2e-16);
  // Per-sample axis normalisation adds a few ulps over the straight guide.
  assert.ok(maximumRollerSurfaceError < 5e-16, `roller surface ${maximumRollerSurfaceError}`);
  assert.ok(maximumGuideError < 6e-16);
  assert.ok(maximumNormalError < 5e-16, `normal ${maximumNormalError}`);
  disposeModel(model.root);
});

test('movement 265 obeys the exact continuously varying no-slip speed law', () => {
  const model = createMovementModel(catalog.movements[264]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
    transmission,
  } = model.root.userData;
  const derivativeStep = 1e-5;
  let maximumNoSlipError = 0;
  let maximumRatioError = 0;
  let maximumNumericalRateError = 0;

  for (let sample = 1; sample < 4096; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 4096;
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      Math.abs(state.noSlipTangentialError),
    );
    maximumRatioError = Math.max(
      maximumRatioError,
      Math.abs(
        state.speedRatio
          + state.coneRadiusAtContact / geometry.rollerPitchRadius,
      ),
    );
    maximumNumericalRateError = Math.max(
      maximumNumericalRateError,
      Math.abs(
        (after.rollerAngleUnwrapped - before.rollerAngleUnwrapped)
          / (2 * derivativeStep) - state.rollerAngularSpeed,
      ),
    );
    near(
      state.rollerAngularSpeed,
      transmission.rollerAngularSpeedAtAxialPosition(
        state.contactAxialPosition,
      ),
      5e-16,
      `instantaneous roller law at sample ${sample}`,
    );
    assert.ok(state.coneAngularSpeed > 0);
    assert.ok(state.rollerAngularSpeed < 0);
  }
  assert.ok(maximumNoSlipError < 5e-16);
  assert.ok(maximumRatioError < 5e-16);
  assert.ok(maximumNumericalRateError < 2e-9);

  const largeEnd = stateAtTime(canonicalTimes.firstLargeEndReversal);
  const smallEnd = stateAtTime(canonicalTimes.firstSmallEndReversal);
  near(largeEnd.contactAxialPosition, -geometry.traverseAmplitude, 3e-16,
    'large-end traverse station');
  near(smallEnd.contactAxialPosition, geometry.traverseAmplitude, 3e-16,
    'small-end traverse station');
  near(largeEnd.contactAxialVelocity, 0, 2e-16,
    'large-end smooth reversal');
  near(smallEnd.contactAxialVelocity, 0, 2e-16,
    'small-end smooth reversal');
  near(
    Math.abs(largeEnd.speedRatio),
    transmission.maximumSpeedRatioMagnitude,
    3e-16,
    'maximum magnitude at large cone end',
  );
  near(
    Math.abs(smallEnd.speedRatio),
    transmission.minimumSpeedRatioMagnitude,
    3e-16,
    'minimum magnitude at small cone end',
  );
  assert.ok(Math.abs(largeEnd.speedRatio) > Math.abs(smallEnd.speedRatio) * 2);
  disposeModel(model.root);
});

test('movement 265 uses a transparent smooth traverse demonstration', () => {
  const model = createMovementModel(catalog.movements[264]);
  const {
    canonicalTimes,
    driveSchedule,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const source = stateAtTime(canonicalTimes.sourcePose);

  assert.equal(
    driveSchedule.coneInput,
    'source-required-uniform-continuous-rotation',
  );
  assert.equal(driveSchedule.sourcePrescribesTraverseSchedule, false);
  assert.match(driveSchedule.traverse, /zero-speed-at-both-ends/);
  assert.match(driveSchedule.purpose, /without teleporting/);
  near(source.contactAxialPosition, geometry.sourceContactAxialPosition, 0,
    'source contact station');
  assert.ok(source.contactAxialVelocity > 0);
  assert.ok(source.rollerCenterVelocity.distanceTo(
    geometry.coneGeneratorAxis.clone().multiplyScalar(source.guideVelocity),
  ) < 2e-16);
  for (const time of [0.3, 1.7, 3.1, 5.9]) {
    const step = 1e-6;
    const numerical = stateAtTime(time + step).rollerCenter
      .sub(stateAtTime(time - step).rollerCenter)
      .multiplyScalar(1 / (2 * step));
    assert.ok(numerical.distanceTo(stateAtTime(time).rollerCenterVelocity)
      < 2e-8, `roller centre velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 265 renderer binds cone, roller, contact, and guide exactly', () => {
  const model = createMovementModel(catalog.movements[264]);
  const { blocks, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));

  assert.equal(
    roles.filter((role) => role
      === 'uniformly-rotating-conical-friction-drum').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'generator-tangent-friction-roller-traversing-concave-drum').length,
    1,
  );
  assert.equal(
    roles.filter((role) => role
      === 'moving-no-slip-cone-roller-contact').length,
    1,
  );
  assert.equal(
    roles.filter((role) => /white-variable-roller-speed-index/.test(role)).length,
    2,
  );
  assert.equal(blocks.coneIndices.length, 2);
  assert.equal(blocks.rollerIndices.length, 2);

  for (const time of [0, 0.8, 2.4, 4.7, 7.9]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.coneRotor.rotation.z, state.coneAngle, 0,
      `rendered cone angle at ${time}`);
    near(blocks.rollerRotor.rotation.z, state.rollerAngle, 0,
      `rendered roller angle at ${time}`);
    near(blocks.roller.position.distanceTo(state.rollerCenter), 0, 0,
      `rendered roller center at ${time}`);
    near(blocks.contactMarker.position.distanceTo(state.contactPoint), 0, 0,
      `rendered contact point at ${time}`);
    model.root.updateMatrixWorld(true);
    const axle = new THREE.Vector3(0, 0, 1).transformDirection(
      blocks.rollerGuide.matrixWorld,
    );
    const worldGenerator = state.generatorAxis.clone().transformDirection(
      model.root.matrixWorld,
    );
    near(Math.abs(axle.dot(worldGenerator)), 1, 1e-12,
      `roller axle tangent to the generator at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 265 closes exactly and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[264]);
  const {
    animationTiming,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.coneAngle, start.coneAngle, 0, 'cone visual closure');
  near(closure.rollerAngle, start.rollerAngle, 0, 'roller visual closure');
  near(closure.contactPoint.distanceTo(start.contactPoint), 0, 4e-16,
    'contact closure');
  near(closure.rollerCenter.distanceTo(start.rollerCenter), 0, 4e-16,
    'roller-center closure');
  near(closure.contactAxialVelocity, start.contactAxialVelocity, 2e-16,
    'traverse-rate closure');
  near(closure.coneAngleUnwrapped / FULL_TURN, 4, 0,
    'four cone turns per traverse');
  near(closure.rollerAngleUnwrapped / FULL_TURN, -4, 1e-15,
    'four opposite roller turns per traverse');
  assert.equal(animationTiming.authoredCyclePeriod, 8);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
