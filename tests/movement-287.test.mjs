import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

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

test('movement 287 is Pickering’s leaf-spring governor with the plate’s two springs', () => {
  const movement = catalog.movements[286];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 287);
  assert.equal(movement.number, '287');
  assert.equal(movement.title, 'Pickering Three-Spring Governor');
  assert.equal(movement.category, 'Governors & flywheels');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'three-leaf-spring-pickering-governor-keyed-sliding-sleeve');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two diametrically opposed flat leaf springs/);
  assert.match(mechanism, /weight is clamped at its spring midpoint/);
  assert.match(mechanism, /keyed nonrotating-relative-to-spindle/);
  assert.equal(transmission.ballCount, 2);
  assert.equal(transmission.springCount, 2);
  assert.equal(transmission.lowerSleeveRelativeRotation, 0);
  assert.match(transmission.output, /axial displacement/);

  assert.equal(blocks.governorRotor.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.spindle.parent, blocks.governorRotor);
  assert.equal(blocks.upperHead.parent, blocks.governorRotor);
  assert.equal(blocks.slidingSleeve.parent, blocks.governorRotor);
  assert.equal(blocks.springAssemblies.length, 2);
  assert.equal(blocks.upperAnchorClamps.length, 2);
  assert.equal(blocks.lowerAnchorClamps.length, 2);
  vectorNear(blocks.governorRotor.userData.axis,
    new THREE.Vector3(0, 1, 0), 0, 'vertical governor axis');
  for (const [index, assembly] of blocks.springAssemblies.entries()) {
    assert.equal(assembly.springPlane.parent, blocks.governorRotor);
    assert.equal(assembly.spring.parent, assembly.springPlane);
    assert.equal(assembly.ball.parent, assembly.springPlane);
    assert.equal(assembly.ballClampPin.parent, assembly.springPlane);
    near(assembly.baseAngle, index * Math.PI, 0,
      `spring ${index + 1} azimuth`);
    assert.equal(blocks.upperAnchorClamps[index].parent,
      blocks.governorRotor);
    assert.equal(blocks.lowerAnchorClamps[index].parent,
      blocks.slidingSleeve);
  }

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /inextensible-compound-curved-flat-leaf-spring/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /centrifugal-weight-on-leaf-midpoint/.test(role)).length, 2);
  assert.equal(roles.some((role) => /^white-/.test(role)), false,
    'undrawn white indices removed');
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 287 records the static plate and Pickering patent independently', () => {
  const movement = catalog.movements[286];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate287;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /static plate/);
  assert.match(sourceAnimation.referenceScope, /US36621A/);
  assert.match(sourceAnimation.referenceScope, /no proprietary animation/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_287.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.rasterSpindleAxisX, 263);
  assert.equal(plate.rasterTopSpringAnchorY, 78);
  assert.deepEqual(plate.rasterTopSpringAnchorLeft,
    new THREE.Vector2(236, 78));
  assert.deepEqual(plate.rasterTopSpringAnchorRight,
    new THREE.Vector2(290, 78));
  assert.deepEqual(plate.rasterBottomSpringAnchorLeft,
    new THREE.Vector2(232, 391));
  assert.deepEqual(plate.rasterBottomSpringAnchorRight,
    new THREE.Vector2(294, 391));
  assert.deepEqual(plate.rasterBallLeft, new THREE.Vector2(179, 230));
  assert.deepEqual(plate.rasterBallRight, new THREE.Vector2(351, 230));
  assert.match(plate.inferredTopology, /exactly two spring-and-weight profiles/);
  vectorNear(sourcePointToModel({ x: 263, y: 78 }),
    new THREE.Vector2(0, geometry.topAnchorY), 0,
    'source top-axis reference');
  near(geometry.anchorRadius / geometry.sourceScale,
    geometry.meanAnchorRadiusPixels, 5e-15, 'mean source anchor radius');
  near((geometry.anchorRadius + geometry.minimumDeflection)
      / geometry.sourceScale,
  geometry.meanBallOrbitRadiusPixels, 2e-14,
  'mean source ball radius');

  assert.equal(sourceReference.patent.number, 'US36621A');
  assert.equal(sourceReference.patent.date, '1862-10-07');
  assert.match(sourceReference.patent.figure1, /solid low-speed/);
  assert.match(sourceReference.patent.figure2, /three equally spaced/);
  assert.match(sourceReference.patent.verifiedTopology,
    /feather-keyed sliding sleeve/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 75,
    edition: 21,
    illustrationPage: 74,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 287 preserves every spring centerline and all parallel clamps', () => {
  const model = createMovementModel(catalog.movements[286]);
  const {
    curveDerivativeAt,
    geometry,
    halfSpanAtDeflection,
    halfSpanKinematicsAtDeflection,
    springCenterlineAt,
  } = model.root.userData;
  let previousHalfSpan = Infinity;
  for (let sample = 0; sample <= 80; sample += 1) {
    const fraction = sample / 80;
    const deflection = THREE.MathUtils.lerp(
      geometry.minimumDeflection,
      geometry.maximumDeflection,
      fraction,
    );
    const halfSpan = halfSpanAtDeflection(deflection);
    const metrics = halfSpanKinematicsAtDeflection(deflection);
    near(metrics.halfSpan, halfSpan, 0,
      `half-span solver agrees at ${sample}`);
    near(metrics.length, geometry.halfSpringLength, 8e-15,
      `inextensible half-leaf at ${sample}`);
    assert.ok(halfSpan <= previousHalfSpan + 1e-14,
      `half span decreases as spring ${sample} bows`);
    previousHalfSpan = halfSpan;

    const points = springCenterlineAt(deflection, halfSpan, 257);
    const top = points[0];
    const middle = points[128];
    const bottom = points[256];
    near(top.x, geometry.anchorRadius, 0, `top radius ${sample}`);
    near(top.y, geometry.topAnchorY, 0, `top height ${sample}`);
    near(middle.x, geometry.anchorRadius + deflection, 2e-16,
      `ball midpoint radius ${sample}`);
    near(middle.y, geometry.topAnchorY - halfSpan, 0,
      `ball midpoint height ${sample}`);
    near(bottom.x, geometry.anchorRadius, 0,
      `bottom radius ${sample}`);
    near(bottom.y, geometry.topAnchorY - 2 * halfSpan, 0,
      `bottom height ${sample}`);
    for (const parameter of [0, 0.5, 1]) {
      const tangent = curveDerivativeAt(
        parameter,
        deflection,
        halfSpan,
      );
      near(tangent.x, 0, 2e-15,
        `parallel clamp tangent ${parameter} at ${sample}`);
      assert.ok(tangent.y < 0);
    }
  }
  disposeModel(model.root);
});

test('movement 287 balances centrifugal force against the spring response', () => {
  const model = createMovementModel(catalog.movements[286]);
  const {
    geometry,
    spindleSpeedAtDeflection,
    stateAtCyclePhase,
  } = model.root.userData;
  for (let sample = 0; sample <= 2000; sample += 1) {
    const state = stateAtCyclePhase(sample / 2000);
    near(state.forceEquilibriumResidual, 0, 3e-13,
      `force equilibrium at ${sample}`);
    near(state.centrifugalForce, state.restoringForce, 3e-13,
      `force pair at ${sample}`);
    near(spindleSpeedAtDeflection(state.deflection),
      state.spindleAngularSpeed, 2e-15,
    `speed/deflection inverse at ${sample}`);
    assert.ok(state.deflection >= geometry.minimumDeflection - 1e-14);
    assert.ok(state.deflection <= geometry.maximumDeflection + 1e-14);
    assert.ok(Math.abs(state.springLengthError) < 2e-14);
  }
  const low = stateAtCyclePhase(0);
  const rising = stateAtCyclePhase(0.25);
  const high = stateAtCyclePhase(0.5);
  const falling = stateAtCyclePhase(0.75);
  assert.ok(low.spindleAngularSpeed < rising.spindleAngularSpeed);
  assert.ok(rising.spindleAngularSpeed < high.spindleAngularSpeed);
  near(falling.spindleAngularSpeed, rising.spindleAngularSpeed, 2e-15,
    'symmetric speed response');
  assert.ok(low.deflection < rising.deflection);
  assert.ok(rising.deflection < high.deflection);
  near(falling.deflection, rising.deflection, 3e-15,
    'symmetric spring response');
  disposeModel(model.root);
});

test('movement 287 differentiates ball spread and sleeve lift consistently', () => {
  const model = createMovementModel(catalog.movements[286]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 2e-5;
  for (const time of [0.57, 1.41, 2.73, 3.62, 4.58, 5.77, 7.19]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.deflection - before.deflection) / (2 * epsilon),
      state.deflectionRate, 2e-8,
    `deflection velocity at ${time}`);
    near((after.deflectionRate - before.deflectionRate) / (2 * epsilon),
      state.deflectionAcceleration, 2e-7,
    `deflection acceleration at ${time}`);
    near((after.sleeveY - before.sleeveY) / (2 * epsilon),
      state.sleeveVelocityY, 3e-8,
    `sleeve velocity at ${time}`);
    near((after.sleeveVelocityY - before.sleeveVelocityY)
        / (2 * epsilon),
    state.sleeveAccelerationY, 4e-7,
    `sleeve acceleration at ${time}`);
    near(state.sleeveLift, 2 * state.ballLift, 2e-15,
      `midpoint-to-sleeve lift ratio at ${time}`);
    near(state.sleeveVelocityY, 2 * state.ballVerticalSpeed, 2e-15,
      `midpoint-to-sleeve speed ratio at ${time}`);
    near(state.sleeveAccelerationY,
      2 * state.ballVerticalAcceleration, 2e-15,
    `midpoint-to-sleeve acceleration ratio at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 287 keeps two rotating weights exactly 180 degrees apart', () => {
  const model = createMovementModel(catalog.movements[286]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;
  for (const time of [0.31, 1.37, 2.91, 4.43, 6.28, 7.73]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    assert.equal(state.ballStates.length, 2);
    for (let index = 0; index < 2; index += 1) {
      const ball = state.ballStates[index];
      near(Math.hypot(ball.position.x, ball.position.z),
        state.ballOrbitRadius, 5e-16,
      `ball radius ${index} at ${time}`);
      near(ball.position.y, state.ballCenterY, 0,
        `ball height ${index} at ${time}`);
      const numericalVelocity = after.ballStates[index].position.clone()
        .sub(before.ballStates[index].position)
        .multiplyScalar(1 / (2 * epsilon));
      vectorNear(ball.velocity, numericalVelocity, 1e-7,
        `ball velocity ${index} at ${time}`);
      const numericalAcceleration = after.ballStates[index].velocity.clone()
        .sub(before.ballStates[index].velocity)
        .multiplyScalar(1 / (2 * epsilon));
      vectorNear(ball.acceleration, numericalAcceleration, 8e-7,
        `ball acceleration ${index} at ${time}`);
      const next = state.ballStates[(index + 1) % 2];
      const radial = new THREE.Vector2(ball.position.x, ball.position.z)
        .normalize();
      const nextRadial = new THREE.Vector2(
        next.position.x,
        next.position.z,
      ).normalize();
      near(radial.dot(nextRadial), -1, 9e-15,
        `180-degree spacing ${index} at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 287 accelerates, lifts, decelerates, and closes in six turns', () => {
  const model = createMovementModel(catalog.movements[286]);
  const {
    animationTiming,
    canonicalStates,
    geometry,
    stateAtCyclePhase,
    timeline,
  } = model.root.userData;
  const low = canonicalStates.lowSpeed;
  const accelerating = canonicalStates.accelerating;
  const high = canonicalStates.highSpeed;
  const decelerating = canonicalStates.decelerating;
  const closure = canonicalStates.cycleClosure;

  assert.equal(timeline.cyclePeriod, 8);
  assert.equal(timeline.rotationsPerCycle, 6);
  assert.deepEqual(timeline.schedule, [
    'speed-rises-balls-bow-outward-sleeve-rises',
    'maximum-speed-maximum-sleeve-lift',
    'speed-falls-springs-retract-balls-sleeve-descends',
    'minimum-speed-minimum-sleeve-height',
  ]);
  assert.equal(animationTiming.authoredCyclePeriod, 8);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.match(low.stage, /minimum-speed/);
  assert.match(accelerating.stage, /speed-rising/);
  assert.match(high.stage, /maximum-speed/);
  assert.match(decelerating.stage, /speed-falling/);
  near(low.deflection, geometry.minimumDeflection, 3e-16,
    'minimum deflection');
  near(high.deflection, geometry.maximumDeflection, 6e-16,
    'maximum deflection');
  near(low.sleeveLift, 0, 0, 'minimum sleeve lift');
  near(high.sleeveLift, geometry.sleeveStroke, 0,
    'maximum sleeve lift');
  near(closure.governorAngle - low.governorAngle,
    6 * Math.PI * 2, 4e-15, 'six-turn cycle');
  near(closure.spindleAngularSpeed, low.spindleAngularSpeed, 0,
    'speed closure');
  near(closure.deflection, low.deflection, 0, 'deflection closure');
  near(closure.sleeveY, low.sleeveY, 0, 'sleeve closure');
  near(stateAtCyclePhase(1).governorAngle, closure.governorAngle, 0,
    'phase API closure');
  disposeModel(model.root);
});

test('movement 287 renderer binds all spring, weight, spindle, and sleeve states', () => {
  const model = createMovementModel(catalog.movements[286]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  for (const time of [0, 0.8, 1.9, 3.1, 4, 5.3, 6.7, 8]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.governorRotor.rotation.y, expected.governorAngle, 0,
      `rendered rotor at ${time}`);
    near(blocks.slidingSleeve.position.y, expected.sleeveY, 0,
      `rendered sleeve at ${time}`);
    near(blocks.slidingSleeve.userData.axialSpeed,
      expected.sleeveVelocityY, 0,
    `rendered sleeve speed at ${time}`);
    for (const [index, assembly] of blocks.springAssemblies.entries()) {
      near(assembly.ball.position.x, expected.ballOrbitRadius, 0,
        `rendered ball radius ${index} at ${time}`);
      near(assembly.ball.position.y, expected.ballCenterY, 0,
        `rendered ball height ${index} at ${time}`);
      assert.equal(assembly.spring.userData.centerlinePoints.length, 65);
      near(assembly.spring.userData.centerlineLength,
        expected.springCenterlineLength, 0,
      `rendered spring length ${index} at ${time}`);
      near(assembly.spring.userData.lengthError, 0, 2e-14,
        `rendered spring error ${index} at ${time}`);
      near(model.root.userData.contacts.springAnchors[index].lengthError,
        0, 2e-14, `contact spring error ${index} at ${time}`);
      near(model.root.userData.contacts.ballClamps[index]
        .middleTangentRadialComponent, 0, 2e-15,
      `rendered middle clamp ${index} at ${time}`);
    }
    assert.equal(model.root.userData.contacts.sleeveFeather
      .relativeAngularSpeed, 0);
    model.root.updateMatrixWorld(true);
    for (const [index, assembly] of blocks.springAssemblies.entries()) {
      const renderedBall = model.root.worldToLocal(
        assembly.ball.getWorldPosition(new THREE.Vector3()),
      );
      vectorNear(renderedBall, expected.ballStates[index].position, 2e-14,
        `rendered world ball ${index} at ${time}`);
    }
  }

  model.update(0);
  const startRotor = blocks.governorRotor.quaternion.clone();
  const startSleeve = blocks.slidingSleeve.position.clone();
  model.update(timeline.cyclePeriod);
  near(blocks.governorRotor.quaternion.angleTo(startRotor), 0, 3e-15,
    'rendered rotor closure');
  vectorNear(blocks.slidingSleeve.position, startSleeve, 0,
    'rendered sleeve closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
