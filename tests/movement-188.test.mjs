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

test('movement 188 matches Brown\'s loop-handle direct-pin cam and separate leaf-spring latch topology', () => {
  const movement = catalog.movements[187];
  const model = createMovementModel(movement);
  const {
    blocks,
    camLawAtHandleAngle,
    camProfileAtHandleAngle,
    canonicalStates,
    geometry,
    inputMotionAtCyclePhase,
    leafSpringPointsAtConfiguration,
    loopGripLocalAtHandleAngle,
    notchALocalAtHandleAngle,
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
    camLobe,
    camPivotPin,
    camWorkingEdge,
    eccentricRod,
    frame,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    handleStem,
    latchMarker,
    leafSpring,
    leafSpringAnchor,
    leafSpringTipIndex,
    loopCamHandle,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    relievedCamMarker,
    valveGear,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
  } = blocks;

  assert.equal(movement.id, 188);
  assert.equal(movement.number, '188');
  assert.equal(movement.title, 'Loop-Handle Pin-Cam Gab Disengaging Gear');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.description, '187 and 188. Modifications of 186.');
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_188.html');
  assert.equal(
    movement.archetype,
    'loop-handle-direct-pin-conjugate-cam-leaf-spring-notch-gab-release',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'rod-pivoted-loop-handle-conjugate-cam-lifts-gab-directly-from-valve-pin-then-leaf-spring-latches-notch-a-on-relieved-overtravel',
  );
  for (const fn of [
    camLawAtHandleAngle,
    camProfileAtHandleAngle,
    inputMotionAtCyclePhase,
    leafSpringPointsAtConfiguration,
    loopGripLocalAtHandleAngle,
    notchALocalAtHandleAngle,
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
    camLobe,
    camPivotPin,
    camWorkingEdge,
    eccentricRod,
    frame,
    gabCaptureMarker,
    gabCenterAnchor,
    gabCrownArch,
    gabTopBridge,
    handleStem,
    latchMarker,
    leafSpring,
    leafSpringAnchor,
    leafSpringTipIndex,
    loopCamHandle,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    relievedCamMarker,
    valveGear,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
  ]) assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  assert.equal(gabJaws.length, 2);
  assert.equal(gabContactShoes.length, 2);

  // The plate contains three distinct working bodies: valve pin, rod/gab,
  // and one rigid loop/cam. The leaf spring is fixed to the rod, not welded
  // to the moving loop, and notch a travels with that loop.
  assert.equal(valveGear.parent, model.root);
  assert.equal(eccentricRod.parent, model.root);
  assert.ok(frame.parent === null && model.root.userData.sourcePresentation.removedRoles.includes(frame.userData.role),
    'source presentation removes the undrawn frame');
  assert.equal(valvePin.parent, valveGear);
  assert.equal(loopCamHandle.parent, eccentricRod);
  assert.equal(camLobe.parent, loopCamHandle);
  assert.equal(camWorkingEdge.parent, loopCamHandle);
  assert.equal(loopHandleBody.parent, loopCamHandle);
  assert.equal(handleStem.parent, loopCamHandle);
  assert.equal(notchAAnchor.parent, loopCamHandle);
  assert.equal(notchLipLower.parent, loopCamHandle);
  assert.equal(notchLipUpper.parent, loopCamHandle);
  assert.equal(leafSpring.parent, eccentricRod);
  assert.equal(leafSpringAnchor.parent, eccentricRod);
  assert.notEqual(leafSpring.parent, loopCamHandle);

  const forbidden = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (
      object.userData.mechanismBelt
        || object.userData.selectorBelt
        || /(?:belt|remote-cam-support|two-handle)/i.test(role)
    ) forbidden.push(role || object.type);
  });
  assert.deepEqual(forbidden, []);
  assert.equal(blocks.camSupportShoe, undefined);
  assert.equal(blocks.upperHandleGrip, undefined);
  assert.equal(blocks.lowerHandleGrip, undefined);

  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceUnitsPerPixel, 0.017, 0, 'source scale');
  assert.deepEqual(geometry.sourceRasterGabPin.toArray(), [394, 326]);
  assert.deepEqual(geometry.sourceRasterCamPivot.toArray(), [287, 290]);
  assert.deepEqual(geometry.sourceRasterLoopGrip.toArray(), [35, 112]);
  assert.deepEqual(geometry.sourceRasterNotchA.toArray(), [224, 174]);
  assert.deepEqual(geometry.sourceRasterLeafAnchor.toArray(), [117, 288]);
  assert.deepEqual(geometry.sourceRasterLeafFreeTip.toArray(), [207, 232]);
  assert.deepEqual(geometry.sourceRasterCamBackCrown.toArray(), [361, 239]);
  assert.deepEqual(geometry.sourceRasterRodLeftEnd.toArray(), [15, 319]);
  assert.deepEqual(geometry.sourceRasterRodRightEnd.toArray(), [510, 326]);
  for (const rasterPoint of [
    geometry.sourceRasterGabPin,
    geometry.sourceRasterCamPivot,
    geometry.sourceRasterLoopGrip,
    geometry.sourceRasterNotchA,
    geometry.sourceRasterLeafAnchor,
    geometry.sourceRasterLeafFreeTip,
    geometry.sourceRasterCamBackCrown,
    geometry.sourceRasterRodLeftEnd,
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
  vector2Near(source.gabCenter, new THREE.Vector2(0, 0), 1e-15,
    'source gab center');
  vector2Near(source.valvePin, new THREE.Vector2(0, 0), 1e-15,
    'source valve pin');
  vector2Near(source.camPivot, sourcePointFromRaster(
    geometry.sourceRasterCamPivot,
  ), 1e-15, 'source cam pivot');
  vector2Near(source.loopGrip, sourcePointFromRaster(
    geometry.sourceRasterLoopGrip,
  ), 2e-15, 'source loop grip');
  vector2Near(source.notchA, sourcePointFromRaster(
    geometry.sourceRasterNotchA,
  ), 2e-15, 'source notch a');
  vector2Near(source.leafSpringPointsLocal[0], sourcePointFromRaster(
    geometry.sourceRasterLeafAnchor,
  ), 2e-15, 'source fixed leaf-spring root');
  vector2Near(source.leafSpringTip, sourcePointFromRaster(
    geometry.sourceRasterLeafFreeTip,
  ), 2e-15, 'source leaf-spring free tip');
  vector2Near(geometry.camBackCrownLocal.clone().add(geometry.camPivotLocal),
    sourcePointFromRaster(geometry.sourceRasterCamBackCrown), 2e-15,
    'source visible cam crown');
  vector2Near(geometry.rodLeftEndLocal, sourcePointFromRaster(
    geometry.sourceRasterRodLeftEnd,
  ), 2e-15, 'source rod left end');
  vector2Near(geometry.rodRightEndLocal, sourcePointFromRaster(
    geometry.sourceRasterRodRightEnd,
  ), 2e-15, 'source rod right end');
  assert.equal(source.gabCaptured, true);
  assert.equal(source.pinInsideGabMouth, true);
  assert.equal(source.pinFullyClearBelowGab, false);
  near(source.minimumGabSolidClearance, 0.05, 2e-15,
    'source gab running clearance');
  near(source.camPinIntendedGap, 0, 2e-15,
    'source hidden cam rests directly on the valve pin');
  assert.ok(source.camProfileMinimumGap >= -1e-14);
  near(source.latchGap,
    sourcePointFromRaster(geometry.sourceRasterLeafFreeTip).distanceTo(
      sourcePointFromRaster(geometry.sourceRasterNotchA),
    ), 2e-15, 'source spring-to-notch gap');

  const full = canonicalStates.fullyLiftedAndLatched;
  assert.ok(geometry.maximumGabLift > geometry.fullClearCouplingEnd);
  near(full.gabLift, geometry.maximumGabLift, 1e-15, 'full cam lift');
  near(full.camProfileRelief, geometry.maximumCamRelief, 1e-15,
    'full overtravel relief');
  near(full.latchGap, 0, 2e-15, 'leaf spring closes into notch a');
  assert.ok(full.loopGrip.x < source.loopGrip.x);
  assert.ok(full.loopGrip.y < source.loopGrip.y - 2.7,
    'the loop swings down toward the rod-mounted leaf spring');
  disposeModel(model.root);
});

test('movement 188 conjugate cam stays tangent while working and clears the pin after relieved overtravel', () => {
  const model = createMovementModel(catalog.movements[187]);
  const {
    camProfileAtHandleAngle,
    canonicalStates,
    geometry,
    stateAtConfiguration,
  } = model.root.userData;
  let minimumGabClearance = Infinity;

  for (let handleIndex = 0; handleIndex <= 256; handleIndex += 1) {
    const handleFraction = handleIndex / 256;
    const handleAngle = geometry.maximumHandleAngle * handleFraction;
    const cam = camProfileAtHandleAngle(handleAngle);
    const state = stateAtConfiguration({
      handleFraction,
      inputAngle: 0,
      latchEngagement: handleIndex === 256 ? 1 : 0,
    });
    finiteStateNumbers(state);
    near(cam.pitchTangentLocal.length(), 1, 2e-15,
      'unit conjugate pitch tangent');
    near(cam.profileNormalLocal.length(), 1, 2e-15,
      'unit conjugate profile normal');
    near(cam.pitchTangentLocal.dot(cam.profileNormalLocal), 0, 2e-15,
      'roller normal is perpendicular to the pitch curve');
    near(state.camPinIntendedGap, cam.relief, 2e-14,
      'cam profile supplies exactly its designed relief');
    assert.ok(state.camProfileMinimumGap >= -2e-14,
      'no other part of the cam profile penetrates the valve pin');
    if (handleAngle <= geometry.workingCamEndAngle + 1e-14) {
      near(state.camPinIntendedGap, 0, 2e-14,
        'working cam remains tangent to the round pin');
      assert.ok(state.camProfileMinimumGap <= 2e-5,
        'sampled visible profile includes the active contact');
    }
    minimumGabClearance = Math.min(
      minimumGabClearance,
      state.minimumGabSolidClearance,
    );
    if (state.couplingBlend < 1 - 1e-12) {
      assert.equal(state.pinFullyClearBelowGab, true,
        'coupling falls only after the pin is below both gab jaws');
    }
  }
  near(minimumGabClearance, 0.05, 3e-14,
    'stopped handle sweep minimum gab clearance');

  // Sweep more than 33,000 handle/input combinations for finite geometry and
  // the release-before-decoupling invariant. Intermediate handle positions
  // are operated only at alignment; cam collision is checked on that valid
  // path above and at both running endpoints below.
  for (let handleIndex = 0; handleIndex <= 128; handleIndex += 1) {
    const handleFraction = handleIndex / 128;
    for (let inputIndex = 0; inputIndex < 256; inputIndex += 1) {
      const state = stateAtConfiguration({
        handleFraction,
        inputAngle: FULL_TURN * inputIndex / 256,
        latchEngagement: handleIndex === 128 ? 1 : 0,
      });
      finiteStateNumbers(state);
      assert.ok(state.minimumGabSolidClearance >= 0.05 - 3e-14);
      if (state.couplingBlend < 1 - 1e-12) {
        assert.equal(state.pinFullyClearBelowGab, true);
      }
    }
  }

  let minimumReleasedCamGap = Infinity;
  for (let inputIndex = 0; inputIndex < 512; inputIndex += 1) {
    const inputAngle = FULL_TURN * inputIndex / 512;
    const engaged = stateAtConfiguration({
      handleFraction: 0,
      inputAngle,
    });
    const released = stateAtConfiguration({
      handleFraction: 1,
      inputAngle,
      latchEngagement: 1,
    });
    assert.equal(engaged.gabCaptured, true);
    assert.equal(engaged.pinInsideGabMouth, true);
    near(engaged.valvePin.x, engaged.gabCenter.x, 2e-15,
      'engaged gab drives the pin laterally');
    near(engaged.camProfileMinimumGap, 0, 2e-14,
      'resting cam travels with the engaged pin');
    assert.equal(released.pinFullyClearBelowGab, true);
    near(released.couplingBlend, 0, 0, 'released coupling');
    vector2Near(released.valvePin, new THREE.Vector2(0, 0), 1e-15,
      'released valve pin remains stationary');
    near(released.latchGap, 0, 4e-15, 'latched spring capture');
    minimumReleasedCamGap = Math.min(
      minimumReleasedCamGap,
      released.camProfileMinimumGap,
    );
  }
  assert.ok(minimumReleasedCamGap > 0.164,
    'relieved cam clears the stationary pin over the full rod stroke');

  const working = canonicalStates.workingCamAtFullLift;
  const latched = canonicalStates.fullyLiftedAndLatched;
  near(working.gabLift, geometry.maximumGabLift, 1e-15,
    'working cam reaches full lift before overtravel');
  near(working.camProfileRelief, 0, 0, 'working contact has no relief');
  near(working.camPinIntendedGap, 0, 1e-15, 'working contact closes');
  near(latched.gabLift, working.gabLift, 0,
    'overtravel does not change the lifted gab height');
  near(latched.camProfileRelief, geometry.maximumCamRelief, 1e-15,
    'latched handle reaches full cam relief');
  disposeModel(model.root);
});

test('movement 188 stops for cam operation, runs while latched, and crosses every event with C2 laws', () => {
  const model = createMovementModel(catalog.movements[187]);
  const {
    geometry,
    inputMotionAtCyclePhase,
    sequenceAtCyclePhase,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  const { cyclePeriod, sequenceBreaks, workingHandleFraction } = geometry;

  const checkpoints = [
    [0, 'engaged-eccentric-rod-driving-valve-pin', 0, 0, 0],
    [sequenceBreaks.engagedRunEnd,
      'eccentric-stopped-with-direct-cam-aligned-to-pin', 2, 0, 0],
    [sequenceBreaks.handleLiftStart,
      'loop-handle-cam-lifting-gab-directly-from-pin', 2, 0, 0],
    [0.28, 'loop-handle-cam-lifting-gab-directly-from-pin', 2,
      workingHandleFraction / 2, 0],
    [sequenceBreaks.camLiftEnd,
      'loop-handle-overtravel-leaf-spring-passing-notch-a', 2,
      workingHandleFraction, 0],
    [0.37, 'loop-handle-overtravel-leaf-spring-passing-notch-a', 2,
      (workingHandleFraction + 1) / 2, 0.5],
    [sequenceBreaks.handleLatchEnd,
      'leaf-spring-latched-gab-clear-while-eccentric-rod-runs', 2, 1, 1],
    [0.52, 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs', 3, 1, 1],
    [sequenceBreaks.latchedRunEnd,
      'leaf-spring-flexing-out-of-notch-a', 4, 1, 1],
    [0.67, 'leaf-spring-flexing-out-of-notch-a', 4, 1, 0.5],
    [sequenceBreaks.springReleaseEnd,
      'loop-handle-returning-through-relieved-cam-overtravel', 4, 1, 0],
    [0.73, 'loop-handle-returning-through-relieved-cam-overtravel', 4,
      (workingHandleFraction + 1) / 2, 0],
    [sequenceBreaks.reliefReturnEnd,
      'direct-pin-cam-lowering-gab-to-recapture', 4,
      workingHandleFraction, 0],
    [0.82, 'direct-pin-cam-lowering-gab-to-recapture', 4,
      workingHandleFraction / 2, 0],
    [sequenceBreaks.camLowerEnd,
      'gab-recaptured-eccentric-rod-driving-valve-pin', 4, 0, 0],
  ];
  for (const [phase, stage, turns, handleFraction, latchEngagement] of checkpoints) {
    const state = stateAtCyclePhase(phase);
    assert.equal(state.stage, stage);
    near(state.inputTurns, turns, 3e-14, `input turns at ${phase}`);
    near(state.handleFraction, handleFraction, 3e-14,
      `handle fraction at ${phase}`);
    near(state.latchEngagement, latchEngagement, 3e-14,
      `latch engagement at ${phase}`);
  }

  near(stateAtCyclePhase(0.20).inputAngularSpeed, 0, 0,
    'shaft stops before cam lift');
  near(stateAtCyclePhase(0.28).inputAngularSpeed, 0, 0,
    'shaft stops during direct pin lift');
  near(stateAtCyclePhase(0.37).inputAngularSpeed, 0, 0,
    'shaft stops during latch overtravel');
  near(stateAtCyclePhase(0.67).inputAngularSpeed, 0, 0,
    'shaft stops while releasing the leaf spring');
  near(stateAtCyclePhase(0.73).inputAngularSpeed, 0, 0,
    'shaft stops while relief closes');
  near(stateAtCyclePhase(0.82).inputAngularSpeed, 0, 0,
    'shaft stops while the cam lowers the gab');
  assert.ok(stateAtCyclePhase(0.09).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.46).inputAngularSpeed > 0);
  assert.ok(stateAtCyclePhase(0.94).inputAngularSpeed > 0);
  near(stateAtCyclePhase(0.37).springDeflection,
    -geometry.springMaximumDeflection, 3e-15,
    'leaf spring flexes behind the passing notch lip');
  near(stateAtCyclePhase(0.67).springDeflection,
    geometry.springMaximumDeflection, 3e-15,
    'leaf spring flexes out of notch a for release');

  let previousTurns = 0;
  let observedReleasedRodMotion = false;
  for (let index = 0; index < 32768; index += 1) {
    const state = stateAtCyclePhase(index / 32768);
    finiteStateNumbers(state);
    assert.ok(state.inputTurns >= previousTurns - 2e-13,
      'input progress is monotone through the demonstration');
    previousTurns = state.inputTurns;
    assert.ok(state.minimumGabSolidClearance >= 0.05 - 4e-13);
    assert.ok(state.camProfileMinimumGap >= -4e-13,
      'the direct cam never penetrates its valve-pin follower');
    if (state.couplingBlend < 1 - 1e-12) {
      assert.equal(state.pinFullyClearBelowGab, true);
    }
    if (state.camContactActive) {
      near(state.inputAngularSpeed, 0, 6e-13,
        'direct pin cam operates only at stopped alignment');
      near(state.camPinIntendedGap, 0, 3e-13,
        'active conjugate cam remains tangent to the valve pin');
    }
    if (state.latchEngagement >= 1 - 1e-12) {
      assert.equal(state.pinFullyClearBelowGab, true);
      near(state.latchGap, 0, 4e-12, 'leaf spring captured in notch a');
    }
    if (
      state.stage
        === 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs'
        && state.inputAngularSpeed > 1e-8
    ) {
      observedReleasedRodMotion = true;
      near(state.couplingBlend, 0, 2e-14, 'latched gab remains released');
      vector2Near(state.valvePin, new THREE.Vector2(0, 0), 2e-14,
        'released valve pin remains stopped');
      assert.ok(state.camProfileMinimumGap > 0.164,
        'relieved cam clears the stopped pin during rod motion');
    }
  }
  assert.equal(observedReleasedRodMotion, true);
  assert.ok(previousTurns > 5.9999999996);

  for (const phase of [
    0,
    sequenceBreaks.engagedRunEnd,
    sequenceBreaks.handleLatchEnd,
    sequenceBreaks.latchedRunEnd,
    sequenceBreaks.camLowerEnd,
    1,
  ]) {
    const input = inputMotionAtCyclePhase(phase);
    near(input.ratePerPhase, 0, 5e-13, `input rate at ${phase}`);
    near(input.accelerationPerPhaseSquared, 0, 2e-11,
      `input acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.handleLiftStart,
    sequenceBreaks.camLiftEnd,
    sequenceBreaks.handleLatchEnd,
    sequenceBreaks.springReleaseEnd,
    sequenceBreaks.reliefReturnEnd,
    sequenceBreaks.camLowerEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.handleRatePerPhase, 0, 5e-13,
      `handle rate at ${phase}`);
    near(sequence.handleAccelerationPerPhaseSquared, 0, 2e-11,
      `handle acceleration at ${phase}`);
  }
  for (const phase of [
    sequenceBreaks.camLiftEnd,
    sequenceBreaks.handleLatchEnd,
    sequenceBreaks.latchedRunEnd,
    sequenceBreaks.springReleaseEnd,
  ]) {
    const sequence = sequenceAtCyclePhase(phase);
    near(sequence.latchRatePerPhase, 0, 5e-13,
      `latch rate at ${phase}`);
    near(sequence.latchAccelerationPerPhaseSquared, 0, 2e-11,
      `latch acceleration at ${phase}`);
    near(sequence.springDeflectionRatePerPhase, 0, 5e-13,
      `leaf-spring flex rate at ${phase}`);
  }

  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(cyclePeriod);
  for (const key of [
    'camPivot',
    'camProfilePoint',
    'gabCenter',
    'leafSpringTip',
    'loopGrip',
    'notchA',
    'valvePin',
  ]) vector2Near(cycleEnd[key], cycleStart[key], 4e-14, `${key} cycle closure`);
  for (const key of [
    'camProfileRelief',
    'gabLift',
    'gabLiftAcceleration',
    'gabLiftVelocity',
    'handleAngle',
    'handleAngularVelocity',
    'inputAngularAcceleration',
    'inputAngularSpeed',
  ]) near(cycleEnd[key], cycleStart[key], 4e-13, `${key} cycle closure`);
  disposeModel(model.root);
});

test('movement 188 rendered transforms keep the pin, rod, rigid loop, cam, and leaf spring on their own depth layers', () => {
  const model = createMovementModel(catalog.movements[187]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const {
    camContactMarker,
    camLobe,
    camPivotPin,
    eccentricRod,
    gabCaptureMarker,
    gabCenterAnchor,
    latchMarker,
    leafSpring,
    leafSpringAnchor,
    leafSpringTipIndex,
    loopCamHandle,
    loopGripAnchor,
    notchAAnchor,
    relievedCamMarker,
    valveGear,
    valvePinAnchor,
  } = blocks;

  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    vector2Near(worldPoint(gabCenterAnchor), state.gabCenter, 3e-14,
      'rendered gab center');
    vector2Near(worldPoint(valvePinAnchor), state.valvePin, 3e-14,
      'rendered valve pin');
    vector2Near(worldPoint(camPivotPin), state.camPivot, 3e-14,
      'rendered rod-mounted loop/cam pivot');
    vector2Near(worldPoint(loopGripAnchor), state.loopGrip, 4e-14,
      'rendered rigid loop grip');
    vector2Near(worldPoint(notchAAnchor), state.notchA, 4e-14,
      'rendered moving notch a');
    vector2Near(worldPoint(leafSpringAnchor), state.gabCenter.clone().add(
      model.root.userData.geometry.leafAnchorLocal,
    ), 4e-14, 'rendered fixed leaf-spring root');
    vector2Near(worldPoint(leafSpringTipIndex), state.leafSpringTip, 4e-14,
      'rendered flexible leaf-spring tip');
    near(loopCamHandle.rotation.z, state.handleAngle, 2e-15,
      'rendered loop/cam handle angle');
    assert.equal(camContactMarker.visible, state.camContactActive);
    assert.equal(gabCaptureMarker.visible, state.gabCaptured);
    assert.equal(latchMarker.visible, state.latchEngagement > 1 - 1e-8);
    assert.equal(relievedCamMarker.visible, state.camRelievedForRodMotion);
    assert.equal(leafSpring.children.filter((child) => child.visible).length, 48);
    assert.equal(model.root.userData.contacts.camPin.active,
      state.camContactActive);
    near(model.root.userData.contacts.camPin.minimumProfileGap,
      state.camProfileMinimumGap, 1e-15, 'rendered cam clearance record');
    near(model.root.userData.contacts.gabPin.clearance,
      state.minimumGabSolidClearance, 1e-15, 'rendered gab clearance record');
    near(model.root.userData.contacts.notchA.gap,
      state.latchGap, 1e-15, 'rendered spring-latch gap record');
  }

  model.update(canonicalTimes.sourceEngaged);
  assert.equal(gabCaptureMarker.visible, true);
  assert.equal(latchMarker.visible, false);
  assert.equal(relievedCamMarker.visible, false);
  model.update(canonicalTimes.camHalfLift);
  assert.equal(camContactMarker.visible, true);
  assert.equal(gabCaptureMarker.visible, false);
  model.update(canonicalTimes.latchedReleasedPositiveStroke);
  assert.equal(camContactMarker.visible, false);
  assert.equal(gabCaptureMarker.visible, false);
  assert.equal(latchMarker.visible, true);
  assert.equal(relievedCamMarker.visible, true);
  model.update(canonicalTimes.leafFlexedForRelease);
  model.root.updateMatrixWorld(true);
  assert.equal(latchMarker.visible, false);
  assert.ok(worldPoint(leafSpringTipIndex).z > worldPoint(notchAAnchor).z + 0.13);
  model.update(canonicalTimes.camHalfLowered);
  assert.equal(camContactMarker.visible, true);

  model.update(canonicalTimes.latchedReleasedPositiveStroke);
  model.root.updateMatrixWorld(true);
  assert.ok(valveGear.position.z < eccentricRod.position.z);
  assert.ok(eccentricRod.position.z < worldPoint(camLobe).z);
  assert.ok(worldPoint(camLobe).z < worldPoint(notchAAnchor).z);
  near(worldPoint(notchAAnchor).z, worldPoint(leafSpringTipIndex).z, 3e-14,
    'latched leaf tip and notch occupy the same working plane');
  disposeModel(model.root);
});

test('movement 188 fills a real 3D envelope and remains distinct from authored 189', () => {
  const model = createMovementModel(catalog.movements[187]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.eccentricRod,
      blocks.frame,
      blocks.leafSpring,
      blocks.loopCamHandle,
      blocks.valveGear,
      blocks.valvePin,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 10.10);
  assert.ok(size.y > 5.90);
  assert.ok(size.z > 2.44);
  assert.ok(physicalBounds.min.z < -1.11);
  assert.ok(physicalBounds.max.z > 1.32);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3.6);

  const movement187 = createMovementModel(catalog.movements[186]);
  const movement189 = createMovementModel(catalog.movements[188]);
  const movement190 = createMovementModel(catalog.movements[189]);
  assert.equal(movement187.root.userData.fidelity, 'authored');
  assert.equal(movement189.root.userData.fidelity, 'authored');
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement187.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement189.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.mechanism,
    movement189.root.userData.mechanism,
  );
  disposeModel(movement187.root);
  disposeModel(movement189.root);
  disposeModel(movement190.root);
  disposeModel(model.root);
});
