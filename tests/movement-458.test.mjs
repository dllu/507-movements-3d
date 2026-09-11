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
  'single-fixed-sheave-one-continuous-rope-two-opposed-well-buckets-with-exact-no-slip-spin';
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

test('movement 458 has one fixed-axis sheave, one continuous rope, and exactly two opposed bucket ends', () => {
  const movement = catalog.movements[457];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 458);
  assert.equal(movement.number, '458');
  assert.equal(movement.title, 'Common pulley and two well buckets');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.pulley.parent, model.root);
  assert.equal(blocks.fixedAxle.parent, model.root);
  assert.equal(blocks.continuousRope.parent, model.root);
  assert.equal(blocks.upperArc.parent, blocks.continuousRope);
  assert.equal(blocks.leftRopeLeg.parent, blocks.continuousRope);
  assert.equal(blocks.rightRopeLeg.parent, blocks.continuousRope);
  assert.equal(blocks.leftBucket.bucket.parent, model.root);
  assert.equal(blocks.rightBucket.bucket.parent, model.root);
  assert.equal(blocks.leftBucket.water.parent, blocks.leftBucket.bucket);
  assert.equal(blocks.rightBucket.water.parent, blocks.rightBucket.bucket);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.pulleySpinIndependent, false);
  assert.equal(degreesOfFreedom.leftBucketIndependent, false);
  assert.equal(degreesOfFreedom.rightBucketIndependent, false);
  assert.equal(blocks.pulley.userData.radius, geometry.pulleyRadius);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(roles.filter((role) => role ===
    'one-fixed-axis-common-sheave-with-no-slip-rope-contact').length, 1);
  assert.equal(roles.filter((role) => role ===
    'one-continuous-open-rope-with-two-bucket-ends').length, 1);
  assert.equal(roles.filter((role) => /well-bucket-at-one-end/.test(role))
    .length, 2);
  assert.equal(roles.filter((role) => /vertical-leg/.test(role)).length, 2);
  assert.equal(roles.some((role) => /belt|tracer|marker|sphere|bead/i.test(role)),
    false, 'no extra belts or moving marker spheres');
  disposeModel(model.root);
});

test('movement 458 records the official canvas timing and explicitly corrects its approximate pulley turn command', () => {
  const movement = catalog.movements[457];
  const model = createMovementModel(movement);
  const { animationTiming, dynamics, sourceAnimation, sourceReference } =
    model.root.userData;
  const canvas = sourceReference.officialCanvasModel;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_458.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /common pulley and buckets/);
  assert.match(movement.description,
    /empty bucket is pulled down to raise the full one/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.runtimeModelFlagPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  near(animationTiming.authoredCyclePeriod, 7.5, 0,
    'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'viewer cycle duration');
  assert.deepEqual(canvas.bucketKeyframeFractions, [0, 0.4, 0.5, 0.9]);
  near(canvas.stroke, 12.409291, 1e-12, 'source canvas stroke');
  near(canvas.pulleyRadius, 1.075, 0, 'source canvas sheave radius');
  near(canvas.commandedPulleyTurnsPerExchange, 2, 0,
    'source commanded turns');
  near(canvas.noSlipTurnsForCanvasDimensions,
    canvas.stroke / (FULL_TURN * canvas.pulleyRadius), 0,
    'turns implied by source geometry');
  assert.ok(Math.abs(canvas.turnCommandToNoSlipRatio - 1) > 0.08,
    'official command differs materially from exact no-slip turns');
  assert.match(dynamics.noSlipModel,
    /exactly rope displacement, speed and acceleration divided by sheave radius/);
  assert.match(dynamics.smoothingDisclosure,
    /Quintic C2 interpolation.*remove visible jerk/);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence,
    /one roof-supported spoked sheave.*exactly two vertical legs.*one bucket on each end/);
  assert.match(evidence.reconstructionDisclosure,
    /canvas supplies opposing endpoint coordinates.*commands an approximate pulley turn count/);
  disposeModel(model.root);
});

test('movement 458 source pose starts with the left bucket empty and high and the right bucket full and low', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.mode,
    'left-empty-high-right-full-low-ready-for-exchange');
  near(sourcePose.leftBailY, geometry.leftHighBailY, 0,
    'left source height');
  near(sourcePose.rightBailY, geometry.rightLowBailY, 0,
    'right source height');
  near(sourcePose.leftWaterFraction, 0, 0, 'left source bucket empty');
  near(sourcePose.rightWaterFraction, 1, 0, 'right source bucket full');
  near(sourcePose.pulleyAngle, 0, 0, 'source sheave datum');
  assert.ok(source.leftBailY > source.rightBailY);
  near(source.leftBucketCenter.y + geometry.bucketHeight / 2
    + geometry.bucketHandleRise, source.leftBailY, 0,
  'left rope joins the handle apex');
  near(source.rightBucketCenter.y + geometry.bucketHeight / 2
    + geometry.bucketHandleRise, source.rightBailY, 3e-16,
  'right rope joins the handle apex');
  disposeModel(model.root);
});

test('movement 458 follows the source 40/10/40/10 exchange with the empty side pulled down each way', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { geometry, stateAtInputAngle, timeline } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  const outward = atPhase(0.20);
  const exchange = atPhase(0.45);
  const returning = atPhase(0.70);
  const reset = atPhase(0.95);

  assert.equal(outward.mode,
    'left-empty-pulled-down-raising-right-full-bucket');
  assert.equal(outward.pulledEmptySide, 'left');
  near(outward.leftWaterFraction, 0, 0, 'left empty outward');
  near(outward.rightWaterFraction, 1, 0, 'right full outward');
  assert.ok(outward.leftBucketVelocityY < 0);
  assert.ok(outward.rightBucketVelocityY > 0);

  assert.equal(exchange.mode,
    'left-bucket-filling-low-right-bucket-emptying-high');
  near(exchange.ropeSpeed, 0, 0, 'rope stopped for exchange');
  near(exchange.leftWaterFraction, 0.5, 2e-15, 'left half filled');
  near(exchange.rightWaterFraction, 0.5, 2e-15, 'right half emptied');

  assert.equal(returning.mode,
    'right-empty-pulled-down-raising-left-full-bucket');
  assert.equal(returning.pulledEmptySide, 'right');
  near(returning.leftWaterFraction, 1, 0, 'left full returning');
  near(returning.rightWaterFraction, 0, 0, 'right empty returning');
  assert.ok(returning.leftBucketVelocityY > 0);
  assert.ok(returning.rightBucketVelocityY < 0);

  assert.equal(reset.mode,
    'left-bucket-emptying-high-right-bucket-filling-low');
  near(reset.ropeSpeed, 0, 0, 'rope stopped for reset');
  near(reset.leftWaterFraction, 0.5, 2e-15, 'left half emptied');
  near(reset.rightWaterFraction, 0.5, 2e-15, 'right half filled');
  assert.deepEqual(timeline.stages, [
    'left empty down / right full up',
    'left fills / right empties',
    'right empty down / left full up',
    'right fills / left empties',
  ]);
  near(geometry.outwardEndPhase, 0.4, 0, 'outward fraction');
  near(geometry.exchangeDwellEndPhase, 0.5, 0, 'exchange dwell end');
  near(geometry.returnEndPhase, 0.9, 0, 'return fraction');
  disposeModel(model.root);
});

test('movement 458 preserves one constant rope length and exactly opposite bucket travel at every sampled pose', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const bailSum = source.leftBailY + source.rightBailY;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.leftVerticalLength + state.fixedArcLength
      + state.rightVerticalLength, geometry.totalRopeLength, 2e-15,
    `piecewise rope length at ${sample}`);
    near(state.totalRopeLength, geometry.totalRopeLength, 2e-15,
      `reported rope length at ${sample}`);
    near(state.leftBailY + state.rightBailY, bailSum, 3e-16,
      `opposed bail travel at ${sample}`);
    near(state.leftBucketCenter.y + state.rightBucketCenter.y,
      source.leftBucketCenter.y + source.rightBucketCenter.y, 7e-16,
    `opposed bucket travel at ${sample}`);
    near(state.leftBucketCenter.x, -geometry.pulleyRadius, 0,
      `left tangent x at ${sample}`);
    near(state.rightBucketCenter.x, geometry.pulleyRadius, 0,
      `right tangent x at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 458 derives the sole sheave angle, rate, and acceleration exactly from rope motion and radius', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 16000; sample += 1) {
    const angle = FULL_TURN * sample / 16000;
    const speed = 0.4 + 2.1 * (sample % 17) / 16;
    const acceleration = -0.3 + 0.7 * (sample % 13) / 12;
    const state = stateAtInputAngle(angle, speed, acceleration);
    near(state.pulleyAngle,
      state.ropeDisplacement / geometry.pulleyRadius, 0,
    `no-slip angle at ${sample}`);
    near(state.pulleyAngularSpeed,
      state.ropeSpeed / geometry.pulleyRadius, 0,
    `no-slip angular speed at ${sample}`);
    near(state.pulleyAngularAcceleration,
      state.ropeAcceleration / geometry.pulleyRadius, 0,
    `no-slip angular acceleration at ${sample}`);
    near(-state.pulleyAngularSpeed * geometry.pulleyRadius,
      state.leftBucketVelocityY, 2e-15,
    `left tangent velocity at ${sample}`);
    near(state.pulleyAngularSpeed * geometry.pulleyRadius,
      state.rightBucketVelocityY, 2e-15,
    `right tangent velocity at ${sample}`);
    near(-state.pulleyAngularAcceleration * geometry.pulleyRadius,
      state.leftBucketAccelerationY, 2e-14,
    `left tangent acceleration at ${sample}`);
    near(state.pulleyAngularAcceleration * geometry.pulleyRadius,
      state.rightBucketAccelerationY, 2e-14,
    `right tangent acceleration at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 458 rope, sheave, buckets, and water are C2-stationary at all four handoffs', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { stateAtInputAngle } = model.root.userData;
  const boundaries = [0, 0.4, 0.5, 0.9];
  for (const phase of boundaries) {
    const angle = FULL_TURN * phase;
    const state = stateAtInputAngle(angle);
    near(state.ropeSpeed, 0, 3e-28,
      `zero rope speed at phase ${phase}`);
    near(state.ropeAcceleration, 0, 3e-13,
      `zero rope acceleration at phase ${phase}`);
    near(state.pulleyAngularSpeed, 0, 4e-28,
      `zero sheave speed at phase ${phase}`);
    near(state.pulleyAngularAcceleration, 0, 4e-13,
      `zero sheave acceleration at phase ${phase}`);
    near(state.leftWaterFractionRate, 0, 2e-14,
      `zero left flow rate at phase ${phase}`);
    near(state.rightWaterFractionRate, 0, 2e-14,
      `zero right flow rate at phase ${phase}`);
    near(state.leftWaterFractionAcceleration, 0, 3e-12,
      `zero left flow acceleration at phase ${phase}`);
    near(state.rightWaterFractionAcceleration, 0, 3e-12,
      `zero right flow acceleration at phase ${phase}`);

    const epsilon = 1e-8;
    const before = stateAtInputAngle(angle - epsilon);
    const after = stateAtInputAngle(angle + epsilon);
    near(after.ropeSpeed, before.ropeSpeed, 2e-12,
      `continuous rope speed at phase ${phase}`);
    near(after.ropeAcceleration, before.ropeAcceleration, 2e-6,
      `continuous rope acceleration at phase ${phase}`);
    near(after.leftWaterFractionRate, before.leftWaterFractionRate, 2e-12,
      `continuous left fill rate at phase ${phase}`);
    near(after.rightWaterFractionRate, before.rightWaterFractionRate, 2e-12,
      `continuous right fill rate at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 458 analytic bucket velocities and accelerations agree with finite differences', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.43, 1.18, 3.54, 4.83]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const numericLeftVelocity = (after.leftBucketCenter.y
      - before.leftBucketCenter.y) * geometry.inputAngularSpeed
      / (2 * step);
    const numericRightVelocity = (after.rightBucketCenter.y
      - before.rightBucketCenter.y) * geometry.inputAngularSpeed
      / (2 * step);
    near(state.leftBucketVelocityY, numericLeftVelocity, 2e-9,
      `left velocity at ${angle}`);
    near(state.rightBucketVelocityY, numericRightVelocity, 2e-9,
      `right velocity at ${angle}`);
    const numericLeftAcceleration = (after.leftBucketVelocityY
      - before.leftBucketVelocityY) * geometry.inputAngularSpeed
      / (2 * step);
    const numericRightAcceleration = (after.rightBucketVelocityY
      - before.rightBucketVelocityY) * geometry.inputAngularSpeed
      / (2 * step);
    near(state.leftBucketAccelerationY, numericLeftAcceleration, 2e-8,
      `left acceleration at ${angle}`);
    near(state.rightBucketAccelerationY, numericRightAcceleration, 2e-8,
      `right acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 458 renderer maps the one-rope state and visible sheave index while its support stays fixed', () => {
  const model = createMovementModel(catalog.movements[457]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.frame, blocks.fixedAxle,
    blocks.pulley, blocks.upperArc, blocks.shaftWell, blocks.wellWater];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.2, 0.4, 0.45, 0.5, 0.7, 0.9, 0.95, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.pulley.userData.rotor.rotation.z, state.pulleyAngle, 0,
      `visible sheave spin at ${phase}`);
    near(blocks.leftRopeLeg.scale.y, state.leftVerticalLength, 4e-16,
      `left leg length at ${phase}`);
    near(blocks.rightRopeLeg.scale.y, state.rightVerticalLength, 4e-16,
      `right leg length at ${phase}`);
    near(blocks.leftRopeLeg.position.y,
      (state.leftBailY + geometry.pulleyCenter.y) / 2, 0,
    `left leg midpoint at ${phase}`);
    near(blocks.rightRopeLeg.position.y,
      (state.rightBailY + geometry.pulleyCenter.y) / 2, 0,
    `right leg midpoint at ${phase}`);
    vectorNear(blocks.leftBucket.bucket.position,
      state.leftBucketCenter, 0, `left bucket at ${phase}`);
    vectorNear(blocks.rightBucket.bucket.position,
      state.rightBucketCenter, 0, `right bucket at ${phase}`);
    assert.equal(blocks.leftBucket.water.visible,
      state.leftWaterFraction > 1e-5);
    assert.equal(blocks.rightBucket.water.visible,
      state.rightWaterFraction > 1e-5);
    if (blocks.leftBucket.water.visible) {
      near(blocks.leftBucket.water.scale.y,
        0.58 * state.leftWaterFraction, 0,
      `left water height at ${phase}`);
    }
    if (blocks.rightBucket.water.visible) {
      near(blocks.rightBucket.water.scale.y,
        0.58 * state.rightWaterFraction, 0,
      `right water height at ${phase}`);
    }
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.ropeDisplacement, source.ropeDisplacement, 0,
    'rope cycle closure');
  vectorNear(closure.leftBucketCenter, source.leftBucketCenter, 0,
    'left bucket cycle closure');
  vectorNear(closure.rightBucketCenter, source.rightBucketCenter, 0,
    'right bucket cycle closure');
  near(closure.leftWaterFraction, source.leftWaterFraction, 0,
    'left water cycle closure');
  near(closure.rightWaterFraction, source.rightWaterFraction, 0,
    'right water cycle closure');
  disposeModel(model.root);
});

test('movement 458 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement458 = catalog.movements[457];
  const movement507 = catalog.movements[506];
  const model458 = createMovementModel(movement458);
  const model507 = createMovementModel(movement507);
  model458.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model458.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement458.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model458.root);
  disposeModel(model507.root);
});
