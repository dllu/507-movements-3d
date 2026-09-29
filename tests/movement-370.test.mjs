import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { turnedHandleMount } from './helpers/turned-handle-mount.mjs';
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

test('movement 370 contains the opposite-ended hand crank, guided long bar, rigid mirror-ratchet, crankpin eccentric and Brown\'s S-shaped click rod', () => {
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
  assert.match(data.mechanism, /eccentric-drives-brown-s-shaped-click-rod/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /continuous hand-crank angle/);
  assert.match(degreesOfFreedom.note, /S-link/);

  for (const component of [
    blocks.upperRail,
    blocks.lowerRail,
    blocks.crankBearing,
    blocks.inputRotor,
    blocks.longBar,
    ...blocks.guidePins,
    ...blocks.railFasteners,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.barBody,
    blocks.upperEye,
    blocks.upperEyeBore,
    blocks.mirrorRotor,
    blocks.sLinkBody,
    blocks.rodKeeper,
  ]) assert.equal(component.parent, blocks.longBar);
  for (const component of [
    blocks.mirrorBacking,
    blocks.mirrorFace,
    blocks.ratchetWheel,
    blocks.mirrorAxle,
    blocks.mirrorIndex,
  ]) assert.equal(component.parent, blocks.mirrorRotor);
  for (const component of [
    blocks.crankPinBoss,
    blocks.handleArm,
    blocks.handle,
    blocks.handleKnob,
    blocks.eccentricDisk,
    blocks.shaftIndex,
  ]) assert.equal(component.parent, blocks.inputRotor);
  assert.equal(blocks.ratchetWheel.userData.ratchetProfile.teeth,
    geometry.ratchetToothCount);
  // No telescoping follower, click carrier or separate pawl remain.
  for (const gone of ['eccentricFollower', 'clickCarrier', 'carrierArm',
    'pawlSlide', 'pawlBody', 'finiteClick']) assert.equal(blocks[gone], undefined, gone);

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
    'eccentric-sheave-keyed-on-the-crankpin-rear-end',
    'long-bar-with-longitudinal-and-oscillating-motion',
    'one-of-two-fixed-lower-rail-bar-guide-pins',
    'square-polishing-mirror-face',
    'ratchet-wheel-rigidly-secured-to-square-mirror',
    'brown-s-shaped-eccentric-rod-and-click',
    'loose-rod-keeper-on-bar-back',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => /telescop|sliding-follower|click-carrier/.test(role)));
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
      4e-15,
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
    if (state.phase > 0.25 && state.phase < 0.45
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

test('movement 370 eccentric keyed on the crankpin carries the S-link strap round the bar eye, all in the ratchet plane', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  // One plane: the ratchet, the S-link and its eccentric share their depth.
  const depth = (mesh) => {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone();
    model.root.updateMatrixWorld(true);
    return box.applyMatrix4(mesh.matrixWorld);
  };
  model.update(0);
  const wheel = depth(blocks.ratchetWheel), link = depth(blocks.sLinkBody), disc = depth(blocks.eccentricDisk);
  near((link.min.z + link.max.z) / 2, geometry.clickPlaneZ, 1e-6, 'S-link plane');
  near((wheel.min.z + wheel.max.z) / 2, geometry.clickPlaneZ, 1e-6, 'ratchet plane');
  near((disc.min.z + disc.max.z) / 2, geometry.clickPlaneZ, 1e-6, 'eccentric plane');
  // Behind the lower rail (back face -0.21) and the bar.
  assert.ok(link.max.z < -0.21 && wheel.max.z < -0.21 && disc.max.z < -0.21);
  for (let sample = 0; sample <= 200; sample += 1) {
    const time = geometry.inputCyclePeriod * sample / 200;
    const state = stateAtTime(time);
    near(Math.hypot(...state.strapCentre), geometry.eccentricity, 1e-12,
      'strap centre circles the bar eye at the throw');
    near(Math.hypot(state.eccentricCenter.x - state.crankPin.x,
      state.eccentricCenter.y - state.crankPin.y), geometry.eccentricity, 1e-12,
    'eccentric centre at the throw from the crankpin');
    model.update(time);
    model.root.updateMatrixWorld(true);
    // The rendered sheave centre (fixed in the crank) is the strap centre.
    const sheave = new THREE.Vector3(
      geometry.crankRadius + geometry.eccentricity * Math.cos(geometry.eccentricPhase),
      geometry.eccentricity * Math.sin(geometry.eccentricPhase),
      geometry.clickPlaneZ,
    ).applyMatrix4(blocks.inputRotor.matrixWorld);
    const strap = new THREE.Vector3(0, 0, 0).applyMatrix4(blocks.sLinkBody.matrixWorld);
    near(Math.hypot(sheave.x - strap.x, sheave.y - strap.y), 0, 1e-12, 'strap concentric with the sheave');
    near(sheave.x, state.eccentricCenter.x, 1e-12, 'state eccentric x');
    near(sheave.y, state.eccentricCenter.y, 1e-12, 'state eccentric y');
  }
  // The strap runs on the sheave with running clearance.
  near(geometry.strapInnerRadius - geometry.eccentricDiscRadius, 0.005, 1e-12, 'strap clearance');
  disposeModel(model.root);
});

test('movement 370 S-link hook drives exactly one tooth while the strap descends and overruns the stationary wheel on the rise', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { geometry, stateAtTime, sLinkSolver: solver, driveTable } = data;
  const pitch = geometry.ratchetToothPitch;
  const record = driveTable.record;
  near(record.at(-1).w - record[0].w, pitch, 1e-12, 'one tooth per steady turn');
  near(record.at(-1).beta, record[0].beta, 1e-9, 'periodic hook pose');
  let engagedSamples = 0;
  let descending = 0;
  for (let i = 1; i < record.length; i += 1) {
    const a = record[i - 1], b = record[i];
    assert.ok(b.w >= a.w - 1e-15, 'the wheel never runs back');
    if (b.w > a.w + 1e-12) {
      engagedSamples += 1;
      assert.ok(b.engaged, 'only the hook turns the wheel');
      // It pushes while its strap comes down the bar (and a little past
      // the bottom, where the strap's sideways swing still carries it).
      if (b.e[1] < a.e[1]) descending += 1;
    }
    assert.ok(!solver.overlaps(b.e, b.beta, b.w), `hook clear of the teeth at ${i}`);
    if (b.engaged) {
      // Seated: the round tip's centre sits at its seat radius.
      const tip = solver.nosePoint(b.e, b.beta);
      near(Math.hypot(tip[0], tip[1] + geometry.mirrorDistanceFromTopEye),
        solver.noseRadius, 1e-9, `seated tip radius at ${i}`);
    }
  }
  assert.ok(descending > 0.9 * engagedSamples, `descending ${descending} of ${engagedSamples}`);
  assert.ok(engagedSamples > record.length * 0.25 && engagedSamples < record.length * 0.45,
    `drive share ${engagedSamples / record.length}`);
  for (let turn = 0; turn < 3; turn += 1) {
    const start = stateAtTime(geometry.inputCyclePeriod * turn);
    const end = stateAtTime(geometry.inputCyclePeriod * (turn + 1));
    near(end.ratchetAngle - start.ratchetAngle, geometry.clickHand * pitch, 1e-12,
      `turn ${turn} advances one tooth anticlockwise`);
  }
  disposeModel(model.root);
});

test('movement 370 renderer preserves bar guide, mirror pose, S-link pose and smooth motion over two crank turns', () => {
  const model = createMovementModel(catalog.movements[369]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let maximumGuideError = 0;
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
    near(blocks.sLinkBody.rotation.z, state.clickRotation, 0,
      'rendered hook rotation');
    near(blocks.sLinkBody.position.x, state.strapCentre[0], 0, 'rendered strap x');
    near(blocks.sLinkBody.position.y, state.strapCentre[1], 0, 'rendered strap y');
    maximumGuideError = Math.max(
      maximumGuideError,
      data.constraints.guide.centerlineError,
    );
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
    assert.ok(blocks.sLinkBody.visible);
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

  // Brown marks no direction; the crank turns clockwise in the plate.
  near(oneTurn.inputAngle - start.inputAngle, -FULL_TURN, 9e-16,
    'one input revolution');
  near(oneTurn.ratchetAngle - start.ratchetAngle,
    geometry.clickHand * geometry.ratchetToothPitch, 1e-12,
    'one ratchet tooth per turn');
  vectorNear(oneTurn.crankPin, start.crankPin, 0,
    'bar crankpin repeats each input turn');
  vectorNear(oneTurn.mirrorCenter, start.mirrorCenter, 0,
    'mirror center orbit repeats each input turn');
  near(fullIndex.inputAngle - start.inputAngle,
    -FULL_TURN * geometry.ratchetToothCount, 1.5e-14,
    'twelve input revolutions');
  near(fullIndex.ratchetAngle - start.ratchetAngle,
    geometry.clickHand * FULL_TURN, 1e-12,
    'one complete mirror-ratchet revolution (anticlockwise)');
  vectorNear(fullIndex.crankPin, start.crankPin, 0,
    'full-index crankpin closure');
  vectorNear(fullIndex.mirrorCenter, start.mirrorCenter, 0,
    'full-index mirror-center closure');
  near(
    positiveModulo(fullIndex.mirrorWorldAngle - start.mirrorWorldAngle,
      FULL_TURN),
    0,
    1e-12,
    'full compound orientation closure',
  );

  for (let cycle = 1; cycle <= 6; cycle += 1) {
    const before = stateAtTime(cycle * period - 1e-7);
    const after = stateAtTime(cycle * period + 1e-7);
    assert.ok(after.crankPin.distanceTo(before.crankPin) < 2e-7);
    assert.ok(after.mirrorCenter.distanceTo(before.mirrorCenter) < 2e-7);
    assert.ok(Math.abs(after.ratchetAngle - before.ratchetAngle) < 1e-12);
    assert.ok(after.clickNoseWorld.distanceTo(before.clickNoseWorld) < 2e-6);
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

test('movement 370 (pass 92): the crank carries the shared turned handle, centred in an arc-ended arm with a margin round its foot', () => {
  const model = createMovementModel(catalog.movements[369]);
  try {
    let handle = null, arm = null;
    model.root.traverse((object) => {
      if (object.userData.role === 'free-turning-hand-handle') handle = object;
      if (object.userData.role === 'opposite-hand-handle-crank-arm') arm = object;
    });
    for (const time of [0, 1.3, 4.1]) {
      model.update(time, 0.01);
      model.root.updateMatrixWorld(true);
      assert.equal(handle.geometry.type, 'LatheGeometry');
      const mount = turnedHandleMount(handle, arm);
      assert.ok(mount.margin > 1.2 * mount.footRadius, `foot ${mount.footRadius} in an arm end of radius ${mount.margin}`);
      assert.ok(mount.endArcSpread < 1e-4, `arm end is an arc about the handle axis (${mount.endArcSpread})`);
    }
    model.root.traverse((object) => {
      if (object.isMesh && object.visible && /knob/.test(object.userData.role ?? '')) assert.notEqual(object.geometry.type, 'SphereGeometry', `${object.userData.role} is a separate ball knob`);
    });
  } finally {
    model.root.traverse((object) => object.geometry?.dispose?.());
  }
});
