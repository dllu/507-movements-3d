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
  'fairbairn-four-bar-bailing-scoop-with-adjustable-beam-notch-and-rigid-pitman';
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

test('movement 460 is a fixed-pivot scoop and rocking beam joined by one double-bar pitman at one of five visible notches', () => {
  const movement = catalog.movements[459];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 460);
  assert.equal(movement.number, '460');
  assert.equal(movement.title, 'Fairbairn’s adjustable bailing scoop');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.scoop.parent, model.root);
  assert.equal(blocks.scoopPivotAxle.parent, model.root);
  assert.equal(blocks.scoopConnectionPin.parent, blocks.scoop);
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.beamPivotAxle.parent, model.root);
  assert.equal(blocks.upperPitmanPin.parent, blocks.beam);
  assert.equal(blocks.notches.length, 5);
  assert.equal(blocks.pitman.parent, model.root);
  assert.equal(blocks.pitmanBars.length, 2);
  assert.ok(blocks.pitmanBars.every((bar) => bar.parent === blocks.pitman));
  assert.equal(blocks.scoopSidePlates.length, 2);
  // Pass 69: two more floor boards carry the water under the trunnion to
  // the spout over the ridge.
  assert.equal(blocks.scoopFloor.length, 6);
  assert.equal(blocks.scoopWater.parent, blocks.scoop);
  assert.equal(geometry.notchRadii.length, 5);
  assert.equal(geometry.selectedNotchIndex, 2);
  assert.equal(geometry.selectedNotchRadius, geometry.notchRadii[2]);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.selectedNotchIndex, 2);
  assert.equal(degreesOfFreedom.notchSelectionDuringOperation, false);
  assert.equal(degreesOfFreedom.pitmanLengthIndependent, false);
  assert.equal(degreesOfFreedom.scoopAngleIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'rigid-fairbairn-bailing-scoop-rocking-about-left-trunnion',
    'fixed-left-scoop-trunnion',
    'rocking-engine-beam-with-five-adjustment-notches',
    'selected-adjustable-pitman-notch',
    'pitman-pin-seated-in-selected-beam-notch',
    'fixed-length-double-bar-pitman-between-selected-notch-and-scoop',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(roles.filter((role) =>
    /available-adjustment-notch/.test(role)).length, 4);
  disposeModel(model.root);
});

test('movement 460 source record preserves Fairbairn’s scoop, single-acting beam, and adjustable lift claim without invented source timing', () => {
  const movement = catalog.movements[459];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate460;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_460.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Fairbairn’s bailing-scoop/);
  assert.match(movement.description, /elevating water short distances/);
  assert.match(movement.description, /connected by pitman/);
  assert.match(movement.description, /beam of single-acting engine/);
  assert.match(movement.description,
    /Distance of lift may be altered.*notches shown/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /fixed left scoop trunnion.*curved scoop.*double-bar pitman.*five notches.*middle notch/);
  assert.match(evidence.reconstructionDisclosure,
    /no pivot coordinates, link lengths, notch spacing.*independently engineered/);
  assert.match(dynamics.linkageModel,
    /exact planar four-bar.*lower circle-intersection branch.*differentiated closure equation/);
  assert.match(dynamics.fillDischargeModel,
    /prescribed C2 volume schedule rather than a free-surface CFD solution/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateScoopPivotPixels, [111, 252]);
  assert.deepEqual(plate.approximateBeamPivotPixels, [407, 174]);
  assert.deepEqual(plate.approximatePitmanUpperPinPixels, [285, 225]);
  assert.deepEqual(plate.approximatePitmanLowerPinPixels, [285, 321]);
  assert.deepEqual(plate.approximateScoopIntakeLipPixels, [334, 342]);
  disposeModel(model.root);
});

test('movement 460 source pose has the selected middle notch, low scoop, and nearly vertical pitman shown in the engraving', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.mode, 'low-full-scoop-ready-for-short-lift');
  assert.equal(sourcePose.notchIndex, geometry.selectedNotchIndex);
  near(sourcePose.beamAngle, geometry.lowBeamAngle, 0,
    'source beam angle');
  near(sourcePose.scoopAngle, source.scoopAngle, 0,
    'source scoop angle');
  vectorNear(sourcePose.upperPin, source.upperPin, 0,
    'source upper pitman pin');
  vectorNear(sourcePose.lowerPin, source.lowerPin, 0,
    'source lower pitman pin');
  near(source.upperPin.x, source.lowerPin.x, 0.12,
    'source pitman nearly vertical');
  assert.ok(source.intakePoint.y < source.outletPoint.y,
    'source intake is submerged below delivery end');
  near(source.waterFraction, 1, 0, 'source scoop full');
  near(source.beamAngularSpeed, 0, 0, 'source beam stopped');
  near(source.scoopAngularSpeed, 0, 0, 'source scoop stopped');
  disposeModel(model.root);
});

test('movement 460 orders full lift, high discharge, empty lowering, and low filling', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { stateAtInputAngle, timeline } = model.root.userData;
  const atPhase = (phase) => stateAtInputAngle(FULL_TURN * phase);
  const lift = atPhase(0.20);
  const discharge = atPhase(0.45);
  const lowering = atPhase(0.70);
  const filling = atPhase(0.95);

  assert.equal(lift.mode, 'pitman-raising-full-scoop');
  near(lift.waterFraction, 1, 0, 'full during lift');
  assert.ok(lift.beamAngularSpeed < 0);
  assert.ok(lift.scoopAngularSpeed > 0);
  assert.ok(lift.intakeVelocity.y > 0);

  assert.equal(discharge.mode,
    'scoop-held-high-while-water-discharges');
  near(discharge.beamAngularSpeed, 0, 0, 'beam held high');
  near(discharge.scoopAngularSpeed, 0, 0, 'scoop held high');
  near(discharge.waterFraction, 0.5, 2e-15, 'half discharged');
  assert.ok(discharge.dischargeFlowRate > 0);

  assert.equal(lowering.mode, 'pitman-lowering-empty-scoop');
  near(lowering.waterFraction, 0, 0, 'empty while lowering');
  assert.ok(lowering.beamAngularSpeed > 0);
  assert.ok(lowering.scoopAngularSpeed < 0);
  assert.ok(lowering.intakeVelocity.y < 0);

  assert.equal(filling.mode, 'scoop-held-low-while-filling');
  near(filling.beamAngularSpeed, 0, 0, 'beam held low');
  near(filling.scoopAngularSpeed, 0, 0, 'scoop held low');
  near(filling.waterFraction, 0.5, 2e-15, 'half filled');
  assert.ok(filling.waterFractionRate > 0);
  assert.deepEqual(timeline.stages, [
    'full scoop raised by pitman',
    'scoop held high and discharged',
    'empty scoop lowered by pitman',
    'scoop held low and filled',
  ]);
  disposeModel(model.root);
});

test('movement 460 exact four-bar closure holds throughout all five selectable notch configurations', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { geometry, stateAtInputAngleForNotch } = model.root.userData;
  for (let notchIndex = 0; notchIndex < geometry.notchRadii.length;
    notchIndex += 1) {
    for (let sample = 0; sample < 6000; sample += 1) {
      const state = stateAtInputAngleForNotch(
        FULL_TURN * sample / 6000,
        notchIndex,
      );
      near(state.upperPin.distanceTo(geometry.beamPivot),
        geometry.notchRadii[notchIndex], 5e-16,
      `beam radius notch ${notchIndex} sample ${sample}`);
      near(state.lowerPin.distanceTo(geometry.scoopPivot),
        geometry.scoopConnectionRadius, 9e-16,
      `scoop radius notch ${notchIndex} sample ${sample}`);
      near(state.upperPin.distanceTo(state.lowerPin),
        geometry.pitmanLength, 2e-15,
      `pitman length notch ${notchIndex} sample ${sample}`);
      near(state.pitmanLength, geometry.pitmanLength, 2e-15,
        `reported pitman notch ${notchIndex} sample ${sample}`);
      assert.ok(state.circleClosureError < 2e-15); // machine precision for the pass-69 geometry
      assert.equal(state.assemblyMode, 'open-lower-circle-intersection');
      // Pass 69: the full-drain stroke (the raised floor must slope to the
      // spout) brings the outermost notch nearer toggle, but every notch
      // keeps a clear margin from it.
      assert.ok(Math.abs(state.outputDenominator) > 1.2,
        `configuration avoids toggle at notch ${notchIndex}`);
      assert.ok(Number.isFinite(state.inputToOutputInstantaneousRatio));
    }
  }
  assert.throws(
    () => stateAtInputAngleForNotch(0, -1),
    /notch index -1 is outside/,
  );
  assert.throws(
    () => stateAtInputAngleForNotch(0, geometry.notchRadii.length),
    /notch index 5 is outside/,
  );
  disposeModel(model.root);
});

test('movement 460 moving the pitman outward through the shown notches strictly increases scoop lift', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { geometry, stateAtInputAngleForNotch } = model.root.userData;

  assert.deepEqual(geometry.notchRadii, [1.30, 1.47, 1.65, 1.83, 2.00]);
  for (let index = 1; index < geometry.notchLiftHeights.length; index += 1) {
    assert.ok(
      geometry.notchLiftHeights[index]
        > geometry.notchLiftHeights[index - 1],
      `notch ${index} must lift farther than notch ${index - 1}`,
    );
  }
  for (let notchIndex = 0; notchIndex < geometry.notchRadii.length;
    notchIndex += 1) {
    const low = stateAtInputAngleForNotch(0, notchIndex);
    const high = stateAtInputAngleForNotch(
      FULL_TURN * geometry.liftEndPhase,
      notchIndex,
    );
    near(high.intakePoint.y - low.intakePoint.y,
      geometry.notchLiftHeights[notchIndex], 0,
    `computed lift at notch ${notchIndex}`);
    assert.ok(high.scoopAngle > low.scoopAngle);
  }
  near(geometry.notchLiftHeights[geometry.selectedNotchIndex],
    2.929978116815363, 2e-12, 'selected middle-notch lift');
  // The raised scoop's floor falls toward the spout, so it can empty.
  const high = stateAtInputAngleForNotch(FULL_TURN * geometry.liftEndPhase);
  assert.ok(high.scoopAngle > Math.atan2(0.78, 1.76), 'raised floor slopes down to the pivot end');
  disposeModel(model.root);
});

test('movement 460 differentiated four-bar velocities and accelerations match finite differences for every notch', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { geometry, stateAtInputAngleForNotch } = model.root.userData;
  const step = 1e-6;
  for (let notchIndex = 0; notchIndex < geometry.notchRadii.length;
    notchIndex += 1) {
    for (const angle of [0.47, 1.73, 3.48, 4.91]) {
      const before = stateAtInputAngleForNotch(angle - step, notchIndex);
      const state = stateAtInputAngleForNotch(angle, notchIndex);
      const after = stateAtInputAngleForNotch(angle + step, notchIndex);
      const velocityScale = geometry.inputAngularSpeed / (2 * step);
      const numericUpperVelocity = after.upperPin.clone()
        .sub(before.upperPin).multiplyScalar(velocityScale);
      const numericLowerVelocity = after.lowerPin.clone()
        .sub(before.lowerPin).multiplyScalar(velocityScale);
      const numericIntakeVelocity = after.intakePoint.clone()
        .sub(before.intakePoint).multiplyScalar(velocityScale);
      const numericScoopSpeed = (after.scoopAngle - before.scoopAngle)
        * velocityScale;
      const numericLowerAcceleration = after.lowerPinVelocity.clone()
        .sub(before.lowerPinVelocity).multiplyScalar(velocityScale);
      const numericIntakeAcceleration = after.intakeVelocity.clone()
        .sub(before.intakeVelocity).multiplyScalar(velocityScale);
      const numericScoopAcceleration = (after.scoopAngularSpeed
        - before.scoopAngularSpeed) * velocityScale;
      vectorNear(state.upperPinVelocity, numericUpperVelocity, 4e-9,
        `upper velocity notch ${notchIndex} at ${angle}`);
      vectorNear(state.lowerPinVelocity, numericLowerVelocity, 4e-9,
        `lower velocity notch ${notchIndex} at ${angle}`);
      vectorNear(state.intakeVelocity, numericIntakeVelocity, 5e-9,
        `intake velocity notch ${notchIndex} at ${angle}`);
      near(state.scoopAngularSpeed, numericScoopSpeed, 2e-9,
        `scoop speed notch ${notchIndex} at ${angle}`);
      vectorNear(state.lowerPinAcceleration,
        numericLowerAcceleration, 4e-8,
      `lower acceleration notch ${notchIndex} at ${angle}`);
      vectorNear(state.intakeAcceleration,
        numericIntakeAcceleration, 5e-8,
      `intake acceleration notch ${notchIndex} at ${angle}`);
      near(state.scoopAngularAcceleration,
        numericScoopAcceleration, 3e-8,
      `scoop acceleration notch ${notchIndex} at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 460 beam, scoop, and water schedule are C2-stationary at every stage boundary', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const boundaries = [0, geometry.liftEndPhase,
    geometry.dischargeEndPhase, geometry.loweringEndPhase];
  for (const phase of boundaries) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    near(state.beamAngularSpeed, 0, 2e-28,
      `beam speed at phase ${phase}`);
    near(state.beamAngularAcceleration, 0, 2e-13,
      `beam acceleration at phase ${phase}`);
    near(state.scoopAngularSpeed, 0, 3e-28,
      `scoop speed at phase ${phase}`);
    near(state.scoopAngularAcceleration, 0, 3e-13,
      `scoop acceleration at phase ${phase}`);
    near(state.waterFractionRate, 0, 2e-14,
      `water rate at phase ${phase}`);
    near(state.waterFractionAcceleration, 0, 4e-12,
      `water acceleration at phase ${phase}`);
    const epsilon = 1e-8;
    const before = stateAtInputAngle(FULL_TURN * phase - epsilon);
    const after = stateAtInputAngle(FULL_TURN * phase + epsilon);
    near(after.scoopAngularSpeed, before.scoopAngularSpeed, 3e-13,
      `continuous scoop speed at ${phase}`);
    near(after.scoopAngularAcceleration,
      before.scoopAngularAcceleration, 2e-6,
    `continuous scoop acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 460 renderer maps the solved pins and rigid links while both ground pivots remain fixed', () => {
  const model = createMovementModel(catalog.movements[459]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.basin, blocks.basinWater,
    blocks.leftBank, blocks.rightBank, blocks.scoopPivotAxle,
    blocks.beamPivotAxle, blocks.beamPedestal, blocks.deliveryChannel];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.2, 0.4, 0.45, 0.5, 0.7, 0.9, 0.95, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.beam.rotation.z, state.beamAngle, 0,
      `beam transform at ${phase}`);
    near(blocks.scoop.rotation.z, state.scoopAngle, 0,
      `scoop transform at ${phase}`);
    for (const bar of blocks.pitmanBars) {
      near(bar.scale.y, geometry.pitmanLength, 9e-16,
        `pitman bar length at ${phase}`);
    }
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.upperPitmanPin.getWorldPosition(new THREE.Vector3()),
      state.upperPin, 5e-16, `upper rendered pin at ${phase}`);
    vectorNear(blocks.scoopConnectionPin.getWorldPosition(new THREE.Vector3()),
      state.lowerPin, 7e-16, `lower rendered pin at ${phase}`);
    assert.equal(blocks.scoopWater.visible, state.waterFraction > 1e-5);
    if (blocks.scoopWater.visible) {
      near(blocks.scoopWater.rotation.z, -state.scoopAngle, 0,
        `horizontal clipped water at ${phase}`);
    }
    // Pass 69: one continuous stream from the scoop floor over the spout
    // into the upper channel, shown while the raised scoop empties.
    assert.equal(blocks.dischargeStream.visible, state.dischargeFlowRate > 0.01 * 1.875
      / ((geometry.dischargeEndPhase - geometry.liftEndPhase) * geometry.cycleDuration));
    if (blocks.dischargeStream.visible) assert.ok(state.outletPoint.y > -0.60, 'spout above the channel water');
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.beamAngle, source.beamAngle, 0, 'beam cycle closure');
  near(closure.scoopAngle, source.scoopAngle, 0, 'scoop cycle closure');
  vectorNear(closure.upperPin, source.upperPin, 0,
    'upper pin cycle closure');
  vectorNear(closure.lowerPin, source.lowerPin, 0,
    'lower pin cycle closure');
  near(closure.waterFraction, source.waterFraction, 0,
    'water cycle closure');
  disposeModel(model.root);
});

test('movement 460 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement460 = catalog.movements[459];
  const movement507 = catalog.movements[506];
  const model460 = createMovementModel(movement460);
  const model507 = createMovementModel(movement507);
  model460.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model460.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement460.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model460.root);
  disposeModel(model507.root);
});
