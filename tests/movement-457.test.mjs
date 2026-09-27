import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { bailHang } from '../src/simulation/well-bucket-working-parts.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'counterbalanced-shallow-well-sweep-with-long-arm-bucket-rope-and-half-load-short-arm-weight';
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

test('movement 457 is an unequal-arm well sweep with one vertical rope, bucket, and rigid short-arm counterweight', () => {
  const movement = catalog.movements[456];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 457);
  assert.equal(movement.number, '457');
  assert.equal(movement.title, 'Counterbalanced well sweep');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.counterweight.parent, blocks.beam);
  assert.equal(blocks.rope.parent, model.root);
  assert.equal(blocks.bucket.parent, model.root);
  // The water rides in the bucket's tipper (it turns about the ears).
  let holder = blocks.bucketWater;
  while (holder && holder !== blocks.bucket) holder = holder.parent;
  assert.equal(holder, blocks.bucket);
  assert.equal(blocks.support.parent, model.root);
  assert.equal(blocks.pivotAxle.parent, model.root);
  assert.equal(blocks.well.parent, model.root);
  assert.equal(blocks.wellRim.parent, model.root);
  assert.ok(geometry.longArmLength > geometry.shortArmLength * 3);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketIndependent, false);
  assert.equal(degreesOfFreedom.counterweightIndependent, false);
  assert.equal(degreesOfFreedom.ropeLengthIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'unequal-arm-well-sweep-rocking-about-fixed-fulcrum',
    'constant-length-rope-hanging-vertically-from-long-arm-tip',
    'upright-well-bucket-on-rope',
    'rigid-short-arm-counterweight-equivalent-to-half-full-load',
    'shallow-well-below-sweep-bucket',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 457 source record preserves the shallow-well and half-load claims without inventing source timing', () => {
  const movement = catalog.movements[456];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate457;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_457.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /raising water from wells of inconsiderable depth/);
  assert.match(movement.description,
    /Counterbalance equals about one-half of weight to be raised/);
  assert.match(movement.description,
    /bucket has to be pulled down when empty/);
  assert.match(movement.description,
    /assisted in elevating it when full by counterbalance/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.fullInertiaRopeElasticityWaterSloshDragPivotFrictionImpactAndOperatorBiomechanicsModeled,
    false,
  );
  assert.match(dynamics.loadModel,
    /full raised weight.*100.*empty bucket.*25.*50-unit weight.*one-half/);
  assert.match(dynamics.motionModel,
    /C2 demonstration.*quasistatic diagnostics.*not a free dynamic simulation/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBeamLeftTipPixels, [119, 70]);
  assert.deepEqual(plate.approximateBucketCenterPixels, [120, 360]);
  assert.deepEqual(plate.approximatePivotPixels, [400, 329]);
  assert.deepEqual(plate.approximateCounterweightCenterPixels, [473, 353]);
  assert.deepEqual(plate.approximateWellCenterPixels, [117, 447]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /long timber sweep.*forked.*vertical rope and bucket.*shallow well.*bulky lashed counterweight/);
  assert.match(evidence.reconstructionDisclosure,
    /no arm lengths, pivot height, rope length.*independently engineered/);
  disposeModel(model.root);
});

test('movement 457 source pose has the long arm raised, empty bucket above the well, and short arm lowered', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.mode,
    'top-empty-bucket-ready-to-be-pulled-down');
  near(sourcePose.beamAngle, geometry.highBeamAngle, 0,
    'source high beam');
  near(sourcePose.bucketWaterFraction, 0, 0, 'source bucket empty');
  assert.ok(sourcePose.bucketCenter.y > geometry.wellRimY);
  assert.ok(sourcePose.counterweightCenter.y < geometry.beamPivot.y);
  near(source.beamAngularSpeed, 0, 0, 'source endpoint stopped');
  assert.equal(source.operatorAction, 'hold');
  disposeModel(model.root);
});

test('movement 457 demonstration orders empty descent, filling, full ascent, and top emptying', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, stateAtInputAngle, timeline } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  const descent = atPhase(geometry.descentEndPhase / 2);
  const fill = atPhase((geometry.descentEndPhase + geometry.fillEndPhase) / 2);
  const ascent = atPhase((geometry.fillEndPhase + geometry.ascentEndPhase) / 2);
  const dwellPhase = (u) => geometry.ascentEndPhase + u * (1 - geometry.ascentEndPhase);
  const empty = atPhase(dwellPhase(0.7));

  assert.equal(descent.mode,
    'operator-pulling-empty-bucket-down-against-counterbalance');
  near(descent.bucketWaterFraction, 0, 0, 'empty on descent');
  assert.ok(descent.beamAngularSpeed > 0);
  assert.equal(descent.operatorAction, 'pull-empty-bucket-down');

  assert.equal(fill.mode, 'bucket-held-at-bottom-while-filling');
  near(fill.beamAngle, geometry.lowBeamAngle, 0, 'bottom dwell');
  near(fill.beamAngularSpeed, 0, 0, 'stationary while filling');
  near(fill.bucketWaterFraction, 0.5, 1e-14, 'half filled');
  assert.ok(fill.bucketWaterFractionRate > 0);

  assert.equal(ascent.mode,
    'operator-raising-full-bucket-with-counterbalance-assistance');
  near(ascent.bucketWaterFraction, 1, 0, 'full on ascent');
  assert.ok(ascent.beamAngularSpeed < 0);
  assert.equal(ascent.operatorAction, 'raise-full-bucket');

  assert.equal(empty.mode, 'bucket-held-at-top-while-emptying');
  near(empty.beamAngle, geometry.highBeamAngle, 0, 'top dwell');
  near(empty.beamAngularSpeed, 0, 0, 'stationary while emptying');
  // Pass 70/72: the raised bucket is drawn aside over the ground and emptied
  // by tipping it about its ears: late in the dwell it is held tipped past
  // the lip and empty; earlier it spills as it tips, keeping what the tipped
  // bucket can hold.
  near(empty.bucketWaterFraction, 0, 0, 'emptied by tipping');
  assert.ok(empty.bucketTilt > THREE.MathUtils.degToRad(100), 'held tipped');
  near(empty.bucketAside, 1, 0, 'drawn aside while tipped');
  const pouring = atPhase(dwellPhase(0.4));
  near(pouring.bucketAside, 1, 0, 'drawn aside before it spills');
  assert.ok(pouring.bucketWaterFraction > 0 && pouring.bucketWaterFraction < 1, 'spilling while it tips');
  assert.ok(pouring.bucketWaterFractionRate < 0);
  assert.ok(pouring.bucketTilt > 0);
  near(atPhase(0).bucketTilt, 0, 0, 'upright again for the descent');
  assert.deepEqual(timeline.stages, [
    'empty bucket pulled downward',
    'bucket fills at well bottom',
    'full bucket raised with counterweight assistance',
    'bucket empties at top',
  ]);
  disposeModel(model.root);
});

test('movement 457 rope keeps its length, hangs vertically except when the raised bucket is drawn aside, and the bucket clears the kerb', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const kerbOuter = 1.135 + 0.08;
  let asideSeen = 0;
  for (let sample = 0; sample < 24000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 24000);
    near(state.leftTip.distanceTo(state.ropeBottom),
      geometry.ropeLength, 1e-12,
    `constant rope length at ${sample}`);
    near(state.ropeBottom.x - state.leftTip.x,
      geometry.ropeLength * Math.sin(state.ropeSwing), 1e-12, `rope swing at ${sample}`);
    near(state.leftTip.z, state.ropeBottom.z, 0,
      `rope in the beam plane at ${sample}`);
    near(state.bucketCenter.x, state.ropeBottom.x, 0,
      `bucket x under the bail at ${sample}`);
    // Tipped past 50 degrees at the top, the bail falls to the pour side on
    // its ears and the bucket hangs back from the rope (bailHang).
    const hang = bailHang(state.bucketTilt, geometry.bucketHandleRise);
    near(state.bucketCenter.y - hang.y,
      state.ropeBottom.y - (geometry.bucketHeight / 2 + geometry.bucketHandleRise),
    1e-12, `bucket hanger offset at ${sample}`);
    near(state.bucketCenter.z - hang.z, state.ropeBottom.z, 1e-12, `bucket hang z at ${sample}`);
    if (state.bucketAside === 0) {
      near(state.ropeSwing, 0, 0, `vertical rope at ${sample}`);
      assert.ok(Math.abs(state.bucketCenter.x - geometry.wellCenterX) + 0.40
        < 1.08,
      `bucket clears well mouth at ${sample}`);
    } else {
      asideSeen += 1;
      assert.ok(state.phase >= geometry.ascentEndPhase, `aside only at the top at ${sample}`);
      assert.ok(state.bucketCenter.y - geometry.bucketHeight / 2 > geometry.wellRimY + 0.08 + 0.1,
        `drawn aside above the kerb at ${sample}`);
      if (state.bucketWaterFractionRate < 0) {
        near(state.bucketAside, 1, 0, `spills only when fully aside at ${sample}`);
        assert.ok(state.bucketCenter.x - 0.13 > geometry.wellCenterX + kerbOuter,
          `spill lands outside the kerb at ${sample}`);
      }
    }
  }
  assert.ok(asideSeen > 1000);
  disposeModel(model.root);
});

test('movement 457 counterbalance moment is exactly half the full raised load and has the captioned effort signs', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  near(geometry.counterbalanceEquivalentWeight,
    geometry.fullBucketWeight / 2, 0, 'half full-load equivalent');
  near(geometry.counterweightActualWeight
      * geometry.counterweightMomentArm,
    geometry.counterbalanceEquivalentWeight * geometry.longArmLength,
    0, 'short-arm counterweight moment equivalence');

  const emptyDescent = stateAtInputAngle(FULL_TURN * 0.175);
  assert.ok(emptyDescent.netGravityTorque < 0,
    'counterweight raises empty bucket without operator');
  assert.ok(emptyDescent.quasistaticOperatorTorque > 0,
    'operator must pull empty bucket down');
  near(emptyDescent.bucketWeight, geometry.emptyBucketWeight, 0,
    'empty descent weight');

  const fullAscent = stateAtInputAngle(FULL_TURN * 0.675);
  assert.ok(fullAscent.netGravityTorque > 0,
    'full bucket still exceeds counterbalance');
  assert.ok(fullAscent.quasistaticOperatorTorque < 0,
    'operator supplies remaining lift torque');
  near(fullAscent.bucketWeight, geometry.fullBucketWeight, 0,
    'full ascent weight');
  near(
    Math.abs(fullAscent.counterweightGravityTorque),
    fullAscent.bucketGravityTorque / 2,
    8e-13,
    'counterweight cancels half full-load torque',
  );
  disposeModel(model.root);
});

test('movement 457 beam and water schedule are C2-stationary at every stage boundary', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const boundaries = [0, geometry.descentEndPhase,
    geometry.fillEndPhase, geometry.ascentEndPhase];
  for (const phase of boundaries) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.beamAngularSpeed, 0, 3e-15,
      `zero beam speed at phase ${phase}`);
    near(state.beamAngularAcceleration, 0, 5e-14,
      `zero beam acceleration at phase ${phase}`);
    near(state.bucketWaterFractionRate, 0, 4e-15,
      `zero fill rate at phase ${phase}`);
  }
  const step = 1e-5;
  for (const phase of boundaries) {
    const angle = FULL_TURN * phase;
    const before = stateAtInputAngle(angle - step);
    const center = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    near((after.beamAngle - before.beamAngle) / (2 * step),
      0, 2e-8, `C1 beam at phase ${phase}`);
    near((after.beamAngle - 2 * center.beamAngle + before.beamAngle)
      / step ** 2, 0, 4e-4, `C2 beam at phase ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 457 analytic sweep-tip velocity and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.31, 1.17, 3.44, 4.22]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const numericVelocity = after.leftTip.clone().sub(before.leftTip)
      .multiplyScalar(geometry.inputAngularSpeed / (2 * step));
    vectorNear(state.leftTipVelocity, numericVelocity, 3e-9,
      `tip velocity at ${angle}`);
    const numericAcceleration = after.leftTipVelocity.clone()
      .sub(before.leftTipVelocity)
      .multiplyScalar(geometry.inputAngularSpeed / (2 * step));
    vectorNear(state.leftTipAcceleration, numericAcceleration, 2e-8,
      `tip acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 457 renderer maps beam, rope, bucket water, and effort direction while well and pivot remain fixed', () => {
  const model = createMovementModel(catalog.movements[456]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.support, blocks.pivotAxle,
    blocks.well, blocks.wellRim, blocks.wellWater];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.175, 0.35, 0.425, 0.5,
    0.675, 0.85, 0.925, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.beam.rotation.z, state.beamAngle, 0,
      `beam transform at ${phase}`);
    vectorNear(blocks.bucket.position, state.bucketCenter, 0,
      `bucket transform at ${phase}`);
    vectorNear(blocks.rope.position, state.leftTip, 0,
      `laid rope hangs from the long-arm tip at ${phase}`);
    blocks.rope.geometry.computeBoundingBox();
    near(blocks.rope.geometry.boundingBox.min.y, -geometry.ropeLength, 1e-9,
      `laid rope reaches the bail at ${phase}`);
    near(blocks.rope.scale.y, 1, 0, `laid rope is not stretched at ${phase}`);
    assert.equal(blocks.operatorArrow.visible, false);
    const expectedWaterVisible = 0.60 * state.bucketWaterFraction > 1e-5;
    assert.equal(blocks.bucketWater.visible, expectedWaterVisible);
    if (expectedWaterVisible) {
      blocks.bucketWater.geometry.computeBoundingBox();
      assert.ok(blocks.bucketWater.geometry.boundingBox.max.y-blocks.bucketWater.geometry.boundingBox.min.y > 0);
      // Upright it stands to the full level; tipped, the wedge kept at the
      // lip may run along the wall from the floor's top to under the rim.
      assert.ok(blocks.bucketWater.geometry.boundingBox.max.y-blocks.bucketWater.geometry.boundingBox.min.y
        <= geometry.bucketHeight-(state.bucketTilt > 0 ? .07 : .11)+1e-7);
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
  near(closure.beamAngle, source.beamAngle, 0, 'beam closure');
  vectorNear(closure.bucketCenter, source.bucketCenter, 0,
    'bucket closure');
  near(closure.bucketWaterFraction, source.bucketWaterFraction, 0,
    'water closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 10);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 457 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement457 = catalog.movements[456];
  const movement507 = catalog.movements[506];
  const model457 = createMovementModel(movement457);
  const model507 = createMovementModel(movement507);
  model457.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model457.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement457.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model457.root);
  disposeModel(model507.root);
});
