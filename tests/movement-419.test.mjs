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
  'continuous-crank-four-bar-oscillating-drum-antagonistic-band-driven-rolling-cradle';
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

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 419 is one continuous crank A, one oscillating wheel B, exactly two source-required bands C/D, and cradle E', () => {
  const movement = catalog.movements[418];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 419);
  assert.equal(movement.number, '419');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Continuously rotating crank wheel A/);
  assert.match(data.mechanism, /larger fixed-axis wheel B/);
  assert.match(data.mechanism, /two simultaneously present source-required flexible bands C and D/);
  assert.match(data.mechanism, /E rolls.*without slipping/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.outputWheelAngleIndependent, false);
  assert.equal(degreesOfFreedom.cradleAngleIndependent, false);
  assert.equal(degreesOfFreedom.storedBandElasticStates, 0);
  assert.equal(blocks.inputWheelA.parent, model.root);
  assert.equal(blocks.outputWheelB.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.cradleE.parent, model.root);
  assert.equal(blocks.flexibleBandC.parent, model.root);
  assert.equal(blocks.flexibleBandD.parent, model.root);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, [blocks.flexibleBandC, blocks.flexibleBandD]);
  // Each band is one continuous laid cord, not thirty cylinder pieces.
  for (const band of [blocks.flexibleBandC, blocks.flexibleBandD]) {
    assert.equal(band.children.length, 1);
    assert.equal(band.userData.crossSection, 'laid-rope');
  }
  assert.ok(!roles.some((role) => /band.*bead|belt.*sphere/i.test(role)));
  for (const role of [
    'continuously-rotating-crank-wheel-A',
    'larger-fixed-axis-oscillating-wheel-B',
    'constant-length-link-from-A-to-B',
    'flexible-band-C-left-limb-over-wheel-B',
    'flexible-band-D-right-limb-over-wheel-B',
    'left-band-standard-attached-to-rocker-E',
    'right-band-standard-attached-to-rocker-E',
    'rolling-self-rocking-cradle-E',
    'circular-rocker-shoe-of-cradle-E',
    'fixed-floor-beneath-rocking-cradle-E',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 419 records Brown’s A–E anatomy and separates source evidence from engineered closure', () => {
  const movement = catalog.movements[418];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate419;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_419.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Wheel, A, revolves/);
  assert.match(movement.description, /wheel, B, of greater radius.*oscillating motion/);
  assert.match(movement.description, /two flexible bands, C, D/);
  assert.match(movement.description, /rocker, E, of the cradle/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.officialCanvasCyclePeriod, 4);
  assert.equal(sourceAnimation.officialCanvasCyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsMaterialsLoadsOrForces,
    false,
  );
  assert.equal(
    dynamics.bandElasticityBacklashBearingFrictionInertiaAndLoadsModeled,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.inputWheelAApproximateCenterPixels, [254, 352]);
  assert.deepEqual(plate.outputWheelBApproximateCenterPixels, [260, 167]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /small lower crank wheel A.*larger upper wheel B/);
  assert.match(evidence.officialCanvasEvidence,
    /relative radii 2\.5 for A and 5 for B/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions.*band attachment law/);
  assert.match(evidence.reconstructionDisclosure,
    /without animated belt beads/);
  disposeModel(model.root);
});

test('movement 419 exact four-bar intersection preserves the A-to-B link and both fixed wheel axes', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumLengthResidual = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const angle = geometry.sourceInputAngle
      + Math.PI * 2 * sample / 50000;
    const state = stateAtInputAngle(angle);
    near(state.inputPin.distanceTo(geometry.inputCenter),
      geometry.inputCrankRadius, 4e-16, 'A crank-pin radius');
    near(state.outputPin.distanceTo(geometry.outputCenter),
      geometry.outputPinRadius, 5e-16, 'B output-pin radius');
    maximumLengthResidual = Math.max(maximumLengthResidual,
      Math.abs(state.connectingRodLengthResidual));
    assert.ok(state.outputPin.x > 0,
      'four-bar remains on Brown’s right-hand assembly branch');
  }
  assert.ok(maximumLengthResidual < 9e-16);
  disposeModel(model.root);
});

test('movement 419 A turns continuously while B reaches only its two exact four-bar dead-center angles', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const outer = stateAtInputAngle(geometry.sourceInputAngle);
  const inner = stateAtInputAngle(geometry.innerDeadCenterInputAngle);

  near(outer.outputAngle, geometry.outputMaximumAngle, 5e-16,
    'outer-dead-center B angle');
  near(Math.abs(outer.outputAngularSpeed), 0, 9e-16,
    'outer-dead-center B speed');
  near(inner.outputAngle, geometry.outputMinimumAngle, 5e-16,
    'inner-dead-center B angle');
  near(Math.abs(inner.outputAngularSpeed), 0, 4e-16,
    'inner-dead-center B speed');
  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(
      geometry.sourceInputAngle + FULL_TURN * sample / 100000,
    );
    assert.ok(state.outputAngle <= geometry.outputMaximumAngle + 6e-16);
    assert.ok(state.outputAngle >= geometry.outputMinimumAngle - 6e-16);
  }
  const closure = stateAtInputAngle(
    geometry.sourceInputAngle + FULL_TURN,
  );
  sameAngle(closure.inputAngle, outer.inputAngle, 3e-16,
    'one continuous A revolution');
  near(closure.outputAngle, outer.outputAngle, 6e-16,
    'B returns after one A revolution');
  disposeModel(model.root);
});

test('movement 419 differentiated four-bar law satisfies rod velocity and acceleration constraints', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumVelocityResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(
      geometry.sourceInputAngle + FULL_TURN * sample / 50000,
    );
    maximumVelocityResidual = Math.max(maximumVelocityResidual,
      Math.abs(state.connectingRodVelocityConstraintResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.connectingRodAccelerationConstraintResidual));
    near(state.inputPinVelocity.dot(
      state.inputPin.clone().sub(geometry.inputCenter),
    ), 0, 2.3e-16, 'A pin tangential velocity');
    near(state.outputPinVelocity.dot(
      state.outputPin.clone().sub(geometry.outputCenter),
    ), 0, 6e-16, 'B pin tangential velocity');
  }
  assert.ok(maximumVelocityResidual < 6e-16);
  assert.ok(maximumAccelerationResidual < 1.3e-15);
  disposeModel(model.root);
});

test('movement 419 opposed bands exchange equal take-up and impose one exact no-slip cradle displacement', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumSpeedResidual = 0;
  let maximumAccelerationResidual = 0;

  for (let sample = 0; sample <= 100000; sample += 1) {
    const state = stateAtInputAngle(
      geometry.sourceInputAngle + FULL_TURN * sample / 100000,
    );
    near(state.bandCDrumTakeUp, -state.bandDDrumTakeUp, 0,
      'C/D opposed take-up');
    near(state.antagonisticTakeUpSum, 0, 0,
      'C/D take-up sum');
    near(state.bandDisplacement,
      geometry.bandPitchRadius
        * (state.outputAngle - geometry.outputCenterAngle),
      0, 'B rim displacement');
    near(state.cradleAngle,
      geometry.cradlePerOutputRatio
        * (state.outputAngle - geometry.outputCenterAngle),
      0, 'B-to-E displacement law');
    maximumSpeedResidual = Math.max(maximumSpeedResidual,
      Math.abs(state.bandNoSlipResidual));
    maximumAccelerationResidual = Math.max(maximumAccelerationResidual,
      Math.abs(state.bandAccelerationConstraintResidual));
  }
  assert.ok(maximumSpeedResidual < 2.3e-16);
  assert.ok(maximumAccelerationResidual < 4.5e-16);
  near(stateAtInputAngle(geometry.sourceInputAngle).cradleAngle,
    geometry.cradleAngularAmplitude, 2e-16, 'right cradle extreme');
  near(stateAtInputAngle(geometry.innerDeadCenterInputAngle).cradleAngle,
    -geometry.cradleAngularAmplitude, 2e-16, 'left cradle extreme');
  disposeModel(model.root);
});

test('movement 419 cradle E rolls its circular shoe on the floor without sliding', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtInputAngle(
      geometry.sourceInputAngle + FULL_TURN * sample / 30000,
    );
    near(state.cradleCenter.x,
      -geometry.rockerRollRadius * state.cradleAngle, 0,
      'rocker center rolling displacement');
    near(state.cradleCenter.y, geometry.cradleCenterY, 0,
      'rocker circle-center height');
    near(state.cradleRollingSpeedResidual, 0, 0,
      'floor no-slip speed');
    near(state.cradleRollingAccelerationResidual, 0, 0,
      'floor no-slip acceleration');
    assert.ok(Math.abs(state.cradleAngle)
      <= geometry.cradleAngularAmplitude + 2e-16);
  }
  disposeModel(model.root);
});

test('movement 419 C and D routes remain tangent to B and meet over its top without duplicate belts', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const center = new THREE.Vector3(
    geometry.outputCenter.x,
    geometry.outputCenter.y,
    geometry.bandZ,
  );

  for (let sample = 0; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(
      geometry.sourceInputAngle + FULL_TURN * sample / 40000,
    );
    for (const [anchor, tangent, label] of [
      [state.leftBandAnchor, state.leftBandTangent, 'C'],
      [state.rightBandAnchor, state.rightBandTangent, 'D'],
    ]) {
      const radial = tangent.clone().sub(center);
      const freeSpan = anchor.clone().sub(tangent);
      near(radial.length(), geometry.bandPitchRadius, 7e-16,
        `${label} tangent radius`);
      near(radial.dot(freeSpan), 0, 2e-15,
        `${label} free span tangent to B`);
      assert.ok(tangent.y > center.y,
        `${label} routes over the upper side of B`);
    }
  }
  disposeModel(model.root);
});

test('movement 419 analytic B and E derivatives match finite differences away from dead centers', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const phase of [0.04, 0.12, 0.23, 0.34, 0.46, 0.57, 0.69,
    0.81, 0.92]) {
    const angle = geometry.sourceInputAngle + FULL_TURN * phase;
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalOutputSpeed = (after.outputAngle - before.outputAngle)
      / (2 * timeStep);
    const numericalOutputAcceleration = (
      after.outputAngularSpeed - before.outputAngularSpeed
    ) / (2 * timeStep);
    const numericalCradleVelocity = after.cradleCenter.clone()
      .sub(before.cradleCenter)
      .multiplyScalar(1 / (2 * timeStep));
    near(numericalOutputSpeed, state.outputAngularSpeed, 5e-10,
      `B angular speed at phase ${phase}`);
    near(numericalOutputAcceleration, state.outputAngularAcceleration,
      1.3e-9, `B angular acceleration at phase ${phase}`);
    vectorNear(numericalCradleVelocity, state.cradleCenterVelocity,
      5e-10, `E center velocity at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 419 update binds both wheel rotations, the link, the rolling cradle, and both flexible routes to one state', () => {
  const model = createMovementModel(catalog.movements[418]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.31, 0.82, 1.29, 1.91, 2.48, 3.17, 3.79,
    4.42]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.inputWheelA.userData.rotor.rotation.z,
      state.inputAngle, 0, 'wheel A update');
    sameAngle(blocks.outputWheelB.userData.rotor.rotation.z,
      state.outputAngle, 0, 'wheel B update');
    near(blocks.connectingRod.userData.nominalLength, geometry.connectingRodLength,
      9e-16, 'rendered A–B link length');
    vectorNear(blocks.cradleE.position, state.cradleCenter, 0,
      'cradle E center update');
    sameAngle(blocks.cradleE.rotation.z, state.cradleAngle, 0,
      'cradle E rocking update');
    for (const band of [blocks.flexibleBandC, blocks.flexibleBandD]) {
      assert.equal(band.children.length, 1);
      assert.ok(Number.isFinite(band.userData.length) && band.userData.length > 0);
      for (const value of band.userData.mesh.geometry.attributes.position.array) {
        assert.ok(Number.isFinite(value));
      }
    }
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.inputAngle, source.inputAngle, 0,
    'A cycle closure');
  near(closure.outputAngle, source.outputAngle, 0,
    'B cycle closure');
  near(closure.cradleAngle, source.cradleAngle, 0,
    'E cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 419 cradle geometry', () => {
  const movement419 = catalog.movements[418];
  const movement507 = catalog.movements[506];
  const model419 = createMovementModel(movement419);
  const model507 = createMovementModel(movement507);

  assert.equal(movement419.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model419.root);
  disposeModel(model507.root);
});
