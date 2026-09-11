import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 381 is one oblong bed with two divergent cheeks, two retained wedges, and one planing workpiece', () => {
  const movement = catalog.movements[380];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 381);
  assert.equal(movement.number, '381');
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(
    movement.archetype,
    'dovetail-retained-paired-wedge-joiners-clamp',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /two-fixed-wedge-formed-cheeks/);
  assert.match(data.mechanism, /one-narrow-bed-throat/);
  assert.match(data.mechanism, /two-matching-sliding-wedges/);
  assert.match(data.mechanism, /workpiece/);
  assert.equal(degreesOfFreedom.independentPhysicalInputs, 2);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /synchronized insertion/);
  assert.match(degreesOfFreedom.note, /physically adjustable on its own/);
  assert.match(degreesOfFreedom.note, /centered workpiece remains centered/);

  for (const component of [
    blocks.bed,
    ...blocks.cheeks,
    ...blocks.dovetailLips,
    ...blocks.grainLines,
    blocks.throatDatum,
    ...blocks.wedgeContactStrips,
    ...blocks.wedges,
    blocks.workpiece,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.cheeks.length, 2);
  assert.equal(blocks.dovetailLips.length, 2);
  assert.equal(blocks.wedges.length, 2);
  assert.equal(blocks.wedgeContactStrips.length, 2);
  assert.equal(blocks.bed.userData.fixed, true);
  assert.equal(blocks.workpiece.userData.fixedForDemonstration, true);
  assert.deepEqual(blocks.cheeks.map(({ userData }) => userData.side),
    [-1, 1]);
  assert.deepEqual(blocks.wedges.map(({ userData }) => userData.side),
    [-1, 1]);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-oblong-clamp-bed',
    'one-of-two-fixed-wedge-formed-cheeks',
    'inward-overhanging-upper-dovetail-retainer-lip',
    'one-of-two-sliding-dovetail-retained-clamping-wedges',
    'one-removable-board-held-for-planing-between-wedges',
    'white-wedge-to-workpiece-contact-face-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 381 preserves Brown\'s plan and transverse-section evidence, unavailable animation, and disclosed reconstruction', () => {
  const movement = catalog.movements[380];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate381;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_381.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Bowery.s joiner.s clamp/);
  assert.match(movement.description, /plan and transverse section/);
  assert.match(movement.description, /Oblong bed/);
  assert.match(movement.description, /two wedge-formed cheeks/);
  assert.match(movement.description, /dovetailed inward/);
  assert.match(movement.description, /two wedges for clamping/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingWedgeAngleOrForce,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /transverse dovetail retention/);
  assert.match(dynamics.treatment, /ideal mechanical advantage/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.transverseBedBottomLeft.toArray(), [149, 204]);
  assert.deepEqual(plate.transverseBedBottomRight.toArray(), [355, 204]);
  assert.deepEqual(plate.transverseCentralWorkpieceTop.toArray(), [257, 50]);
  assert.deepEqual(plate.lowerPlanBedLeft.toArray(), [27, 264]);
  assert.deepEqual(plate.lowerPlanBedRightBreak.toArray(), [490, 265]);
  assert.deepEqual(plate.lowerPlanNarrowThroat.toArray(), [27, 339]);
  assert.deepEqual(plate.upperCheekInnerStart.toArray(), [27, 325]);
  assert.deepEqual(plate.upperCheekInnerEnd.toArray(), [207, 280]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence, /diverging from a narrow left throat/);
  assert.match(evidence.engravingEvidence, /upper retention/);
  assert.match(evidence.reconstructionDisclosure, /0.38 face slope/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 381 cheek faces diverge linearly from the narrow throat and their upper lips project inward as dovetail retainers', () => {
  const model = createMovementModel(catalog.movements[380]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const halfGapAt = (x) => geometry.cheekThroatHalfGap
    + geometry.cheekFaceSlope * (x - geometry.cheekThroatX);

  assert.ok(geometry.cheekFaceSlope > 0);
  assert.ok(halfGapAt(geometry.cheekMaximumX)
    > halfGapAt(geometry.cheekMinimumX));
  assert.ok(halfGapAt(geometry.cheekMinimumX)
    > geometry.cheekThroatHalfGap);
  assert.ok(geometry.dovetailLipProjection > 0);
  assert.ok(geometry.dovetailLipHeight > 0);
  assert.ok(geometry.dovetailLipHeight < geometry.cheekHeight);
  for (let index = 0; index < 2; index += 1) {
    const side = index === 0 ? -1 : 1;
    assert.equal(blocks.cheeks[index].userData.innerFaceSlope,
      side * geometry.cheekFaceSlope);
    assert.equal(blocks.dovetailLips[index].userData.inwardProjection,
      geometry.dovetailLipProjection);
    assert.equal(blocks.dovetailLips[index].userData.side, side);
    near(blocks.dovetailLips[index].position.y,
      geometry.bedTopY + geometry.cheekHeight, 0,
      'retaining lip starts at cheek upper edge');
  }
  disposeModel(model.root);
});

test('movement 381 each rigid wedge follows its fixed sloping cheek face exactly throughout insertion', () => {
  const model = createMovementModel(catalog.movements[380]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const halfGapAt = (x) => geometry.cheekThroatHalfGap
    + geometry.cheekFaceSlope * (x - geometry.cheekThroatX);

  assert.match(transmission.outerFaceContactLaw, /coincident/);
  assert.match(transmission.lateralTravelLaw, /cheek-face slope/);
  for (let sample = -1600; sample <= 3200; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1600);
    for (const wedge of state.wedgeStates) {
      near(wedge.lateralDisplacement,
        wedge.side * geometry.cheekFaceSlope
          * wedge.axialDisplacement,
        0, 'signed path slope');
      if (Math.abs(wedge.axialDisplacement) > 1e-12) {
        near(wedge.pathSlope,
          wedge.side * geometry.cheekFaceSlope,
          2e-16, 'published wedge path slope');
      }
      for (const localX of [
        geometry.wedgeMinimumX,
        (geometry.wedgeMinimumX + geometry.wedgeMaximumX) / 2,
        geometry.wedgeMaximumX,
      ]) {
        const worldX = localX + wedge.axialDisplacement;
        const movingOuterZ = wedge.side * halfGapAt(localX)
          + wedge.lateralDisplacement;
        const fixedCheekZ = wedge.side * halfGapAt(worldX);
        near(movingOuterZ, fixedCheekZ, 5e-16,
          'moving wedge outer face remains on fixed cheek');
      }
    }
  }
  disposeModel(model.root);
});

test('movement 381 mirrored wedge inner faces approach symmetrically and touch the workpiece only at full insertion', () => {
  const model = createMovementModel(catalog.movements[380]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const rest = stateAtTime(0);
  const clamped = stateAtTime(geometry.demonstrationPeriod / 2);

  near(geometry.maximumLateralTravel,
    geometry.cheekFaceSlope * geometry.wedgeTravel, 0,
    'maximum lateral travel');
  near(geometry.wedgeInnerHalfGapAtRest,
    geometry.workpieceHalfWidth + geometry.maximumLateralTravel,
    0, 'resting inner half gap');
  for (const wedge of rest.wedgeStates) {
    near(wedge.contactGap, geometry.maximumLateralTravel, 0,
      'initial workpiece clearance');
  }
  for (const wedge of clamped.wedgeStates) {
    near(wedge.contactGap, 0, 0,
      'exact full-insertion contact');
    near(wedge.innerFaceZ, wedge.workpieceFaceZ, 0,
      'inner face coincides with workpiece face');
  }
  assert.match(transmission.workpieceContactLaw, /exactly zero only at full insertion/);
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1200);
    assert.ok(state.minimumContactGap >= -2e-16,
      'wedges never penetrate workpiece');
    near(state.wedgeStates[0].innerFaceZ,
      -state.wedgeStates[1].innerFaceZ, 0,
      'inner faces remain mirrored');
    near(state.wedgeStates[0].contactGap,
      state.wedgeStates[1].contactGap, 0,
      'both sides retain equal clearance');
  }
  disposeModel(model.root);
});

test('movement 381 smooth wedge schedule has derivative-consistent axial and lateral motion and the correct ideal advantage', () => {
  const model = createMovementModel(catalog.movements[380]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const step = 1e-6;

  near(transmission.wedgeAngle,
    Math.atan(geometry.cheekFaceSlope), 0,
    'wedge angle');
  near(transmission.idealAxialToLateralForceRatio,
    1 / geometry.cheekFaceSlope, 0,
    'frictionless force ratio');
  for (let sample = 0; sample <= 720; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 720 + 0.002;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    near((after.insertionFraction - before.insertionFraction)
      / (2 * step), state.insertionRate, 5e-10,
    'insertion derivative');
    near((after.insertionRate - before.insertionRate)
      / (2 * step), state.insertionAcceleration, 8e-10,
    'insertion acceleration derivative');
    for (let index = 0; index < 2; index += 1) {
      near((after.wedgeStates[index].innerFaceZ
        - before.wedgeStates[index].innerFaceZ) / (2 * step),
      state.wedgeStates[index].lateralVelocity, 4e-10,
      `wedge ${index} lateral derivative`);
    }
  }
  disposeModel(model.root);
});

test('movement 381 renderer binds both wedge paths while bed, cheeks, lips, and workpiece remain fixed', () => {
  const model = createMovementModel(catalog.movements[380]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const bedPosition = blocks.bed.position.clone();
  const cheekPositions = blocks.cheeks.map((cheek) => cheek.position.clone());
  const lipPositions = blocks.dovetailLips.map((lip) => lip.position.clone());
  const workpiecePosition = blocks.workpiece.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    for (let index = 0; index < 2; index += 1) {
      near(blocks.wedges[index].position.x,
        expected.wedgeStates[index].axialDisplacement, 0,
        `rendered wedge ${index} axial position`);
      near(blocks.wedges[index].position.z,
        expected.wedgeStates[index].lateralDisplacement, 0,
        `rendered wedge ${index} lateral position`);
      near(blocks.wedgeContactStrips[index].position.z,
        expected.wedgeStates[index].innerFaceZ
          - expected.wedgeStates[index].side * 0.014,
        0, `rendered contact index ${index}`);
      vectorNear(blocks.cheeks[index].position,
        cheekPositions[index], 0, `cheek ${index} remains fixed`);
      vectorNear(blocks.dovetailLips[index].position,
        lipPositions[index], 0, `lip ${index} remains fixed`);
    }
    vectorNear(blocks.bed.position, bedPosition, 0,
      'bed remains fixed');
    vectorNear(blocks.workpiece.position, workpiecePosition, 0,
      'workpiece remains centered');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 2e-16, 'renderer constraint residual');
    }
  }
  disposeModel(model.root);
});

test('movement 381 closes one insertion-withdrawal cycle before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[380];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.insertionPhase - start.insertionPhase, FULL_TURN, 0,
    'one unwrapped insertion cycle');
  angleNear(closure.insertionPhase, start.insertionPhase, 0,
    'insertion phase closes');
  near(closure.insertionFraction, start.insertionFraction, 0,
    'insertion fraction closes');
  for (let index = 0; index < 2; index += 1) {
    near(closure.wedgeStates[index].axialDisplacement,
      start.wedgeStates[index].axialDisplacement, 0,
      `wedge ${index} axial position closes`);
    near(closure.wedgeStates[index].lateralDisplacement,
      start.wedgeStates[index].lateralDisplacement, 0,
      `wedge ${index} lateral position closes`);
  }
  assert.equal(timeline.demonstrationPeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
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
