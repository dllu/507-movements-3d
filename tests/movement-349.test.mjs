import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 349 is the two-DOF jointed parallel ruler', () => {
  const movement = catalog.movements[348];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 349);
  assert.equal(movement.number, '349');
  assert.equal(movement.title, 'Another form of parallel ruler');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'jointed-two-dof-parallel-ruler-with-intermediate-bar');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /four-equal-jointed-arms/);
  assert.match(mechanism, /two-ternary-middle-pivots/);
  assert.equal(degreesOfFreedom.mechanism, 2);
  assert.match(degreesOfFreedom.animatedPath,
    /one symmetric opening coordinate/);
  assert.match(transmission.arbitraryConfiguration,
    /arbitrary u and v/);
  assert.match(transmission.parallelismConstraint,
    /topRight-topLeft=middleRight-middleLeft=bottomRight-bottomLeft/);

  assert.equal(blocks.upperRuler.group.parent, model.root);
  assert.equal(blocks.lowerRuler.group.parent, model.root);
  assert.equal(blocks.intermediateBar.parent, model.root);
  assert.equal(blocks.intermediateBody.parent, blocks.intermediateBar);
  assert.equal(blocks.middleLeftAnchor.parent, blocks.intermediateBar);
  assert.equal(blocks.middleRightAnchor.parent, blocks.intermediateBar);
  for (const link of Object.values(blocks.links)) {
    assert.equal(link.group.parent, model.root);
    assert.equal(link.startAnchor.parent, link.group);
    assert.equal(link.endAnchor.parent, link.group);
    near(link.group.userData.nominalLength,
      model.root.userData.geometry.armLength, 0,
    'all four rendered links have one length');
  }
  assert.equal(Object.keys(blocks.links).length, 4);
  assert.equal(Object.keys(blocks.pivotPins).length, 6);
  assert.equal(Object.keys(blocks.pivotCaps).length, 6);
  assert.equal(blocks.parallelGuideLines.length, 3);

  assert.equal(contacts.upperRulerPivots.fixedToMember,
    blocks.upperRuler.group);
  assert.equal(contacts.lowerRulerPivots.fixedToMember,
    blocks.lowerRuler.group);
  assert.equal(contacts.middleTernaryPivots.intermediateMember,
    blocks.intermediateBar);
  assert.equal(contacts.middleTernaryPivots.leftMembers.length, 2);
  assert.equal(contacts.middleTernaryPivots.rightMembers.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'intermediate-parallel-bar-joining-both-middle-joints').length, 1);
  assert.equal(roles.filter((role) => /-equal-arm$/.test(role)).length, 4);
  assert.equal(roles.filter((role) => /shared-revolute-pin$/.test(role))
    .length, 6);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 349 preserves the official outlines, pivots, arm length, phase, and timing', () => {
  const model = createMovementModel(catalog.movements[348]);
  const {
    canonicalStates,
    geometry,
    modelPointToOfficialAnimationRaster,
    officialHeightAtPhase,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_349.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_pos_interp-upper-ruler',
    'add_pos_interp-lower-ruler',
    'four-add_c_rod-equal-arms-to-horizontal-middle-line',
    'add_tx-intermediate-bar-from-left-middle-pivot',
  ]);
  assert.equal(official.armLength, 2.386304);
  near(official.rulerPivotSpacing, 2.666666, 5e-16,
    'official ruler-pivot spacing');
  assert.equal(official.intermediatePivotSpacing, 2.666667);
  assert.equal(official.phaseOffset, 0.2);
  assert.deepEqual(official.view, [-8, -4.5, 9, 9]);
  assert.deepEqual(sourceAnimation.officialKeyframePhases,
    [0, 0.4, 0.5, 0.9]);
  assert.equal(official.upperRulerPoints.length, 6);
  assert.equal(official.lowerRulerPoints.length, 6);
  near(sourceAnimation.physicalCorrection.magnitudeSourceUnits,
    1e-6, 2e-16, 'published decimal spacing mismatch');
  assert.match(sourceAnimation.physicalCorrection.reason,
    /both ternary pins close exactly/);
  assert.equal(sourceAnimation.timingRefinement.interpolation,
    'quintic smootherstep');
  assert.equal(
    sourceAnimation.timingRefinement.changesExtremaOrDwells,
    true,
  );
  assert.match(sourceAnimation.timingRefinement.reason,
    /removes visible endpoint jerk/);
  assert.equal(geometry.cyclePeriod, 4);
  assert.equal(geometry.sourceArmLength, 2.386304);
  near(geometry.sourceRulerPivotSpacing, 2.666666, 5e-16,
    'modeled source ruler-pivot spacing');
  near(geometry.sourceIntermediatePivotSpacing, 2.666666, 5e-16,
    'corrected source intermediate-pivot spacing');

  const officialSamples = [
    [0, 1.5],
    [0.1, 1.75],
    [0.2, 2],
    [0.25, 2],
    [0.3, 2],
    [0.5, 1.5],
    [0.7, 1],
    [0.75, 1],
    [0.8, 1],
    [0.9, 1.25],
    [1, 1.5],
  ];
  for (const [phase, expected] of officialSamples) {
    near(officialHeightAtPhase(phase).value, expected, 4e-16,
      `official keyframed half-separation ${phase}`);
  }

  const view = sourceReference.officialAnimationView;
  assert.equal(view.canvasWidth, 525);
  assert.equal(view.canvasHeight, 525);
  const pixelsPerUnit = 525 / 9;
  const sourceTopLeft = canonicalStates.sourceStart.source.topLeft;
  vector2Near(
    modelPointToOfficialAnimationRaster(
      canonicalStates.sourceStart.topLeft,
    ),
    new THREE.Vector2(
      (sourceTopLeft.x + 8) * pixelsPerUnit,
      (4.5 - sourceTopLeft.y) * pixelsPerUnit,
    ),
    1e-12,
    'source-start upper-left pivot raster',
  );
  const plate = sourceReference.brownPlate349;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.match(plate.inferredTopology, /two jointed equal-arm pairs/);
  disposeModel(model.root);
});

test('movement 349 retains parallel bars over its full two-DOF workspace', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { geometry, sourceStateAtArmAngles } = model.root.userData;
  const angles = Array.from({ length: 65 }, (_, index) =>
    -2.75 + 5.5 * index / 64);

  for (const upperAngle of angles) {
    for (const lowerAngle of angles) {
      const state = sourceStateAtArmAngles(upperAngle, lowerAngle);
      const topDirection = state.topRight.clone().sub(state.topLeft);
      const middleDirection = state.middleRight.clone()
        .sub(state.middleLeft);
      const bottomDirection = state.bottomRight.clone()
        .sub(state.bottomLeft);
      vector2Near(topDirection, middleDirection, 2e-15,
        `top-middle parallelism ${upperAngle},${lowerAngle}`);
      vector2Near(topDirection, bottomDirection, 2e-15,
        `top-bottom parallelism ${upperAngle},${lowerAngle}`);
      near(topDirection.length(), geometry.sourceRulerPivotSpacing,
        9e-16, `top pivot spacing ${upperAngle},${lowerAngle}`);
      near(state.middleLeft.distanceTo(state.topLeft),
        geometry.sourceArmLength, 9e-16,
      `upper-left arm length ${upperAngle},${lowerAngle}`);
      near(state.middleRight.distanceTo(state.topRight),
        geometry.sourceArmLength, 9e-16,
      `upper-right arm length ${upperAngle},${lowerAngle}`);
      near(state.middleLeft.distanceTo(state.bottomLeft),
        geometry.sourceArmLength, 9e-16,
      `lower-left arm length ${upperAngle},${lowerAngle}`);
      near(state.middleRight.distanceTo(state.bottomRight),
        geometry.sourceArmLength, 9e-16,
      `lower-right arm length ${upperAngle},${lowerAngle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 349 closes all six animated pivots and three parallel bars', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const time = geometry.cyclePeriod * sample / 32768;
    const state = stateAtTime(time);
    const source = state.source;
    const topDirection = source.topRight.clone().sub(source.topLeft);
    const middleDirection = source.middleRight.clone()
      .sub(source.middleLeft);
    const bottomDirection = source.bottomRight.clone()
      .sub(source.bottomLeft);
    vector2Near(topDirection, middleDirection, 9e-16,
      `source top-middle parallelism ${sample}`);
    vector2Near(topDirection, bottomDirection, 9e-16,
      `source top-bottom parallelism ${sample}`);
    near(source.topLeft.distanceTo(source.middleLeft),
      geometry.sourceArmLength, 2e-15,
    `source upper-left arm ${sample}`);
    near(source.topRight.distanceTo(source.middleRight),
      geometry.sourceArmLength, 2e-15,
    `source upper-right arm ${sample}`);
    near(source.bottomLeft.distanceTo(source.middleLeft),
      geometry.sourceArmLength, 2e-15,
    `source lower-left arm ${sample}`);
    near(source.bottomRight.distanceTo(source.middleRight),
      geometry.sourceArmLength, 2e-15,
    `source lower-right arm ${sample}`);
    near(source.topLeft.y, -source.bottomLeft.y, 0,
      `symmetric animated opening ${sample}`);
    near(source.middleLeft.y, 0, 0,
      `left middle pivot on source centerline ${sample}`);
    near(source.middleRight.y, 0, 0,
      `right middle pivot on source centerline ${sample}`);
    near(source.horizontalReach ** 2 + source.halfSeparation ** 2,
      geometry.sourceArmLength ** 2, 4e-15,
    `Pythagorean arm closure ${sample}`);
    assert.ok(source.halfSeparation >= 1 - 2e-15);
    assert.ok(source.halfSeparation <= 2 + 2e-15);

    near(state.topLeft.distanceTo(state.middleLeft),
      geometry.armLength, 2e-15,
    `model upper-left arm ${sample}`);
    near(state.bottomRight.distanceTo(state.middleRight),
      geometry.armLength, 2e-15,
    `model lower-right arm ${sample}`);
    near(state.middleLeft.distanceTo(state.middleRight),
      geometry.pivotSpacing, 1e-15,
    `model intermediate pivot spacing ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 349 smooths every official traverse/dwell boundary without changing it', () => {
  const model = createMovementModel(catalog.movements[348]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    officialHeightAtPhase,
    smoothHeightAtPhase,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;

  const closed = geometry.closedHalfSeparation;
  assert.ok(closed > 1 && closed <= 1.06,
    'closed stop just short of the official flush pose');
  const midway = (2 + closed) / 2;
  near(canonicalStates.sourceStart.source.halfSeparation, midway, 1e-15,
    'source-start half-separation');
  near(canonicalStates.upperExtreme.source.halfSeparation, 2, 0,
    'upper extreme');
  near(canonicalStates.upperDwellEnd.source.halfSeparation, 2, 0,
    'upper dwell end');
  near(canonicalStates.descendingMidpoint.source.halfSeparation, midway,
    1e-15, 'descending midpoint');
  near(canonicalStates.lowerExtreme.source.halfSeparation, closed, 0,
    'lower extreme');
  near(canonicalStates.lowerDwellEnd.source.halfSeparation, closed, 0,
    'lower dwell end');
  near(canonicalStates.cycleClosure.source.halfSeparation, midway, 1e-15,
    'cycle closure');

  const modelPose = (value) => (value === 1 ? closed : value);
  for (const phase of [0.2, 0.3, 0.7, 0.8]) {
    const smooth = smoothHeightAtPhase(phase);
    near(smooth.velocityPerPhase, 0, 0,
      `smooth boundary velocity ${phase}`);
    near(smooth.accelerationPerPhaseSquared, 0, 0,
      `smooth boundary acceleration ${phase}`);
    near(smooth.value, modelPose(officialHeightAtPhase(phase).value), 0,
      `boundary pose retained ${phase}`);
  }
  for (const [start, end] of [[0.2, 0.3], [0.7, 0.8]]) {
    for (let sample = 0; sample <= 32; sample += 1) {
      const phase = THREE.MathUtils.lerp(start, end, sample / 32);
      near(smoothHeightAtPhase(phase).value,
        modelPose(officialHeightAtPhase(phase).value), 0,
      `dwell pose retained ${phase}`);
    }
  }
  assert.equal(sourceAnimation.timingRefinement.changesExtremaOrDwells,
    true);
  assert.equal(sourceAnimation.closedStop.modelHalfSeparation, closed);
  near(stateAtTime(canonicalTimes.upperExtreme).halfSeparationRate,
    0, 0, 'upper extreme model speed');
  near(stateAtTime(canonicalTimes.lowerExtreme).halfSeparationRate,
    0, 0, 'lower extreme model speed');
  near(geometry.cyclePeriod, 4, 0, 'official cycle duration retained');
  disposeModel(model.root);
});

test('movement 349 analytic translations and arm rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 1e-4;

  for (const time of [0.09, 0.37, 0.66, 1.39, 1.71, 2.08, 2.43, 3.31, 3.77]) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    for (const [name, velocity, beforePoint, afterPoint] of [
      ['top ruler', state.topVelocity,
        beforeV.topLeft, afterV.topLeft],
      ['bottom ruler', state.bottomVelocity,
        beforeV.bottomLeft, afterV.bottomLeft],
      ['intermediate bar', state.middleVelocity,
        beforeV.middleLeft, afterV.middleLeft],
    ]) {
      const numerical = afterPoint.clone().sub(beforePoint)
        .multiplyScalar(1 / (2 * velocityStep));
      vector3Near(velocity, numerical, 1e-9,
        `${name} analytic velocity ${time}`);
    }
    near(state.arms.upper.angularVelocity,
      (afterV.arms.upper.angle - beforeV.arms.upper.angle)
        / (2 * velocityStep),
      1e-9, `upper-arm analytic rate ${time}`);
    near(state.arms.lower.angularVelocity,
      (afterV.arms.lower.angle - beforeV.arms.lower.angle)
        / (2 * velocityStep),
      1e-9, `lower-arm analytic rate ${time}`);

    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    for (const [name, acceleration, beforeVelocity, afterVelocity] of [
      ['top ruler', state.topAcceleration,
        beforeA.topVelocity, afterA.topVelocity],
      ['bottom ruler', state.bottomAcceleration,
        beforeA.bottomVelocity, afterA.bottomVelocity],
      ['intermediate bar', state.middleAcceleration,
        beforeA.middleVelocity, afterA.middleVelocity],
    ]) {
      const numerical = afterVelocity.clone().sub(beforeVelocity)
        .multiplyScalar(1 / (2 * accelerationStep));
      vector3Near(acceleration, numerical, 5e-7,
        `${name} analytic acceleration ${time}`);
    }
    near(state.arms.upper.angularAcceleration,
      (afterA.arms.upper.angularVelocity
        - beforeA.arms.upper.angularVelocity)
        / (2 * accelerationStep),
      5e-7, `upper-arm analytic acceleration ${time}`);
    near(state.arms.lower.angularAcceleration,
      (afterA.arms.lower.angularVelocity
        - beforeA.arms.lower.angularVelocity)
        / (2 * accelerationStep),
      5e-7, `lower-arm analytic acceleration ${time}`);
  }
  disposeModel(model.root);
});

test('movement 349 renderer joins all arm eyes to their six solved pivots', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { blocks, contacts } = model.root.userData;

  for (const time of [0, 0.29, 0.8, 1.2, 1.73, 2.36, 2.8, 3.2, 3.67, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    for (const [name, expected] of [
      ['upperLeft', state.topLeft],
      ['upperRight', state.topRight],
      ['lowerLeft', state.bottomLeft],
      ['lowerRight', state.bottomRight],
    ]) {
      vector3Near(worldPosition(blocks.rulerPivotAnchors[name]),
        expected, 3e-16, `ruler anchor ${name} ${time}`);
      vector3Near(worldPosition(blocks.links[name].startAnchor),
        expected, 0, `arm outer eye ${name} ${time}`);
    }
    for (const [name, expected] of [
      ['upperLeft', state.middleLeft],
      ['lowerLeft', state.middleLeft],
      ['upperRight', state.middleRight],
      ['lowerRight', state.middleRight],
    ]) {
      vector3Near(worldPosition(blocks.links[name].endAnchor),
        expected, 5e-16, `arm middle eye ${name} ${time}`);
    }
    vector3Near(worldPosition(blocks.middleLeftAnchor),
      state.middleLeft, 3e-16, `intermediate left pin ${time}`);
    vector3Near(worldPosition(blocks.middleRightAnchor),
      state.middleRight, 1e-15, `intermediate right pin ${time}`);

    const upperDirection = state.middleLeft.clone().sub(state.topLeft)
      .normalize();
    const lowerDirection = state.middleLeft.clone()
      .sub(state.bottomLeft).normalize();
    vector3Near(X_AXIS.clone().applyQuaternion(
      blocks.links.upperLeft.group.getWorldQuaternion(
        new THREE.Quaternion(),
      )), upperDirection, 4e-16,
    `rendered upper-arm direction ${time}`);
    vector3Near(X_AXIS.clone().applyQuaternion(
      blocks.links.lowerLeft.group.getWorldQuaternion(
        new THREE.Quaternion(),
      )), lowerDirection, 4e-16,
    `rendered lower-arm direction ${time}`);
    assert.equal(blocks.upperRuler.group.quaternion.equals(
      new THREE.Quaternion()), true);
    assert.equal(blocks.lowerRuler.group.quaternion.equals(
      new THREE.Quaternion()), true);
    assert.equal(blocks.intermediateBar.quaternion.equals(
      new THREE.Quaternion()), true);

    vector3Near(contacts.upperRulerPivots.points[0],
      state.topLeft, 0, `upper-left contact ${time}`);
    vector3Near(contacts.upperRulerPivots.points[1],
      state.topRight, 0, `upper-right contact ${time}`);
    vector3Near(contacts.lowerRulerPivots.points[0],
      state.bottomLeft, 0, `lower-left contact ${time}`);
    vector3Near(contacts.lowerRulerPivots.points[1],
      state.bottomRight, 0, `lower-right contact ${time}`);
    vector3Near(contacts.middleTernaryPivots.points[0],
      state.middleLeft, 0, `middle-left ternary contact ${time}`);
    vector3Near(contacts.middleTernaryPivots.points[1],
      state.middleRight, 0, `middle-right ternary contact ${time}`);
  }
  disposeModel(model.root);
});

test('movement 349 closes smoothly and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  for (const key of [
    'topLeft',
    'topRight',
    'middleLeft',
    'middleRight',
    'bottomLeft',
    'bottomRight',
    'topVelocity',
    'bottomVelocity',
    'middleVelocity',
    'topAcceleration',
    'bottomAcceleration',
    'middleAcceleration',
  ]) vector3Near(finish[key], start[key], 0, `${key} cycle closure`);
  near(finish.arms.upper.angle, start.arms.upper.angle, 0,
    'upper-arm angle closure');
  near(finish.arms.lower.angle, start.arms.lower.angle, 0,
    'lower-arm angle closure');
  near(finish.arms.upper.angularVelocity,
    start.arms.upper.angularVelocity, 0,
    'upper-arm rate closure');
  near(finish.arms.lower.angularVelocity,
    start.arms.lower.angularVelocity, 0,
    'lower-arm rate closure');
  assert.equal(finish.phase, 0);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});

test('movement 349 rulers never overlap the arrow bar or each other', () => {
  const model = createMovementModel(catalog.movements[348]);
  const { blocks, geometry } = model.root.userData;
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const inside = (mesh, x, z) => {
    raycaster.set(new THREE.Vector3(x, 5, z), down);
    return raycaster.intersectObject(mesh, false).length > 0;
  };
  let minimumBarGap = Infinity;
  let minimumTailGap = Infinity;
  for (let sample = 0; sample < 40; sample += 1) {
    model.update(geometry.cyclePeriod * sample / 40);
    model.root.updateMatrixWorld(true);
    const upper = new THREE.Box3().setFromObject(blocks.upperRuler.body);
    const lower = new THREE.Box3().setFromObject(blocks.lowerRuler.body);
    minimumTailGap = Math.min(minimumTailGap, lower.min.z - upper.max.z);
    for (let x = -2.99; x <= 3; x += 0.05) {
      for (let z = -0.6; z <= 0.6; z += 0.0125) {
        const bar = inside(blocks.intermediateBody, x, z);
        const up = inside(blocks.upperRuler.body, x, z);
        const low = inside(blocks.lowerRuler.body, x, z);
        assert.ok(!(bar && (up || low)),
          `ruler overlaps arrow bar at phase ${sample / 40}, x ${x}, z ${z}`);
        assert.ok(!(up && low), `rulers overlap at phase ${sample / 40}`);
      }
    }
    // Main ruler inner edges (half-separation - 0.5 source units) against
    // the bar's half-width of 0.5 source units.
    const state = model.root.userData.kinematics;
    minimumBarGap = Math.min(minimumBarGap,
      (state.source.halfSeparation - 1) * geometry.sourceScale);
  }
  assert.ok(minimumBarGap > 0.02 && minimumBarGap < 0.05,
    `closed ruler stops against the bar with a hairline gap: ${minimumBarGap}`);
  assert.ok(minimumTailGap > 0.04 && minimumTailGap < 0.1,
    `ruler tails stop short of each other: ${minimumTailGap}`);
  disposeModel(model.root);
});
