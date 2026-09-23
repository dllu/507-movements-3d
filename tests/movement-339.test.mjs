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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
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

test('movement 339 is the direct-action right-triangle parallel motion', () => {
  const movement = catalog.movements[338];
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

  assert.equal(movement.id, 339);
  assert.equal(movement.number, '339');
  assert.equal(movement.title, 'Parallel motion for direct action engines');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'direct-action-engine-right-angle-slider-midpoint-radius-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fifteen-unit-bar-B-A-C/);
  assert.match(mechanism, /horizontal-slider-B-slot-D/);
  assert.match(mechanism, /fixed-radius-F-A/);
  assert.match(transmission.exactRigidConstraints, /\|B-C\|=15/);
  assert.match(transmission.exactRigidConstraints, /A=\(B\+C\)\/2/);
  assert.match(transmission.geometricProof, /right-angle vertex/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.pistonOutput.parent, model.root);
  assert.equal(blocks.sliderB.parent, model.root);
  assert.equal(blocks.barBC.parent, model.root);
  assert.equal(blocks.radiusBar.parent, model.root);
  assert.equal(blocks.crankArm.parent, blocks.inputCrank);
  assert.equal(blocks.pistonRod.parent, blocks.pistonOutput);
  assert.equal(blocks.sliderBlock.parent, blocks.sliderB);
  assert.equal(blocks.barBCMidpointAnchor.parent, blocks.barBC);
  assert.equal(contacts.crankPivotO.movingMember, blocks.inputCrank);
  assert.equal(contacts.radiusPivotF.movingMember, blocks.radiusBar);
  assert.equal(contacts.pistonGuideC.movingMember, blocks.pistonOutput);
  assert.equal(contacts.sliderAtB.movingMember, blocks.sliderB);
  assert.deepEqual(contacts.midpointAtA.members,
    [blocks.barBC, blocks.radiusBar]);
  assert.deepEqual(contacts.barAtC.members,
    [blocks.barBC, blocks.connectingRod, blocks.pistonOutput]);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'four-unit-upper-driving-crank-O-P').length, 1);
  assert.equal(roles.filter((role) => role ===
    'fourteen-unit-connecting-rod-P-C').length, 1);
  assert.equal(roles.filter((role) => role ===
    'fifteen-unit-rigid-bar-B-C').length, 1);
  assert.equal(roles.filter((role) => role ===
    'seven-point-five-unit-fixed-radius-bar-F-A').length, 1);
  assert.equal(roles.filter((role) => role ===
    'horizontal-slider-B-in-fixed-slot-D').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 339 preserves every official source coordinate and length', () => {
  const movement = catalog.movements[338];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_c_rod',
    'add_tx',
    'add_c_rod',
    'add_rot_to',
    'add_text',
  ]);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_339.html');
  assert.match(sourceAnimation.referenceScope, /horizontal slot D/);
  assert.match(sourceAnimation.reconstructionDifference,
    /reconstructed exactly/);

  assert.deepEqual(official.crankCenterO, new THREE.Vector2(0, 0));
  assert.deepEqual(official.crankPinLocalP, new THREE.Vector2(0, -4));
  assert.equal(official.crankRadius, 4);
  assert.equal(official.connectingRodLength, 14);
  assert.deepEqual(official.connectingRodWristLocal,
    new THREE.Vector2(0, -14));
  assert.equal(official.pistonLineX, 0);
  assert.deepEqual(official.pistonStrokeLine, [
    new THREE.Vector2(0, -24.5),
    new THREE.Vector2(0, -26.5),
  ]);
  assert.equal(official.barBCLength, 15);
  assert.deepEqual(official.barBCSliderLocal,
    new THREE.Vector2(-15, 0));
  assert.deepEqual(official.barBCMidpointLocal,
    new THREE.Vector2(-7.5, 0));
  assert.deepEqual(official.sliderLineD, [
    new THREE.Vector2(-16, -14),
    new THREE.Vector2(-18, -14),
  ]);
  assert.equal(official.sliderLineY, -14);
  assert.deepEqual(official.radiusPivotF, new THREE.Vector2(0, -14));
  assert.equal(official.radiusBarLength, 7.5);
  assert.equal(official.inputPhaseOffsetTurns, -0.25);
  assert.equal(official.pistonRodLocalShoulderY, -14.875);
  assert.equal(official.pistonRodLocalEndY, -16.375);

  near(geometry.crankRadius, 4 * geometry.sourceScale, 0,
    'scaled crank radius');
  near(geometry.connectingRodLength, 14 * geometry.sourceScale, 5e-16,
    'scaled connecting rod');
  near(geometry.barBCLength, 15 * geometry.sourceScale, 0,
    'scaled bar B-C');
  near(geometry.midpointDistance, 7.5 * geometry.sourceScale, 0,
    'scaled midpoint distance');
  near(geometry.radiusBarLength, 7.5 * geometry.sourceScale, 0,
    'scaled radius bar F-A');
  vector2Near(geometry.radiusPivotF,
    new THREE.Vector2(0, -14 * geometry.sourceScale), 0,
  'scaled fixed pivot F');

  assert.equal(sourceReference.brownPlate339.imageWidth, 525);
  assert.equal(sourceReference.brownPlate339.imageHeight, 525);
  assert.match(sourceReference.brownPlate339.inferredTopology,
    /right triangle/);
  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-19.176395, -27.33186),
    viewHeight: 30,
    viewWidth: 30,
  });
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-19.176395, -27.33186)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(0, 525), 0, 'official lower-left view corner');
  vector2Near(modelPointToOfficialAnimationRaster(
    new THREE.Vector2(10.823605, 2.66814)
      .multiplyScalar(geometry.sourceScale)),
  new THREE.Vector2(525, 0), 1.2e-13,
  'official upper-right view corner');
  disposeModel(model.root);
});

test('movement 339 crank drives C through one exact finite connecting rod', () => {
  const model = createMovementModel(catalog.movements[338]);
  const { canonicalStates, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointP.distanceTo(geometry.crankCenterO),
      geometry.crankRadius, 8e-16,
    `crank radius O-P at ${sample}`);
    near(state.pointP.distanceTo(state.pointC),
      geometry.connectingRodLength, 2e-15,
    `connecting rod P-C at ${sample}`);
    near(state.pointC.x, geometry.pistonLineX, 0,
      `vertical piston constraint at ${sample}`);
    assert.ok(state.pointC.y < state.pointP.y,
      `official lower circle-line branch at ${sample}`);
  }

  const scale = geometry.sourceScale;
  vector2Near(canonicalStates.sourceStart.pointP,
    new THREE.Vector2(0, -4).multiplyScalar(scale), 3e-16,
  'source-start crank pin');
  vector2Near(canonicalStates.sourceStart.pointC,
    new THREE.Vector2(0, -18).multiplyScalar(scale), 0,
  'source-start piston pin C');
  vector2Near(canonicalStates.sourceQuarter.pointP,
    new THREE.Vector2(4, 0).multiplyScalar(scale), 1e-16,
  'source-quarter crank pin');
  vector2Near(canonicalStates.sourceQuarter.pointC,
    new THREE.Vector2(0, -Math.sqrt(180)).multiplyScalar(scale), 5e-16,
  'source-quarter piston pin C');
  vector2Near(canonicalStates.sourceHalf.pointP,
    new THREE.Vector2(0, 4).multiplyScalar(scale), 1e-16,
  'source-half crank pin');
  vector2Near(canonicalStates.sourceHalf.pointC,
    new THREE.Vector2(0, -10).multiplyScalar(scale), 5e-16,
  'source-half piston pin C');
  vector2Near(canonicalStates.sourceThreeQuarter.pointP,
    new THREE.Vector2(-4, 0).multiplyScalar(scale), 2e-16,
  'source-three-quarter crank pin');
  disposeModel(model.root);
});

test('movement 339 closes B-C, its midpoint A, and fixed radius F-A exactly', () => {
  const model = createMovementModel(catalog.movements[338]);
  const { geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 8192);
    near(state.pointB.y, geometry.sliderLineY, 0,
      `horizontal slot-D constraint at ${sample}`);
    assert.ok(state.pointB.x < geometry.pistonLineX,
      `official left circle-line branch at ${sample}`);
    near(state.pointB.distanceTo(state.pointC),
      geometry.barBCLength, 2e-15,
    `bar B-C at ${sample}`);
    vector2Near(state.pointA,
      state.pointB.clone().add(state.pointC).multiplyScalar(0.5), 0,
    `A is exact midpoint at ${sample}`);
    near(state.pointA.distanceTo(state.pointB),
      geometry.midpointDistance, 1e-15,
    `A-B half-bar at ${sample}`);
    near(state.pointA.distanceTo(state.pointC),
      geometry.midpointDistance, 1e-15,
    `A-C half-bar at ${sample}`);
    near(state.pointA.distanceTo(geometry.radiusPivotF),
      geometry.radiusBarLength, 2e-15,
    `fixed radius F-A at ${sample}`);
    near(state.rightAngleDot, 0, 0,
      `B-F perpendicular F-C at ${sample}`);
    near(state.radiusClosureResidual, 0, 3e-16,
      `right-triangle circumradius identity at ${sample}`);
  }
  assert.ok(geometry.maximumRadiusClosureResidual < 3e-16);
  assert.equal(geometry.maximumRightAngleResidual, 0);
  disposeModel(model.root);
});

test('movement 339 exposes the exact piston stroke and slot travel', () => {
  const model = createMovementModel(catalog.movements[338]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumC = Infinity;
  let maximumC = -Infinity;
  let minimumB = Infinity;
  let maximumB = -Infinity;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 32768);
    minimumC = Math.min(minimumC, state.pointC.y);
    maximumC = Math.max(maximumC, state.pointC.y);
    minimumB = Math.min(minimumB, state.pointB.x);
    maximumB = Math.max(maximumB, state.pointB.x);
  }

  const scale = geometry.sourceScale;
  near(geometry.minimumPistonY, -18 * scale, 0,
    'lower piston dead center');
  near(geometry.maximumPistonY, -10 * scale, 0,
    'upper piston dead center');
  near(geometry.pistonStroke, 8 * scale, 5e-16,
    'eight-unit direct-action stroke');
  near(minimumC, geometry.minimumPistonY, 0,
    'sampled lower piston limit');
  near(maximumC, geometry.maximumPistonY, 5e-16,
    'sampled upper piston limit');
  near(geometry.minimumSliderX, -15 * scale, 0,
    'leftmost B position');
  near(geometry.maximumSliderX, -Math.sqrt(209) * scale, 0,
    'rightmost B position at both piston dead centers');
  near(geometry.sliderTravel, (15 - Math.sqrt(209)) * scale, 5e-16,
    'slot-D slider travel');
  near(maximumB, geometry.maximumSliderX, 0,
    'sampled right slider limit');
  assert.ok(Math.abs(minimumB - geometry.minimumSliderX) < 2e-8,
    'dense sweep reaches the algebraic left slider limit');
  near(geometry.maximumRadiusDeflection,
    Math.atan2(4, Math.sqrt(209)), 2e-15,
  'maximum F-A deflection from the leftward centerline');
  disposeModel(model.root);
});

test('movement 339 analytic point and link rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[338]);
  const { stateAtTime } = model.root.userData;
  const h = 5e-5;
  const samples = [0.17, 0.71, 1.27, 2.43, 3.61];

  for (const time of samples) {
    const previous = stateAtTime(time - h);
    const state = stateAtTime(time);
    const next = stateAtTime(time + h);
    for (const [pointName, velocityName, accelerationName] of [
      ['pointP', 'pointPVelocity', 'pointPAcceleration'],
      ['pointC', 'pointCVelocity', 'pointCAcceleration'],
      ['pointB', 'pointBVelocity', 'pointBAcceleration'],
      ['pointA', 'pointAVelocity', 'pointAAcceleration'],
    ]) {
      const finiteVelocity = next[pointName].clone()
        .sub(previous[pointName]).multiplyScalar(1 / (2 * h));
      const finiteAcceleration = next[pointName].clone()
        .add(previous[pointName])
        .addScaledVector(state[pointName], -2)
        .multiplyScalar(1 / h ** 2);
      vector2Near(state[velocityName], finiteVelocity, 3e-9,
        `${pointName} velocity at ${time}`);
      vector2Near(state[accelerationName], finiteAcceleration, 1e-6,
        `${pointName} acceleration at ${time}`);
    }

    for (const linkName of ['connectingRod', 'barBC', 'radiusBar']) {
      const finiteAngularVelocity = angleDifference(
        next[linkName].angle,
        previous[linkName].angle,
      ) / (2 * h);
      const finiteAngularAcceleration = (
        next[linkName].angularVelocity
          - previous[linkName].angularVelocity
      ) / (2 * h);
      near(state[linkName].angularVelocity, finiteAngularVelocity, 8e-10,
        `${linkName} angular velocity at ${time}`);
      near(state[linkName].angularAcceleration,
        finiteAngularAcceleration, 2e-9,
      `${linkName} angular acceleration at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 339 renderer binds O, P, B, A, C, F and all spatial layers', () => {
  const model = createMovementModel(catalog.movements[338]);
  const {
    blocks,
    canonicalTimes,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (const time of Object.values(canonicalTimes)) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vector3Near(worldPosition(blocks.crankPinAnchor),
      new THREE.Vector3(state.pointP.x, state.pointP.y, 0.12), 8e-16,
    `rendered crank pin P at ${time}`);
    vector3Near(worldPosition(blocks.connectingRodStartAnchor),
      new THREE.Vector3(state.pointP.x, state.pointP.y, 0.45), 1e-15,
    `connecting-rod start P at ${time}`);
    vector3Near(worldPosition(blocks.connectingRodEndAnchor),
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0.45), 2e-15,
    `connecting-rod end C at ${time}`);
    vector3Near(worldPosition(blocks.barBCStartAnchor),
      new THREE.Vector3(state.pointB.x, state.pointB.y, -0.02), 2e-15,
    `bar start B at ${time}`);
    vector3Near(worldPosition(blocks.barBCMidpointAnchor),
      new THREE.Vector3(state.pointA.x, state.pointA.y, -0.02), 2e-15,
    `bar midpoint A at ${time}`);
    vector3Near(worldPosition(blocks.barBCEndAnchor),
      new THREE.Vector3(state.pointC.x, state.pointC.y, -0.02), 2e-15,
    `bar end C at ${time}`);
    vector3Near(worldPosition(blocks.radiusBarStartAnchor),
      new THREE.Vector3(geometry.radiusPivotF.x,
        geometry.radiusPivotF.y, -0.28), 1e-15,
    `radius start F at ${time}`);
    vector3Near(worldPosition(blocks.radiusBarEndAnchor),
      new THREE.Vector3(state.pointA.x, state.pointA.y, -0.28), 2e-15,
    `radius end A at ${time}`);
    vector3Near(blocks.sliderB.position,
      new THREE.Vector3(state.pointB.x, state.pointB.y, 0), 0,
    `rendered horizontal slider B at ${time}`);
    vector3Near(blocks.pistonOutput.position,
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0), 0,
    `rendered piston C at ${time}`);
    vector3Near(contacts.crankAtP.point,
      new THREE.Vector3(state.pointP.x, state.pointP.y, 0.2675), 1e-15,
    `contact P at ${time}`);
    vector3Near(contacts.midpointAtA.point,
      new THREE.Vector3(state.pointA.x, state.pointA.y, -0.15), 1e-15,
    `contact A at ${time}`);
    vector3Near(contacts.barAtC.point,
      new THREE.Vector3(state.pointC.x, state.pointC.y, 0.2175), 1e-15,
    `contact C at ${time}`);
  }

  near(blocks.connectingRod.userData.nominalLength,
    geometry.connectingRodLength, 0, 'rendered P-C rod length');
  near(blocks.barBC.userData.nominalLength,
    geometry.barBCLength, 0, 'rendered B-C bar length');
  near(blocks.radiusBar.userData.nominalLength,
    geometry.radiusBarLength, 0, 'rendered F-A radius length');
  assert.notEqual(blocks.connectingRod, blocks.barBC);
  assert.notEqual(blocks.barBC, blocks.radiusBar);
  assert.equal(blocks.slotRails.length, 2);
  assert.deepEqual(blocks.archMembers, [blocks.casting]);
  const drawnRoles = [];
  model.root.traverse((object) => drawnRoles.push(object.userData.role ?? ''));
  assert.equal(drawnRoles.some((role) => /engine-bed|piston-guide-rail|piston-head|arch-member/.test(role)), false,
    'the parallel motion alone guides C: Brown draws no bed, guide rails or exposed piston');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.8);
  assert.ok(size.y > 8.5, 'crank pedestal to the broken-off cylinder');
  assert.ok(size.z > 2.3,
    'casting, radius bar, B-C, crosshead, connecting rod and round cylinder occupy real layers');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 339 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[338]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'source phase closure');
  near(closure.inputAngle, start.inputAngle, 0, 'input crank closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    Math.PI * 2, 0, 'one unwrapped crank revolution');
  vector2Near(closure.pointP, start.pointP, 0, 'P closure');
  vector2Near(closure.pointC, start.pointC, 0, 'C closure');
  vector2Near(closure.pointB, start.pointB, 0, 'B closure');
  vector2Near(closure.pointA, start.pointA, 0, 'A closure');
  near(closure.connectingRod.angle, start.connectingRod.angle, 0,
    'connecting-rod closure');
  near(closure.barBC.angle, start.barBC.angle, 0, 'B-C bar closure');
  near(closure.radiusBar.angle, start.radiusBar.angle, 0,
    'F-A radius closure');
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  vector3Near(worldPosition(blocks.barBCMidpointAnchor),
    new THREE.Vector3(start.pointA.x, start.pointA.y, -0.02), 3e-16,
  'rendered midpoint closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
