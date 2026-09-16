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
  'self-acting-two-leaf-weir-with-overlap-contact-notch-overflow-and-bed-scour-opening';

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

function movementModel() {
  const movement = catalog.movements[462];
  return { model: createMovementModel(movement), movement };
}

test('movement 463 is one unequal two-leaf self-acting weir with a notch and a bed-scouring passage', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 463);
  assert.equal(movement.number, '463');
  assert.equal(movement.title,
    'Self-acting two-leaf weir and scouring sluice');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.upperLeaf.parent, model.root);
  assert.equal(blocks.lowerLeaf.parent, model.root);
  assert.equal(blocks.upperBody.parent, blocks.upperLeaf);
  assert.equal(blocks.lowerBody.parent, blocks.lowerLeaf);
  assert.equal(blocks.upperShoulders.length, 2);
  assert.ok(blocks.upperShoulders.every((part) =>
    part.parent === blocks.upperLeaf));
  assert.equal(blocks.upperContactEdge.parent, blocks.upperLeaf);
  assert.equal(blocks.notchFlow.parent, model.root);
  assert.equal(blocks.bedFlow.parent, model.root);
  assert.ok(geometry.upperLength > geometry.lowerLength * 2);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.lowerLeafIndependent, false);
  assert.equal(degreesOfFreedom.upperLeafHydraulicTriggerDemonstration, true);
  disposeModel(model.root);
});

test('movement 463 source record preserves both Brown poses and discloses reconstructed dimensions, force law, and timing', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate463;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_463.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 463');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateClosedUpperLeafBoundsPixels,
    [117, 183, 30, 236]);
  assert.deepEqual(plate.approximateOpenUpperLeafBoundsPixels,
    [315, 193, 96, 151]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('pivot below their centers')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('turns in the direction of the stream')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('notch')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('bed passage')));
  assert.match(evidence.engravingEvidence, /closed vertical pair/i);
  assert.match(evidence.engravingEvidence, /open opposed-rotation pair/i);
  assert.match(evidence.reconstructionDisclosure, /no leaf dimensions/i);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/i);
  disposeModel(model.root);
});

test('movement 463 both pivots are below panel center and the closed lower leaf overlaps the upper bottom edge', () => {
  const { model } = movementModel();
  const { geometry, stateAtDrive } = model.root.userData;
  const closed = stateAtDrive(0);

  assert.ok(geometry.upperPivotFromBottom < geometry.upperLength / 2);
  assert.ok(geometry.lowerPivotFromBottom < geometry.lowerLength / 2);
  near(closed.upperAngle, 0, 1e-14, 'closed upper angle');
  near(closed.lowerAngle, 0, 1e-14, 'closed lower angle');
  near(closed.upperBottomCenter.x, geometry.upperPivot.x, 1e-12,
    'closed upper centerline is vertical');
  near(closed.lowerBottomCenter.x, geometry.lowerPivot.x, 1e-12,
    'closed lower centerline is vertical');
  const upperBottomY = geometry.upperPivot.y
    - geometry.upperPivotFromBottom;
  const lowerTopY = geometry.lowerPivot.y + geometry.lowerTopLocal;
  assert.ok(lowerTopY > upperBottomY);
  near(lowerTopY - upperBottomY,
    geometry.lowerTopLocal - closed.lowerContactCoordinate, 1e-12,
    'lower top overlap beyond upper bottom contact');
  assert.ok(closed.lowerContactCoordinate > -geometry.lowerPivotFromBottom);
  assert.ok(closed.lowerContactCoordinate < geometry.lowerTopLocal);
  vectorNear(closed.contactPoint,
    new THREE.Vector3(0, upperBottomY, 0), 1e-12,
    'closed faces meet at x=0');
  disposeModel(model.root);
});

test('movement 463 solves the lower angle from exact sliding face contact throughout opening', () => {
  const { model } = movementModel();
  const { geometry, stateAtDrive } = model.root.userData;
  let previousUpperAngle = 0;
  let previousLowerAngle = 0;

  for (let index = 0; index <= 200; index += 1) {
    const drive = index / 200;
    const state = stateAtDrive(drive);
    const reconstructedContact = state.lowerFaceReference.clone()
      .addScaledVector(state.lowerAxis, state.lowerContactCoordinate);
    vectorNear(state.contactPoint, reconstructedContact, 2e-12,
      `contact point at drive ${drive}`);
    near(state.contactNormalResidual, 0, 2e-12,
      `normal contact residual at drive ${drive}`);
    near(state.contactPoint.clone().sub(state.upperBottomCenter)
      .dot(state.upperNormal), -geometry.upperThickness / 2, 2e-12,
    `upper upstream face offset at drive ${drive}`);
    assert.ok(state.lowerContactCoordinate >= -geometry.lowerPivotFromBottom);
    assert.ok(state.lowerContactCoordinate <= geometry.lowerTopLocal);
    assert.ok(geometry.lowerTopLocal - state.lowerContactCoordinate > 0.20,
      `lower top still overlaps contact at drive ${drive}`);
    assert.ok(state.upperAngle <= previousUpperAngle + 1e-12,
      `upper downstream angle is monotonic at drive ${drive}`);
    assert.ok(state.lowerAngle >= previousLowerAngle - 1e-12,
      `lower upstream angle is monotonic at drive ${drive}`);
    previousUpperAngle = state.upperAngle;
    previousLowerAngle = state.lowerAngle;
  }
  disposeModel(model.root);
});

test('movement 463 upper and lower leaves rotate in opposite source-prescribed stream directions and expose the bed', () => {
  const { model } = movementModel();
  const { geometry, stateAtDrive, transmission } = model.root.userData;
  const closed = stateAtDrive(0);
  const open = stateAtDrive(1);

  assert.deepEqual(geometry.streamDirection.toArray(), [1, 0, 0]);
  near(open.upperAngle, -geometry.maximumUpperAngle, 1e-12,
    'upper leaf maximum downstream rotation');
  assert.ok(open.upperAngle < 0);
  assert.ok(open.lowerAngle > 0);
  assert.ok(open.upperTopCenter.x > closed.upperTopCenter.x,
    'upper top moves downstream');
  assert.ok(open.lowerTopCenter.x < closed.lowerTopCenter.x,
    'lower top moves upstream');
  assert.ok(open.lowerBottomCenter.x > closed.lowerBottomCenter.x,
    'lower bottom swings downstream away from its closed bed line');
  assert.ok(open.bedPassageHorizontalOpening > 0.14);
  assert.match(transmission.directions, /upper rotation negative/);
  assert.match(transmission.directions, /lower rotation positive/);
  assert.match(transmission.contactConstraint, /circle-line intersection/);
  disposeModel(model.root);
});

test('movement 463 schedule demonstrates ordinary notch overflow, flood opening, bed scour, and reclosure in order', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const ordinary = stateAtPhase(0);
  const flood = stateAtPhase(geometry.riseEndPhase);
  const opening = stateAtPhase(
    (geometry.riseEndPhase + geometry.openingEndPhase) / 2,
  );
  const scour = stateAtPhase(
    (geometry.openingEndPhase + geometry.drainEndPhase) / 2,
  );
  const closing = stateAtPhase(
    (geometry.drainEndPhase + geometry.closingEndPhase) / 2,
  );
  const reset = stateAtPhase(geometry.closingEndPhase);

  near(ordinary.contactDrive, 0, 1e-12, 'ordinary gate drive');
  near(ordinary.waterLevel, geometry.ordinaryWaterLevel, 1e-12,
    'ordinary water level');
  assert.ok(ordinary.notchHead > 0);
  assert.ok(ordinary.notchFlowFraction > 0);
  near(ordinary.bedFlowFraction, 0, 1e-12, 'ordinary bed flow');
  near(flood.contactDrive, 0, 1e-12, 'gate remains closed at trigger');
  near(flood.waterLevel, geometry.floodWaterLevel, 1e-12,
    'peak flood level');
  assert.ok(opening.contactDrive > 0 && opening.contactDrive < 1);
  assert.match(opening.regime, /rising-head/);
  near(scour.contactDrive, 1, 1e-12, 'fully open scour state');
  near(scour.notchFlowFraction, 0, 1e-12, 'notch stream off while open');
  near(scour.bedFlowFraction, 1, 1e-12, 'full bed flow');
  assert.ok(scour.sedimentRemainingFraction < ordinary.sedimentRemainingFraction);
  assert.ok(closing.contactDrive > 0 && closing.contactDrive < 1);
  assert.match(closing.regime, /reclose/);
  near(reset.contactDrive, 0, 1e-12, 'closed after falling head');
  near(reset.waterLevel, geometry.ordinaryWaterLevel, 1e-12,
    'ordinary water restored');
  assert.equal(stateAtPhase(1).phase, 0);
  disposeModel(model.root);
});

test('movement 463 gate and water schedule have continuous position, velocity, and acceleration at every event boundary', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [
    0,
    geometry.riseEndPhase,
    geometry.openingEndPhase,
    geometry.drainEndPhase,
    geometry.closingEndPhase,
  ];
  const step = 1e-5;
  const fields = ['upperAngle', 'lowerAngle', 'waterLevel'];

  for (const boundary of boundaries) {
    for (const field of fields) {
      const minusTwo = stateAtPhase(boundary - 2 * step)[field];
      const minusOne = stateAtPhase(boundary - step)[field];
      const center = stateAtPhase(boundary)[field];
      const plusOne = stateAtPhase(boundary + step)[field];
      const plusTwo = stateAtPhase(boundary + 2 * step)[field];
      const leftVelocity = (center - minusOne) / step;
      const rightVelocity = (plusOne - center) / step;
      const leftAcceleration = (center - 2 * minusOne + minusTwo) / step ** 2;
      const rightAcceleration = (plusTwo - 2 * plusOne + center) / step ** 2;
      near(leftVelocity, rightVelocity, 1e-4,
        `${field} velocity continuity at phase ${boundary}`);
      near(leftAcceleration, rightAcceleration, 0.10,
        `${field} acceleration continuity at phase ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 463 source closed and open states reproduce the two engraved configurations', () => {
  const { model } = movementModel();
  const {
    sourceOpenPose,
    sourcePose,
    stateAtDrive,
    stateAtPhase,
  } = model.root.userData;
  const closed = stateAtPhase(0);
  const open = stateAtDrive(1);

  near(sourcePose.upperAngle, closed.upperAngle, 1e-12,
    'source closed upper angle');
  near(sourcePose.lowerAngle, closed.lowerAngle, 1e-12,
    'source closed lower angle');
  near(sourcePose.waterLevel, closed.waterLevel, 1e-12,
    'source closed water level');
  vectorNear(sourcePose.contactPoint, closed.contactPoint, 1e-12,
    'source closed contact');
  near(sourceOpenPose.upperAngle, open.upperAngle, 1e-12,
    'source open upper angle');
  near(sourceOpenPose.lowerAngle, open.lowerAngle, 1e-12,
    'source open lower angle');
  vectorNear(sourceOpenPose.contactPoint, open.contactPoint, 1e-12,
    'source open contact');
  disposeModel(model.root);
});

test('movement 463 renderer follows the contact solution, changes flow routes, and leaves both pivot assemblies fixed', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const upperAxlePosition = blocks.upperPivotAssembly.axle.position.clone();
  const lowerAxlePosition = blocks.lowerPivotAssembly.axle.position.clone();

  for (const phase of [0, 0.39, 0.59, 0.79, 0.95]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.upperLeaf.rotation.z, state.upperAngle, 1e-12,
      `upper render angle at phase ${phase}`);
    near(blocks.lowerLeaf.rotation.z, state.lowerAngle, 1e-12,
      `lower render angle at phase ${phase}`);
    near(blocks.upstreamWater.scale.y,
      state.waterLevel - geometry.channelFloorY, 1e-12,
      `upstream water depth at phase ${phase}`);
    near(blocks.upstreamWater.position.y,
      (state.waterLevel + geometry.channelFloorY) / 2, 1e-12,
      `upstream water center at phase ${phase}`);
    assert.equal(blocks.notchFlow.visible,
      state.contactDrive < 1e-8);
    assert.equal(blocks.bedFlow.visible,
      state.contactDrive > .05 && state.lowerBottomCenter.y - geometry.lowerThickness/2*Math.abs(Math.sin(state.lowerAngle)) - geometry.channelFloorY > .02);
    near(blocks.sedimentBank.scale.x,
      1.45 * state.sedimentRemainingFraction, 1e-12,
      `sediment render scale at phase ${phase}`);
    vectorNear(blocks.upperPivotAssembly.axle.position,
      upperAxlePosition, 0, 'upper axle fixed');
    vectorNear(blocks.lowerPivotAssembly.axle.position,
      lowerAxlePosition, 0, 'lower axle fixed');
  }
  disposeModel(model.root);
});

test('movement 463 closes exactly after its explanatory flood cycle', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);

  near(closure.phase, source.phase, 1e-12, 'cycle phase closure');
  near(closure.upperAngle, source.upperAngle, 1e-12,
    'upper angle closure');
  near(closure.lowerAngle, source.lowerAngle, 1e-12,
    'lower angle closure');
  near(closure.waterLevel, source.waterLevel, 1e-12,
    'water level closure');
  vectorNear(closure.contactPoint, source.contactPoint, 1e-12,
    'contact closure');
  model.update(geometry.cycleDuration);
  near(blocks.upperLeaf.rotation.z, 0, 1e-12,
    'rendered upper leaf closes');
  near(blocks.lowerLeaf.rotation.z, 0, 1e-12,
    'rendered lower leaf closes');
  disposeModel(model.root);
});

test('movement 463 has finite render bounds in both poses and movement 507 remains the next authored frontier', () => {
  const movement463 = catalog.movements[462];
  const movement507 = catalog.movements[506];
  const model463 = createMovementModel(movement463);
  const model507 = createMovementModel(movement507);
  const fitBounds = model463.root.userData.cameraFitBounds;

  for (const phase of [0, 0.59]) {
    model463.update(phase * model463.root.userData.geometry.cycleDuration);
    model463.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model463.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    assert.ok(fitBounds.min.x <= bounds.min.x);
    assert.ok(fitBounds.min.y <= bounds.min.y);
    assert.ok(fitBounds.min.z <= bounds.min.z);
    assert.ok(fitBounds.max.x >= bounds.max.x);
    assert.ok(fitBounds.max.y >= bounds.max.y);
    assert.ok(fitBounds.max.z >= bounds.max.z);
  }
  assert.equal(movement463.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model463.root);
  disposeModel(model507.root);
});
