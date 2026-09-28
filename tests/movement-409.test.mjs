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
  'locked-sliding-pivot-two-leg-proportional-compasses-with-invariant-opposed-point-span-ratio';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector2Near(actual, expected, tolerance, message) {
  near(
    new THREE.Vector2(actual.x, actual.y).distanceTo(
      new THREE.Vector2(expected.x, expected.y),
    ),
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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 409 is two slotted double-ended legs, one common pivot slide, one set screw, and one proportion scale', () => {
  const movement = catalog.movements[408];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 409);
  assert.equal(movement.number, '409');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /two equal rigid double-ended compass legs/);
  assert.match(data.mechanism, /common pivot carried by longitudinal slides/);
  assert.match(data.mechanism, /selected constant proportion/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['manual opening angle after the proportion is locked']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.legA.group.parent, model.root);
  assert.equal(blocks.legB.group.parent, model.root);
  assert.equal(blocks.pivotAssembly.parent, model.root);
  assert.equal(blocks.legA.scaleTicks.length,
    geometry.scaleCalibration.length);
  assert.equal(blocks.legB.scaleTicks.length, 0);

  const roles = [];
  const legs = [];
  const slots = [];
  const sharpPoints = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role?.endsWith(
      'single-rigid-double-ended-compass-leg')) legs.push(object);
    if (object.userData.role?.endsWith(
      'longitudinal-pivot-adjustment-slot')) slots.push(object);
    if (object.userData.role?.endsWith('arm-sharp-point')) {
      sharpPoints.push(object);
    }
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
  });
  assert.equal(legs.length, 2);
  assert.equal(slots.length, 2);
  assert.equal(sharpPoints.length, 4);
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  for (const role of [
    'common-adjustable-pivot-slide-and-set-screw',
    'set-screw-collar-locking-pivot-position-in-both-slots',
    'common-pivot-axis-allowing-relative-leg-rotation',
    'visible-set-screw-head-clamping-selected-proportion',
    'locked-pivot-index-at-selected-proportion',
    'nonphysical-short-pair-dimension-witness',
    'nonphysical-long-pair-transferred-dimension-witness',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 409 records Brown’s plate, written proportional construction, and unavailable-animation boundary', () => {
  const movement = catalog.movements[408];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate409;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_409.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /pivot of compasses is secured in a slide/);
  assert.match(movement.description,
    /adjustable in the longitudinal slots of legs/);
  assert.match(movement.description, /secured by a set screw/);
  assert.match(movement.description,
    /proportion to the relative distances of the points from the pivot/);
  assert.match(movement.description,
    /scale is provided on one or both legs/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.centralPivotApproximatePixels, [261, 231]);
  assert.deepEqual(plate.upperLeftPointApproximatePixels, [144, 10]);
  assert.deepEqual(plate.upperRightPointApproximatePixels, [391, 18]);
  assert.deepEqual(plate.lowerLeftPointApproximatePixels, [87, 488]);
  assert.deepEqual(plate.lowerRightPointApproximatePixels, [426, 503]);
  assert.deepEqual(plate.leftScaleApproximateBoundsPixels,
    [164, 113, 219, 240]);
  assert.equal(evidence.explicitInBrownDescription.length, 8);
  assert.match(evidence.engravingEvidence,
    /two crossed double-ended legs.*two long central slots/);
  assert.match(evidence.reconstructionDisclosure,
    /selected 1\.275 ratio.*approximate plate proportions/);
  disposeModel(model.root);
});

test('movement 409 scale graduations exactly calibrate pivot division to indicated transfer ratio', () => {
  const model = createMovementModel(catalog.movements[408]);
  const data = model.root.userData;
  const { calibration, geometry } = data;

  near(geometry.totalPointLength,
    geometry.shortArmLength + geometry.longArmLength, 0,
  'total point-to-point leg length');
  near(geometry.selectedScaleRatio,
    geometry.longArmLength / geometry.shortArmLength, 0,
  'selected point-arm ratio');
  assert.equal(calibration.scaleCalibration.length,
    geometry.scaleRatios.length);
  for (let index = 0; index < geometry.scaleRatios.length; index += 1) {
    const ratio = geometry.scaleRatios[index];
    const entry = calibration.scaleCalibration[index];
    near(entry.ratio, ratio, 0, 'recorded scale ratio');
    near(entry.pivotFromShortPoint,
      geometry.totalPointLength / (ratio + 1), 0,
    'pivot position for scale graduation');
    near(entry.localCoordinate,
      geometry.shortArmLength - entry.pivotFromShortPoint, 0,
    'graduation position in leg coordinates');
    near(
      (geometry.totalPointLength - entry.pivotFromShortPoint)
        / entry.pivotFromShortPoint,
      ratio,
      3e-16,
      'graduation indicates exact transfer ratio',
    );
    near(blocksRatio(model, index), ratio, 0,
      'rendered scale tick stores exact ratio');
  }
  const selected = calibration.scaleCalibration.find(({ ratio }) =>
    ratio === geometry.selectedScaleRatio);
  assert.ok(selected);
  near(selected.localCoordinate, 0, 0,
    'selected graduation lies at locked pivot');
  assert.match(calibration.scaleLaw,
    /indicated enlargement ratio=\(L-a\)\/a/);
  disposeModel(model.root);
});

function blocksRatio(model, index) {
  return model.root.userData.blocks.legA.scaleTicks[index].userData.ratio;
}

test('movement 409 preserves the exact opposed-point span, rate, and acceleration ratio through the cycle', () => {
  const model = createMovementModel(catalog.movements[408]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumRatioResidual = 0;
  let maximumRateResidual = 0;
  let maximumAccelerationResidual = 0;
  let minimumUpperSpan = Infinity;
  let maximumUpperSpan = -Infinity;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumRatioResidual = Math.max(maximumRatioResidual,
      Math.abs(state.ratioResidual));
    maximumRateResidual = Math.max(maximumRateResidual,
      Math.abs(state.rateRatioResidual));
    maximumAccelerationResidual = Math.max(
      maximumAccelerationResidual,
      Math.abs(state.accelerationRatioResidual),
    );
    minimumUpperSpan = Math.min(minimumUpperSpan, state.upperSpan);
    maximumUpperSpan = Math.max(maximumUpperSpan, state.upperSpan);
    near(state.upperSpan,
      2 * geometry.shortArmLength * Math.sin(state.halfOpeningAngle),
      5e-16, 'short-point span law');
    near(state.lowerSpan,
      2 * geometry.longArmLength * Math.sin(state.halfOpeningAngle),
      5e-16, 'long-point span law');
  }
  assert.equal(maximumRatioResidual, 0);
  assert.ok(maximumRateResidual < 2.3e-16);
  assert.equal(maximumAccelerationResidual, 0);
  assert.ok(minimumUpperSpan > 0.79);
  assert.ok(maximumUpperSpan > 2.03);
  disposeModel(model.root);
});

test('movement 409 keeps equal corresponding point radii on the two rigid legs and one common pivot', () => {
  const model = createMovementModel(catalog.movements[408]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1200);
    vectorNear(state.pivot, new THREE.Vector2(), 0,
      'common fixed pivot');
    near(state.upperLeft.position.length(), geometry.shortArmLength,
      5e-16, 'left short radius');
    near(state.upperRight.position.length(), geometry.shortArmLength,
      5e-16, 'right short radius');
    near(state.lowerLeft.position.length(), geometry.longArmLength,
      5e-16, 'left long radius');
    near(state.lowerRight.position.length(), geometry.longArmLength,
      5e-16, 'right long radius');
    near(state.upperLeft.position.y, state.upperRight.position.y,
      3e-16, 'upper pair transverse alignment');
    near(state.lowerLeft.position.y, state.lowerRight.position.y,
      3e-16, 'lower pair transverse alignment');
    near(state.legAAngle, -state.legBAngle, 0,
      'equal opposed leg rotations');
  }
  disposeModel(model.root);
});

test('movement 409 analytic point and span derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[408]);
  const { stateAtTime } = model.root.userData;
  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;

  for (const time of [0.18, 0.77, 1.56, 2.43, 3.71, 4.86, 6.29]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    for (const pointName of [
      'upperLeft',
      'upperRight',
      'lowerLeft',
      'lowerRight',
    ]) {
      const finiteVelocity = after[pointName].position.clone()
        .sub(before[pointName].position)
        .multiplyScalar(1 / (2 * velocityEpsilon));
      const finiteAcceleration = afterAcceleration[pointName].velocity.clone()
        .sub(beforeAcceleration[pointName].velocity)
        .multiplyScalar(1 / (2 * accelerationEpsilon));
      vectorNear(state[pointName].velocity, finiteVelocity, 5e-10,
        `${pointName} velocity`);
      vectorNear(state[pointName].acceleration, finiteAcceleration, 3e-9,
        `${pointName} acceleration`);
    }
    near(state.upperSpanRate,
      (after.upperSpan - before.upperSpan) / (2 * velocityEpsilon),
      7e-10, 'upper span rate');
    near(state.lowerSpanRate,
      (after.lowerSpan - before.lowerSpan) / (2 * velocityEpsilon),
      9e-10, 'lower span rate');
  }
  disposeModel(model.root);
});

test('movement 409 smoothly closes and reopens between the plate pose and minimum opening', () => {
  const model = createMovementModel(catalog.movements[408]);
  const { geometry, sourcePose, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const middle = stateAtTime(geometry.cycleDuration / 2);
  const closure = stateAtTime(geometry.cycleDuration);

  near(source.halfOpeningAngle, geometry.maximumHalfOpeningAngle, 0,
    'source maximum opening');
  near(middle.halfOpeningAngle, geometry.minimumHalfOpeningAngle,
    6e-17, 'minimum opening');
  near(sourcePose.halfOpeningAngle, source.halfOpeningAngle, 0,
    'plate pose opening');
  near(sourcePose.upperSpan, source.upperSpan, 0,
    'plate pose short span');
  near(sourcePose.lowerSpan, source.lowerSpan, 0,
    'plate pose long span');
  near(source.halfOpeningAngularSpeed, 0, 0,
    'source smooth reversal');
  near(middle.halfOpeningAngularSpeed, 0, 3e-17,
    'closed smooth reversal');
  near(closure.halfOpeningAngularSpeed, 0, 6e-17,
    'closure smooth reversal');
  near(closure.halfOpeningAngle, source.halfOpeningAngle, 0,
    'angle cycle closure');
  vectorNear(closure.upperLeft.position, source.upperLeft.position, 0,
    'upper point cycle closure');
  vectorNear(closure.lowerRight.position, source.lowerRight.position, 0,
    'lower point cycle closure');
  disposeModel(model.root);
});

test('movement 409 update binds both rigid legs, four point locations, witnesses, and locked pivot to one state', () => {
  const model = createMovementModel(catalog.movements[408]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const pivotWorld = blocks.pivotAssembly.position.clone();

  for (const fraction of [0, 0.09, 0.25, 0.5, 0.72, 0.91, 1]) {
    const time = geometry.cycleDuration * fraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.legA.group.rotation.z, state.legAAngle, 0,
      'rendered leg A angle');
    near(blocks.legB.group.rotation.z, state.legBAngle, 0,
      'rendered leg B angle');
    vector2Near(
      blocks.legA.shortTipIndex.getWorldPosition(new THREE.Vector3()),
      state.upperLeft.position,
      4e-16,
      'rendered upper-left point',
    );
    vector2Near(
      blocks.legB.shortTipIndex.getWorldPosition(new THREE.Vector3()),
      state.upperRight.position,
      4e-16,
      'rendered upper-right point',
    );
    vector2Near(
      blocks.legB.longTipIndex.getWorldPosition(new THREE.Vector3()),
      state.lowerLeft.position,
      4e-16,
      'rendered lower-left point',
    );
    vector2Near(
      blocks.legA.longTipIndex.getWorldPosition(new THREE.Vector3()),
      state.lowerRight.position,
      4e-16,
      'rendered lower-right point',
    );
    near(blocks.upperSpanWitness.scale.x, state.upperSpan, 0,
      'rendered upper witness span');
    near(blocks.lowerSpanWitness.scale.x, state.lowerSpan, 0,
      'rendered lower witness span');
    vectorNear(blocks.pivotAssembly.position, pivotWorld, 0,
      'common pivot remains fixed');
    assert.equal(data.contacts.commonPivotToLegASlot.active, true);
    assert.equal(data.contacts.commonPivotToLegBSlot.active, true);
    assert.equal(data.contacts.setScrew.locked, true);
    near(data.contacts.setScrew.selectedScaleRatio,
      geometry.selectedScaleRatio, 0, 'locked rendered ratio');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});

test('movement 409 legs are round-ended bars with straight tapers, no bulb bosses (pass 90)', () => {
  const model = createMovementModel(catalog.movements[408]);
  const { blocks, geometry } = model.root.userData;
  for (const leg of [blocks.legA, blocks.legB]) {
    const body = leg.spine;
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox;
    // The serrated grip is Brown's widest part; the round ends are no wider than the bar.
    assert.ok(box.max.x <= 0.26 && box.min.x >= -0.26, `leg width ${box.min.x}..${box.max.x}`);
    const p = body.geometry.attributes.position;
    let endWidth = 0;
    for (let i = 0; i < p.count; i += 1) if (p.getY(i) > 1.47) endWidth = Math.max(endWidth, Math.abs(p.getX(i)));
    assert.ok(endWidth <= geometry.legWidth / 2 + 1e-6, `upper end radius ${endWidth}`);
  }
  disposeModel(model.root);
});
