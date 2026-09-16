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

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

test('movement 186 matches Brown\'s spring-handle gab-release topology and source layout', () => {
  const movement = catalog.movements[185];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    handleLiftAtAngle,
    inputMotionAtCyclePhase,
    sequenceAtCyclePhase,
    sourcePointFromRaster,
    sourceRasterFromPoint,
    springHandlePointsAtConfiguration,
    stateAtConfiguration,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camLatchTang,
    camLever,
    camLeverBody,
    camPivotPin,
    camSupportAnchor,
    camSupportShoe,
    eccentricRod,
    frame,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabJaws,
    gabTopBridge,
    latchMarker,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    springHandle,
    springHandleAnchor,
    springTipIndex,
    upperHandleGrip,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  } = blocks;

  assert.equal(movement.id, 186);
  assert.equal(movement.number, '186');
  assert.equal(movement.title, 'Spring-Handle Gab-Lever Disengaging Gear');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '186. Apparatus for disengaging the eccentric-rod from the valve-gear. By pulling up the spring handle below until it catches in the notch, a, the pin is disengaged from the gab in the eccentric-rod.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_186.html');
  assert.equal(
    movement.archetype,
    'spring-handle-cam-lifted-eccentric-rod-gab-pin-notch-latch',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'rod-carried-cam-lever-lifts-downward-opening-eccentric-rod-gab-off-valve-pin-and-spring-handle-latches-in-notch-a',
  );
  for (const fn of [
    handleLiftAtAngle,
    inputMotionAtCyclePhase,
    sequenceAtCyclePhase,
    sourcePointFromRaster,
    sourceRasterFromPoint,
    springHandlePointsAtConfiguration,
    stateAtConfiguration,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  ]) assert.equal(typeof fn, 'function');

  for (const object of [
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camLatchTang,
    camLever,
    camLeverBody,
    camPivotPin,
    camSupportAnchor,
    camSupportShoe,
    eccentricRod,
    frame,
    gabCaptureMarker,
    gabCenterAnchor,
    gabTopBridge,
    latchMarker,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    springHandle,
    springHandleAnchor,
    springTipIndex,
    upperHandleGrip,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  ]) assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  assert.equal(gabJaws.length, 2);
  assert.equal(gabContactShoes.length, 2);

  // Brown's overlapping side elevation represents four distinct bodies. In
  // particular, the lower U spring is mounted to the rod; it is not welded to
  // the independently pivoted upper cam lever.
  assert.equal(valveRocker.parent, model.root);
  assert.equal(eccentricRod.parent, model.root);
  assert.equal(frame.parent, model.root);
  assert.equal(valvePin.parent, valveRocker);
  assert.equal(camSupportShoe.parent, valveRocker);
  assert.equal(camLever.parent, eccentricRod);
  assert.equal(camPivotPin.parent, eccentricRod);
  assert.equal(springHandle.parent, eccentricRod);
  assert.equal(springHandleAnchor.parent, eccentricRod);
  assert.notEqual(springHandle.parent, camLever);
  assert.equal(camLatchTang.parent, camLever);
  assert.equal(notchAAnchor.parent, camLever);
  assert.equal(upperHandleGrip.parent, camLever);

  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceUnitsPerPixel, 0.015, 0, 'source scale');
  assert.deepEqual(geometry.sourceRasterGabPin.toArray(), [266, 254]);
  assert.deepEqual(geometry.sourceRasterValvePivot.toArray(), [261, 57]);
  assert.deepEqual(geometry.sourceRasterCamContact.toArray(), [285, 151]);
  assert.deepEqual(geometry.sourceRasterCamPivot.toArray(), [340, 207]);
  assert.deepEqual(geometry.sourceRasterHandleGrip.toArray(), [470, 213]);
  assert.deepEqual(geometry.sourceRasterSpringAnchor.toArray(), [358, 240]);
  assert.deepEqual(geometry.sourceRasterSpringFreeTip.toArray(), [418, 319]);
  assert.deepEqual(geometry.sourceRasterNotchA.toArray(), [480, 319]);
  assert.deepEqual(geometry.sourceRasterSpringBottom.toArray(), [436, 482]);
  for (const rasterPoint of [
    geometry.sourceRasterGabPin,
    geometry.sourceRasterValvePivot,
    geometry.sourceRasterCamContact,
    geometry.sourceRasterCamPivot,
    geometry.sourceRasterHandleGrip,
    geometry.sourceRasterSpringAnchor,
    geometry.sourceRasterSpringFreeTip,
    geometry.sourceRasterNotchA,
    geometry.sourceRasterSpringBottom,
  ]) {
    vector2Near(
      sourceRasterFromPoint(sourcePointFromRaster(rasterPoint)),
      rasterPoint,
      2e-13,
      'source raster round trip',
    );
  }

  const source = canonicalStates.sourceEngaged;
  vector2Near(source.gabCenter, new THREE.Vector2(0, 0), 1e-15,
    'source gab center');
  vector2Near(source.valvePin, new THREE.Vector2(0, 0), 1e-15,
    'source valve pin');
  vector2Near(source.valvePivot, sourcePointFromRaster(
    geometry.sourceRasterValvePivot,
  ), 1e-15, 'source valve pivot');
  vector2Near(source.camPivot, sourcePointFromRaster(
    geometry.sourceRasterCamPivot,
  ), 1e-15, 'source cam pivot');
  vector2Near(source.camContactPoint, sourcePointFromRaster(
    geometry.sourceRasterCamContact,
  ), 2e-15, 'source cam contact');
  vector2Near(source.notchA, sourcePointFromRaster(
    geometry.sourceRasterNotchA,
  ), 2e-15, 'source notch a');
  vector2Near(source.springLatchTip, sourcePointFromRaster(
    geometry.sourceRasterSpringFreeTip,
  ), 2e-15, 'source spring free tip');
  vector2Near(source.springHandlePointsLocal[0], sourcePointFromRaster(
    geometry.sourceRasterSpringAnchor,
  ), 2e-15, 'source spring fixed root');
  vector2Near(source.springHandlePointsLocal[4], sourcePointFromRaster(
    geometry.sourceRasterSpringBottom,
  ), 2e-15, 'source spring loop bottom');
  const sourceHandleGrip = source.camPivot.clone().add(geometry.handleGripLocal);
  vector2Near(sourceHandleGrip, sourcePointFromRaster(
    geometry.sourceRasterHandleGrip,
  ), 2e-15, 'source upper grip');
  near(source.latchGap, 62 * geometry.sourceUnitsPerPixel, 2e-15,
    'source unlatched spring-to-notch gap');
  assert.equal(source.gabCaptured, true);
  assert.equal(source.pinInsideGabMouth, true);
  assert.equal(source.pinFullyClearBelowGab, false);
  near(source.camContactError, 0, 1e-15, 'source cam contact');
  near(source.minimumGabSolidClearance, 0.04, 2e-15,
    'source gab running clearance');

  assert.ok(geometry.maximumGabLift > geometry.fullClearCouplingEnd);
  near(handleLiftAtAngle(0), 0, 0, 'zero-angle cam lift');
  near(
    handleLiftAtAngle(geometry.maximumHandleAngle),
    geometry.maximumGabLift,
    1e-15,
    'full-angle cam lift',
  );
  disposeModel(model.root);
});

test('movement 186 preserves gab clearance, pin capture, cam lift, and latch closure over the full configuration envelope', () => {
  const model = createMovementModel(catalog.movements[185]);
  const { canonicalStates, geometry, stateAtConfiguration } = model.root.userData;
  let minimumSolidClearance = Infinity;
  let previousLift = -Infinity;

  for (let handleIndex = 0; handleIndex <= 128; handleIndex += 1) {
    const handleFraction = handleIndex / 128;
    const reference = stateAtConfiguration({
      handleFraction,
      inputAngle: 0,
    });
    assert.ok(reference.gabLift >= previousLift - 2e-15,
      'cam lift is monotone while the handle is pulled');
    previousLift = reference.gabLift;
    near(reference.camContactError, 0, 8e-16,
      'cam remains on its support shoulder at the stopped release position');

    for (let inputIndex = 0; inputIndex < 256; inputIndex += 1) {
      const inputAngle = FULL_TURN * inputIndex / 256;
      const state = stateAtConfiguration({
        handleFraction,
        inputAngle,
        latchEngagement: handleFraction === 1 ? 1 : 0,
      });
      finiteStateNumbers(state);
      minimumSolidClearance = Math.min(
        minimumSolidClearance,
        state.minimumGabSolidClearance,
      );
      assert.ok(state.minimumGabSolidClearance >= 0.04 - 3e-14,
        'round valve pin never intersects either jaw or the gab crown');
      near(state.valvePinRadiusError, 0, 1.5e-15,
        'valve pin remains on its finite rocker arm');
      assert.ok(state.couplingBlend >= 0 && state.couplingBlend <= 1);
      if (state.couplingBlend < 1 - 1e-12) {
        assert.equal(state.pinFullyClearBelowGab, true,
          'the valve can decouple only after the pin is below both jaws');
      }

      if (handleIndex === 0) {
        assert.equal(state.gabCaptured, true);
        assert.equal(state.pinInsideGabMouth, true);
        near(state.couplingBlend, 1, 0, 'engaged coupling');
        vector2Near(state.gabCenter, state.valvePin, 1.5e-15,
          'engaged gab follows the valve pin exactly');
      }
      if (handleIndex === 128) {
        assert.equal(state.pinFullyClearBelowGab, true);
        near(state.couplingBlend, 0, 0, 'fully released coupling');
        near(state.rockerAngle, 0, 0, 'released valve lever remains at rest');
        vector2Near(state.springLatchTip, state.notchA, 2e-15,
          'spring tip closes into moving notch a');
        near(state.latchGap, 0, 2e-15, 'latched gap');
        near(state.latchCaptureError, 0, 2e-15, 'latched capture error');
      }
    }
  }
  near(minimumSolidClearance, 0.04, 3e-14,
    'dense-envelope minimum solid clearance');

  const engagedPositive = stateAtConfiguration({
    handleFraction: 0,
    inputAngle: Math.PI / 2,
  });
  const engagedNegative = stateAtConfiguration({
    handleFraction: 0,
    inputAngle: 3 * Math.PI / 2,
  });
  const releasedPositive = stateAtConfiguration({
    handleFraction: 1,
    inputAngle: Math.PI / 2,
    latchEngagement: 1,
  });
  const releasedNegative = stateAtConfiguration({
    handleFraction: 1,
    inputAngle: 3 * Math.PI / 2,
    latchEngagement: 1,
  });
  near(engagedPositive.rockerAngle, geometry.valveRockerAmplitude, 1e-15,
    'engaged positive valve throw');
  near(engagedNegative.rockerAngle, -geometry.valveRockerAmplitude, 1e-15,
    'engaged negative valve throw');
  near(releasedPositive.rockerAngle, 0, 0, 'released positive valve stop');
  near(releasedNegative.rockerAngle, 0, 0, 'released negative valve stop');
  assert.ok(releasedPositive.gabCenter.distanceTo(releasedNegative.gabCenter) > 0.65,
    'the eccentric rod continues its off-frame stroke while disengaged');
  vector2Near(releasedPositive.valvePin, releasedNegative.valvePin, 1e-15,
    'disengaged valve pin remains stationary');
  assert.equal(canonicalStates.fullyLiftedAtQuarterTurn.pinFullyClearBelowGab, true);
  disposeModel(model.root);
});

test('movement 186 stops at alignment for operation, runs while latched, and crosses every event with C2 laws', () => {
  const model = createMovementModel(catalog.movements[185]);
  const {
    geometry,
    inputMotionAtCyclePhase,
    sequenceAtCyclePhase,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  const { cyclePeriod, sequenceBreaks } = geometry;

  const checkpoints = [
    [0, 'engaged-eccentric-rod-driving-valve-gear', 0, 0, 0],
    [sequenceBreaks.sourceEngagedHoldEnd,
      'pulling-spring-handle-cam-lifting-gab', 2, 0, 0],
    [sequenceBreaks.springSnapStart,
      'spring-handle-passing-notch-a', 2, 0.8552983875766051, 0],
    [sequenceBreaks.handlePullEnd,
      'spring-handle-latched-gab-clear-of-pin', 2, 1, 1],
    [0.45, 'spring-handle-latched-gab-clear-of-pin', 3, 1, 1],
    [sequenceBreaks.latchedHoldEnd,
      'spring-handle-flexing-out-of-notch-a', 4, 1, 1],
    [0.61, 'spring-handle-flexing-out-of-notch-a', 4, 1, 0.5],
    [sequenceBreaks.springReleaseEnd,
      'cam-lowering-gab-around-valve-pin', 4, 1, 0],
    [sequenceBreaks.handleLowerEnd,
      'gab-recaptured-eccentric-rod-driving-valve-gear', 4, 0, 0],
  ];
  for (const [phase, stage, turns, handleFraction, latchEngagement] of checkpoints) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.stage, stage);
    near(state.inputTurns, turns, 2e-14, `input turns at ${phase}`);
    near(state.handleFraction, handleFraction, 2e-14,
      `handle fraction at ${phase}`);
    near(state.latchEngagement, latchEngagement, 2e-14,
      `latch engagement at ${phase}`);
  }

  near(stateAtCyclePhase(0.25).inputAngularSpeed, 0, 0,
    'shaft is stopped while pulling the spring handle');
  near(stateAtCyclePhase(0.61).inputAngularSpeed, 0, 0,
    'shaft is stopped while releasing the spring latch');
  near(stateAtCyclePhase(0.72).inputAngularSpeed, 0, 0,
    'shaft is stopped while lowering the gab');
  assert.ok(stateAtCyclePhase(0.09).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.45).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.90).inputAngularSpeed > 0);
  near(stateAtCyclePhase(0.61).springDeflection,
    geometry.springMaximumDeflection, 2e-15,
    'spring flexes out of the notch in depth');

  let previousTurns = 0;
  for (let index = 0; index < 32768; index += 1) {
    const phase = index / 32768;
    const state = stateAtCyclePhase(phase);
    finiteStateNumbers(state);
    assert.ok(state.inputTurns >= previousTurns - 2e-13,
      'input progress is monotone through the demonstration');
    previousTurns = state.inputTurns;
    assert.ok(state.minimumGabSolidClearance >= 0.04 - 4e-13);
    if (state.camLiftActive) {
      near(state.inputAngularSpeed, 0, 5e-13,
        'cam is operated only at the stopped alignment');
      near(state.camContactError, 0, 2e-13,
        'active cam remains on the valve-lever shoulder');
    }
    if (state.latchEngagement >= 1 - 1e-12) {
      assert.equal(state.pinFullyClearBelowGab, true);
      near(state.latchGap, 0, 3e-12, 'latched spring capture');
      near(state.rockerAngle, 0, 1e-14, 'latched valve lever is stopped');
    }
  }
  assert.ok(previousTurns > 5.9999999999);

  // Each piecewise event begins and ends with zero rate and acceleration.
  for (const phase of [
    0,
    sequenceBreaks.sourceEngagedHoldEnd,
    sequenceBreaks.handlePullEnd,
    sequenceBreaks.latchedHoldEnd,
    sequenceBreaks.springReleaseEnd,
    sequenceBreaks.handleLowerEnd,
    1,
  ]) {
    const input = inputMotionAtCyclePhase(phase);
    near(input.ratePerPhase, 0, 5e-13, `input rate at ${phase}`);
    near(input.accelerationPerPhaseSquared, 0, 2e-11,
      `input acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.sourceEngagedHoldEnd,
    sequenceBreaks.handlePullEnd,
    sequenceBreaks.springReleaseEnd,
    sequenceBreaks.handleLowerEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.handleRatePerPhase, 0, 5e-13,
      `handle rate at ${phase}`);
    near(sequence.handleAccelerationPerPhaseSquared, 0, 2e-11,
      `handle acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.springSnapStart,
    sequenceBreaks.handlePullEnd,
    sequenceBreaks.latchedHoldEnd,
    sequenceBreaks.springReleaseEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.latchRatePerPhase, 0, 5e-13,
      `latch rate at ${phase}`);
    near(sequence.latchAccelerationPerPhaseSquared, 0, 2e-11,
      `latch acceleration at ${phase}`);
    near(sequence.springDeflectionRatePerPhase, 0, 5e-13,
      `spring flex rate at ${phase}`);
  }

  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(cyclePeriod);
  for (const key of [
    'camContactPoint',
    'gabCenter',
    'notchA',
    'springLatchTip',
    'valvePin',
  ]) vector2Near(cycleEnd[key], cycleStart[key], 3e-14, `${key} cycle closure`);
  for (const key of [
    'gabLift',
    'gabLiftAcceleration',
    'gabLiftVelocity',
    'handleAngle',
    'handleAngularVelocity',
    'inputAngularAcceleration',
    'inputAngularSpeed',
    'rockerAngle',
  ]) near(cycleEnd[key], cycleStart[key], 3e-13, `${key} cycle closure`);
  disposeModel(model.root);
});

test('movement 186 rendered transforms keep the four bodies, contacts, and moving notch attached in depth', () => {
  const model = createMovementModel(catalog.movements[185]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const {
    camContactMarker,
    camContactNose,
    camLever,
    camPivotPin,
    camSupportAnchor,
    eccentricRod,
    gabCaptureMarker,
    gabCenterAnchor,
    latchMarker,
    notchAAnchor,
    springHandle,
    springHandleAnchor,
    springTipIndex,
    valvePinAnchor,
    valveRocker,
  } = blocks;

  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    vector2Near(worldPoint(gabCenterAnchor), state.gabCenter, 2e-14,
      'rendered gab center');
    vector2Near(worldPoint(valvePinAnchor), state.valvePin, 2e-14,
      'rendered valve pin');
    vector2Near(worldPoint(camContactNose), state.camContactPoint, 3e-14,
      'rendered cam nose');
    vector2Near(worldPoint(camSupportAnchor), state.camSupportCenter, 3e-14,
      'rendered valve-lever cam shoulder');
    vector2Near(worldPoint(notchAAnchor), state.notchA, 3e-14,
      'rendered moving notch a');
    vector2Near(worldPoint(springTipIndex), state.springLatchTip, 3e-14,
      'rendered flexible spring tip');
    vector2Near(worldPoint(springHandleAnchor), state.gabCenter.clone().add(
      model.root.userData.geometry.springHandleAnchorLocal,
    ), 3e-14, 'rendered fixed spring root');
    vector2Near(worldPoint(camPivotPin), state.camPivot, 3e-14,
      'rendered cam pivot');
    near(valveRocker.rotation.z, state.rockerAngle, 2e-15,
      'rendered valve rocker angle');
    near(camLever.rotation.z, state.camAngle, 2e-15,
      'rendered cam handle angle');
    near(worldPoint(notchAAnchor).z, 0.80, 2e-14,
      'notch plate depth');
    near(worldPoint(springTipIndex).z, 0.80 + state.springDeflection, 2e-14,
      'spring tip depth flex');
    assert.equal(camContactMarker.visible, state.camLiftActive);
    assert.equal(gabCaptureMarker.visible, state.gabCaptured);
    assert.equal(latchMarker.visible, state.latchEngagement > 1 - 1e-8);
    assert.equal(springHandle.children.filter((child) => child.visible).length, 48);
    assert.equal(model.root.userData.contacts.camShoulder.active,
      state.camContactActive);
    near(model.root.userData.contacts.gabPin.clearance,
      state.minimumGabSolidClearance, 1e-15, 'rendered gab clearance record');
    near(model.root.userData.contacts.notchA.gap,
      state.latchGap, 1e-15, 'rendered latch gap record');
  }

  model.update(canonicalTimes.engagedRunning);
  assert.equal(gabCaptureMarker.visible, true);
  assert.equal(latchMarker.visible, false);
  model.update(canonicalTimes.latchedDisengaged);
  assert.equal(gabCaptureMarker.visible, false);
  assert.equal(latchMarker.visible, true);
  assert.equal(camContactMarker.visible, false);
  model.update(canonicalTimes.springFlexedForRelease);
  assert.equal(latchMarker.visible, false);
  assert.ok(worldPoint(springTipIndex).z > worldPoint(notchAAnchor).z + 0.13);
  model.update(canonicalTimes.handleHalfLowered);
  assert.equal(camContactMarker.visible, true);

  assert.ok(valveRocker.position.z < eccentricRod.position.z);
  assert.ok(eccentricRod.position.z > worldPoint(camContactNose).z);
  assert.ok(worldPoint(camContactNose).z < worldPoint(notchAAnchor).z);
  disposeModel(model.root);
});

test('movement 186 fills a real 3D envelope and remains distinct from authored 187', () => {
  const model = createMovementModel(catalog.movements[185]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.camLatchTang,
      blocks.camLever,
      blocks.eccentricRod,
      blocks.frame,
      blocks.springHandle,
      blocks.valvePin,
      blocks.valveRocker,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.45);
  assert.ok(size.y > 7.0);
  assert.ok(size.z > 2.30);
  assert.ok(physicalBounds.min.z < -1.07);
  assert.ok(physicalBounds.max.z > blocks.eccentricRod.position.z + .5);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3.1);

  const movement185 = createMovementModel(catalog.movements[184]);
  const movement187 = createMovementModel(catalog.movements[186]);
  const movement188 = createMovementModel(catalog.movements[187]);
  const movement189 = createMovementModel(catalog.movements[188]);
  const movement190 = createMovementModel(catalog.movements[189]);
  assert.equal(movement185.root.userData.fidelity, 'authored');
  assert.equal(movement187.root.userData.fidelity, 'authored');
  assert.equal(movement188.root.userData.fidelity, 'authored');
  assert.equal(movement189.root.userData.fidelity, 'authored');
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement185.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement187.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement188.root.userData.mechanism,
    movement187.root.userData.mechanism,
  );
  assert.notEqual(
    movement189.root.userData.mechanism,
    movement188.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.mechanism,
    movement189.root.userData.mechanism,
  );
  disposeModel(movement185.root);
  disposeModel(movement187.root);
  disposeModel(movement188.root);
  disposeModel(movement189.root);
  disposeModel(movement190.root);
  disposeModel(model.root);
});
