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

function planarNear(actual, expected, tolerance, message) {
  near(
    Math.hypot(actual.x - expected.x, actual.y - expected.y),
    0,
    tolerance,
    message,
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

test('movement 319 is Brown’s complete cut-rim bimetallic compensation balance', () => {
  const movement = catalog.movements[318];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    massModel,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 319);
  assert.equal(movement.number, '319');
  assert.match(movement.title, /^Compensation balance/);
  assert.equal(movement.category, 'Escapements & horology');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'cut-bimetallic-rim-constant-rate-compensation-balance');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /main balance bar t–a–t′/);
  assert.match(mechanism, /timing screws outward/);
  assert.match(mechanism, /outer brass layer/);
  assert.match(mechanism, /draws b and b′/);
  assert.match(mechanism, /sqrt\(kappa\/I\) constant/);
  assert.equal(transmission.bimetalLayerOrder,
    'brass radially outside, steel radially inside');
  assert.equal(transmission.timingScrewCount, 2);
  assert.match(transmission.compensationTarget, /sqrt/);
  assert.ok(massModel.balance.referenceInertia > 0);
  assert.ok(massModel.spring.referenceStiffness > 0);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.balanceAssembly.parent, model.root);
  assert.equal(blocks.mainBar.parent, blocks.balanceAssembly);
  assert.equal(blocks.hub.parent, blocks.balanceAssembly);
  assert.equal(blocks.staff.parent, blocks.balanceAssembly);
  assert.equal(blocks.rightWeight.group.parent, blocks.balanceAssembly);
  assert.equal(blocks.leftWeight.group.parent, blocks.balanceAssembly);
  assert.equal(blocks.topTimingScrew.group.parent,
    blocks.balanceAssembly);
  assert.equal(blocks.bottomTimingScrew.group.parent,
    blocks.balanceAssembly);
  assert.equal(blocks.compoundArmSegments.length, 2);
  assert.equal(blocks.compoundArmSegments[0].length, 42);
  assert.equal(blocks.compoundArmSegments[1].length, 42);
  assert.equal(blocks.springSegments.length, 112);
  assert.deepEqual(blocks.balanceAssembly.userData.axis,
    new THREE.Vector3(0, 0, 1));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'outer-brass-layer-of-compound-balance-arm').length, 84);
  assert.equal(roles.filter((role) =>
    role === 'inner-steel-layer-of-compound-balance-arm').length, 84);
  assert.equal(roles.filter((role) =>
    role === 'bimetal-arm-carried-compensation-weight').length, 2);
  assert.equal(roles.filter((role) =>
    role === 'timing-regulation-screw-nut').length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 319 records t, a, t-prime, both weights, and the disabled source animation', () => {
  const movement = catalog.movements[318];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToNeutralFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate319;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /central staff a/);
  assert.match(sourceAnimation.referenceScope, /t–a–t′/);
  assert.match(sourceAnimation.referenceScope, /brass outside/);
  assert.match(sourceAnimation.referenceScope, /weights b and b′/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_319.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.rasterCenter, new THREE.Vector2(264, 265));
  assert.deepEqual(plate.rasterTopAttachmentT,
    new THREE.Vector2(265, 65));
  assert.deepEqual(plate.rasterBottomAttachmentTPrime,
    new THREE.Vector2(265, 465));
  assert.deepEqual(plate.rasterTopTimingScrew,
    new THREE.Vector2(265, 32));
  assert.deepEqual(plate.rasterBottomTimingScrew,
    new THREE.Vector2(265, 495));
  assert.deepEqual(plate.rasterRightWeightB,
    new THREE.Vector2(469, 275));
  assert.deepEqual(plate.rasterLeftWeightBPrime,
    new THREE.Vector2(57, 241));
  assert.match(plate.inferredTopology, /central staff a/);
  assert.match(plate.inferredTopology, /brass outside and steel inside/);

  near((plate.rasterBottomAttachmentTPrime.y
      - plate.rasterTopAttachmentT.y) * geometry.sourceScale / 2,
    geometry.referenceAttachmentRadius, 0,
  'source attachment radius');
  near((plate.rasterHubRight.x - plate.rasterHubLeft.x)
      * geometry.sourceScale / 2,
    geometry.hubRadius, 0, 'source hub radius');
  const neutral = stateAtTime(0);
  const sourceTolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  planarNear(sourcePointToNeutralFront(plate.rasterTopAttachmentT),
    neutral.topAttachment.position, sourceTolerance,
  'source top t attachment');
  planarNear(sourcePointToNeutralFront(
    plate.rasterBottomAttachmentTPrime,
  ), neutral.bottomAttachment.position, sourceTolerance,
  'source bottom t-prime attachment');
  planarNear(sourcePointToNeutralFront(plate.rasterTopTimingScrew),
    neutral.topTimingScrew.position, sourceTolerance,
  'source top timing screw');
  planarNear(sourcePointToNeutralFront(plate.rasterBottomTimingScrew),
    neutral.bottomTimingScrew.position, sourceTolerance,
  'source bottom timing screw');
  planarNear(sourcePointToNeutralFront(plate.rasterRightWeightB),
    neutral.rightWeight.position, sourceTolerance,
  'source right b weight');
  planarNear(sourcePointToNeutralFront(plate.rasterLeftWeightBPrime),
    neutral.leftWeight.position, sourceTolerance,
  'source left b-prime weight');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 319 exactly matches balance inertia to temperature-softened spring stiffness', () => {
  const model = createMovementModel(catalog.movements[318]);
  const {
    compensationAtTemperatureCoordinate,
    geometry,
    massModel,
    massProperties,
  } = model.root.userData;
  let previousCoordinate = -Infinity;
  let previousAttachment = -Infinity;
  let previousWeightRadius = Infinity;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const coordinate = -1 + 2 * sample / 65536;
    const compensation = compensationAtTemperatureCoordinate(coordinate);
    const properties = massProperties(compensation);
    assert.ok(coordinate > previousCoordinate || sample === 0);
    assert.ok(compensation.attachmentRadius > previousAttachment
      || sample === 0,
    `main bar expands monotonically at ${sample}`);
    assert.ok(compensation.weightRadius < previousWeightRadius
      || sample === 0,
    `bimetal weights move inward monotonically at ${sample}`);
    previousCoordinate = coordinate;
    previousAttachment = compensation.attachmentRadius;
    previousWeightRadius = compensation.weightRadius;
    near(properties.inertia, compensation.targetInertia, 3e-14,
      `target inertia at ${sample}`);
    near(properties.inertia / geometry.referenceInertia,
      compensation.springStiffnessRatio, 5e-16,
    `inertia-stiffness ratio at ${sample}`);
    near(Math.sqrt(
      massModel.spring.referenceStiffness
        * compensation.springStiffnessRatio / properties.inertia,
    ), geometry.balanceAngularFrequency, 2e-15,
    `constant natural frequency at ${sample}`);
    assert.ok(compensation.weightRadiusSquared > 0,
      `physical compensation radius at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 319 heat expands t-a-t-prime but bends both brass-outside arms and weights inward', () => {
  const model = createMovementModel(catalog.movements[318]);
  const { canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const neutral = stateAtTime(canonicalTimes.neutralHeating);
  const hot = stateAtTime(canonicalTimes.hot);
  const cold = stateAtTime(canonicalTimes.cold);

  assert.equal(neutral.temperatureState, 'neutral');
  assert.equal(hot.temperatureState, 'hot-weights-drawn-inward');
  assert.equal(cold.temperatureState, 'cold-weights-moved-outward');
  near(hot.temperature,
    geometry.nominalTemperature + geometry.temperatureAmplitude, 0,
  'hot temperature');
  near(cold.temperature,
    geometry.nominalTemperature - geometry.temperatureAmplitude, 0,
  'cold temperature');
  assert.ok(hot.attachmentRadius > neutral.attachmentRadius);
  assert.ok(cold.attachmentRadius < neutral.attachmentRadius);
  assert.ok(hot.massProperties.timingScrewRadius
    > neutral.massProperties.timingScrewRadius);
  assert.ok(cold.massProperties.timingScrewRadius
    < neutral.massProperties.timingScrewRadius);
  assert.ok(hot.weightRadius < neutral.weightRadius);
  assert.ok(cold.weightRadius > neutral.weightRadius);
  assert.ok(hot.inertia < neutral.inertia);
  assert.ok(cold.inertia > neutral.inertia);
  assert.ok(hot.springStiffness < neutral.springStiffness);
  assert.ok(cold.springStiffness > neutral.springStiffness);
  near(hot.naturalAngularFrequency,
    neutral.naturalAngularFrequency, 2e-15,
  'hot compensated rate');
  near(cold.naturalAngularFrequency,
    neutral.naturalAngularFrequency, 2e-15,
  'cold compensated rate');
  near(hot.rightWeight.position.length(), hot.weightRadius, 1e-15,
    'hot right b radius');
  near(hot.leftWeight.position.length(), hot.weightRadius, 1e-15,
    'hot left b-prime radius');
  vectorNear(hot.leftWeight.position,
    hot.rightWeight.position.clone().multiplyScalar(-1), 0,
  'opposed hot weights');
  disposeModel(model.root);
});

test('movement 319 quarter-rim material coordinates remain continuous between t and each weight', () => {
  const model = createMovementModel(catalog.movements[318]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(
      geometry.thermalCyclePeriod * sample / 16384,
    );
    vectorNear(state.armPoint(1, 0).position,
      state.topAttachment.position, 0,
    `upper arm starts at t at ${sample}`);
    vectorNear(state.armPoint(-1, 0).position,
      state.bottomAttachment.position, 0,
    `lower arm starts at t-prime at ${sample}`);
    vectorNear(state.armPoint(1, 1).position,
      state.rightWeight.position, 0,
    `upper arm reaches b at ${sample}`);
    vectorNear(state.armPoint(-1, 1).position,
      state.leftWeight.position, 0,
    `lower arm reaches b-prime at ${sample}`);
    for (const parameter of [0, 0.125, 0.5, 0.875, 1]) {
      const upper = state.armPoint(1, parameter);
      const lower = state.armPoint(-1, parameter);
      vectorNear(upper.position, lower.position.clone().multiplyScalar(-1),
        2e-15, `opposed material point ${parameter} at ${sample}`);
      const expectedRadius = Math.hypot(
        state.weightRadius * Math.sin(Math.PI * parameter / 2),
        state.attachmentRadius * Math.cos(Math.PI * parameter / 2),
      );
      near(upper.position.length(), expectedRadius, 3e-15,
        `quarter-ellipse radius ${parameter} at ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 319 analytic thermal, radial, and oscillatory rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[318]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.17, 0.83, 1.61, 2.73, 4.29, 6.34, 7.71]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.weightRadius - before.weightRadius) / (2 * epsilon),
      state.weightRadiusVelocity, 1e-9,
    `weight-radius velocity at ${time}`);
    near((after.weightRadiusVelocity - before.weightRadiusVelocity)
        / (2 * epsilon),
      state.weightRadiusAcceleration, 1e-9,
    `weight-radius acceleration at ${time}`);
    near((after.attachmentRadius - before.attachmentRadius)
        / (2 * epsilon),
      state.attachmentRadiusVelocity, 1e-10,
    `bar-expansion velocity at ${time}`);
    near((after.balanceAngle - before.balanceAngle) / (2 * epsilon),
      state.balanceAngularVelocity, 4e-9,
    `balance angular velocity at ${time}`);
    near((after.balanceAngularVelocity - before.balanceAngularVelocity)
        / (2 * epsilon),
      state.balanceAngularAcceleration, 2e-8,
    `balance angular acceleration at ${time}`);
    vectorNear(after.rightWeight.position.clone()
      .sub(before.rightWeight.position).multiplyScalar(1 / (2 * epsilon)),
    state.rightWeight.velocity, 1e-8,
    `right b velocity at ${time}`);
    vectorNear(after.leftWeight.velocity.clone()
      .sub(before.leftWeight.velocity).multiplyScalar(1 / (2 * epsilon)),
    state.leftWeight.acceleration, 8e-8,
    `left b-prime acceleration at ${time}`);
    vectorNear(after.topTimingScrew.position.clone()
      .sub(before.topTimingScrew.position)
      .multiplyScalar(1 / (2 * epsilon)),
    state.topTimingScrew.velocity, 1e-8,
    `top timing-screw velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 319 renderer keeps brass outside steel and binds all four radial endpoints', () => {
  const model = createMovementModel(catalog.movements[318]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const rightWorld = new THREE.Vector3();
  const leftWorld = new THREE.Vector3();
  const topWorld = new THREE.Vector3();
  const bottomWorld = new THREE.Vector3();
  const springStart = new THREE.Vector3();
  const springEnd = new THREE.Vector3();

  assert.equal(blocks.springSegments[0].castShadow, false);
  assert.equal(blocks.springSegments[0].receiveShadow, false);
  assert.equal(model.root.userData.groundFloorY, -5.00);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);

  for (const time of [
    canonicalTimes.neutralHeating,
    canonicalTimes.hot,
    canonicalTimes.neutralCooling,
    canonicalTimes.cold,
    canonicalTimes.cycleClosure,
    0.37,
    5.29,
  ]) {
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.balanceAssembly.rotation.z, expected.balanceAngle, 0,
      `rendered balance at ${time}`);
    near(blocks.mainBar.scale.y, 2 * expected.attachmentRadius, 0,
      `rendered expanding main bar at ${time}`);
    blocks.rightWeight.group.getWorldPosition(rightWorld);
    blocks.leftWeight.group.getWorldPosition(leftWorld);
    blocks.topTimingScrew.group.getWorldPosition(topWorld);
    blocks.bottomTimingScrew.group.getWorldPosition(bottomWorld);
    vectorNear(rightWorld, expected.rightWeight.position, 3e-15,
      `rendered right b at ${time}`);
    vectorNear(leftWorld, expected.leftWeight.position, 3e-15,
      `rendered left b-prime at ${time}`);
    vectorNear(topWorld, expected.topTimingScrew.position, 3e-15,
      `rendered top timing screw at ${time}`);
    vectorNear(bottomWorld, expected.bottomTimingScrew.position, 3e-15,
      `rendered bottom timing screw at ${time}`);

    for (const arm of blocks.compoundArmSegments) {
      for (const index of [0, 10, 21, 31, 41]) {
        const { brass, steel } = arm[index];
        assert.equal(brass.userData.layer, 'radially-outer-brass');
        assert.equal(steel.userData.layer, 'radially-inner-steel');
        assert.ok(brass.position.length() > steel.position.length(),
          `brass outside steel in arm segment ${index} at ${time}`);
      }
    }

    for (const index of [0, 31, 63, 95, 111]) {
      // Brown draws no balance spring, so source presentation detaches the
      // segments; their kinematic law is still checked in the root frame.
      const segment = blocks.springSegments[index];
      assert.equal(segment.parent, null);
      segment.updateMatrix();
      const segmentWorld = model.root.matrixWorld.clone()
        .multiply(segment.matrix);
      springStart.set(0, -0.5, 0).applyMatrix4(segmentWorld);
      springEnd.set(0, 0.5, 0).applyMatrix4(segmentWorld);
      vectorNear(springStart,
        expected.balanceSpringPoint(
          blocks.springSamples[index].parameter,
        ).position,
      3e-15, `spring segment ${index} start at ${time}`);
      vectorNear(springEnd,
        expected.balanceSpringPoint(
          blocks.springSamples[index + 1].parameter,
        ).position,
      3e-15, `spring segment ${index} end at ${time}`);
    }
    near(model.root.userData.compensationState.inertiaError,
      expected.inertiaError, 0,
    `published compensation error at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 319 closes eight balance vibrations and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[318]);
  const {
    animationTiming,
    canonicalTimes,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  assert.equal(animationTiming.authoredCyclePeriod, 8);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  near((closure.unwrappedBalancePhase - start.unwrappedBalancePhase)
      / (Math.PI * 2),
    8, 0, 'eight balance vibrations');
  near(closure.unwrappedThermalAngle - start.unwrappedThermalAngle,
    Math.PI * 2, 0, 'one temperature cycle');
  near(closure.balanceAngle, start.balanceAngle, 0,
    'balance closure');
  near(closure.weightRadius, start.weightRadius, 0,
    'weight-radius closure');
  vectorNear(closure.rightWeight.position, start.rightWeight.position, 0,
    'right b closure');
  vectorNear(closure.leftWeight.position, start.leftWeight.position, 0,
    'left b-prime closure');
  assert.deepEqual(timeline.schedule, [
    'neutral-source-proportions-and-balanced-rate',
    'heating-expands-main-bar-and-softens-balance-spring',
    'outer-brass-layers-bend-bimetal-arms-inward',
    'weights-b-and-b-prime-reduce-total-inertia',
    'cooling-moves-both-weights-outward-again',
    'eight-balance-vibrations-close-with-one-thermal-cycle',
  ]);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
