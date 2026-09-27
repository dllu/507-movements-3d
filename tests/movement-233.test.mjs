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

test('movement 233 is one lantern wheel with alternative roller and latch stops', () => {
  const movement = catalog.movements[232];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 233);
  assert.equal(movement.number, '233');
  assert.equal(movement.title, 'Roller and Latch Stops for a Lantern Wheel');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'alternating-roller-and-latch-stops-for-lantern-wheel',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.alternativesSimultaneouslyLoaded, false);
  assert.equal(transmission.trundlesPerDemonstrationStroke, 1);
  assert.equal(transmission.wheelReturnsToSourceAngleEachCycle, true);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.rollerStop.parent, model.root);
  assert.equal(blocks.latchStop.parent, model.root);
  assert.notEqual(blocks.rollerStop, blocks.latchStop);
  assert.equal(blocks.rollerArm.parent, blocks.rollerStop);
  assert.equal(blocks.rollerWheel.parent, blocks.rollerStop);
  assert.equal(blocks.latchBody.parent, blocks.latchStop);
  assert.equal(blocks.wheel.userData.pinCount, 14);
  assert.equal(blocks.wheel.userData.trundles.length, 14);
  assert.equal(blocks.frameBeams.length, 3);
  disposeModel(model.root);
});

test('movement 233 preserves the measured shared-wheel source layout', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate233;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [236, 301]);
  assert.deepEqual(plate.rasterRollerPivot.toArray(), [29, 254]);
  assert.deepEqual(plate.rasterRollerCenter.toArray(), [177, 183]);
  assert.deepEqual(plate.rasterLatchPivot.toArray(), [490, 220]);
  assert.deepEqual(plate.rasterLatchNose.toArray(), [303, 240]);
  assert.equal(plate.rasterImageWidth, 525);
  assert.equal(plate.rasterImageHeight, 525);
  assert.equal(plate.inferredTrundleCount, 14);
  assert.equal(plate.sharedWheelAlternativeStops, true);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(sourceReference.primaryScan, {
    bookPage: 58,
    edition: 21,
    publicationYear: 1908,
  });
  assert.deepEqual(sourceReference.corroboratingClassification, {
    caption: 'Roller stop and latch stop for lantern wheel.',
    publication: 'Pictorial Handbook of Technical Devices',
    publicationYear: 1971,
    section: 'Machine Technology / Gearing / Pawls and Ratchets',
  });
  near(geometry.trundlePitch, FULL_TURN / 14, 0, 'fourteen-trundle pitch');
  near(
    geometry.rollerGapAngle - geometry.latchGapAngle,
    3 * geometry.trundlePitch,
    1e-15,
    'the two engraved stops are three gaps apart',
  );

  const upperPin = new THREE.Vector2(
    Math.cos(geometry.rollerGapAngle + geometry.trundlePitch / 2)
      * geometry.trundleOrbitRadius,
    Math.sin(geometry.rollerGapAngle + geometry.trundlePitch / 2)
      * geometry.trundleOrbitRadius,
  );
  const lowerPin = new THREE.Vector2(
    Math.cos(geometry.rollerGapAngle - geometry.trundlePitch / 2)
      * geometry.trundleOrbitRadius,
    Math.sin(geometry.rollerGapAngle - geometry.trundlePitch / 2)
      * geometry.trundleOrbitRadius,
  );
  near(
    geometry.rollerRestCenter.distanceTo(upperPin),
    geometry.rollerContactDistance,
    6e-16,
    'roller seats on upper adjacent trundle',
  );
  near(
    geometry.rollerRestCenter.distanceTo(lowerPin),
    geometry.rollerContactDistance,
    6e-16,
    'roller seats on lower adjacent trundle',
  );
  const source = stateAtCycleCoordinate(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.activeAlternative, null);
  near(source.wheelAngle, 0, 0, 'source wheel angle');
  near(source.rollerLeverDelta, 0, 0, 'source roller-stop angle');
  near(source.latchAngle, 0, 0, 'source latch-stop angle');

  const trundleLayer = geometry.axialLayers.trundles;
  const trundleFront = trundleLayer.center + trundleLayer.length / 2;
  const trundleRear = trundleLayer.center - trundleLayer.length / 2;
  for (const stop of [
    geometry.axialLayers.rollerStop,
    geometry.axialLayers.latchStop,
  ]) {
    const stopFront = stop.center + stop.depth / 2;
    const stopRear = stop.center - stop.depth / 2;
    assert.ok(stopRear < trundleFront && stopFront > trundleRear);
  }
  disposeModel(model.root);
});

test('movement 233 loads only one alternative through 65,537 cycle states', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  let minimumWheelAngle = Infinity;
  let maximumWheelAngle = -Infinity;
  let rollerStates = 0;
  let latchStates = 0;
  let sourceStates = 0;
  for (let index = 0; index <= 65536; index += 1) {
    const state = stateAtCycleCoordinate(index / 65536);
    for (const value of [
      state.wheelAngle,
      state.wheelAngularSpeed,
      state.wheelAngularAcceleration,
      state.rollerLeverDelta,
      state.rollerLeverAngularSpeed,
      state.rollerSpinAngle,
      state.rollerSpinAngularSpeed,
      state.latchAngle,
      state.latchAngularSpeed,
    ]) assert.ok(Number.isFinite(value));
    assert.equal(state.rollerActive && state.latchActive, false);
    assert.equal(state.rollerContact !== null, state.rollerActive);
    assert.equal(state.latchContact !== null, state.latchActive);
    assert.ok(state.wheelAngle <= 2e-15);
    assert.ok(state.wheelAngle >= -geometry.trundlePitch - 2e-15);
    if (state.rollerActive) {
      rollerStates += 1;
      assert.equal(state.activeAlternative, 'roller-stop');
      assert.equal(state.latchParked, true);
      assert.ok(state.wheelAngularSpeed <= 1e-13);
      assert.ok(state.rollerLeverDelta >= -2e-14);
    }
    if (state.latchActive) {
      latchStates += 1;
      assert.equal(state.activeAlternative, 'latch-stop');
      assert.equal(state.rollerParked, true);
      assert.ok(state.wheelAngularSpeed >= -1e-13);
      assert.ok(state.latchAngle <= 2e-14);
    }
    if (state.sourcePose) {
      sourceStates += 1;
      near(state.wheelAngle, 0, 2e-14, 'source-pose wheel closure');
      near(state.rollerLeverDelta, 0, 2e-14, 'source-pose roller closure');
      near(state.latchAngle, 0, 2e-14, 'source-pose latch closure');
    }
    minimumWheelAngle = Math.min(minimumWheelAngle, state.wheelAngle);
    maximumWheelAngle = Math.max(maximumWheelAngle, state.wheelAngle);
  }
  assert.ok(rollerStates > 15000);
  assert.ok(latchStates > 15000);
  assert.ok(sourceStates > 5000);
  near(minimumWheelAngle, -geometry.trundlePitch, 2e-15,
    'roller demonstration advances clockwise one pitch');
  near(maximumWheelAngle, 0, 2e-15,
    'latch demonstration returns counterclockwise one pitch');
  near(stateAtCycleCoordinate(0.16).wheelAngle, 0, 0,
    'roller drive begins at source angle');
  near(stateAtCycleCoordinate(0.4).wheelAngle, -geometry.trundlePitch, 1e-15,
    'roller drive ends one pitch clockwise');
  near(stateAtCycleCoordinate(0.58).wheelAngle, -geometry.trundlePitch, 1e-15,
    'latch drive begins at indexed angle');
  near(stateAtCycleCoordinate(0.82).wheelAngle, 0, 1e-15,
    'latch drive returns one pitch counterclockwise');
  const closure = stateAtCycleCoordinate(1);
  near(closure.wheelAngle, 0, 0, 'cycle wheel closure');
  near(closure.rollerLeverDelta, 0, 0, 'cycle roller closure');
  near(closure.latchAngle, 0, 0, 'cycle latch closure');
  disposeModel(model.root);
});

test('movement 233 roller has exact two-circle contact and true rolling rate', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    geometry,
    rollerContactAtProgress,
    rollerSpinAtProgress,
  } = model.root.userData;
  let maximumLift = 0;
  let maximumRollingError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const progress = index / 32768;
    const contact = rollerContactAtProgress(progress);
    near(
      contact.rollerCenter.distanceTo(contact.pinCenter),
      geometry.rollerContactDistance,
      5e-15,
      'roller-to-trundle center distance',
    );
    vectorNear(
      contact.pinContactPoint,
      contact.rollerContactPoint,
      5e-15,
      'roller and trundle share one contact point',
    );
    near(
      contact.rollingVelocityError.dot(contact.contactNormal),
      0,
      1.2e-15,
      'roller contact has no normal slip',
    );
    near(
      contact.rollingVelocityError.dot(contact.contactTangent),
      0,
      1.2e-15,
      'roller contact has no tangential slip',
    );
    maximumLift = Math.max(maximumLift, contact.armDelta);
    maximumRollingError = Math.max(
      maximumRollingError,
      contact.rollingVelocityError.length(),
    );
  }
  assert.ok(maximumLift > THREE.MathUtils.degToRad(4.7));
  assert.ok(maximumLift < THREE.MathUtils.degToRad(4.9));
  assert.ok(maximumRollingError < 1.2e-15);
  near(rollerContactAtProgress(0).armDelta, 0, 5e-16,
    'roller begins seated');
  near(rollerContactAtProgress(1).armDelta, 0, 5e-16,
    'roller reseats one pitch later');
  near(rollerSpinAtProgress(0), 0, 0, 'roller witness starts at zero');
  near(
    rollerSpinAtProgress(1),
    geometry.rollerSpinPerPitch,
    0,
    'roller witness integrates one complete contact stroke',
  );
  for (const progress of [0.08, 0.21, 0.37, 0.5, 0.64, 0.82, 0.94]) {
    const h = 1e-5;
    const finiteDerivative = (
      rollerSpinAtProgress(progress + h)
      - rollerSpinAtProgress(progress - h)
    ) / (2 * h);
    near(
      finiteDerivative,
      rollerContactAtProgress(progress).rollerSpinDerivative,
      2e-4,
      'integrated roller witness derivative',
    );
  }
  disposeModel(model.root);
});

test('movement 233 latch is a flat bar with a slanted end that rides the lower trundle and falls into the next space', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    geometry,
    latchEnvelopeAtProgress,
  } = model.root.userData;
  // The slant runs at Brown's angle from the tip; the bar keeps one width.
  const face = geometry.latchFacePoints.at(-1).clone()
    .sub(geometry.latchFacePoints[0]);
  near(Math.atan2(face.y, face.x), geometry.latchFaceSlope, 1e-12,
    'slanted end at the drawn angle');
  near(geometry.latchWidth, 2 * face.y / Math.sin(geometry.latchFaceSlope)
    * Math.sin(geometry.latchFaceSlope) / 2, 1e-12, 'bar width');
  let minimumLatchAngle = 0;
  let fallProgress = null;
  for (let index = 0; index <= 4096; index += 1) {
    const progress = index / 4096;
    const contact = latchEnvelopeAtProgress(progress);
    // The solved lift is tabulated (512 steps); interpolation may undercut
    // the 0.002 running clearance slightly, never into the trundle.
    assert.ok(contact.gap >= 0.0015,
      `bar clear of every trundle at ${progress}: ${contact.gap}`);
    assert.ok(contact.latchAngle <= 1e-12);
    minimumLatchAngle = Math.min(minimumLatchAngle, contact.latchAngle);
    if (fallProgress === null && progress > 0.5
      && contact.latchAngle > -1e-9) fallProgress = progress;
  }
  near(minimumLatchAngle, -geometry.latchLiftAmplitude, 1e-9,
    'latch reaches its solved lift');
  assert.ok(geometry.latchLiftAmplitude > 0.15,
    'the lower trundle lifts the bar clear of the tip');
  assert.ok(fallProgress !== null && fallProgress < 1,
    'the bar falls back into the next space within the stroke');
  near(latchEnvelopeAtProgress(0).latchAngle, 0, 0, 'latch begins seated');
  near(latchEnvelopeAtProgress(1).latchAngle, 0, 1e-12,
    'latch reseats in the adjacent space');
  // At rest the bar lies on the lower trundle and its tip stands between
  // the two, below the upper trundle's centre.
  const rest = latchEnvelopeAtProgress(0);
  near(rest.gap, 0.004, 1e-9, 'bar rests on the lower trundle');
  disposeModel(model.root);
});

test('movement 233 analytic velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[232]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-5;
  for (const cyclePhase of [0.2, 0.24, 0.28, 0.34, 0.62, 0.68, 0.7, 0.76]) {
    const time = cyclePhase * geometry.cyclePeriod;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const wheelSpeed = (after.wheelAngle - before.wheelAngle) / (2 * h);
    const wheelAcceleration = (
      after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
    ) / h ** 2;
    near(wheelSpeed, state.wheelAngularSpeed, 2e-9,
      'wheel angular speed finite difference');
    near(wheelAcceleration, state.wheelAngularAcceleration, 2e-5,
      'wheel angular acceleration finite difference');
    if (state.rollerActive) {
      const leverSpeed = (
        after.rollerLeverDelta - before.rollerLeverDelta
      ) / (2 * h);
      const spinSpeed = (
        after.rollerSpinAngle - before.rollerSpinAngle
      ) / (2 * h);
      near(leverSpeed, state.rollerLeverAngularSpeed, 3e-8,
        'roller arm angular speed finite difference');
      near(spinSpeed, state.rollerSpinAngularSpeed, 6e-5,
        'roller spin finite difference');
    }
    if (state.latchActive) {
      const latchSpeed = (
        after.latchAngle - before.latchAngle
      ) / (2 * h);
      const latchAcceleration = (
        after.latchAngle - 2 * state.latchAngle + before.latchAngle
      ) / h ** 2;
      // The latch's lift is a C1 monotone spline through its solved table,
      // so its acceleration steps at the table knots.
      near(latchSpeed, state.latchAngularSpeed,
        1e-4 * (1 + Math.abs(state.latchAngularSpeed)),
        'latch angular speed finite difference');
      near(latchAcceleration, state.latchAngularAcceleration,
        0.3 * (1 + Math.abs(state.latchAngularAcceleration)),
        'latch angular acceleration finite difference');
    }
  }
  disposeModel(model.root);
});

test('movement 233 renderer binds wheel, stops, witnesses, and contacts for 4,097 frames', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const wheelRotor = blocks.wheel.userData.rotor;
  const wheelShaftRotor = blocks.wheelShaft.userData.rotor;
  const rollerRotor = blocks.rollerWheel.userData.rotor;
  for (let index = 0; index <= 4096; index += 1) {
    const time = geometry.cyclePeriod * index / 4096;
    model.update(time);
    const state = stateAtTime(time);
    near(wheelRotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered wheel angle');
    near(wheelShaftRotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered wheel-shaft angle');
    near(blocks.rollerStop.rotation.z, state.rollerLeverDelta, 2e-15,
      'rendered roller arm angle');
    near(
      rollerRotor.rotation.z,
      state.rollerSpinAngle - state.rollerLeverDelta,
      2e-15,
      'rendered free-roller spin angle',
    );
    near(blocks.latchStop.rotation.z, state.latchAngle, 2e-15,
      'rendered latch angle');
    assert.equal(blocks.rollerContactMarker.visible, state.rollerActive);
    assert.equal(blocks.latchContactMarker.visible, state.latchActive);
    if (state.rollerContact) {
      vectorNear(
        new THREE.Vector2(
          blocks.rollerContactMarker.position.x,
          blocks.rollerContactMarker.position.y,
        ),
        state.rollerContact.point,
        1e-15,
        'rendered roller contact marker',
      );
    }
    if (state.latchContact) {
      vectorNear(
        new THREE.Vector2(
          blocks.latchContactMarker.position.x,
          blocks.latchContactMarker.position.y,
        ),
        state.latchContact.point,
        1e-15,
        'rendered latch contact marker',
      );
    }
    const renderedRollerContact = model.root.userData.contacts
      .rollerStopToTrundle;
    const renderedLatchContact = model.root.userData.contacts
      .latchStopToTrundle;
    assert.equal(renderedRollerContact !== null, state.rollerContact !== null);
    assert.equal(renderedLatchContact !== null, state.latchContact !== null);
    if (state.rollerContact) {
      vectorNear(renderedRollerContact.point, state.rollerContact.point, 0,
        'renderer publishes the roller contact point');
      near(
        renderedRollerContact.tangentialVelocityError,
        state.rollerContact.tangentialVelocityError,
        0,
        'renderer publishes roller rolling contact',
      );
    }
    if (state.latchContact) {
      vectorNear(renderedLatchContact.point, state.latchContact.point, 0,
        'renderer publishes the latch contact point');
      near(
        renderedLatchContact.normalVelocityError,
        state.latchContact.normalVelocityError,
        0,
        'renderer publishes latch normal contact',
      );
    }
  }
  assert.equal(blocks.rollerWitness.userData.rollerRotationWitness, true);
  assert.equal(blocks.wheelIndicator.userData.rotationWitness, true);
  disposeModel(model.root);
});

test('movement 233 closes every demonstration cycle and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[232]);
  const {
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0);
  for (let cycle = 1; cycle <= 14; cycle += 1) {
    const closure = stateAtCycleCoordinate(cycle);
    near(closure.wheelAngle, source.wheelAngle, 0,
      `wheel closure after demonstration cycle ${cycle}`);
    near(closure.rollerLeverDelta, source.rollerLeverDelta, 0,
      `roller arm closure after demonstration cycle ${cycle}`);
    near(closure.latchAngle, source.latchAngle, 0,
      `latch closure after demonstration cycle ${cycle}`);
    near(
      closure.rollerSpinAngle,
      cycle * geometry.rollerSpinPerPitch,
      2e-15,
      `free roller accumulates physical spin in cycle ${cycle}`,
    );
  }
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(movement507.root);
});
