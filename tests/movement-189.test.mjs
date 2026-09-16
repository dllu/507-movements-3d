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
    } else if (object.material) {
      materials.add(object.material);
    }
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

test('movement 189 matches Brown\'s fixed operating lever, short crank, hanger, and gab-rod topology', () => {
  const movement = catalog.movements[188];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    inputMotionAtCyclePhase,
    nominalEngagedPoseAtInputAngle,
    rodPoseAtConfiguration,
    sequenceAtCyclePhase,
    sourcePointFromRaster,
    sourceRasterFromPoint,
    stateAtConfiguration,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    cameraEnvelope,
    crankPin,
    crankPinAnchor,
    eccentricJointAnchor,
    eccentricRod,
    frame,
    fullClearMarker,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    hangerLink,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
    operatingLever,
    operatingPivotAnchor,
    operatingPivotPin,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  } = blocks;

  assert.equal(movement.id, 189);
  assert.equal(movement.number, '189');
  assert.equal(
    movement.title,
    'Bell-Crank Hanger Gab Disengaging Gear',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.description, '189. Another modification of 186.');
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_189.html');
  assert.equal(
    movement.archetype,
    'bell-crank-hanger-lifted-eccentric-rod-gab-pin-release',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'fixed-pivot-operating-handle-short-crank-and-finite-hanger-rock-the-eccentric-rod-to-lift-its-gab-from-the-valve-pin',
  );
  for (const fn of [
    inputMotionAtCyclePhase,
    nominalEngagedPoseAtInputAngle,
    rodPoseAtConfiguration,
    sequenceAtCyclePhase,
    sourcePointFromRaster,
    sourceRasterFromPoint,
    stateAtConfiguration,
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  ]) assert.equal(typeof fn, 'function');

  for (const object of [
    cameraEnvelope,
    crankPin,
    crankPinAnchor,
    eccentricJointAnchor,
    eccentricRod,
    frame,
    fullClearMarker,
    gabCaptureMarker,
    gabCenterAnchor,
    gabCrownArch,
    gabTopBridge,
    hangerLink,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
    operatingLever,
    operatingPivotAnchor,
    operatingPivotPin,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  ]) assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  assert.equal(gabJaws.length, 2);
  assert.equal(gabContactShoes.length, 2);

  // The handle stem and short crank are one rigid bell crank. The finite
  // hanger is a separate pin-jointed link, and its lower pin belongs to the
  // rigid eccentric rod rather than to the fixed frame or valve lever.
  assert.equal(valveRocker.parent, model.root);
  assert.equal(eccentricRod.parent, model.root);
  assert.equal(operatingLever.parent, model.root);
  assert.equal(hangerLink.parent, model.root);
  assert.equal(frame.parent, model.root);
  assert.equal(valvePin.parent, valveRocker);
  assert.equal(operatingHandleStem.parent, operatingLever);
  assert.equal(operatingCrankArm.parent, operatingLever);
  assert.equal(crankPin.parent, operatingLever);
  assert.equal(crankPinAnchor.parent, operatingLever);
  assert.equal(operatingHandleTopAnchor.parent, operatingLever);
  assert.equal(rodHangerPin.parent, eccentricRod);
  assert.equal(rodHangerPinAnchor.parent, eccentricRod);
  assert.equal(eccentricJointAnchor.parent, eccentricRod);
  assert.notEqual(hangerLink.parent, operatingLever);
  assert.notEqual(hangerLink.parent, eccentricRod);
  assert.equal(operatingPivotPin.parent, model.root);

  const forbidden = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (
      object.userData.mechanismBelt
        || object.userData.selectorBelt
        || /(?:spring|latch|notch|pulley|tooth)/i.test(role)
        || (/(?:^|-)cam(?:-|$)/i.test(role) && !/camera/i.test(role))
    ) forbidden.push(role || object.type);
  });
  assert.deepEqual(forbidden, []);
  assert.equal(blocks.camLobe, undefined);
  assert.equal(blocks.leafSpring, undefined);
  assert.equal(blocks.notchAAnchor, undefined);

  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceUnitsPerPixel, 0.016, 0, 'source scale');
  assert.deepEqual(geometry.sourceRasterGabPin.toArray(), [342, 406]);
  assert.deepEqual(geometry.sourceRasterValvePivot.toArray(), [327, 282]);
  assert.deepEqual(
    geometry.sourceRasterOperatingPivot.toArray(),
    [401, 235],
  );
  assert.deepEqual(geometry.sourceRasterCrankPin.toArray(), [471, 235]);
  assert.deepEqual(
    geometry.sourceRasterRodHangerPin.toArray(),
    [470, 404],
  );
  assert.deepEqual(
    geometry.sourceRasterOperatingHandleTop.toArray(),
    [400, 28],
  );
  assert.deepEqual(
    geometry.sourceRasterEccentricJoint.toArray(),
    [15, 399],
  );
  assert.deepEqual(geometry.sourceRasterRodRightEnd.toArray(), [511, 407]);
  for (const rasterPoint of [
    geometry.sourceRasterGabPin,
    geometry.sourceRasterValvePivot,
    geometry.sourceRasterOperatingPivot,
    geometry.sourceRasterCrankPin,
    geometry.sourceRasterRodHangerPin,
    geometry.sourceRasterOperatingHandleTop,
    geometry.sourceRasterEccentricJoint,
    geometry.sourceRasterRodRightEnd,
  ]) {
    vector2Near(
      sourceRasterFromPoint(sourcePointFromRaster(rasterPoint)),
      rasterPoint,
      3e-13,
      'source raster round trip',
    );
  }

  const source = canonicalStates.sourceEngaged;
  vector2Near(source.gabCenter, new THREE.Vector2(0, 0), 2e-15,
    'source gab center');
  vector2Near(source.valvePin, new THREE.Vector2(0, 0), 2e-15,
    'source valve pin');
  vector2Near(source.valvePivot, sourcePointFromRaster(
    geometry.sourceRasterValvePivot,
  ), 2e-15, 'source valve pivot');
  vector2Near(source.crankPin, sourcePointFromRaster(
    geometry.sourceRasterCrankPin,
  ), 3e-15, 'source short-crank pin');
  vector2Near(source.rodHangerPin, sourcePointFromRaster(
    geometry.sourceRasterRodHangerPin,
  ), 3e-15, 'source rod hanger pin');
  vector2Near(source.eccentricJoint, sourcePointFromRaster(
    geometry.sourceRasterEccentricJoint,
  ), 3e-15, 'source remote eccentric connection');
  vector2Near(source.operatingHandleTop, sourcePointFromRaster(
    geometry.sourceRasterOperatingHandleTop,
  ), 3e-15, 'source operating-handle top');
  vector2Near(source.rodRightEnd, sourcePointFromRaster(
    geometry.sourceRasterRodRightEnd,
  ), 3e-15, 'source rod tail');
  near(source.rodAngle, 0, 2e-15, 'source rigid rod angle');
  near(source.operatingAngle, 0, 0, 'source operating angle');
  near(source.minimumGabSolidClearance, 0.03, 3e-15,
    'source gab running clearance');
  assert.equal(source.gabCaptured, true);
  assert.equal(source.pinInsideGabMouth, true);
  assert.equal(source.pinFullyClearBelowGab, false);
  assert.ok(
    geometry.minimumFullyRaisedGabLift > geometry.fullClearCouplingEnd,
  );
  disposeModel(model.root);
});

test('movement 189 closes the exact four-bar, clears the pin before released running, and preserves every rigid length', () => {
  const model = createMovementModel(catalog.movements[188]);
  const { canonicalStates, geometry, stateAtConfiguration } =
    model.root.userData;
  let minimumGabSolidClearance = Infinity;
  let minimumRaisedGabLift = Infinity;
  let minimumFullClearMargin = Infinity;
  let maximumClosureError = 0;
  let releasedMinimumX = Infinity;
  let releasedMaximumX = -Infinity;

  // More than 33,000 independent input/handle configurations exercise both
  // circle intersections and the entire lifting branch, not only the poses
  // used by the demonstration timeline.
  for (let handleIndex = 0; handleIndex <= 128; handleIndex += 1) {
    const handleFraction = handleIndex / 128;
    for (let inputIndex = 0; inputIndex < 256; inputIndex += 1) {
      const state = stateAtConfiguration({
        handleFraction,
        inputAngle: FULL_TURN * inputIndex / 256,
      });
      finiteStateNumbers(state);
      maximumClosureError = Math.max(
        maximumClosureError,
        state.crankLengthError,
        state.hangerLengthError,
        state.eccentricToHangerLengthError,
        state.eccentricToGabLengthError,
        state.gabToHangerLengthError,
        state.valvePinRadiusError,
      );
      minimumGabSolidClearance = Math.min(
        minimumGabSolidClearance,
        state.minimumGabSolidClearance,
      );
      assert.ok(
        state.rodHangerPin.y < state.crankPin.y - 1.55,
        'the finite hanger remains on Brown\'s lower assembly branch',
      );
      if (handleIndex === 0) {
        assert.equal(state.gabCaptured, true);
        assert.equal(state.pinInsideGabMouth, true);
        vector2Near(state.gabCenter, state.valvePin, 7e-15,
          'engaged gab drives the valve pin');
      }
      if (handleIndex === 128) {
        assert.equal(state.pinFullyClearBelowGab, true);
        near(state.couplingBlend, 0, 0, 'fully raised coupling');
        vector2Near(state.valvePin, new THREE.Vector2(0, 0), 2e-15,
          'released valve pin remains stopped');
        minimumRaisedGabLift = Math.min(
          minimumRaisedGabLift,
          state.gabLift,
        );
        minimumFullClearMargin = Math.min(
          minimumFullClearMargin,
          -geometry.gabMouthDepth
            - (state.pinRelativeToGab.y + geometry.gabPinRadius),
        );
        releasedMinimumX = Math.min(releasedMinimumX, state.gabCenter.x);
        releasedMaximumX = Math.max(releasedMaximumX, state.gabCenter.x);
      }
    }
  }
  assert.ok(maximumClosureError < 5e-14,
    'all four-bar and rigid-body lengths close to floating-point precision');
  near(minimumGabSolidClearance, 0.03, 4e-14,
    'minimum solid clearance occurs in the captured source pose');
  near(minimumRaisedGabLift, geometry.minimumFullyRaisedGabLift, 2e-13,
    'runtime raised-lift audit agrees with construction audit');
  assert.ok(minimumRaisedGabLift > geometry.fullClearCouplingEnd + 0.06);
  assert.ok(minimumFullClearMargin > 0.12,
    'both gab jaws remain above the stationary pin over the released stroke');
  assert.ok(releasedMaximumX - releasedMinimumX > 0.44,
    'the eccentric rod continues its longitudinal stroke while released');

  const source = canonicalStates.sourceEngaged;
  const raisedPositive = canonicalStates.fullyRaisedAtPositiveStroke;
  const raisedNegative = canonicalStates.fullyRaisedAtNegativeStroke;
  assert.ok(raisedPositive.operatingHandleTop.x < source.operatingHandleTop.x);
  assert.ok(raisedPositive.operatingHandleTop.y < source.operatingHandleTop.y,
    'pulling the source handle left rocks its top downward');
  assert.ok(raisedPositive.gabCenter.x > raisedNegative.gabCenter.x + 0.45);
  vector2Near(raisedPositive.valvePin, raisedNegative.valvePin, 2e-15,
    'released valve lever remains stationary across the rod stroke');
  disposeModel(model.root);
});

test('movement 189 stops for lever operation, runs engaged and released, and crosses every event with C2 laws', () => {
  const model = createMovementModel(catalog.movements[188]);
  const {
    geometry,
    inputMotionAtCyclePhase,
    sequenceAtCyclePhase,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  const { cyclePeriod, sequenceBreaks } = geometry;
  const checkpoints = [
    [0, 'engaged-eccentric-rod-driving-valve-gear', 0, 0],
    [sequenceBreaks.engagedRunEnd,
      'eccentric-stopped-at-gab-release-alignment', 2, 0],
    [sequenceBreaks.handleLiftStart,
      'operating-lever-and-hanger-lifting-gab', 2, 0],
    [0.29, 'operating-lever-and-hanger-lifting-gab', 2, 0.5],
    [sequenceBreaks.handleLiftEnd,
      'operator-holding-gab-clear-while-eccentric-runs', 2, 1],
    [0.50, 'operator-holding-gab-clear-while-eccentric-runs', 3, 1],
    [sequenceBreaks.releasedRunEnd,
      'eccentric-stopped-with-gab-held-clear', 4, 1],
    [sequenceBreaks.handleLowerStart,
      'operating-lever-lowering-gab-to-recapture-pin', 4, 1],
    [0.75, 'operating-lever-lowering-gab-to-recapture-pin', 4, 0.5],
    [sequenceBreaks.handleLowerEnd,
      'gab-recaptured-eccentric-rod-driving-valve-gear', 4, 0],
  ];
  for (const [phase, stage, turns, handleFraction] of checkpoints) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.stage, stage);
    near(state.inputTurns, turns, 4e-14, `input turns at ${phase}`);
    near(state.handleFraction, handleFraction, 4e-14,
      `handle fraction at ${phase}`);
  }

  for (const phase of [0.20, 0.29, 0.66, 0.75]) {
    near(stateAtCyclePhase(phase).inputAngularSpeed, 0, 0,
      `eccentric stopped for lever operation at ${phase}`);
  }
  assert.ok(stateAtCyclePhase(0.09).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.50).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.91).inputAngularSpeed > 0);

  let previousTurns = 0;
  let observedReleasedRodMotion = false;
  let releasedMinimumX = Infinity;
  let releasedMaximumX = -Infinity;
  for (let index = 0; index < 32768; index += 1) {
    const state = stateAtCyclePhase(index / 32768);
    finiteStateNumbers(state);
    assert.ok(state.inputTurns >= previousTurns - 2e-13,
      'input progress is monotone through the demonstration');
    previousTurns = state.inputTurns;
    assert.ok(state.minimumGabSolidClearance >= 0.03 - 5e-13);
    assert.ok(state.crankLengthError < 2e-13);
    assert.ok(state.hangerLengthError < 2e-13);
    assert.ok(state.eccentricToHangerLengthError < 2e-13);
    assert.ok(state.eccentricToGabLengthError < 2e-13);
    assert.ok(state.gabToHangerLengthError < 2e-13);
    if (
      state.stage === 'operating-lever-and-hanger-lifting-gab'
        || state.stage
          === 'operating-lever-lowering-gab-to-recapture-pin'
    ) {
      near(state.inputAngularSpeed, 0, 8e-13,
        'the four-bar is operated only at stopped alignment');
    }
    if (
      state.stage === 'operator-holding-gab-clear-while-eccentric-runs'
        && state.inputAngularSpeed > 1e-8
    ) {
      observedReleasedRodMotion = true;
      assert.equal(state.pinFullyClearBelowGab, true);
      near(state.couplingBlend, 0, 0, 'released coupling remains open');
      vector2Near(state.valvePin, new THREE.Vector2(0, 0), 2e-14,
        'released valve pin remains stopped');
      releasedMinimumX = Math.min(releasedMinimumX, state.gabCenter.x);
      releasedMaximumX = Math.max(releasedMaximumX, state.gabCenter.x);
    }
  }
  assert.equal(observedReleasedRodMotion, true);
  assert.ok(releasedMaximumX - releasedMinimumX > 0.44);
  assert.ok(previousTurns > 5.9999999996);

  for (const phase of [
    0,
    sequenceBreaks.engagedRunEnd,
    sequenceBreaks.handleLiftEnd,
    sequenceBreaks.releasedRunEnd,
    sequenceBreaks.handleLowerEnd,
    1,
  ]) {
    const input = inputMotionAtCyclePhase(phase);
    near(input.ratePerPhase, 0, 6e-13, `input rate at ${phase}`);
    near(input.accelerationPerPhaseSquared, 0, 3e-11,
      `input acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.handleLiftStart,
    sequenceBreaks.handleLiftEnd,
    sequenceBreaks.handleLowerStart,
    sequenceBreaks.handleLowerEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.handleRatePerPhase, 0, 6e-13,
      `handle rate at ${phase}`);
    near(sequence.handleAccelerationPerPhaseSquared, 0, 3e-11,
      `handle acceleration at ${phase}`);
  }

  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(cyclePeriod);
  for (const key of [
    'crankPin',
    'eccentricJoint',
    'gabCenter',
    'operatingHandleTop',
    'rodHangerPin',
    'rodRightEnd',
    'valvePin',
  ]) vector2Near(cycleEnd[key], cycleStart[key], 5e-14, `${key} cycle closure`);
  for (const key of [
    'gabLift',
    'handleAngularVelocity',
    'inputAngularAcceleration',
    'inputAngularSpeed',
    'operatingAngle',
    'rockerAngle',
    'rodAngle',
  ]) near(cycleEnd[key], cycleStart[key], 5e-13, `${key} cycle closure`);
  disposeModel(model.root);
});

test('movement 189 rendered transforms keep the valve lever, rod, bell crank, and hanger on their own pin-connected depth layers', () => {
  const model = createMovementModel(catalog.movements[188]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const {
    cameraEnvelope,
    crankPinAnchor,
    eccentricJointAnchor,
    eccentricRod,
    fullClearMarker,
    gabCaptureMarker,
    gabCenterAnchor,
    hangerLink,
    operatingHandleTopAnchor,
    operatingLever,
    operatingPivotAnchor,
    rodHangerPinAnchor,
    valvePinAnchor,
    valveRocker,
  } = blocks;
  const hangerLength = model.root.userData.geometry.hangerLength;

  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    vector2Near(worldPoint(gabCenterAnchor), state.gabCenter, 4e-14,
      'rendered gab center');
    vector2Near(worldPoint(valvePinAnchor), state.valvePin, 4e-14,
      'rendered valve pin');
    vector2Near(worldPoint(crankPinAnchor), state.crankPin, 4e-14,
      'rendered short-crank pin');
    vector2Near(worldPoint(rodHangerPinAnchor), state.rodHangerPin, 5e-14,
      'rendered rod hanger pin');
    vector2Near(worldPoint(eccentricJointAnchor), state.eccentricJoint, 5e-14,
      'rendered remote eccentric joint');
    vector2Near(worldPoint(operatingHandleTopAnchor),
      state.operatingHandleTop, 5e-14, 'rendered operating-handle top');
    vector2Near(worldPoint(operatingPivotAnchor),
      model.root.userData.geometry.operatingPivot, 2e-15,
      'rendered fixed operating pivot');
    vector2Near(new THREE.Vector3().applyMatrix4(hangerLink.matrixWorld), state.crankPin, 4e-14,
      'rendered hanger upper joint');
    vector2Near(new THREE.Vector3(hangerLength, 0, 0).applyMatrix4(hangerLink.matrixWorld), state.rodHangerPin, 5e-14,
      'rendered hanger lower joint');
    near(operatingLever.rotation.z, state.operatingAngle, 2e-15,
      'rendered operating angle');
    near(eccentricRod.rotation.z, state.rodAngle, 2e-15,
      'rendered rigid rod angle');
    assert.equal(gabCaptureMarker.visible, state.gabCaptured);
    assert.equal(fullClearMarker.visible, state.pinFullyClearBelowGab);
    near(model.root.userData.contacts.gabPin.clearance,
      state.minimumGabSolidClearance, 1e-15, 'rendered gab clearance record');
    near(model.root.userData.contacts.hanger.lengthError,
      state.hangerLengthError, 1e-15, 'rendered hanger closure record');
  }

  model.update(canonicalTimes.sourceEngaged);
  assert.equal(gabCaptureMarker.visible, true);
  assert.equal(fullClearMarker.visible, false);
  model.update(canonicalTimes.handleHalfRaised);
  assert.equal(gabCaptureMarker.visible, false);
  model.update(canonicalTimes.heldClearPositiveStroke);
  assert.equal(gabCaptureMarker.visible, false);
  assert.equal(fullClearMarker.visible, true);

  model.update(canonicalTimes.heldClearPositiveStroke);
  model.root.updateMatrixWorld(true);
  assert.ok(valveRocker.position.z < eccentricRod.position.z);
  assert.ok(eccentricRod.position.z < operatingLever.position.z);
  assert.ok(operatingLever.position.z < new THREE.Vector3().applyMatrix4(hangerLink.matrixWorld).z);
  near(new THREE.Vector3().applyMatrix4(hangerLink.matrixWorld).z, new THREE.Vector3(hangerLength, 0, 0).applyMatrix4(hangerLink.matrixWorld).z, 1e-15,
    'both hanger pins share one working plane');
  assert.equal(cameraEnvelope.material.colorWrite, false);
  assert.equal(cameraEnvelope.castShadow, false);
  assert.equal(cameraEnvelope.receiveShadow, false);
  disposeModel(model.root);
});

test('movement 189 fills a real 3D envelope and remains distinct from authored 190', () => {
  const model = createMovementModel(catalog.movements[188]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.eccentricRod,
      blocks.frame,
      blocks.hangerLink,
      blocks.operatingLever,
      blocks.operatingPivotPin,
      blocks.valvePin,
      blocks.valveRocker,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.85);
  assert.ok(size.y > 7.10);
  assert.ok(size.z > 2.25);
  assert.ok(physicalBounds.min.z < -1.00);
  assert.ok(physicalBounds.max.z > 1.25);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3.4);

  const movement188 = createMovementModel(catalog.movements[187]);
  const movement190 = createMovementModel(catalog.movements[189]);
  assert.equal(movement188.root.userData.fidelity, 'authored');
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement188.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  disposeModel(movement188.root);
  disposeModel(movement190.root);
  disposeModel(model.root);
});
