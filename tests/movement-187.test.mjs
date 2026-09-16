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

test('movement 187 matches Brown\'s rigid-lower-grip and pivoted-upper-cam topology', () => {
  const movement = catalog.movements[186];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    handleLiftAtAngle,
    inputMotionAtCyclePhase,
    nominalRockerAngleAtInput,
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
    camContactMarker,
    camContactNose,
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
    heldClearMarker,
    lowerGripAnchor,
    lowerHandle,
    lowerHandleGrip,
    upperCamBody,
    upperCamHandle,
    upperGripAnchor,
    upperHandleGrip,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  } = blocks;

  assert.equal(movement.id, 187);
  assert.equal(movement.number, '187');
  assert.equal(movement.title, 'Two-Handle Cam-Lift Gab Disengaging Gear');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.description, '187 and 188. Modifications of 186.');
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_187.html');
  assert.equal(
    movement.archetype,
    'two-handle-cam-lifted-eccentric-rod-gab-pin-release',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'rod-integral-lower-grip-and-pivoted-upper-cam-handle-lift-downward-opening-gab-off-valve-pin',
  );
  for (const fn of [
    handleLiftAtAngle,
    inputMotionAtCyclePhase,
    nominalRockerAngleAtInput,
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
    camContactMarker,
    camContactNose,
    camPivotPin,
    camSupportAnchor,
    camSupportShoe,
    eccentricRod,
    frame,
    gabCaptureMarker,
    gabCenterAnchor,
    gabTopBridge,
    heldClearMarker,
    lowerGripAnchor,
    lowerHandle,
    lowerHandleGrip,
    upperCamBody,
    upperCamHandle,
    upperGripAnchor,
    upperHandleGrip,
    valveArm,
    valvePin,
    valvePinAnchor,
    valveRocker,
    valveShaft,
  ]) assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  assert.equal(gabJaws.length, 2);
  assert.equal(gabContactShoes.length, 2);

  // The key distinction from 186 is structural, not cosmetic: the lower
  // handle is rigidly part of the rod, the upper cam is the only moving
  // handle, and there is no spring or notch latch.
  assert.equal(valveRocker.parent, model.root);
  assert.equal(eccentricRod.parent, model.root);
  assert.equal(frame.parent, model.root);
  assert.equal(valvePin.parent, valveRocker);
  assert.equal(camSupportShoe.parent, valveRocker);
  assert.equal(lowerHandle.parent, eccentricRod);
  assert.equal(lowerHandleGrip.parent, eccentricRod);
  assert.equal(lowerGripAnchor.parent, eccentricRod);
  assert.equal(upperCamHandle.parent, eccentricRod);
  assert.equal(camPivotPin.parent, eccentricRod);
  assert.equal(camContactNose.parent, upperCamHandle);
  assert.equal(upperHandleGrip.parent, upperCamHandle);
  assert.notEqual(lowerHandle, upperCamHandle);

  const forbidden = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (
      object.userData.mechanismBelt
        || object.userData.selectorBelt
        || /(?:spring|notch|latch|belt)/i.test(role)
    ) forbidden.push(role || object.type);
  });
  assert.deepEqual(forbidden, []);

  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceUnitsPerPixel, 0.018, 0, 'source scale');
  assert.deepEqual(geometry.sourceRasterGabPin.toArray(), [313, 242]);
  assert.deepEqual(geometry.sourceRasterValvePivot.toArray(), [313, 111]);
  assert.deepEqual(geometry.sourceRasterCamContact.toArray(), [283, 175]);
  assert.deepEqual(geometry.sourceRasterCamPivot.toArray(), [320, 198]);
  assert.deepEqual(geometry.sourceRasterUpperGrip.toArray(), [474, 195]);
  assert.deepEqual(geometry.sourceRasterLowerGrip.toArray(), [474, 245]);
  assert.deepEqual(geometry.sourceRasterRodLeftEnd.toArray(), [15, 242]);
  assert.deepEqual(geometry.sourceRasterSupportLeft.toArray(), [258, 175]);
  assert.deepEqual(geometry.sourceRasterSupportRight.toArray(), [370, 175]);
  for (const rasterPoint of [
    geometry.sourceRasterGabPin,
    geometry.sourceRasterValvePivot,
    geometry.sourceRasterCamContact,
    geometry.sourceRasterCamPivot,
    geometry.sourceRasterUpperGrip,
    geometry.sourceRasterLowerGrip,
    geometry.sourceRasterRodLeftEnd,
    geometry.sourceRasterSupportLeft,
    geometry.sourceRasterSupportRight,
  ]) {
    vector2Near(
      sourceRasterFromPoint(sourcePointFromRaster(rasterPoint)),
      rasterPoint,
      3e-13,
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
  vector2Near(source.upperGrip, sourcePointFromRaster(
    geometry.sourceRasterUpperGrip,
  ), 2e-15, 'source upper grip');
  vector2Near(source.lowerGrip, sourcePointFromRaster(
    geometry.sourceRasterLowerGrip,
  ), 2e-15, 'source lower grip');
  vector2Near(geometry.rodLeftEndLocal, sourcePointFromRaster(
    geometry.sourceRasterRodLeftEnd,
  ), 2e-15, 'source eccentric-rod left end');
  near(source.camContactError, 0, 0, 'source cam contact closes');
  assert.equal(source.camContactWithinSupport, true);
  assert.equal(source.gabCaptured, true);
  assert.equal(source.pinInsideGabMouth, true);
  assert.equal(source.pinFullyClearBelowGab, false);
  near(source.minimumGabSolidClearance, 0.05, 2e-15,
    'source gab running clearance');
  assert.ok(geometry.maximumGabLift > geometry.fullClearCouplingEnd);
  near(handleLiftAtAngle(0), 0, 0, 'zero-angle cam lift');
  near(
    handleLiftAtAngle(geometry.maximumHandleAngle),
    geometry.maximumGabLift,
    1e-15,
    'full-angle cam lift',
  );
  assert.ok(canonicalStates.fullyLiftedStopped.upperGrip.y > source.upperGrip.y,
    'the moving upper handle is raised, never squeezed downward');
  disposeModel(model.root);
});

test('movement 187 preserves gab clearance and exact cam support over the full configuration envelope', () => {
  const model = createMovementModel(catalog.movements[186]);
  const { canonicalStates, geometry, stateAtConfiguration } = model.root.userData;
  let minimumSolidClearance = Infinity;
  let previousLift = -Infinity;

  for (let handleIndex = 0; handleIndex <= 128; handleIndex += 1) {
    const handleFraction = handleIndex / 128;
    const stopped = stateAtConfiguration({ handleFraction, inputAngle: 0 });
    assert.ok(stopped.gabLift >= previousLift - 2e-15,
      'cam lift is monotone while the upper handle rises');
    previousLift = stopped.gabLift;
    near(stopped.camContactError, 0, 9e-16,
      'cam remains on the stopped valve-lever support line');
    assert.equal(stopped.camContactWithinSupport, true);

    for (let inputIndex = 0; inputIndex < 256; inputIndex += 1) {
      const inputAngle = FULL_TURN * inputIndex / 256;
      const state = stateAtConfiguration({ handleFraction, inputAngle });
      finiteStateNumbers(state);
      minimumSolidClearance = Math.min(
        minimumSolidClearance,
        state.minimumGabSolidClearance,
      );
      assert.ok(state.minimumGabSolidClearance >= 0.05 - 3e-14,
        'round valve pin never intersects either jaw or the gab crown');
      near(state.valvePinRadiusError, 0, 1.5e-15,
        'valve pin remains on its finite rocker arm');
      assert.ok(state.couplingBlend >= 0 && state.couplingBlend <= 1);
      if (state.couplingBlend < 1 - 1e-12) {
        assert.equal(state.pinFullyClearBelowGab, true,
          'decoupling begins only once the round pin is below both jaws');
      }

      if (handleIndex === 0) {
        assert.equal(state.gabCaptured, true);
        assert.equal(state.pinInsideGabMouth, true);
        near(state.couplingBlend, 1, 0, 'engaged coupling');
        near(state.lateralDriveError, 0, 1.6e-15,
          'engaged rod and valve pin have exact lateral drive alignment');
      }
      if (handleIndex === 128) {
        assert.equal(state.pinFullyClearBelowGab, true);
        near(state.couplingBlend, 0, 0, 'fully released coupling');
        near(state.rockerAngle, 0, 0, 'released valve lever remains stopped');
        near(state.camContactError, 0, 8e-16,
          'held cam slides on the fixed horizontal support');
        assert.equal(state.camContactWithinSupport, true);
      }
    }
  }
  near(minimumSolidClearance, 0.05, 3e-14,
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
  });
  const releasedNegative = stateAtConfiguration({
    handleFraction: 1,
    inputAngle: 3 * Math.PI / 2,
  });
  near(engagedPositive.rockerAngle,
    Math.asin(geometry.rodStroke / geometry.valveArmLength), 1e-15,
    'engaged positive valve throw');
  near(engagedNegative.rockerAngle,
    -Math.asin(geometry.rodStroke / geometry.valveArmLength), 1e-15,
    'engaged negative valve throw');
  near(releasedPositive.rockerAngle, 0, 0, 'released positive valve stop');
  near(releasedNegative.rockerAngle, 0, 0, 'released negative valve stop');
  near(releasedPositive.gabCenter.x - releasedNegative.gabCenter.x,
    geometry.rodStroke * 2, 1e-15,
    'the eccentric rod keeps its full stroke while held disengaged');
  vector2Near(releasedPositive.valvePin, releasedNegative.valvePin, 1e-15,
    'disengaged valve pin remains stationary');
  assert.ok(
    releasedPositive.upperGrip.distanceTo(releasedPositive.lowerGrip)
      > engagedPositive.upperGrip.distanceTo(engagedPositive.lowerGrip) + 1.8,
    'upper and lower handles visibly open as the cam lifts the gab',
  );
  assert.equal(canonicalStates.fullyLiftedAtPositiveStroke.pinFullyClearBelowGab,
    true);
  disposeModel(model.root);
});

test('movement 187 stops for lift and recapture, runs while held clear, and crosses each event with C2 laws', () => {
  const model = createMovementModel(catalog.movements[186]);
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
      'eccentric-stopped-with-gab-pin-aligned', 2, 0],
    [sequenceBreaks.handleRaiseStart,
      'raising-upper-cam-handle-lifting-gab', 2, 0],
    [0.32, 'raising-upper-cam-handle-lifting-gab', 2, 0.5],
    [sequenceBreaks.handleRaiseEnd,
      'operator-holding-two-handle-gab-clear-while-rod-runs', 2, 1],
    [0.53, 'operator-holding-two-handle-gab-clear-while-rod-runs', 3, 1],
    [sequenceBreaks.releasedRunEnd,
      'eccentric-stopped-with-gab-held-clear', 4, 1],
    [sequenceBreaks.handleLowerStart,
      'lowering-upper-cam-handle-recapturing-pin', 4, 1],
    [0.77, 'lowering-upper-cam-handle-recapturing-pin', 4, 0.5],
    [sequenceBreaks.handleLowerEnd,
      'gab-recaptured-eccentric-rod-driving-valve-gear', 4, 0],
  ];
  for (const [phase, stage, turns, handleFraction] of checkpoints) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.stage, stage);
    near(state.inputTurns, turns, 2e-14, `input turns at ${phase}`);
    near(state.handleFraction, handleFraction, 2e-14,
      `handle fraction at ${phase}`);
  }

  near(stateAtCyclePhase(0.22).inputAngularSpeed, 0, 0,
    'shaft is stopped before the upper handle is raised');
  near(stateAtCyclePhase(0.32).inputAngularSpeed, 0, 0,
    'shaft is stopped while the gab is lifted');
  near(stateAtCyclePhase(0.68).inputAngularSpeed, 0, 0,
    'shaft is stopped before the gab is lowered');
  near(stateAtCyclePhase(0.77).inputAngularSpeed, 0, 0,
    'shaft is stopped while the pin is recaptured');
  assert.ok(stateAtCyclePhase(0.10).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.465).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.92).inputAngularSpeed > 0);
  const releasedMoving = stateAtCyclePhase(0.465);
  near(releasedMoving.couplingBlend, 0, 0, 'moving rod is fully released');
  near(releasedMoving.rockerAngle, 0, 0, 'released valve remains stopped');
  near(releasedMoving.camContactError, 0, 1e-15,
    'operator-held cam slides exactly along its support');
  assert.equal(releasedMoving.camContactWithinSupport, true);
  assert.equal(releasedMoving.operatorHoldingHandle, true);

  let previousTurns = 0;
  let observedReleasedRodMotion = false;
  for (let index = 0; index < 32768; index += 1) {
    const phase = index / 32768;
    const state = stateAtCyclePhase(phase);
    finiteStateNumbers(state);
    assert.ok(state.inputTurns >= previousTurns - 2e-13,
      'input progress is monotone through the demonstration');
    previousTurns = state.inputTurns;
    assert.ok(state.minimumGabSolidClearance >= 0.05 - 4e-13);
    if (state.couplingBlend < 1 - 1e-12) {
      assert.equal(state.pinFullyClearBelowGab, true);
    }
    if (state.camLiftActive) {
      near(state.camContactError, 0, 3e-13,
        'active cam remains on the valve-lever shoe');
      assert.equal(state.camContactWithinSupport, true);
    }
    if (
      state.stage
        === 'operator-holding-two-handle-gab-clear-while-rod-runs'
        && state.inputAngularSpeed > 1e-8
    ) {
      observedReleasedRodMotion = true;
      near(state.couplingBlend, 0, 2e-14, 'held gab remains released');
      near(state.rockerAngle, 0, 2e-14, 'valve remains stopped');
    }
  }
  assert.equal(observedReleasedRodMotion, true);
  assert.ok(previousTurns > 5.9999999998);

  for (const phase of [
    0,
    sequenceBreaks.engagedRunEnd,
    sequenceBreaks.handleRaiseEnd,
    sequenceBreaks.releasedRunEnd,
    sequenceBreaks.handleLowerEnd,
    1,
  ]) {
    const input = inputMotionAtCyclePhase(phase);
    near(input.ratePerPhase, 0, 5e-13, `input rate at ${phase}`);
    near(input.accelerationPerPhaseSquared, 0, 2e-11,
      `input acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.handleRaiseStart,
    sequenceBreaks.handleRaiseEnd,
    sequenceBreaks.handleLowerStart,
    sequenceBreaks.handleLowerEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.handleRatePerPhase, 0, 5e-13,
      `handle rate at ${phase}`);
    near(sequence.handleAccelerationPerPhaseSquared, 0, 2e-11,
      `handle acceleration at ${phase}`);
  }

  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(cyclePeriod);
  for (const key of [
    'camContactPoint',
    'gabCenter',
    'lowerGrip',
    'upperGrip',
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

test('movement 187 rendered transforms keep the rigid lower grip and moving upper cam on distinct depth layers', () => {
  const model = createMovementModel(catalog.movements[186]);
  const { blocks, canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const {
    camContactMarker,
    camContactNose,
    camPivotPin,
    camSupportAnchor,
    eccentricRod,
    gabCaptureMarker,
    gabCenterAnchor,
    heldClearMarker,
    lowerGripAnchor,
    lowerHandle,
    upperCamHandle,
    upperGripAnchor,
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
      'rendered upper cam nose');
    vector2Near(worldPoint(camSupportAnchor), state.camSupportCenter, 3e-14,
      'rendered valve-lever support center');
    vector2Near(worldPoint(camPivotPin), state.camPivot, 3e-14,
      'rendered rod-mounted cam pivot');
    vector2Near(worldPoint(lowerGripAnchor), state.lowerGrip, 3e-14,
      'rendered integral lower grip');
    vector2Near(worldPoint(upperGripAnchor), state.upperGrip, 3e-14,
      'rendered independently moving upper grip');
    near(valveRocker.rotation.z, state.rockerAngle, 2e-15,
      'rendered valve rocker angle');
    near(upperCamHandle.rotation.z, state.camAngle, 2e-15,
      'rendered upper cam-handle angle');
    assert.equal(camContactMarker.visible, state.camLiftActive);
    assert.equal(gabCaptureMarker.visible, state.gabCaptured);
    assert.equal(heldClearMarker.visible, state.operatorHoldingHandle);
    assert.equal(model.root.userData.contacts.camShoulder.active,
      state.camContactActive);
    assert.equal(model.root.userData.contacts.camShoulder.withinSupport,
      state.camContactWithinSupport);
    near(model.root.userData.contacts.gabPin.clearance,
      state.minimumGabSolidClearance, 1e-15, 'rendered gab clearance record');
    assert.equal(model.root.userData.contacts.twoHandleOperator.holding,
      state.operatorHoldingHandle);
  }

  model.update(canonicalTimes.sourceEngaged);
  assert.equal(gabCaptureMarker.visible, true);
  assert.equal(heldClearMarker.visible, false);
  model.update(canonicalTimes.handleHalfRaised);
  assert.equal(camContactMarker.visible, true);
  assert.equal(gabCaptureMarker.visible, false);
  model.update(canonicalTimes.heldClearPositiveStroke);
  assert.equal(camContactMarker.visible, true);
  assert.equal(heldClearMarker.visible, true);
  assert.equal(gabCaptureMarker.visible, false);
  model.update(canonicalTimes.handleHalfLowered);
  assert.equal(camContactMarker.visible, true);
  assert.equal(heldClearMarker.visible, false);

  model.update(canonicalTimes.heldClearStopped);
  model.root.updateMatrixWorld(true);
  assert.ok(valveRocker.position.z < eccentricRod.position.z);
  assert.ok(worldPoint(lowerHandle).z > worldPoint(camContactNose).z);
  assert.ok(worldPoint(camContactNose).z > worldPoint(camSupportAnchor).z);
  assert.ok(worldPoint(camContactNose).z - worldPoint(camSupportAnchor).z < 0.32,
    'cam and shoe occupy adjacent overlapping contact layers');
  near(worldPoint(heldClearMarker).y,
    model.root.userData.kinematics.gabCenter.y - geometry.gabMouthDepth,
    2e-14, 'clearance marker follows the open gab mouth');
  disposeModel(model.root);
});

test('movement 187 fills a real 3D envelope and remains distinct from authored 188', () => {
  const model = createMovementModel(catalog.movements[186]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.eccentricRod,
      blocks.frame,
      blocks.upperCamHandle,
      blocks.valvePin,
      blocks.valveRocker,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.95);
  assert.ok(size.y > 5.15);
  assert.ok(size.z > 2.40);
  assert.ok(physicalBounds.min.z < -1.17);
  assert.ok(physicalBounds.max.z > blocks.eccentricRod.position.z + .5);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3.4);

  const movement186 = createMovementModel(catalog.movements[185]);
  const movement188 = createMovementModel(catalog.movements[187]);
  const movement189 = createMovementModel(catalog.movements[188]);
  const movement190 = createMovementModel(catalog.movements[189]);
  assert.equal(movement186.root.userData.fidelity, 'authored');
  assert.equal(movement188.root.userData.fidelity, 'authored');
  assert.equal(movement189.root.userData.fidelity, 'authored');
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement186.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement188.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement189.root.userData.mechanism,
    movement188.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.mechanism,
    movement189.root.userData.mechanism,
  );
  disposeModel(movement186.root);
  disposeModel(movement188.root);
  disposeModel(movement189.root);
  disposeModel(movement190.root);
  disposeModel(model.root);
});
