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
  // Both stops stay on the wheel; nothing lifts either except a trundle.
  assert.equal(transmission.alternativesSimultaneouslyLoaded, true);
  assert.equal(transmission.stopsLiftedOnlyByTrundleContact, true);
  assert.equal(transmission.trundlesPerDemonstrationStroke, 1);
  assert.equal(transmission.strokesPerCycle, 2);
  assert.equal(transmission.wheelReturnsToSourceAngleEachCycle, false);
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

test('movement 233 turns the wheel counterclockwise past both engaged stops', () => {
  const model = createMovementModel(catalog.movements[232]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let previous = stateAtCycleCoordinate(0);
  let active = 0;
  for (let index = 1; index <= 65536; index += 1) {
    const state = stateAtCycleCoordinate(index / 65536);
    for (const value of [state.wheelAngle, state.wheelAngularSpeed,
      state.rollerLeverDelta, state.rollerLeverAngularSpeed,
      state.rollerSpinAngle, state.latchAngle, state.latchAngularSpeed,
    ]) assert.ok(Number.isFinite(value));
    // The roller only rises (never below its seat) and the latch only
    // lifts; both are bounded by their contact solutions.
    assert.ok(state.rollerLeverDelta >= 0);
    assert.ok(state.rollerLeverDelta < THREE.MathUtils.degToRad(4.9));
    assert.ok(state.latchAngle <= 1e-12);
    assert.ok(state.wheelAngle >= previous.wheelAngle - geometry.trundlePitch
      * geometry.latchOvershoot);
    assert.ok(Math.abs(state.rollerLeverDelta - previous.rollerLeverDelta)
      < THREE.MathUtils.degToRad(0.05), 'roller lift is continuous');
    if (state.rollerActive) active += 1;
    assert.equal(state.rollerActive, state.latchActive);
    previous = state;
  }
  assert.ok(active > 30000);
  near(stateAtCycleCoordinate(0.4).wheelAngle, geometry.trundlePitch, 1e-12,
    'first stroke turns one pitch counterclockwise');
  near(stateAtCycleCoordinate(0.82).wheelAngle, 2 * geometry.trundlePitch,
    1e-12, 'second stroke turns another pitch');
  for (const phase of [0, 0.1, 0.45, 0.55, 0.9]) {
    const seated = stateAtCycleCoordinate(phase);
    near(seated.rollerLeverDelta, 0, 1e-12, `roller seated at ${phase}`);
    near(seated.latchAngle, 0, 1e-12, `latch seated at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 233 roller rides over the trundles as a least-lift contact follower', () => {
  const model = createMovementModel(catalog.movements[232]);
  const { geometry, lanternStop233Kinematics: kinematics } = model.root.userData;
  const {
    rollerArmLength, rollerContactDistance, rollerPivot, rollerRestArmAngle,
    trundleCount, trundleOrbitRadius, trundlePitch,
  } = geometry;
  let maximumLift = 0;
  for (let index = 0; index <= 8192; index += 1) {
    const theta = trundlePitch * index / 8192;
    const { delta, binding } = kinematics.rollerLift(theta);
    const angle = rollerRestArmAngle + delta;
    const center = new THREE.Vector2(
      rollerPivot.x + rollerArmLength * Math.cos(angle),
      rollerPivot.y + rollerArmLength * Math.sin(angle),
    );
    let closest = Infinity;
    for (let pin = 0; pin < trundleCount; pin += 1) {
      const pinAngle = geometry.rollerGapAngle + trundlePitch / 2
        + pin * trundlePitch + theta;
      const gap = center.distanceTo(new THREE.Vector2(
        Math.cos(pinAngle) * trundleOrbitRadius,
        Math.sin(pinAngle) * trundleOrbitRadius,
      )) - rollerContactDistance;
      assert.ok(gap > -1e-9, `roller clears trundle ${pin} at ${theta}`);
      closest = Math.min(closest, gap);
    }
    // It always touches a trundle: lifted by one, or seated between two.
    assert.ok(closest < 1e-9, `roller rests on a trundle at ${theta}`);
    if (delta > 1e-9) assert.ok(binding >= 0);
    maximumLift = Math.max(maximumLift, delta);
  }
  assert.ok(maximumLift > THREE.MathUtils.degToRad(4.7));
  assert.ok(maximumLift < THREE.MathUtils.degToRad(4.9));
  near(kinematics.rollerLift(0).delta, 0, 0, 'roller begins seated');
  near(kinematics.rollerLift(trundlePitch).delta, 0, 1e-9,
    'roller reseats one pitch later');
  assert.ok(Math.abs(kinematics.spinPerPitch) > 1, 'the free roller rolls');
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

test('movement 233 published speeds match finite differences', () => {
  const model = createMovementModel(catalog.movements[232]);
  const { geometry, stateAtTime } = model.root.userData;
  const h = 2e-5;
  for (const cyclePhase of [0.2, 0.24, 0.28, 0.34, 0.62, 0.68, 0.7, 0.76]) {
    const time = cyclePhase * geometry.cyclePeriod;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    near((after.wheelAngle - before.wheelAngle) / (2 * h),
      state.wheelAngularSpeed, 2e-8, 'wheel angular speed');
    near((after.rollerLeverDelta - before.rollerLeverDelta) / (2 * h),
      state.rollerLeverAngularSpeed, 2e-3, 'roller arm angular speed');
    near((after.latchAngle - before.latchAngle) / (2 * h),
      state.latchAngularSpeed, 1e-3 * (1 + Math.abs(state.latchAngularSpeed)),
      'latch angular speed');
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
    const published = model.root.userData.contacts;
    assert.equal(published.rollerStopToTrundle !== null, state.rollerContact !== null);
    assert.equal(published.latchStopToTrundle !== null, state.latchContact !== null);
  }
  assert.equal(blocks.rollerWitness.userData.rollerRotationWitness, true);
  assert.equal(blocks.wheelIndicator.userData.rotationWitness, true);
  disposeModel(model.root);
});

test('movement 233 closes every cycle two trundles on and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[232]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  for (let cycle = 1; cycle <= 14; cycle += 1) {
    const closure = stateAtCycleCoordinate(cycle);
    near(closure.wheelAngle, 2 * cycle * geometry.trundlePitch, 1e-12,
      `wheel advances two trundles in cycle ${cycle}`);
    near(closure.rollerLeverDelta, 0, 1e-12, `roller reseated after ${cycle}`);
    near(closure.latchAngle, 0, 1e-12, `latch reseated after ${cycle}`);
    near(closure.rollerSpinAngle, 2 * cycle * model.root.userData.lanternStop233Kinematics.spinPerPitch,
    1e-9, `free roller accumulates spin in cycle ${cycle}`);
    const before = stateAtCycleCoordinate(cycle - 1e-9);
    near(before.rollerSpinAngle, closure.rollerSpinAngle, 1e-6,
      `roller spin is continuous across cycle ${cycle}`);
  }
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(movement507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(movement507.root);
});
