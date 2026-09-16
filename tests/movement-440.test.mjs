import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'tipping-water-meter-with-equally-divided-pivoted-trough-alternately-filling-and-emptying';
const FULL_TURN = Math.PI * 2;

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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function transformedLocalPoint(localPoint, pivot, angle) {
  return new THREE.Vector3(
    pivot.x + localPoint.x * Math.cos(angle)
      - localPoint.y * Math.sin(angle),
    pivot.y + localPoint.x * Math.sin(angle)
      + localPoint.y * Math.cos(angle),
    localPoint.z,
  );
}

test('movement 440 is one rigid, equally divided trough on one fixed transverse axle', () => {
  const movement = catalog.movements[439];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 440);
  assert.equal(movement.number, '440');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism,
    /One rigid trough is divided transversely into two equal open-ended compartments/);
  assert.match(data.mechanism, /rocks about one fixed axis/);
  assert.match(data.mechanism,
    /loaded side descends, discharges through its outer end/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.troughHalvesIndependent, false);
  assert.equal(degreesOfFreedom.dividerIndependent, false);
  assert.equal(degreesOfFreedom.pivotTranslationIndependent, false);
  assert.equal(degreesOfFreedom.compartmentFillsIndependent, false);
  assert.equal(blocks.trough.parent, model.root);
  assert.equal(blocks.axle.parent, model.root);
  assert.equal(blocks.leftCompartment.parent, blocks.trough);
  assert.equal(blocks.rightCompartment.parent, blocks.trough);
  assert.equal(blocks.centralDivider.parent, blocks.trough);
  assert.equal(blocks.leftWater.parent, blocks.trough);
  assert.equal(blocks.rightWater.parent, blocks.trough);
  assert.equal(blocks.leftFloor.parent, blocks.leftCompartment);
  assert.equal(blocks.rightFloor.parent, blocks.rightCompartment);
  assert.deepEqual(
    blocks.leftFloor.geometry.parameters,
    blocks.rightFloor.geometry.parameters,
  );
  assert.equal(
    blocks.leftCompartment.userData.capacity,
    blocks.rightCompartment.userData.capacity,
  );

  const belts = [];
  const ropes = [];
  const axisRoles = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role === 'single-fixed-transverse-trough-axis') {
      axisRoles.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  assert.deepEqual(axisRoles, [blocks.axle]);
  for (const role of [
    'one-rigid-trough-rocking-about-one-fixed-transverse-axis',
    'left-equal-half-of-transversely-divided-trough',
    'right-equal-half-of-transversely-divided-trough',
    'single-transverse-divider-forming-two-equal-compartments',
    'fixed-location-continuous-water-fall-over-moving-divider',
    'left-outer-end-emptying-stream',
    'right-outer-end-emptying-stream',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 440 source evidence is explicit and reconstruction choices are disclosed', () => {
  const movement = catalog.movements[439];
  const model = createMovementModel(movement);
  const {
    dynamics,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate440;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_440.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /trough divided transversely into equal parts/);
  assert.match(movement.description, /supported on an axis by a frame beneath/);
  assert.match(movement.description,
    /opposite side is brought under the stream and filled/);
  assert.match(movement.description, /used as a water meter/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*Animated control is unavailable/);
  assert.equal(dynamics.fluidImpactSplashViscosityFreeSurfaceSloshDryTroughInertiaBearingFrictionStopImpactAndThresholdInstabilityModeled,
    false);
  assert.match(dynamics.phaseSchedule,
    /constant-flow filling dwells.*quintic zero-velocity, zero-acceleration tipping strokes/);
  assert.match(dynamics.waterSurfaceTreatment,
    /counter-rotated.*free surface remains horizontal/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximatePivotPixels, [209, 301]);
  assert.deepEqual(plate.approximateCentralDividerPixels, [273, 264]);
  assert.deepEqual(plate.approximateIncomingStreamImpactPixels, [280, 244]);
  assert.deepEqual(plate.approximateLeftDischargePixels, [17, 411]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /one long two-ended trough.*high transverse center division.*one axle/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, tilt limits, compartment capacity.*independently engineered/);
  disposeModel(model.root);
});

test('movement 440 has mirror-equal compartments, stops, and equal metered volume per tip', () => {
  const model = createMovementModel(catalog.movements[439]);
  const {
    geometry,
    metering,
    motion,
    sourcePose,
    stateAtInputAngle,
  } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(geometry.leftStopContact.x, -geometry.rightStopContact.x,
    2e-15, 'mirror stop x');
  near(geometry.leftStopContact.y, geometry.rightStopContact.y,
    2e-15, 'equal stop height');
  near(source.troughAngle, geometry.maximumTiltAngle, 0,
    'source positive stop angle');
  near(sourcePose.troughAngle, source.troughAngle, 0,
    'source pose angle');
  assert.equal(sourcePose.stopContact, 'left');
  assert.equal(sourcePose.streamTargetSide, 'right');
  near(sourcePose.leftFill, 0, 0, 'source left water load');
  near(sourcePose.rightFill, 0, 0, 'source right water load');
  assert.equal(metering.compartmentCapacity, geometry.compartmentCapacity);
  assert.equal(metering.equalVolumePerTip, geometry.compartmentCapacity);
  assert.equal(metering.tipsPerCycle, 2);
  assert.equal(metering.volumePerCycle, 2 * geometry.compartmentCapacity);
  near(motion.troughAngleMaximum, -motion.troughAngleMinimum, 0,
    'symmetric angular travel limits');
  assert.equal(motion.troughNetRevolutionsPerCycle, 0);
  disposeModel(model.root);
});

test('movement 440 alternates right fill, right dump, left fill, and left dump in order', () => {
  const model = createMovementModel(catalog.movements[439]);
  const {
    geometry,
    stateAtInputAngle,
    waterStateAtPhase,
  } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  const rightHalfFull = waterStateAtPhase(geometry.rightFillEndPhase);
  const leftHalfFull = waterStateAtPhase(geometry.leftFillEndPhase);
  near(atPhase(0.19).rightFill, 0.5, 1e-15,
    'right half-filled during first dwell');
  near(atPhase(0.19).troughAngle, geometry.maximumTiltAngle, 0,
    'trough remains on left stop while right fills');
  near(rightHalfFull.rightFill, 1, 1e-15, 'right fill threshold');
  near(atPhase(0.44).rightFill, 0.5, 4e-15,
    'right half-empty at first mid-tip');
  near(atPhase(0.44).rightDrainFlow, 1, 2e-15,
    'right discharge peaks at first mid-tip');
  near(atPhase(0.44).troughAngle, 0, 3e-15,
    'trough crosses level at first mid-tip');
  assert.ok(atPhase(0.44).troughAngularSpeed < 0,
    'filled right side descends clockwise');
  near(atPhase(geometry.rightTipEndPhase).troughAngle,
    -geometry.maximumTiltAngle, 2e-15, 'first tip reaches right stop');
  near(atPhase(0.69).leftFill, 0.5, 2e-15,
    'left half-filled during second dwell');
  near(atPhase(0.69).troughAngle, -geometry.maximumTiltAngle, 0,
    'trough remains on right stop while left fills');
  near(leftHalfFull.leftFill, 1, 1e-15, 'left fill threshold');
  near(atPhase(0.94).leftFill, 0.5, 4e-15,
    'left half-empty at second mid-tip');
  near(atPhase(0.94).leftDrainFlow, 1, 2e-15,
    'left discharge peaks at second mid-tip');
  near(atPhase(0.94).troughAngle, 0, 3e-15,
    'trough crosses level at second mid-tip');
  assert.ok(atPhase(0.94).troughAngularSpeed > 0,
    'filled left side descends counterclockwise');
  disposeModel(model.root);
});

test('movement 440 water-load torque has the sign required for each tipping stroke', () => {
  const model = createMovementModel(catalog.movements[439]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (const phase of [0.08, 0.19, 0.31, 0.40, 0.43, 0.47,
    0.58, 0.69, 0.81, 0.90, 0.93, 0.97]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    const expectedTorque = -geometry.gravity * (
      state.leftWaterMass
        * (state.leftWaterCenter.x - geometry.pivot.x)
      + state.rightWaterMass
        * (state.rightWaterCenter.x - geometry.pivot.x)
    );
    near(state.waterTorqueAboutPivot, expectedTorque, 0,
      `gravity torque formula at phase ${phase}`);
    if (state.rightFill > 1e-12) {
      assert.ok(state.waterTorqueAboutPivot < 0,
        `right water load gives clockwise torque at ${phase}`);
    }
    if (state.leftFill > 1e-12) {
      assert.ok(state.waterTorqueAboutPivot > 0,
        `left water load gives counterclockwise torque at ${phase}`);
    }
  }
  const rightTip = stateAtInputAngle(FULL_TURN * 0.43);
  const leftTip = stateAtInputAngle(FULL_TURN * 0.93);
  assert.ok(rightTip.waterTorqueAboutPivot < 0);
  assert.ok(rightTip.troughAngularSpeed < 0);
  assert.ok(leftTip.waterTorqueAboutPivot > 0);
  assert.ok(leftTip.troughAngularSpeed > 0);
  near(stateAtInputAngle(0).waterTorqueAboutPivot, 0, 0,
    'empty-cycle torque');
  disposeModel(model.root);
});

test('movement 440 fixed stream changes receiving side only because the divider rocks beneath it', () => {
  const model = createMovementModel(catalog.movements[439]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const rightReceiving = stateAtInputAngle(FULL_TURN * 0.19);
  const firstTransition = stateAtInputAngle(FULL_TURN * 0.44);
  const leftReceiving = stateAtInputAngle(FULL_TURN * 0.69);
  const secondTransition = stateAtInputAngle(FULL_TURN * 0.94);

  assert.equal(rightReceiving.streamTargetSide, 'right');
  assert.ok(rightReceiving.dividerTop.x < geometry.streamX);
  assert.ok(rightReceiving.streamOffsetFromDivider > 0);
  assert.equal(leftReceiving.streamTargetSide, 'left');
  assert.ok(leftReceiving.dividerTop.x > geometry.streamX);
  assert.ok(leftReceiving.streamOffsetFromDivider < 0);
  assert.equal(firstTransition.streamTargetSide, 'divider-transition');
  assert.equal(secondTransition.streamTargetSide, 'divider-transition');
  near(firstTransition.dividerTop.x, geometry.streamX, 3e-15,
    'first level crossing places divider below stream');
  near(secondTransition.dividerTop.x, geometry.streamX, 3e-15,
    'second level crossing places divider below stream');
  for (const phase of [0, 0.17, 0.41, 0.63, 0.91, 0.999]) {
    near(stateAtInputAngle(FULL_TURN * phase).inletFlowRate,
      geometry.inletFlowRate, 0, `continuous inlet at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 440 trough remains rigid on its fixed pivot and meets symmetric travel stops', () => {
  const model = createMovementModel(catalog.movements[439]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;
  const leftContactLocal = new THREE.Vector3(
    -2.02,
    geometry.floorLocalY - geometry.floorThickness / 2,
    0,
  );
  const rightContactLocal = new THREE.Vector3(
    2.02,
    geometry.floorLocalY - geometry.floorThickness / 2,
    0,
  );
  vectorNear(
    transformedLocalPoint(
      leftContactLocal,
      geometry.pivot,
      geometry.maximumTiltAngle,
    ),
    geometry.leftStopContact,
    0,
    'left low-floor contact',
  );
  vectorNear(
    transformedLocalPoint(
      rightContactLocal,
      geometry.pivot,
      -geometry.maximumTiltAngle,
    ),
    geometry.rightStopContact,
    0,
    'right low-floor contact',
  );
  const childTransforms = blocks.trough.children.map((child) => ({
    position: child.position.clone(),
    quaternion: child.quaternion.clone(),
  }));
  for (const phase of [0, 0.19, 0.44, 0.5, 0.69, 0.94, 0.999]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    update(geometry.cycleDuration * phase);
    vectorNear(blocks.trough.position, geometry.pivot, 0,
      `fixed pivot at ${phase}`);
    near(blocks.trough.rotation.z, state.troughAngle, 2e-15,
      `rigid trough angle at ${phase}`);
    blocks.trough.children.forEach((child, index) => {
      if (child === blocks.leftWater || child === blocks.rightWater) return;
      vectorNear(child.position, childTransforms[index].position, 0,
        `rigid child position at ${phase}`);
      near(child.quaternion.angleTo(childTransforms[index].quaternion),
        0, 0, `rigid child orientation at ${phase}`);
    });
  }
  disposeModel(model.root);
});

test('movement 440 quintic tipping strokes match analytic speed and acceleration without endpoint jolts', () => {
  const model = createMovementModel(catalog.movements[439]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const phase of [0.395, 0.41, 0.43, 0.455, 0.48,
    0.895, 0.91, 0.93, 0.955, 0.98]) {
    const angle = FULL_TURN * phase;
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalSpeed = (
      after.troughAngle - before.troughAngle
    ) / (2 * timeStep);
    const numericalAcceleration = (
      after.troughAngularSpeed - before.troughAngularSpeed
    ) / (2 * timeStep);
    near(numericalSpeed, state.troughAngularSpeed, 3e-9,
      `trough speed at phase ${phase}`);
    near(numericalAcceleration, state.troughAngularAcceleration, 5e-8,
      `trough acceleration at phase ${phase}`);
  }
  for (const phase of [geometry.rightFillEndPhase,
    geometry.rightTipEndPhase, geometry.leftFillEndPhase, 0, 1]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.troughAngularSpeed, 0, 2e-13,
      `zero stop speed at phase ${phase}`);
    near(state.troughAngularAcceleration, 0, 2e-12,
      `zero stop acceleration at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 440 update binds the rigid trough, horizontal water loads, drains, and fixed apparatus to one state', () => {
  const model = createMovementModel(catalog.movements[439]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.axle, blocks.base, blocks.flume,
    blocks.fallingWater, blocks.leftStop, blocks.rightStop,
    ...blocks.supportPosts, ...blocks.bearingRings, ...blocks.braces];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const identity = new THREE.Quaternion();

  for (const phase of [0, 0.19, 0.44, 0.50, 0.69, 0.94, 0.999]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.trough.rotation.z, state.troughAngle, 2e-15,
      `trough update at ${phase}`);
    assert.equal(blocks.leftWater.visible, state.leftFill > 0.002);
    assert.equal(blocks.rightWater.visible, state.rightFill > 0.002);
    assert.equal(blocks.leftWater.scale.y, 1, 'left water is clipped geometry');
    assert.equal(blocks.rightWater.scale.y, 1, 'right water is clipped geometry');
    assert.equal(blocks.leftSpill.visible, state.leftDrainFlow > 0.002);
    assert.equal(blocks.rightSpill.visible, state.rightDrainFlow > 0.002);
    model.root.updateMatrixWorld(true);
    const leftWorldRotation = new THREE.Quaternion();
    const rightWorldRotation = new THREE.Quaternion();
    blocks.leftWater.getWorldQuaternion(leftWorldRotation);
    blocks.rightWater.getWorldQuaternion(rightWorldRotation);
    near(leftWorldRotation.angleTo(identity), 0, 3e-8,
      `horizontal left free surface at ${phase}`);
    near(rightWorldRotation.angleTo(identity), 0, 3e-8,
      `horizontal right free surface at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.troughAngle, source.troughAngle, 0,
    'trough cycle closure');
  near(closure.leftFill, source.leftFill, 0, 'left fill cycle closure');
  near(closure.rightFill, source.rightFill, 0, 'right fill cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 440 water meter', () => {
  const movement440 = catalog.movements[439];
  const movement507 = catalog.movements[506];
  const model440 = createMovementModel(movement440);
  const model507 = createMovementModel(movement507);

  assert.equal(movement440.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model440.root);
  disposeModel(model507.root);
});
