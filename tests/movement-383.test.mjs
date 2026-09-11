import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 383 is one S-path textile web between two winding rolls and one interposed brush dressing cylinder', () => {
  const movement = catalog.movements[382];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 383);
  assert.equal(movement.number, '383');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.archetype,
    'tangent-s-web-two-winding-rolls-brush-dressing-cylinder',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-open-textile-web/);
  assert.match(data.mechanism, /one-upper-roll/);
  assert.match(data.mechanism, /one-interposed-brush-dressing-cylinder/);
  assert.match(data.mechanism, /one-lower-roll/);
  assert.match(data.mechanism, /equal-end-roll-surface-speeds/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 2);
  assert.match(degreesOfFreedom.inputs[0], /cloth transport/);
  assert.match(degreesOfFreedom.inputs[1], /dressing-cylinder rotation/);
  assert.match(degreesOfFreedom.note, /surface slip/);
  assert.match(degreesOfFreedom.note, /conjectural/);

  for (const component of [
    blocks.dressingCylinder,
    blocks.fixedFrame,
    blocks.webRibbon,
    ...blocks.webMarkers,
    ...blocks.windingRollers,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    ...blocks.bearingBars,
    ...blocks.bearingBlocks,
    ...blocks.frameFeet,
    blocks.arch,
  ]) assert.equal(component.parent, blocks.fixedFrame);
  for (const component of [
    ...blocks.brushBars,
    blocks.dressingAxle,
    blocks.dressingCore,
    blocks.dressingIndex,
  ]) assert.equal(component.parent, blocks.dressingCylinder);
  assert.equal(blocks.windingRollers.length, 2);
  assert.equal(blocks.brushBars.length, 12);
  assert.equal(blocks.webMarkers.length, 9);
  assert.equal(blocks.fixedFrame.userData.fixed, true);
  assert.equal(blocks.webRibbon.userData.isContinuousOpenTextileWeb, true);
  assert.equal(blocks.webRibbon.userData.isBelt, false);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'upper-supply-winding-roll',
    'lower-takeup-winding-roll',
    'interposed-brush-armed-dressing-cylinder',
    'one-of-dressing-cylinder-brush-bars',
    'one-continuous-cloth-or-warp-web-on-tangent-s-path',
    'moving-transverse-cloth-material-registration-stripe',
    'white-winding-roll-rotation-index',
    'white-dressing-cylinder-rotation-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 383 preserves Brown\'s elements, applications, measured plate, and the official conjecture warning', () => {
  const movement = catalog.movements[382];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate383;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_383.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two rollers/);
  assert.match(movement.description, /yarn or cloth is wound/);
  assert.match(movement.description, /interposed cylinder/);
  assert.match(movement.description, /smooth-surfaced or armed with brushes, teasels/);
  assert.match(movement.description, /sizing warps/);
  assert.match(movement.description, /gig-mills/);
  assert.match(movement.description, /finishing woven fabrics/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(
    sourceAnimation.officialNotesTurnRatioAndDirectionAreConjectural,
    true,
  );
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingTurnRatioDirectionOrWebSpeed,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /official page explicitly calls/);
  assert.match(dynamics.treatment, /plausible internally consistent/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.topRollCenter.toArray(), [256, 96]);
  assert.equal(plate.topRollRadiusPixels, 55);
  assert.deepEqual(plate.dressingCylinderCenter.toArray(), [260, 278]);
  assert.equal(plate.dressingCylinderRadiusPixels, 91);
  assert.deepEqual(plate.bottomRollCenter.toArray(), [258, 442]);
  assert.equal(plate.bottomRollRadiusPixels, 54);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.officialAnimationEvidence, /one-and-a-half times/);
  assert.match(evidence.officialAnimationEvidence, /conjectural/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 383 web path has exact internal tangencies and continuous direction at both straight-to-drum joins', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { geometry, textilePath } = data;
  const { path } = textilePath;
  const upperRadius = textilePath.drumUpperTangent.clone();
  const lowerRadius = textilePath.drumLowerTangent.clone();
  const topRadius = textilePath.topTangent.clone()
    .sub(textilePath.topCenter);
  const bottomRadius = textilePath.bottomTangent.clone()
    .sub(textilePath.bottomCenter);

  near(topRadius.length(), geometry.rollRadius, 2e-16,
    'upper winding tangent radius');
  near(bottomRadius.length(), geometry.rollRadius, 2e-16,
    'lower winding tangent radius');
  near(upperRadius.length(), geometry.dressingContactRadius, 2e-16,
    'upper dressing tangent radius');
  near(lowerRadius.length(), geometry.dressingContactRadius, 2e-16,
    'lower dressing tangent radius');
  near(topRadius.dot(textilePath.firstLineTangent), 0, 2e-16,
    'top roll line tangency');
  near(upperRadius.dot(textilePath.firstLineTangent), 0, 2e-16,
    'upper dressing line tangency');
  near(lowerRadius.dot(textilePath.secondLineTangent), 0, 2e-16,
    'lower dressing line tangency');
  near(bottomRadius.dot(textilePath.secondLineTangent), 0, 2e-16,
    'bottom roll line tangency');

  const epsilon = 1e-10;
  vectorNear(
    path.tangentAtDistance(textilePath.lineLength - epsilon),
    path.tangentAtDistance(textilePath.lineLength + epsilon),
    3e-10,
    'upper straight/arc tangent continuity',
  );
  vectorNear(
    path.tangentAtDistance(
      textilePath.lineLength + textilePath.arcLength - epsilon,
    ),
    path.tangentAtDistance(
      textilePath.lineLength + textilePath.arcLength + epsilon,
    ),
    3e-10,
    'lower arc/straight tangent continuity',
  );
  vectorNear(path.pointAtDistance(0), textilePath.topTangent, 0,
    'open path begins at supply roll');
  vectorNear(path.pointAtDistance(geometry.webPathLength),
    textilePath.bottomTangent, 1e-15,
    'open path ends at takeup roll');
  disposeModel(model.root);
});

test('movement 383 engineered path is exactly one winding circumference so material and roll phase have a common closure', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { geometry, textilePath } = data;

  near(geometry.dressingContactRadius / geometry.rollRadius,
    1.5, 2e-16, 'source animation dressing-to-winding radius ratio');
  near(geometry.webPathLength,
    2 * textilePath.lineLength + textilePath.arcLength,
    0, 'two straight spans plus central wrap');
  near(geometry.webPathLength,
    FULL_TURN * geometry.rollRadius, 1e-15,
    'one path circuit equals one roll circumference');
  near(geometry.webCircuitPeriod,
    geometry.webPathLength / data.transmission.webSpeed, 0,
    'material circuit period');
  assert.ok(geometry.centerSpacing
    > geometry.rollRadius + geometry.dressingContactRadius,
  'separated circles admit internal common tangent');
  disposeModel(model.root);
});

test('movement 383 both winding rolls satisfy exact vector no-slip at their distinct tangent points', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { geometry, stateAtTime, textilePath, transmission } = data;
  const topRadius = textilePath.topTangent.clone()
    .sub(textilePath.topCenter);
  const bottomRadius = textilePath.bottomTangent.clone()
    .sub(textilePath.bottomCenter);

  assert.match(transmission.windingNoSlipLaw, /omega cross radius/);
  assert.ok(transmission.windingAngularSpeed < 0,
    'both winding rolls turn clockwise');
  near(Math.abs(transmission.windingAngularSpeed)
    * geometry.rollRadius,
  transmission.webSpeed, 2e-16, 'winding surface speed');
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const state = stateAtTime(data.timeline.demonstrationPeriod
      * sample / 1200);
    vectorNear(state.topContactVelocity,
      state.webVelocityAtTop, 3e-16,
      'upper supply contact no slip');
    vectorNear(state.bottomContactVelocity,
      state.webVelocityAtBottom, 3e-16,
      'lower takeup contact no slip');
    vectorNear(state.topContactVelocity,
      new THREE.Vector3().crossVectors(
        Z_AXIS.clone().multiplyScalar(state.windingAngularSpeed),
        topRadius,
      ), 0, 'upper omega cross radius');
    vectorNear(state.bottomContactVelocity,
      new THREE.Vector3().crossVectors(
        Z_AXIS.clone().multiplyScalar(state.windingAngularSpeed),
        bottomRadius,
      ), 0, 'lower omega cross radius');
  }
  disposeModel(model.root);
});

test('movement 383 disclosed brush-cylinder choice is half the winding angular speed magnitude and retains positive dressing slip', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.equal(transmission.selectedInterposedSurface,
    'armed-with-brush-bars');
  assert.match(transmission.ratioAndDirectionChoice, /conjectural|clockwise|counterclockwise/);
  near(transmission.dressingAngularSpeed,
    -0.5 * transmission.windingAngularSpeed, 0,
    'chosen angular ratio and opposite direction');
  near(transmission.dressingSurfaceSpeed,
    transmission.dressingAngularSpeed
      * geometry.dressingContactRadius,
    0, 'brush surface speed');
  near(transmission.dressingRelativeSlipSpeed,
    transmission.webSpeed - transmission.dressingSurfaceSpeed,
    0, 'dressing slip speed');
  assert.ok(transmission.dressingRelativeSlipSpeed > 0);
  assert.ok(transmission.dressingRelativeSlipSpeed
    < transmission.webSpeed);
  for (const time of [-12, 0, 2.3, 17]) {
    const state = stateAtTime(time);
    near(state.dressingRelativeSlipSpeed,
      transmission.dressingRelativeSlipSpeed, 0,
      'steady dressing slip');
  }
  disposeModel(model.root);
});

test('movement 383 material stripes remain equally spaced by arc length and move smoothly through exact path tangencies', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { geometry, stateAtTime, textilePath, transmission } = data;
  const markerSpacing = geometry.webPathLength / geometry.markerCount;

  for (let sample = -900; sample <= 1800; sample += 1) {
    const state = stateAtTime(data.timeline.demonstrationPeriod
      * sample / 900);
    assert.equal(state.markerStates.length, geometry.markerCount);
    for (let index = 0; index < geometry.markerCount; index += 1) {
      const marker = state.markerStates[index];
      near(marker.velocityMagnitude, transmission.webSpeed, 0,
        `marker ${index} material speed`);
      vectorNear(marker.position,
        textilePath.path.pointAtDistance(marker.distance), 0,
        `marker ${index} exact arc-length position`);
      vectorNear(marker.tangent,
        textilePath.path.tangentAtDistance(marker.distance), 0,
        `marker ${index} exact tangent`);
      near(marker.tangent.length(), 1, 3e-16,
        `marker ${index} unit tangent`);
      const next = state.markerStates[
        (index + 1) % geometry.markerCount
      ];
      const separation = THREE.MathUtils.euclideanModulo(
        next.distance - marker.distance,
        geometry.webPathLength,
      );
      near(separation, markerSpacing, 2e-15,
        `marker ${index} equal path spacing`);
    }
  }
  disposeModel(model.root);
});

test('movement 383 renderer binds both winding rolls, dressing cylinder, and every arc-length cloth marker exactly', () => {
  const model = createMovementModel(catalog.movements[382]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const framePosition = blocks.fixedFrame.position.clone();
  const ribbonPosition = blocks.webRibbon.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = data.timeline.demonstrationPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    for (let index = 0; index < 2; index += 1) {
      near(blocks.windingRollers[index].rotation.z,
        expected.windingAngles[index], 0,
        `rendered winding roll ${index}`);
    }
    near(blocks.dressingCylinder.rotation.z,
      expected.dressingAngle, 0,
      'rendered dressing cylinder');
    for (let index = 0; index < geometry.markerCount; index += 1) {
      vectorNear(blocks.webMarkers[index].position,
        expected.markerStates[index].position, 0,
        `rendered material stripe ${index}`);
      angleNear(blocks.webMarkers[index].rotation.z,
        Math.atan2(
          expected.markerStates[index].tangent.y,
          expected.markerStates[index].tangent.x,
        ), 0, `rendered stripe ${index} tangent angle`);
    }
    vectorNear(blocks.fixedFrame.position, framePosition, 0,
      'arched frame remains fixed');
    vectorNear(blocks.webRibbon.position, ribbonPosition, 0,
      'web path geometry remains fixed');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 1e-15, 'renderer constraint residual');
    }
  }
  disposeModel(model.root);
});

test('movement 383 closes two web circuits, two winding turns, and one dressing turn before movement 507 remains authored', () => {
  const movement = catalog.movements[382];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.webTravel - start.webTravel,
    2 * geometry.webPathLength, 2e-15,
    'two unwrapped material path circuits');
  for (let index = 0; index < 2; index += 1) {
    near(closure.windingAngles[index] - start.windingAngles[index],
      -2 * FULL_TURN, 4e-15,
      `winding roll ${index} makes two clockwise turns`);
    angleNear(closure.windingAngles[index],
      start.windingAngles[index], 4e-15,
      `winding roll ${index} pose closes`);
  }
  near(closure.dressingAngle - start.dressingAngle,
    FULL_TURN, 2e-15,
    'dressing cylinder makes one counterclockwise turn');
  angleNear(closure.dressingAngle, start.dressingAngle, 2e-15,
    'dressing cylinder pose closes');
  for (let index = 0; index < geometry.markerCount; index += 1) {
    vectorNear(closure.markerStates[index].position,
      start.markerStates[index].position, 2e-15,
      `material stripe ${index} closes`);
  }
  assert.equal(timeline.demonstrationPeriod,
    2 * geometry.webCircuitPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    timeline.demonstrationPeriod);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
