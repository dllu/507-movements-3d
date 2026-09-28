import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

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

test('movement 370 contains the opposite-ended hand crank, guided long bar, rigid mirror-ratchet, shaft eccentric, and oscillating click', () => {
  const movement = catalog.movements[369];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 370);
  assert.equal(movement.number, '370');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'crank-guided-sliding-oscillating-bar-eccentric-click-mirror-ratchet',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-hand-crank/);
  assert.match(data.mechanism, /simultaneous-bar-slide-and-oscillation/);
  assert.match(data.mechanism, /eccentric-oscillates-a-click/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /continuous hand-crank angle/);
  assert.match(degreesOfFreedom.note, /one-way ratchet indexing/);

  for (const component of [
    blocks.upperRail,
    blocks.lowerRail,
    blocks.crankBearing,
    blocks.inputRotor,
    blocks.longBar,
    blocks.eccentricFollower,
    ...blocks.guidePins,
    ...blocks.railFasteners,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.barBody,
    blocks.upperEye,
    blocks.upperEyeBore,
    blocks.mirrorRotor,
    blocks.clickCarrier,
  ]) assert.equal(component.parent, blocks.longBar);
  for (const component of [
    blocks.mirrorBacking,
    blocks.mirrorFace,
    blocks.ratchetWheel,
    blocks.mirrorAxle,
    blocks.mirrorIndex,
  ]) assert.equal(component.parent, blocks.mirrorRotor);
  for (const component of [
    blocks.carrierArm,
    blocks.carrierPivot,
    blocks.pawlSlide,
  ]) assert.equal(component.parent, blocks.clickCarrier);
  for (const component of [
    blocks.pawlBody,
    blocks.pawlTip,
    blocks.contactMarker,
  ]) assert.equal(component.parent, blocks.pawlSlide);
  for (const component of [
    blocks.crankPinBoss,
    blocks.handleArm,
    blocks.handle,
    blocks.handleKnob,
    blocks.eccentricDisk,
    blocks.shaftIndex,
  ]) assert.equal(component.parent, blocks.inputRotor);
  assert.equal(blocks.ratchetWheel.userData.toothCount,
    geometry.ratchetToothCount);
  assert.equal(blocks.ratchetWheel.userData.toothPitch,
    geometry.ratchetToothPitch);

  const roles = [];
  const beltObjects = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) beltObjects.push(object);
  });
  for (const role of [
    'crankpin-through-long-bar-upper-eye',
    'free-turning-hand-handle',
    'off-center-disk-eccentric-on-common-crankshaft',
    'long-bar-with-longitudinal-and-oscillating-motion',
    'one-of-two-fixed-lower-rail-bar-guide-pins',
    'square-polishing-mirror-face',
    'ratchet-wheel-rigidly-secured-to-square-mirror',
    'eccentric-oscillated-click-carrier-about-ratchet-axis',
    'click-tip-engaging-one-ratchet-tooth',
    'sliding-follower-transmitting-crankshaft-eccentric-to-click-carrier',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(beltObjects.length, 0);
  disposeModel(model.root);
});

test('movement 370 records every link in Brown\'s compound-motion caption, unavailable animation, and measured engraving', () => {
  const movement = catalog.movements[369];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate370;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_370.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /polishing mirrors/);
  assert.match(movement.description, /handle turns the crank/);
  assert.match(movement.description, /mirror is secured rigidly to the ratchet-wheel/);
  assert.match(movement.description, /guided by pins in the lower rail/);
  assert.match(movement.description, /longitudinal and an oscillating movement/);
  assert.match(movement.description, /click operated by an eccentric/);
  assert.match(movement.description, /compound movement/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesDimensionsTimingClearanceOrPolishingLoad,
    false);
  assert.match(data.dynamics.treatment, /no dimensions/);
  assert.match(data.dynamics.treatment, /ratchet tooth count/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.longBarTopEye.toArray(), [218, 51]);
  assert.deepEqual(plate.crankShaftCenter.toArray(), [251, 136]);
  assert.deepEqual(plate.crankHandlePin.toArray(), [296, 235]);
  assert.deepEqual(plate.mirrorRatchetCenter.toArray(), [274, 376]);
  assert.deepEqual(plate.leftGuidePin.toArray(), [247, 480]);
  assert.deepEqual(plate.rightGuidePin.toArray(), [342, 473]);
  assert.deepEqual(plate.upperRailLeft.toArray(), [39, 92]);
  assert.deepEqual(plate.upperRailRight.toArray(), [397, 92]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence, /upper eye on one side/);
  assert.match(evidence.engravingEvidence, /opposite crank arm/);
  assert.match(evidence.engravingEvidence, /two lower-rail guide pins/);
  assert.match(evidence.engravingEvidence, /dotted hidden click\/eccentric/);
  assert.match(evidence.reconstructionDisclosure, /twelve-tooth ratchet/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 370 crankpin and fixed lower guide determine an exact polar slider with positive pin clearance and both bar motions', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let minimumGuideClearance = Infinity;
  let minimumSlide = Infinity;
  let maximumSlide = -Infinity;
  let minimumBarAngle = Infinity;
  let maximumBarAngle = -Infinity;

  for (let sample = 0; sample <= 1800; sample += 1) {
    const state = stateAtTime(
      geometry.inputCyclePeriod * 3 * sample / 1800,
    );
    const expectedPin = geometry.crankCenter.clone().add(new THREE.Vector3(
      geometry.crankRadius * Math.cos(state.inputPoseAngle),
      geometry.crankRadius * Math.sin(state.inputPoseAngle),
      geometry.barPlaneZ,
    ));
    vectorNear(state.crankPin, expectedPin, 0, 'crankpin circle');
    near(
      Math.hypot(
        state.crankPin.x - geometry.crankCenter.x,
        state.crankPin.y - geometry.crankCenter.y,
      ),
      geometry.crankRadius,
      4e-16,
      'crank radius',
    );
    near(state.barUpDirection.length(), 1, 4e-16,
      'unit bar direction');
    near(state.barLocalXDirection.length(), 1, 4e-16,
      'unit bar transverse direction');
    near(state.barUpDirection.dot(state.barLocalXDirection), 0, 0,
      'orthogonal bar basis');
    const reconstructedGuide = state.crankPin.clone().addScaledVector(
      state.barUpDirection,
      -state.guideCoordinateFromTopEye,
    );
    vectorNear(reconstructedGuide, geometry.guidePoint, 1.4e-15,
      'bar centerline passes fixed guide');
    vectorNear(
      new THREE.Vector3(
        -Math.sin(state.barWorldAngle),
        Math.cos(state.barWorldAngle),
        0,
      ),
      state.barUpDirection,
      3e-16,
      'bar render angle maps local vertical to centerline',
    );
    minimumGuideClearance = Math.min(
      minimumGuideClearance,
      state.guideSideClearance,
    );
    minimumSlide = Math.min(minimumSlide,
      state.guideCoordinateFromTopEye);
    maximumSlide = Math.max(maximumSlide,
      state.guideCoordinateFromTopEye);
    minimumBarAngle = Math.min(minimumBarAngle, state.barWorldAngle);
    maximumBarAngle = Math.max(maximumBarAngle, state.barWorldAngle);
  }
  assert.ok(minimumGuideClearance > 0.042);
  assert.ok(maximumSlide - minimumSlide > 1.43);
  assert.ok(maximumBarAngle - minimumBarAngle > 0.36);

  const h = 1e-5;
  for (const phase of [0.08, 0.22, 0.41, 0.68, 0.87]) {
    const time = geometry.inputCyclePeriod * phase;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    near(
      (after.guideCoordinateFromTopEye
        - before.guideCoordinateFromTopEye) / (2 * h),
      state.barLongitudinalSpeed,
      5e-10,
      'analytic longitudinal slide speed',
    );
    near(
      (after.barWorldAngle - before.barWorldAngle) / (2 * h),
      state.barAngularSpeed,
      1.5e-10,
      'analytic bar oscillation speed',
    );
  }
  assert.match(data.transmission.barConstraintLaw,
    /fixed lower-guide midpoint/);
  assert.match(data.transmission.barMotionLaw,
    /longitudinal slide coordinate/);
  disposeModel(model.root);
});

test('movement 370 mirror remains at one rigid station on the bar while its center motion and ratchet-relative rotation combine', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let centerTravel = 0;
  let previousCenter = null;
  let sawBarOnlyAngularMotion = false;
  let sawCombinedAngularMotion = false;

  for (let sample = 0; sample <= 1400; sample += 1) {
    const time = geometry.inputCyclePeriod * 2 * sample / 1400;
    const state = stateAtTime(time);
    const expectedCenter = state.crankPin.clone().addScaledVector(
      state.barUpDirection,
      -geometry.mirrorDistanceFromTopEye,
    );
    expectedCenter.z = geometry.barPlaneZ + geometry.mirrorRotorZ;
    vectorNear(state.mirrorCenter, expectedCenter, 0,
      'rigid mirror station on bar');
    near(
      Math.hypot(
        state.mirrorCenter.x - state.crankPin.x,
        state.mirrorCenter.y - state.crankPin.y,
      ),
      geometry.mirrorDistanceFromTopEye,
      9e-16,
      'fixed top-eye-to-mirror distance',
    );
    near(state.mirrorWorldAngle,
      state.barWorldAngle + state.ratchetAngle, 0,
      'compound mirror orientation');
    near(state.mirrorWorldAngularSpeed,
      state.barAngularSpeed + state.ratchetAngularSpeed, 0,
      'compound mirror angular speed');
    near(
      Math.hypot(
        state.mirrorIndexPoint.x - state.mirrorCenter.x,
        state.mirrorIndexPoint.y - state.mirrorCenter.y,
      ),
      geometry.mirrorSize * 0.34,
      1e-15,
      'rigid asymmetric mirror index radius',
    );
    if (previousCenter !== null) {
      centerTravel += state.mirrorCenter.distanceTo(previousCenter);
    }
    previousCenter = state.mirrorCenter;
    if (state.phase > 0.55 && state.phase < 0.95
      && state.ratchetAngularSpeed === 0
      && Math.abs(state.barAngularSpeed) > 0.02) {
      sawBarOnlyAngularMotion = true;
    }
    if (state.phase > 0.10 && state.phase < 0.40
      && state.ratchetAngularSpeed * geometry.clickHand > 0
      && Math.abs(state.barAngularSpeed) > 0.02) {
      sawCombinedAngularMotion = true;
    }
  }
  assert.ok(centerTravel > 6.0);
  assert.equal(sawBarOnlyAngularMotion, true);
  assert.equal(sawCombinedAngularMotion, true);

  const h = 1e-5;
  for (const phase of [0.13, 0.37, 0.63, 0.88]) {
    const time = geometry.inputCyclePeriod * phase;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    const numericVelocity = after.mirrorCenter.clone()
      .sub(before.mirrorCenter)
      .multiplyScalar(1 / (2 * h));
    vectorNear(numericVelocity, state.mirrorCenterVelocity, 7e-10,
      'analytic mirror-center velocity');
  }
  assert.match(data.transmission.compoundMirrorLaw,
    /world angle equals bar angle plus cumulative ratchet angle/);
  disposeModel(model.root);
});

test('movement 370 common-shaft eccentric gives the exact harmonic click-carrier stroke and its telescoping follower reaches both moving endpoints', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  let minimumFollowerLength = Infinity;
  let maximumFollowerLength = -Infinity;

  for (let sample = 0; sample <= 1200; sample += 1) {
    const time = geometry.inputCyclePeriod * 2 * sample / 1200;
    const state = stateAtTime(time);
    const expectedFraction = 0.5
      * (1 - Math.cos(FULL_TURN * state.phase));
    near(state.carrierFraction, expectedFraction, 3e-16,
      'eccentric harmonic carrier fraction');
    // The carrier swings a pitch plus the click's backlash.
    near(state.carrierAngle,
      geometry.carrierBaseAngle
        + geometry.clickHand
          * (geometry.ratchetToothPitch + geometry.clickBacklash)
          * state.carrierFraction,
      0, 'click-carrier angle');
    near(
      Math.hypot(
        state.eccentricCenter.x - geometry.crankCenter.x,
        state.eccentricCenter.y - geometry.crankCenter.y,
      ),
      geometry.eccentricity,
      3e-16,
      'eccentric center radius',
    );
    model.update(time);
    vectorNear(blocks.eccentricFollower.userData.upperEndpoint,
      state.eccentricCenter, 0, 'follower eccentric endpoint');
    vectorNear(blocks.eccentricFollower.userData.lowerEndpoint,
      state.carrierPivotWorld, 0, 'follower carrier endpoint');
    near(blocks.eccentricFollower.userData.currentLength,
      state.eccentricCenter.distanceTo(state.carrierPivotWorld), 0,
      'telescoping follower length');
    minimumFollowerLength = Math.min(minimumFollowerLength,
      blocks.eccentricFollower.userData.currentLength);
    maximumFollowerLength = Math.max(maximumFollowerLength,
      blocks.eccentricFollower.userData.currentLength);
  }
  assert.ok(maximumFollowerLength - minimumFollowerLength > 0.71);

  const h = 1e-5;
  for (const phase of [0.12, 0.32, 0.68, 0.88]) {
    const time = geometry.inputCyclePeriod * phase;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    near(
      (after.carrierAngle - before.carrierAngle) / (2 * h),
      state.carrierAngularSpeed,
      // central difference of an angle near 2.5 rad at h = 1e-5
      5e-11,
      'analytic carrier angular speed',
    );
  }
  assert.match(data.transmission.clickCarrierLaw,
    /\(1-cos\(input phase\)\)\/2/);
  disposeModel(model.root);
});

test('movement 370 click advances exactly one tooth on each forward half-turn and lifts over the stationary wheel on return', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const period = geometry.inputCyclePeriod;
  // Brown's click pushes the wheel anticlockwise (clickHand +1, p90): the
  // signed advance is clickHand times the tooth count.
  const pitch = geometry.clickHand * geometry.ratchetToothPitch;
  assert.equal(geometry.clickHand, 1);

  const backlash = geometry.clickBacklash;
  const stroke = geometry.ratchetToothPitch + backlash;
  const click = data.blocks.finiteClick;
  const liftAt = (state) => click.angleAt(state.ratchetAngle - state.carrierAngle);
  for (let cycle = 0; cycle < 16; cycle += 1) {
    const start = stateAtTime(cycle * period);
    const driveMid = stateAtTime((cycle + 0.25) * period);
    const driveEnd = stateAtTime((cycle + 0.5) * period);
    const returnMid = stateAtTime((cycle + 0.75) * period);
    const next = stateAtTime((cycle + 1) * period);
    near(start.ratchetAngle, cycle * pitch, 2e-15,
      `cycle ${cycle} start index`);
    // The drive first takes up the backlash, then carries the wheel.
    near(driveMid.ratchetAngle,
      cycle * pitch + geometry.clickHand * (stroke / 2 - backlash), 2e-15,
      `cycle ${cycle} mid-stroke advance`);
    near(driveEnd.ratchetAngle, (cycle + 1) * pitch, 2e-15,
      `cycle ${cycle} drive completion`);
    near(returnMid.ratchetAngle, driveEnd.ratchetAngle, 0,
      `cycle ${cycle} return dwell`);
    near(next.ratchetAngle, driveEnd.ratchetAngle, 2e-15,
      `cycle ${cycle} boundary continuity`);
    near(driveMid.ratchetAngle - cycle * pitch,
      driveMid.carrierAngle - geometry.carrierBaseAngle
        - geometry.clickHand * backlash, 8e-16,
      `cycle ${cycle} carrier drives wheel`);
    near(driveMid.pawlTipWorld.distanceTo(driveMid.selectedToothWorld),
      0, 5e-16, `cycle ${cycle} engaged click contact`);
    near(driveMid.pawlLift, 0, 0,
      `cycle ${cycle} click seated on drive`);
    // The finite hook: off the face by the backlash at the start of the
    // drive, seated in the root while driving, lifted over a tooth on return.
    assert.ok(Math.abs(liftAt(start)) > 1e-3, `cycle ${cycle} backlash at drive start`);
    near(liftAt(driveMid), 0, 1e-12, `cycle ${cycle} hook seated in the root`);
    near(liftAt(driveEnd), 0, 1e-12, `cycle ${cycle} hook seated at drive end`);
    assert.ok(Math.abs(liftAt(returnMid)) > 0.05, `cycle ${cycle} hook rides over a tooth`);
    near(returnMid.ratchetAngularSpeed, 0, 0,
      `cycle ${cycle} wheel dwell speed`);
    near(returnMid.pawlLift, geometry.pawlMaximumLift, 2e-16,
      `cycle ${cycle} maximum overrun lift`);
    assert.ok(returnMid.pawlTipWorld.distanceTo(
      returnMid.selectedToothWorld) > 0.3 * geometry.ratchetOuterRadius);
    assert.equal(start.engagedToothIndex,
      positiveModulo(-cycle, geometry.ratchetToothCount));
  }

  let previousAngle = -Infinity;
  for (let sample = 0; sample <= 4000; sample += 1) {
    const state = stateAtTime(period * 5 * sample / 4000);
    assert.ok(state.ratchetAngle * geometry.clickHand
      >= previousAngle - 2e-15);
    previousAngle = state.ratchetAngle * geometry.clickHand;
    if (state.phase <= 0.5) {
      assert.ok(state.pawlTipWorld.distanceTo(
        state.selectedToothWorld) < 5e-16);
    } else {
      near(state.ratchetAngularSpeed, 0, 0,
        'stationary return-stroke ratchet');
    }
  }
  assert.match(data.transmission.ratchetLaw, /wheel dwells/);
  disposeModel(model.root);
});

test('movement 370 renderer preserves bar guide, mirror pose, click contact, follower endpoints, and smooth motion over two crank turns', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let maximumGuideError = 0;
  let maximumDriveContactError = 0;
  let largestMirrorCenterStep = 0;
  let previousMirrorCenter = null;
  const stages = new Set();

  assert.equal(animationTiming.authoredCyclePeriod,
    geometry.inputCyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.inputCyclePeriod * 2 * frame / 1200;
    model.update(time);
    const state = data.currentState;
    stages.add(state.stage);
    near(blocks.inputRotor.rotation.z, state.inputAngle, 0,
      'rendered crank angle');
    vectorNear(blocks.longBar.position, state.crankPin, 0,
      'rendered bar top eye');
    vectorNear(
      Y_AXIS.clone().applyQuaternion(blocks.longBar.quaternion),
      state.barUpDirection,
      4e-16,
      'rendered bar direction',
    );
    near(blocks.mirrorRotor.rotation.z, state.ratchetAngle, 0,
      'rendered ratchet angle');
    near(blocks.clickCarrier.rotation.z, state.carrierAngle, 0,
      'rendered click-carrier angle');
    near(blocks.pawlSlide.position.x, state.pawlLift, 0,
      'rendered click lift');
    vectorNear(blocks.eccentricFollower.userData.upperEndpoint,
      state.eccentricCenter, 0, 'rendered upper follower endpoint');
    vectorNear(blocks.eccentricFollower.userData.lowerEndpoint,
      state.carrierPivotWorld, 0, 'rendered lower follower endpoint');
    maximumGuideError = Math.max(
      maximumGuideError,
      data.constraints.guide.centerlineError,
    );
    if (data.constraints.clickContact.engaged) {
      maximumDriveContactError = Math.max(
        maximumDriveContactError,
        data.constraints.clickContact.clearance,
      );
    }
    assert.ok(data.constraints.guide.sideClearance > 0.042);
    model.root.updateMatrixWorld(true);
    const renderedMirrorCenter = blocks.mirrorRotor.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(renderedMirrorCenter, state.mirrorCenter, 1e-15,
      'rendered mirror center');
    const renderedIndex = blocks.mirrorIndex.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(renderedIndex, state.mirrorIndexPoint, 3e-15,
      'rendered compound mirror index');
    assert.equal(blocks.contactMarker.visible, false);
    assert.ok(blocks.finiteClick.body.visible);
    if (previousMirrorCenter !== null) {
      largestMirrorCenterStep = Math.max(
        largestMirrorCenterStep,
        renderedMirrorCenter.distanceTo(previousMirrorCenter),
      );
    }
    previousMirrorCenter = renderedMirrorCenter;
    if (frame % 100 === 0) {
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(maximumGuideError < 1.5e-15);
  assert.ok(maximumDriveContactError < 5e-16);
  assert.ok(largestMirrorCenterStep < 0.0077);
  assert.deepEqual(stages, new Set([
    'eccentric-driven-click-advancing-ratchet-one-tooth',
    'click-overrunning-back-across-stationary-ratchet',
  ]));
  disposeModel(model.root);
});

test('movement 370 is continuous at every crank boundary and completes one ratchet revolution in twelve turns before movement 507', () => {
  const movement370 = catalog.movements[369];
  const movement507 = catalog.movements[506];
  const model370 = createMovementModel(movement370);
  const data = model370.root.userData;
  const { geometry, stateAtTime } = data;
  const period = geometry.inputCyclePeriod;
  const start = stateAtTime(0);
  const oneTurn = stateAtTime(period);
  const fullIndex = stateAtTime(period * geometry.ratchetToothCount);

  near(oneTurn.inputAngle - start.inputAngle, FULL_TURN, 9e-16,
    'one input revolution');
  near(oneTurn.ratchetAngle - start.ratchetAngle,
    geometry.clickHand * geometry.ratchetToothPitch, 0,
    'one ratchet tooth per turn');
  vectorNear(oneTurn.crankPin, start.crankPin, 0,
    'bar crankpin repeats each input turn');
  vectorNear(oneTurn.mirrorCenter, start.mirrorCenter, 0,
    'mirror center orbit repeats each input turn');
  near(fullIndex.inputAngle - start.inputAngle,
    FULL_TURN * geometry.ratchetToothCount, 1.5e-14,
    'twelve input revolutions');
  near(fullIndex.ratchetAngle - start.ratchetAngle,
    geometry.clickHand * FULL_TURN, 9e-16,
    'one complete mirror-ratchet revolution (anticlockwise)');
  vectorNear(fullIndex.crankPin, start.crankPin, 0,
    'full-index crankpin closure');
  vectorNear(fullIndex.mirrorCenter, start.mirrorCenter, 0,
    'full-index mirror-center closure');
  near(
    positiveModulo(fullIndex.mirrorWorldAngle - start.mirrorWorldAngle,
      FULL_TURN),
    0,
    9e-16,
    'full compound orientation closure',
  );

  for (let cycle = 1; cycle <= 6; cycle += 1) {
    const before = stateAtTime(cycle * period - 1e-7);
    const after = stateAtTime(cycle * period + 1e-7);
    assert.ok(after.crankPin.distanceTo(before.crankPin) < 2e-7);
    assert.ok(after.mirrorCenter.distanceTo(before.mirrorCenter) < 2e-7);
    assert.ok(Math.abs(after.ratchetAngle - before.ratchetAngle) < 1e-12);
    assert.ok(after.pawlTipWorld.distanceTo(before.pawlTipWorld) < 2e-7);
  }

  const model507 = createMovementModel(movement507);
  assert.equal(movement370.id, 370);
  assert.equal(movement370.fidelity, 'authored');
  assert.equal(model370.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model370.root);
});
