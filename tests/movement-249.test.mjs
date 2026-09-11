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

const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

test('movement 249 is one hollow ball retained by a two-piece bolted pipe socket', () => {
  const movement = catalog.movements[248];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 249);
  assert.equal(movement.number, '249');
  assert.equal(movement.title, 'Bolted Ball-and-Socket Pipe Joint');
  assert.equal(movement.category, 'Universal joints');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'hollow-ball-and-socket-pipe-joint-with-two-piece-bolted-retainer-and-continuous-bore',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'hollow-ball-on-upper-tube-pivots-about-one-fixed-spherical-center-inside-a-two-piece-bolted-socket-on-the-lower-tube',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.jointType, 'ball-and-socket-pipe-joint');
  assert.equal(transmission.rotationalDegreesOfFreedom, 3);
  assert.equal(transmission.translationalDegreesOfFreedom, 0);
  assert.equal(transmission.sphericalCenterFixed, true);
  assert.equal(transmission.fluidPassageContinuous, true);
  assert.equal(transmission.socketRetainerPieces, 2);
  assert.equal(transmission.clampBoltCount, 2);
  assert.equal(
    blocks.maleAssembly.userData.role,
    'articulating-upper-tube-and-hollow-spherical-ball',
  );
  assert.equal(
    blocks.fixedSocketAssembly.userData.role,
    'fixed-two-piece-bolted-socket-and-lower-tube',
  );
  assert.equal(blocks.fixedSocketAssembly.userData.fixed, true);
  disposeModel(model.root);
});

test('movement 249 preserves the measured unavailable longitudinal section', () => {
  const movement = catalog.movements[248];
  const model = createMovementModel(movement);
  const { sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate249;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.equal(
    plate.view,
    'longitudinal-section-through-bore-spherical-center-and-two-opposed-clamp-bolts',
  );
  assert.deepEqual(plate.rasterUpperTubeBounds, {
    bottom: 197,
    left: 236,
    right: 324,
    top: 77,
  });
  assert.deepEqual(plate.rasterBallBounds, {
    bottom: 419,
    left: 161,
    right: 390,
    top: 191,
  });
  assert.deepEqual(plate.rasterSocketEnvelopeBounds, {
    bottom: 450,
    left: 130,
    right: 424,
    top: 190,
  });
  assert.deepEqual(plate.rasterClampBounds, {
    bottom: 321,
    left: 80,
    right: 460,
    top: 244,
  });
  assert.deepEqual(plate.rasterLowerTubeBounds, {
    bottom: 501,
    left: 225,
    right: 327,
    top: 405,
  });
  assert.match(plate.inferredTopology, /hollow ball integral/);
  assert.match(plate.inferredTopology, /two socket halves/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'centered-source-dwell');
  vectorNear(source.tubeAxis, Y_AXIS, 0, 'vertical source tube axis');
  disposeModel(model.root);
});

test('movement 249 keeps one fixed spherical center and exact concentric ball contact', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { geometry, stateAtTime, timeline } = model.root.userData;

  near(
    geometry.socketInnerRadius - geometry.ballOuterRadius,
    geometry.socketRadialClearance,
    0,
    'constant spherical running clearance',
  );
  near(
    geometry.ballOuterRadius - geometry.upperMouthRadius,
    geometry.socketCaptureOverlap,
    0,
    'positive retainer overlap',
  );
  assert.ok(geometry.socketRadialClearance > 0.039);
  assert.ok(geometry.socketCaptureOverlap > 0.45);
  assert.ok(geometry.upperMouthRadius < geometry.ballOuterRadius);

  let maximumAxisNormError = 0;
  let maximumOrientationError = 0;
  let maximumMeasuredTilt = 0;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumZ = Infinity;
  let maximumZ = -Infinity;
  for (let sample = 0; sample <= 65536; sample += 1) {
    const state = stateAtTime(timeline.cycleClosure * sample / 65536);
    near(state.ballCenter.length(), 0, 0, `fixed center at ${sample}`);
    maximumAxisNormError = Math.max(
      maximumAxisNormError,
      Math.abs(state.tubeAxis.length() - 1),
    );
    const mappedAxis = Y_AXIS.clone().applyQuaternion(state.orientation);
    maximumOrientationError = Math.max(
      maximumOrientationError,
      mappedAxis.distanceTo(state.tubeAxis),
    );
    const measuredTilt = Math.atan2(
      Math.hypot(state.tubeAxis.x, state.tubeAxis.z),
      state.tubeAxis.y,
    );
    maximumMeasuredTilt = Math.max(maximumMeasuredTilt, measuredTilt);
    near(measuredTilt, state.tiltAngle, 1.5e-15,
      `reported tilt at ${sample}`);
    assert.equal(state.clearances.ballCaptured, true);
    if (state.stage === 'circumducting-at-maximum-tilt') {
      minimumX = Math.min(minimumX, state.tubeAxis.x);
      maximumX = Math.max(maximumX, state.tubeAxis.x);
      minimumZ = Math.min(minimumZ, state.tubeAxis.z);
      maximumZ = Math.max(maximumZ, state.tubeAxis.z);
    }
  }
  assert.ok(maximumAxisNormError < 2.3e-16);
  assert.ok(maximumOrientationError < 3e-16);
  near(maximumMeasuredTilt, geometry.maximumTilt, 2e-15,
    'maximum demonstrated tilt');
  const transverseRadius = Math.sin(geometry.maximumTilt);
  assert.ok(minimumX < -transverseRadius + 1e-8);
  assert.ok(maximumX > transverseRadius - 1e-8);
  assert.ok(minimumZ < -transverseRadius + 1e-7);
  assert.ok(maximumZ > transverseRadius - 1e-7);
  disposeModel(model.root);
});

test('movement 249 tilts, circumducts once, and returns with C2 handoffs', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const expectedStages = [
    [0.5, 'centered-source-dwell'],
    [1.75, 'tilting-upper-tube'],
    [3.5, 'circumducting-at-maximum-tilt'],
    [8.25, 'returning-upper-tube-to-center'],
    [9.5, 'centered-source-dwell'],
  ];
  for (const [time, expected] of expectedStages) {
    assert.equal(stateAtTime(time).stage, expected);
  }

  const orbitStart = stateAtTime(timeline.orbitStart);
  const orbitMiddle = stateAtTime(
    (timeline.orbitStart + timeline.orbitEnd) / 2,
  );
  const orbitEnd = stateAtTime(timeline.orbitEnd);
  near(orbitStart.tiltAngle, geometry.maximumTilt, 0,
    'outward tilt endpoint');
  near(orbitStart.azimuth, 0, 0, 'orbit begins on positive x side');
  near(orbitMiddle.azimuth, Math.PI, 0, 'half orbit');
  near(orbitEnd.tiltAngle, geometry.maximumTilt, 0,
    'orbit finishes at same tilt');
  vectorNear(orbitStart.tubeAxis, orbitEnd.tubeAxis, 0,
    'one complete circumduction');
  assert.ok(orbitMiddle.azimuthVelocity > 2.35);

  for (const boundary of [
    timeline.centeredDwellEnd,
    timeline.orbitStart,
    timeline.orbitEnd,
    timeline.returnedToCenter,
  ]) {
    const state = stateAtTime(boundary);
    near(state.tiltVelocity, 0, 0, `tilt speed at ${boundary}`);
    near(state.tiltAcceleration, 0, 0,
      `tilt acceleration at ${boundary}`);
    near(state.azimuthVelocity, 0, 0, `azimuth speed at ${boundary}`);
    near(state.azimuthAcceleration, 0, 0,
      `azimuth acceleration at ${boundary}`);
    near(state.tubeAxisVelocity.length(), 0, 0,
      `axis speed at ${boundary}`);
    near(state.tubeAxisAcceleration.length(), 0, 0,
      `axis acceleration at ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 249 keeps both moving tube envelopes inside the fixed openings', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { clearancesAtTilt, geometry, stateAtTime, timeline } =
    model.root.userData;
  const limiting = clearancesAtTilt(geometry.maximumTilt);
  assert.ok(limiting.upperNeckClearance > 0.072);
  assert.ok(limiting.lowerBoreClearance > 0.077);
  assert.ok(geometry.upperMouthRadius > geometry.upperTubeOuterRadius);
  assert.ok(geometry.lowerThroatRadius > geometry.ballBoreRadius);

  let minimumUpperClearance = Infinity;
  let minimumLowerClearance = Infinity;
  for (let sample = 0; sample <= 65536; sample += 1) {
    const state = stateAtTime(timeline.cycleClosure * sample / 65536);
    const cosine = Math.cos(state.tiltAngle);
    near(
      state.clearances.upperNeckEnvelopeAtMouth,
      geometry.upperSocketMaximumY * Math.tan(state.tiltAngle)
        + geometry.upperTubeOuterRadius / cosine,
      0,
      `upper oblique-cylinder envelope at ${sample}`,
    );
    near(
      state.clearances.lowerBoreEnvelopeAtThroat,
      Math.abs(geometry.lowerTubeMaximumY) * Math.tan(state.tiltAngle)
        + geometry.ballBoreRadius / cosine,
      0,
      `lower oblique-bore envelope at ${sample}`,
    );
    minimumUpperClearance = Math.min(
      minimumUpperClearance,
      state.clearances.upperNeckClearance,
    );
    minimumLowerClearance = Math.min(
      minimumLowerClearance,
      state.clearances.lowerBoreClearance,
    );
    assert.ok(state.clearances.upperNeckClearance > 0.072);
    assert.ok(state.clearances.lowerBoreClearance > 0.077);
    assert.equal(state.fluidPassageOpen, true);
  }
  near(minimumUpperClearance, limiting.upperNeckClearance, 2e-16,
    'minimum upper lip clearance');
  near(minimumLowerClearance, limiting.lowerBoreClearance, 2e-16,
    'minimum lower throat clearance');
  disposeModel(model.root);
});

test('movement 249 renderer exposes the bores, socket split, bolts, and exact rigid pose', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  assert.equal(blocks.maleBallSectionFaces.length, 2);
  assert.equal(blocks.upperTubeSectionFaces.length, 2);
  assert.equal(blocks.upperSocketSectionFaces.length, 2);
  assert.equal(blocks.lowerSocketSectionFaces.length, 2);
  assert.equal(blocks.lowerTubeSectionFaces.length, 2);
  assert.equal(blocks.clampBolts.length, 2);
  assert.equal(blocks.upperClampEars.length, 2);
  assert.equal(blocks.lowerClampEars.length, 2);
  assert.equal(
    blocks.maleBoreLiner.userData.role,
    'visible-inner-wall-of-continuous-male-bore',
  );
  assert.equal(
    blocks.lowerBoreLiner.userData.role,
    'visible-inner-wall-of-fixed-lower-bore',
  );
  assert.equal(
    blocks.orientationIndex.userData.role,
    'white-rigid-orientation-index-on-upper-tube',
  );
  for (const bolt of blocks.clampBolts) {
    assert.equal(bolt.userData.fixed, true);
    assert.equal(bolt.children.length, 3);
  }

  const fixedPosition = blocks.fixedSocketAssembly.position.clone();
  const fixedQuaternion = blocks.fixedSocketAssembly.quaternion.clone();
  for (const time of [0, 1.4, 2.5, 3.6, 5, 6.4, 7.5, 8.6, 9.5]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    vectorNear(blocks.fixedSocketAssembly.position, fixedPosition, 0,
      `fixed socket position at ${time}`);
    near(
      blocks.fixedSocketAssembly.quaternion.angleTo(fixedQuaternion),
      0,
      0,
      `fixed socket rotation at ${time}`,
    );
    vectorNear(blocks.maleAssembly.position, new THREE.Vector3(), 0,
      `male ball center at ${time}`);
    assert.equal(
      blocks.maleAssembly.quaternion.equals(state.orientation),
      true,
      `rendered male orientation at ${time}`,
    );
    vectorNear(
      Y_AXIS.clone().applyQuaternion(blocks.maleAssembly.quaternion),
      state.tubeAxis,
      3e-16,
      `rendered upper tube axis at ${time}`,
    );
    const contacts = model.root.userData.contacts;
    near(contacts.ballToSocket.radialClearance,
      geometry.socketRadialClearance, 0,
      `spherical contact clearance at ${time}`);
    assert.equal(contacts.ballToSocket.concentricCenters, true);
    assert.equal(contacts.continuousFluidBore.open, true);
    assert.equal(contacts.socketHalves.boltCount, 2);
    assert.equal(contacts.socketHalves.clamped, true);
  }
  disposeModel(model.root);
});

test('movement 249 analytic tube-axis and tip rates agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const time of [
    1.25,
    1.75,
    2.2,
    3.0,
    3.75,
    5,
    6.25,
    7.0,
    7.8,
    8.25,
    8.7,
  ]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const finiteAxisVelocity = after.tubeAxis.clone()
      .sub(before.tubeAxis)
      .multiplyScalar(1 / (2 * step));
    const finiteAxisAcceleration = after.tubeAxisVelocity.clone()
      .sub(before.tubeAxisVelocity)
      .multiplyScalar(1 / (2 * step));
    const finiteTipVelocity = after.upperTip.clone()
      .sub(before.upperTip)
      .multiplyScalar(1 / (2 * step));
    const finiteTipAcceleration = after.upperTipVelocity.clone()
      .sub(before.upperTipVelocity)
      .multiplyScalar(1 / (2 * step));
    vectorNear(finiteAxisVelocity, state.tubeAxisVelocity, 1.2e-8,
      `axis velocity at ${time}`);
    vectorNear(finiteAxisAcceleration, state.tubeAxisAcceleration, 1.2e-7,
      `axis acceleration at ${time}`);
    vectorNear(finiteTipVelocity, state.upperTipVelocity, 5e-8,
      `tip velocity at ${time}`);
    vectorNear(finiteTipAcceleration, state.upperTipAcceleration, 5e-7,
      `tip acceleration at ${time}`);
    near(
      (after.tiltAngle - before.tiltAngle) / (2 * step),
      state.tiltVelocity,
      5e-10,
      `tilt velocity at ${time}`,
    );
    near(
      (after.tiltVelocity - before.tiltVelocity) / (2 * step),
      state.tiltAcceleration,
      4e-9,
      `tilt acceleration at ${time}`,
    );
    near(
      (after.azimuthUnwrapped - before.azimuthUnwrapped) / (2 * step),
      state.azimuthVelocity,
      5e-9,
      `azimuth velocity at ${time}`,
    );
    near(
      (after.azimuthVelocity - before.azimuthVelocity) / (2 * step),
      state.azimuthAcceleration,
      4e-8,
      `azimuth acceleration at ${time}`,
    );
  }
  disposeModel(model.root);
});

test('movement 249 closes exactly in ten seconds and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[248]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleClosure);

  vectorNear(end.ballCenter, start.ballCenter, 0, 'closed ball center');
  vectorNear(end.tubeAxis, start.tubeAxis, 0, 'closed tube axis');
  vectorNear(end.tubeAxisVelocity, start.tubeAxisVelocity, 0,
    'closed tube-axis velocity');
  vectorNear(end.tubeAxisAcceleration, start.tubeAxisAcceleration, 0,
    'closed tube-axis acceleration');
  near(end.orientation.angleTo(start.orientation), 0, 0,
    'closed male orientation');
  assert.equal(end.stage, start.stage);
  assert.equal(end.sourcePose, true);
  assert.equal(end.fluidPassageOpen, true);
  near(animationTiming.authoredCyclePeriod, 10, 0,
    'authored cycle duration');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
