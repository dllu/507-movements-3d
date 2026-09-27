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
  'water-filled-bucket-reciprocator-with-ground-opened-bottom-valve-single-rope-pulley-and-return-counterweight';
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

test('movement 439 has one rope over one pulley joining a valved bucket to one counterweight', () => {
  const movement = catalog.movements[438];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 439);
  assert.equal(movement.number, '439');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /One continuous rope runs from the counterweight.*over the upper half of one fixed-axis pulley/);
  assert.match(data.mechanism, /loaded bucket descends while lifting the counterweight by exactly the same distance/);
  assert.match(data.mechanism, /valve stem meets the fixed anvil.*empties the bucket/);
  assert.match(data.mechanism, /pulley rotation follows the single rope without slip/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketAndCounterweightIndependent, false);
  assert.equal(degreesOfFreedom.pulleySlipIndependent, false);
  assert.equal(degreesOfFreedom.valveLiftIndependent, false);
  assert.equal(blocks.ropeAssembly.parent, model.root);
  assert.equal(blocks.leftRopeStrand.parent, blocks.ropeAssembly);
  assert.equal(blocks.upperRopeArc.parent, blocks.ropeAssembly);
  assert.equal(blocks.rightRopeStrand.parent, blocks.ropeAssembly);
  assert.equal(blocks.pulleyDisk.parent, blocks.pulley);
  // Source presentation removes the white pulley stripe Brown does not draw.
  assert.equal(blocks.pulleyMarker.parent, null);
  assert.equal(blocks.bucket.parent, model.root);
  assert.equal(blocks.counterweight.parent, model.root);
  assert.equal(blocks.valve.parent, blocks.bucket);

  const ropes = [];
  const belts = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(ropes, [blocks.ropeAssembly]);
  assert.deepEqual(belts, []);
  assert.equal(blocks.ropeAssembly.userData.ropePathId,
    'movement-439-single-rope');
  for (const role of [
    'one-continuous-open-rope-counterweight-to-bucket-over-pulley',
    'single-fixed-axis-rope-pulley',
    'water-filled-reciprocating-bucket',
    'bottom-valve-opened-by-ground-contact',
    'bucket-return-counterweight',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws only the pulley, bucket, weight and spout: no gallows,
  // ground, striking block or spout post is presented. The valve still
  // opens at the ground-contact station of the kinematic schedule.
  assert.equal(blocks.strikeAnvil.userData.role,
    'ground-anvil-opening-bucket-valve');
  for (const role of ['ground-anvil-opening-bucket-valve', 'fixed-ground-beneath-bucket',
    'bored-pulley-shaft-hanger', 'fixed-post-carrying-upper-end-of-flume',
    'fixed-overhead-pulley-support-beam', 'fixed-pulley-support-post'])
    assert.ok(!roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 439 preserves Brown’s detailed operating sequence and discloses its smooth timing reconstruction', () => {
  const movement = catalog.movements[438];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate439;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_439.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /continuous fall of water/);
  assert.match(movement.description, /valve in the bottom of the bucket.*striking the ground/);
  assert.match(movement.description, /counterweight on the other side of the pulley/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureSplashLeakageValveImpactRopeElasticityPulleyInertiaBearingFrictionBucketMassCounterweightMassAndDynamicAccelerationModeled,
    false);
  assert.match(dynamics.fillDrainMotionSchedule,
    /quintic zero-velocity, zero-acceleration ramps.*counterweight return.*fills the bucket at one steady rate whenever the valve is shut/);
  assert.match(dynamics.ropeMarkerContinuity,
    /one analytic rope path.*straight-to-arc tangents match exactly/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximatePulleyCenterPixels, [233, 73]);
  assert.deepEqual(plate.approximateBucketCenterPixels, [287, 199]);
  assert.deepEqual(plate.approximateCounterweightCenterPixels, [177, 447]);
  assert.equal(plate.approximatePulleyRadiusPixels, 54);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /one upper pulley with a single rope.*bucket under a right-hand flume.*counterweight on the left/);
  assert.match(evidence.reconstructionDisclosure,
    /smooth phase schedule.*rope tracer.*independently engineered/);
  disposeModel(model.root);
});

test('movement 439 reconstructed source pose places the empty bucket high and counterweight low on a constant rope', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.bucketAttachmentY, geometry.topAttachmentY, 0,
    'source bucket high');
  near(sourcePose.counterweightAttachmentY, geometry.bottomAttachmentY, 0,
    'source counterweight low');
  near(sourcePose.pulleyAngle, 0, 0, 'source pulley angle');
  // The stream never stops: under the spout the bucket already holds the
  // water it gained since its valve reseated at the bottom (pass 69).
  near(sourcePose.waterFill, (1 - geometry.drainEndPhase) / (1 - (geometry.drainEndPhase - geometry.descendEndPhase)), 1e-12,
    'source bucket part filled by the running stream');
  near(sourcePose.valveLift, 0, 0, 'source valve closed');
  near(sourcePose.totalRopeLength, geometry.sourceTotalRopeLength, 0,
    'source rope length');
  near(source.totalRopeLength, sourcePose.totalRopeLength, 0,
    'source state matches recorded pose');
  disposeModel(model.root);
});

test('movement 439 fill, descent, ground-opened drain, and counterweight return occur in the stated order', () => {
  const model = createMovementModel(catalog.movements[438]);
  const {
    geometry,
    stateAtInputAngle,
    valveLiftAtPhase,
    waterFillAtPhase,
  } = model.root.userData;
  const stateAtPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);

  // Pass 69: constant inflow fills the bucket whenever its valve is shut,
  // from the reseat at the bottom (fillStartPhase) through the return and
  // the top dwell to the arrival at the anvil (fillEndPhase).
  near(waterFillAtPhase(geometry.fillStartPhase), 0, 0, 'empty when the valve reseats');
  const fillSpan = 1 - (geometry.fillStartPhase - geometry.fillEndPhase);
  near(waterFillAtPhase(geometry.fillStartPhase + fillSpan / 2), 0.5, 1e-12, 'half full half-way through the fill');
  near(waterFillAtPhase(geometry.fillEndPhase - 1e-9), 1, 1e-6, 'full on arrival at the anvil');
  let previousFill = waterFillAtPhase(geometry.fillStartPhase);
  for (let k = 1; k <= 200; k += 1) {
    const fill = waterFillAtPhase(geometry.fillStartPhase + fillSpan * k / 200 - 1e-9);
    assert.ok(fill >= previousFill - 1e-12, 'fill never falls while the valve is shut');
    near(fill - previousFill, fillSpan / 200 / fillSpan, 1e-6, 'constant inflow rate');
    previousFill = fill;
  }
  assert.ok(waterFillAtPhase(geometry.descendStartPhase) > 0.5,
    'outweighs the counterweight before it descends');
  near(stateAtPhase(
    (geometry.descendStartPhase + geometry.descendEndPhase) / 2,
  ).bucketAttachmentY,
  (geometry.topAttachmentY + geometry.bottomAttachmentY) / 2,
  1e-15, 'loaded bucket halfway down');
  near(stateAtPhase(geometry.descendEndPhase).bucketAttachmentY,
    geometry.bottomAttachmentY, 0, 'bucket reaches anvil station');
  const contactPhase = (geometry.valveOpenStartPhase + geometry.valveFullyOpenPhase) / 2;
  near(stateAtPhase(contactPhase).valveTipY, geometry.strikeAnvilY, 1e-15,
    'stem stays on the anvil while the bucket opens its valve');
  near(valveLiftAtPhase(geometry.valveFullyOpenPhase),
    geometry.valveMaximumLift, 0, 'valve fully open');
  near(waterFillAtPhase(
    (geometry.descendEndPhase + geometry.drainEndPhase) / 2,
  ), 0.5, 3e-15, 'bucket half drained at bottom');
  near(waterFillAtPhase(geometry.drainEndPhase), 0, 0,
    'bucket empty before return');
  near(stateAtPhase(
    (geometry.riseStartPhase + geometry.riseEndPhase) / 2,
  ).bucketAttachmentY,
  (geometry.topAttachmentY + geometry.bottomAttachmentY) / 2,
  1e-14, 'empty bucket halfway up');
  near(stateAtPhase(geometry.riseEndPhase).bucketAttachmentY,
    geometry.topAttachmentY, 0, 'counterweight returns bucket to top');
  disposeModel(model.root);
});

test('movement 439 bucket and counterweight always travel equally and oppositely on a constant-length rope', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 10000);
    near(state.bucketAttachmentY + state.counterweightAttachmentY,
      geometry.attachmentHeightSum, 5e-16,
      'opposed attachment-height sum');
    near(state.bucketVelocityY + state.counterweightVelocityY, 0, 0,
      'opposed vertical velocities');
    near(state.bucketAccelerationY + state.counterweightAccelerationY,
      0, 0, 'opposed vertical accelerations');
    near(state.totalRopeLength, geometry.sourceTotalRopeLength, 4e-15,
      'single-rope length');
    near(state.leftRopeLength + state.rightRopeLength,
      geometry.sourceTotalRopeLength - geometry.ropeArcLength,
      4e-15, 'straight strands exchange equal length');
  }
  disposeModel(model.root);
});

test('movement 439 pulley oscillation follows the single rope with exact no-slip speed and acceleration', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 10000);
    near(state.pulleyAngle,
      (state.bucketAttachmentY - geometry.topAttachmentY)
        / geometry.pulleyPitchRadius,
    0, 'pulley angle from right-strand travel');
    near(state.pulleyAngularSpeed,
      state.bucketVelocityY / geometry.pulleyPitchRadius,
      0, 'pulley rim speed equals rope speed');
    near(state.pulleyAngularAcceleration,
      state.bucketAccelerationY / geometry.pulleyPitchRadius,
      0, 'pulley rim acceleration equals rope acceleration');
    if (state.bucketVelocityY < 0) {
      assert.ok(state.pulleyAngularSpeed < 0,
        'bucket descent rotates pulley clockwise');
    }
    if (state.bucketVelocityY > 0) {
      assert.ok(state.pulleyAngularSpeed > 0,
        'bucket return reverses pulley');
    }
  }
  disposeModel(model.root);
});

test('movement 439 material rope path is position- and tangent-continuous at both pulley contacts', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { geometry, ropePointAtDistance } = model.root.userData;
  const counterweightY = -0.41;
  const bucketY = geometry.attachmentHeightSum - counterweightY;
  const leftLength = geometry.pulleyCenter.y - counterweightY;
  const rightArcBoundary = leftLength + geometry.ropeArcLength;
  const epsilon = 1e-8;

  const leftBefore = ropePointAtDistance(
    counterweightY, bucketY, leftLength - epsilon,
  );
  const leftAt = ropePointAtDistance(
    counterweightY, bucketY, leftLength,
  );
  const leftAfter = ropePointAtDistance(
    counterweightY, bucketY, leftLength + epsilon,
  );
  assert.equal(leftBefore.region, 'left-straight');
  assert.equal(leftAfter.region, 'upper-pulley-arc');
  assert.ok(leftBefore.position.distanceTo(leftAt.position) < 1.1e-8);
  assert.ok(leftAfter.position.distanceTo(leftAt.position) < 1.1e-8);
  assert.ok(leftBefore.tangent.angleTo(leftAfter.tangent) < 2e-8);

  const rightBefore = ropePointAtDistance(
    counterweightY, bucketY, rightArcBoundary - epsilon,
  );
  const rightAt = ropePointAtDistance(
    counterweightY, bucketY, rightArcBoundary,
  );
  const rightAfter = ropePointAtDistance(
    counterweightY, bucketY, rightArcBoundary + epsilon,
  );
  assert.equal(rightBefore.region, 'upper-pulley-arc');
  assert.equal(rightAfter.region, 'right-straight');
  assert.ok(rightBefore.position.distanceTo(rightAt.position) < 1.1e-8);
  assert.ok(rightAfter.position.distanceTo(rightAt.position) < 1.1e-8);
  assert.ok(rightBefore.tangent.angleTo(rightAfter.tangent) < 2e-8);
  disposeModel(model.root);
});

test('movement 439 quintic bucket motion matches analytic velocity and acceleration without endpoint jolts', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const phase of [0.28, 0.33, 0.39, 0.46, 0.50,
    0.70, 0.74, 0.80, 0.86, 0.91]) {
    const angle = FULL_TURN * phase;
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalVelocity = (
      after.bucketAttachmentY - before.bucketAttachmentY
    ) / (2 * timeStep);
    const numericalAcceleration = (
      after.bucketVelocityY - before.bucketVelocityY
    ) / (2 * timeStep);
    near(numericalVelocity, state.bucketVelocityY, 2e-9,
      `bucket velocity at phase ${phase}`);
    near(numericalAcceleration, state.bucketAccelerationY, 2e-8,
      `bucket acceleration at phase ${phase}`);
  }
  for (const phase of [geometry.descendStartPhase,
    geometry.descendEndPhase, geometry.riseStartPhase,
    geometry.riseEndPhase, 0, 1]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.bucketVelocityY, 0, 2e-27,
      `zero endpoint velocity at phase ${phase}`);
    near(state.bucketAccelerationY, 0, 5e-14,
      `zero endpoint acceleration at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 439 update binds bucket, counterweight, valve, rope strands, and pulley to one exact state', () => {
  const model = createMovementModel(catalog.movements[438]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.pulleyShaft, blocks.frameBeam,
    blocks.framePost, blocks.ground, blocks.strikeAnvil,
    blocks.flume];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const time of [0, 0.41, 1.08, 1.96, 2.72, 3.56, 4.20,
    4.92, 5.56, 6.44, 7.20, 7.76]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.bucket.position.y, state.bucketAttachmentY, 0,
      'bucket update');
    near(blocks.counterweight.position.y,
      state.counterweightAttachmentY, 0, 'counterweight update');
    near(blocks.valve.position.y, state.valveLift, 0, 'valve update');
    sameAngle(blocks.pulley.rotation.z, state.pulleyAngle, 1.2e-16,
      'pulley update');
    near(blocks.leftRopeStrand.scale.y, state.leftRopeLength, 0,
      'left rope strand length');
    near(blocks.rightRopeStrand.scale.y, state.rightRopeLength, 0,
      'right rope strand length');
    vectorNear(blocks.ropeMarker.position, state.ropeMarker.position, 0,
      'continuous rope material marker');
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position, fixedPositions[index], 0, 'fixed apparatus position',
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.bucketAttachmentY, source.bucketAttachmentY, 0,
    'bucket cycle closure');
  near(closure.counterweightAttachmentY,
    source.counterweightAttachmentY, 0, 'counterweight cycle closure');
  near(closure.waterFill, source.waterFill, 0, 'fill cycle closure');
  vectorNear(closure.ropeMarker.position, source.ropeMarker.position, 0,
    'rope marker cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 8);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 439 single-rope reciprocator', () => {
  const movement439 = catalog.movements[438];
  const movement507 = catalog.movements[506];
  const model439 = createMovementModel(movement439);
  const model507 = createMovementModel(movement507);

  assert.equal(movement439.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model439.root);
  disposeModel(model507.root);
});
