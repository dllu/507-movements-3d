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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// Model-frame position: the source presentation mirrors 346's root to the
// plate's handedness, so positions are read back in the unpresented frame.
function worldPosition(object) {
  const root = rootOf(object);
  root.updateMatrixWorld(true);
  return object.getWorldPosition(new THREE.Vector3())
    .applyMatrix4(root.matrixWorld.clone().invert());
}

function rootOf(object) {
  let node = object;
  while (node.parent) node = node.parent;
  return node;
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

test('movement 346 is the fixed-cylinder table engine with two side rods', () => {
  const movement = catalog.movements[345];
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

  assert.equal(movement.id, 346);
  assert.equal(movement.number, '346');
  assert.equal(movement.title,
    'Table engine. The cylinder is fixed on a table-like base');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'table-engine-two-side-rods-parallel-cranks');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two-parallel-cranks-O-P/);
  assert.match(mechanism, /two-equal-side-rods-P-C/);
  assert.match(mechanism, /guided-crosshead-C/);
  assert.match(mechanism, /fixed-table-cylinder/);
  assert.match(transmission.exactConstraint, /\|O-P\|=2/);
  assert.match(transmission.exactConstraint, /11\.125/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCranks.parent, model.root);
  assert.equal(blocks.pistonAssembly.parent, model.root);
  assert.equal(blocks.crosshead.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonRod.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonHead.parent, blocks.pistonAssembly);
  assert.equal(blocks.sideRodAssemblies.length, 2);
  assert.equal(blocks.crankArms.length, 2);
  assert.equal(blocks.crankPinBosses.length, 2);
  assert.equal(blocks.crankIndexMarks.length, 2);
  assert.equal(blocks.crossheadPinCaps.length, 2);
  // Brown's cylinder is one round, closed turned casting (barrel and both
  // covers), not a box of walls and plates.
  assert.equal(blocks.cylinderWalls.length, 1);
  assert.equal(blocks.cylinderWalls[0].geometry.type, 'LatheGeometry');
  assert.equal(blocks.cylinderEndPlates.length, 0);
  assert.equal(blocks.pistonHead.geometry.type, 'CylinderGeometry');
  const boreRadius = Math.max(...blocks.cylinderWalls[0].geometry.parameters.points
    .filter((point) => point.y > 2.3 * 0.36 && point.y < 7.45 * 0.36 && point.x < 0.5)
    .map((point) => point.x));
  const pistonRadius = blocks.pistonHead.geometry.parameters.radiusTop;
  assert.ok(pistonRadius < boreRadius && boreRadius - pistonRadius < 0.02,
    'the round piston fits its bore');
  assert.equal(blocks.guideRails.length, 2);
  // The tapered outer loop is one flat bar in the rails' own plane, depth
  // and material (no second offset rod reading as a rim).
  assert.equal(blocks.guideStandards, undefined);
  const loopBox = new THREE.Box3().setFromObject(blocks.guideArch);
  const railBox = new THREE.Box3().setFromObject(blocks.guideRails[0]);
  assert.ok(Math.abs(loopBox.min.z - railBox.min.z) < 1e-6 && Math.abs(loopBox.max.z - railBox.max.z) < 1e-6);
  assert.equal(blocks.guideArch.material, blocks.guideRails[0].material);
  // Brown's table-like base is one solid plinth, not two legs.
  assert.equal(blocks.tableLegs.length, 1);
  assert.equal(blocks.tableLegs[0], blocks.tablePlinth);
  blocks.sideRodAssemblies.forEach(({ group }) => {
    assert.equal(group.parent, model.root);
  });

  assert.equal(contacts.crankshaftBearingO.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.crankshaftBearingO.movingMember,
    blocks.inputCranks);
  assert.equal(contacts.parallelCrankPinsP.length, 2);
  assert.equal(contacts.sideRodsAtCrossheadC.length, 2);
  assert.equal(contacts.crossheadInStraightGuides.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.crossheadInStraightGuides.movingMember,
    blocks.pistonAssembly);
  assert.equal(contacts.pistonInFixedCylinder.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.pistonInFixedCylinder.movingMember,
    blocks.pistonAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^parallel-crank-arm-[12]-O-P$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^moving-side-connecting-rod-[12]-P-C$/.test(role)).length, 2);
  assert.equal(roles.filter((role) => role ===
    'moving-crosshead-in-fixed-straight-slot').length, 1);
  assert.equal(roles.filter((role) => role ===
    'moving-piston-head-inside-fixed-cylinder').length, 1);
  assert.equal(roles.some((role) => /oscillating-cylinder|pendulum-cylinder/i
    .test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 346 preserves the official source constants, phase, and view', () => {
  const model = createMovementModel(catalog.movements[345]);
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
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_346.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_c_rod',
    'add_tx',
    'add_text',
  ]);
  assert.equal(sourceAnimation.physicalCorrection.applied, false);
  assert.match(sourceAnimation.physicalCorrection.reason,
    /closes exactly/);

  assert.deepEqual(official.crankCenter, new THREE.Vector2(0, 0));
  assert.equal(official.crankRadius, 2);
  assert.equal(official.crankPhaseOffsetTurns, 0);
  assert.equal(official.connectingRodLength, 11.125);
  assert.deepEqual(official.strokeLine, [
    new THREE.Vector2(0, 8.125),
    new THREE.Vector2(0, 13.125),
  ]);
  assert.equal(official.crossheadMinimumY, 9.125);
  assert.equal(official.crossheadMaximumY, 13.125);
  assert.equal(official.crossheadWidth, 1);
  assert.equal(official.crossheadHeight, 1.25);
  assert.equal(official.pistonRodTopY, -0.625);
  assert.equal(official.pistonRodBottomY, -6);
  assert.equal(official.pistonRodHalfWidth, 0.125);
  assert.equal(official.pistonHeadOffsetY, -6.25);
  assert.equal(official.pistonHeadHalfWidth, 1.25);
  assert.equal(official.pistonHeadThickness, 0.5);
  assert.equal(official.cylinderBoreMinimumY, 2.375);
  assert.equal(official.cylinderBoreMaximumY, 7.375);
  assert.equal(official.cylinderInnerHalfWidth, 1.25);
  assert.equal(official.cylinderOuterHalfWidth, 1.5);
  assert.equal(official.cylinderShellMinimumY, 2);
  assert.equal(official.cylinderShellMaximumY, 7.75);
  assert.equal(official.tableHalfWidth, 4.5);
  assert.equal(official.tableBottomY, 1.75);
  assert.equal(official.tableTopY, 2);
  assert.equal(official.guideMinimumY, 7.75);
  assert.equal(official.guideMaximumY, 14.875);

  near(geometry.crankRadius, 2 * geometry.sourceScale, 0,
    'scaled crank radius');
  near(geometry.connectingRodLength, 11.125 * geometry.sourceScale, 0,
    'scaled side-rod length');
  near(geometry.stroke, 4 * geometry.sourceScale, 0,
    'scaled four-unit stroke');
  near(geometry.cyclePeriod, 4, 0, 'official cycle period');
  near(geometry.inputAngularSpeed, Math.PI / 2, 0,
    'official crank speed');

  assert.equal(sourceReference.brownPlate346.imageWidth, 525);
  assert.equal(sourceReference.brownPlate346.imageHeight, 525);
  assert.match(sourceReference.brownPlate346.inferredTopology,
    /two side rods/);
  assert.equal(sourceReference.visualExtrapolation.applied, true);
  assert.equal(sourceReference.visualExtrapolation.sourceCropY, -1.25);
  assert.ok(sourceReference.visualExtrapolation.visualLegBottomY < -2);
  assert.equal(sourceReference.officialAnimationView.viewWidth, 17);
  assert.equal(sourceReference.officialAnimationView.viewHeight, 17);
  assert.deepEqual(sourceReference.officialAnimationView.minimum,
    new THREE.Vector2(-8.5, -1.350861));
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(-8.5, -1.350861)
        .multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(0, 525),
    8e-14,
    'official lower-left raster transform',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(8.5, 15.649139)
        .multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(525, 0),
    8e-14,
    'official upper-right raster transform',
  );
  disposeModel(model.root);
});

test('movement 346 exactly reconstructs the official crank-circle intersection', () => {
  const model = createMovementModel(catalog.movements[345]);
  const {
    sourceStateAtCyclePosition,
    sourceStateAtTime,
  } = model.root.userData;
  const origin = new THREE.Vector2(0, 0);

  for (let sample = 0; sample <= 8192; sample += 1) {
    const phase = sample / 8192;
    const state = sourceStateAtCyclePosition(phase);
    near(state.pointP.distanceTo(origin), 2, 7e-16,
      `official crank radius ${sample}`);
    near(state.crossheadC.x, 0, 0,
      `official stroke-line x ${sample}`);
    near(state.pointP.distanceTo(state.crossheadC), 11.125, 2e-15,
      `official side-rod closure ${sample}`);
    near(state.crossheadC.y,
      state.pointP.y + Math.sqrt(11.125 ** 2 - state.pointP.x ** 2),
      0, `official positive circle-line branch ${sample}`);
    vector2Near(state.pistonHeadH,
      state.crossheadC.clone().add(new THREE.Vector2(0, -6.25)),
      0, `official translated piston assembly ${sample}`);
    near(state.connectingRodLengthError, 0, 2e-15,
      `reported source rod error ${sample}`);
  }

  for (const time of [0, 0.37, 1, 1.89, 2.5, 3.74, 4]) {
    const byTime = sourceStateAtTime(time);
    const byPhase = sourceStateAtCyclePosition(time / 4);
    vector2Near(byTime.pointP, byPhase.pointP, 0,
      `source-time crank ${time}`);
    vector2Near(byTime.crossheadC, byPhase.crossheadC, 0,
      `source-time crosshead ${time}`);
    vector2Near(byTime.pistonHeadH, byPhase.pistonHeadH, 0,
      `source-time piston ${time}`);
  }
  disposeModel(model.root);
});

test('movement 346 has exact dead centers, four-unit stroke, and equal end clearance', () => {
  const model = createMovementModel(catalog.movements[345]);
  const {
    canonicalStates,
    geometry,
    stateAtInputAngle,
  } = model.root.userData;
  const scale = geometry.sourceScale;
  const upper = canonicalStates.upperDeadCenter;
  const lower = canonicalStates.lowerDeadCenter;

  vector2Near(upper.pointP, new THREE.Vector2(0, 2 * scale), 2e-16,
    'upper-dead-center crank pin');
  vector2Near(lower.pointP, new THREE.Vector2(0, -2 * scale), 3e-16,
    'lower-dead-center crank pin');
  near(upper.crosshead.point.y, 13.125 * scale, 1e-15,
    'upper crosshead limit');
  near(lower.crosshead.point.y, 9.125 * scale, 1e-15,
    'lower crosshead limit');
  near(upper.piston.head.y, 6.875 * scale, 1e-15,
    'upper piston-head center');
  near(lower.piston.head.y, 2.875 * scale, 1e-15,
    'lower piston-head center');
  near(upper.piston.head.y - lower.piston.head.y, 4 * scale, 1e-15,
    'exact piston stroke');
  near(lower.piston.head.y - geometry.pistonHeadThickness / 2
      - geometry.cylinderBoreMinimumY,
  0.25 * scale, 1e-15, 'lower bore clearance');
  near(geometry.cylinderBoreMaximumY
      - (upper.piston.head.y + geometry.pistonHeadThickness / 2),
  0.25 * scale, 1e-15, 'upper bore clearance');

  let minimumCrossheadY = Infinity;
  let maximumCrossheadY = -Infinity;
  let minimumLowerClearance = Infinity;
  let minimumUpperClearance = Infinity;
  for (let sample = 0; sample <= 32768; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 32768);
    minimumCrossheadY = Math.min(minimumCrossheadY,
      state.crosshead.point.y);
    maximumCrossheadY = Math.max(maximumCrossheadY,
      state.crosshead.point.y);
    minimumLowerClearance = Math.min(minimumLowerClearance,
      state.piston.head.y - geometry.pistonHeadThickness / 2
        - geometry.cylinderBoreMinimumY);
    minimumUpperClearance = Math.min(minimumUpperClearance,
      geometry.cylinderBoreMaximumY
        - state.piston.head.y - geometry.pistonHeadThickness / 2);
    near(state.crosshead.point.x, 0, 0,
      `guided crosshead x ${sample}`);
    near(state.connectingRods.lengthError, 0, 3e-15,
      `scaled side-rod closure ${sample}`);
  }
  near(minimumCrossheadY, 9.125 * scale, 5e-16,
    'sampled lower crosshead limit');
  near(maximumCrossheadY, 13.125 * scale, 0,
    'sampled upper crosshead limit');
  near(minimumLowerClearance, 0.25 * scale, 1e-15,
    'minimum lower clearance');
  near(minimumUpperClearance, 0.25 * scale, 1e-15,
    'minimum upper clearance');
  disposeModel(model.root);
});

test('movement 346 analytic crank, crosshead, and rod rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[345]);
  const { stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 2e-4;

  for (const time of [0.13, 0.57, 1.21, 1.78, 2.36, 3.09, 3.71]) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    const numericalPointPVelocity = afterV.pointP.clone()
      .sub(beforeV.pointP).multiplyScalar(1 / (2 * velocityStep));
    const numericalCrossheadVelocity = afterV.crosshead.point.clone()
      .sub(beforeV.crosshead.point).multiplyScalar(1 / (2 * velocityStep));
    const numericalRodAngularVelocity = angleDifference(
      afterV.connectingRods.angle,
      beforeV.connectingRods.angle,
    ) / (2 * velocityStep);
    vector2Near(state.pointPVelocity, numericalPointPVelocity, 5e-10,
      `crank-pin velocity ${time}`);
    vector2Near(state.crosshead.velocity, numericalCrossheadVelocity,
      6e-10, `crosshead velocity ${time}`);
    near(state.connectingRods.angularVelocity,
      numericalRodAngularVelocity, 7e-10,
      `side-rod angular velocity ${time}`);

    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    const numericalPointPAcceleration = afterA.pointPVelocity.clone()
      .sub(beforeA.pointPVelocity).multiplyScalar(1 / (2 * accelerationStep));
    const numericalCrossheadAcceleration = afterA.crosshead.velocity.clone()
      .sub(beforeA.crosshead.velocity)
      .multiplyScalar(1 / (2 * accelerationStep));
    const numericalRodAngularAcceleration = (
      afterA.connectingRods.angularVelocity
        - beforeA.connectingRods.angularVelocity
    ) / (2 * accelerationStep);
    vector2Near(state.pointPAcceleration,
      numericalPointPAcceleration, 7e-8,
      `crank-pin acceleration ${time}`);
    vector2Near(state.crosshead.acceleration,
      numericalCrossheadAcceleration, 8e-8,
      `crosshead acceleration ${time}`);
    near(state.connectingRods.angularAcceleration,
      numericalRodAngularAcceleration, 9e-8,
      `side-rod angular acceleration ${time}`);
    vector2Near(state.piston.velocity, state.crosshead.velocity, 0,
      `rigid piston velocity ${time}`);
    vector2Near(state.piston.acceleration, state.crosshead.acceleration, 0,
      `rigid piston acceleration ${time}`);
  }
  disposeModel(model.root);
});

test('movement 346 renderer binds both parallel cranks and side rods to one crosshead', () => {
  const model = createMovementModel(catalog.movements[345]);
  const {
    blocks,
    contacts,
    geometry,
  } = model.root.userData;

  // The two guide surfaces are genuinely vertical; only the surrounding
  // standards taper as they rise toward the rounded top.
  const guideCenters = blocks.guideRails.map((rail) => {
    const bounds = new THREE.Box3().setFromObject(rail)
      .applyMatrix4(model.root.matrixWorld.clone().invert());
    return bounds.getCenter(new THREE.Vector3());
  });
  near(guideCenters[0].x, -0.66 * geometry.sourceScale, 2e-16,
    'left straight guide center');
  near(guideCenters[1].x, 0.66 * geometry.sourceScale, 2e-16,
    'right straight guide center');
  near(guideCenters[0].x + guideCenters[1].x, 0, 2e-16,
    'symmetric guide centers');

  for (const time of [0, 0.41, 1, 1.63, 2, 2.79, 3, 3.52, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(angleDifference(blocks.inputCranks.rotation.z, state.inputAngle),
      0, 2e-16, `common crankshaft angle ${time}`);
    vector3Near(worldPosition(blocks.crossheadAnchor),
      new THREE.Vector3(state.crosshead.point.x,
        state.crosshead.point.y, 0),
      3e-15, `rendered crosshead C ${time}`);
    vector3Near(worldPosition(blocks.pistonHeadAnchor),
      new THREE.Vector3(state.piston.head.x, state.piston.head.y, 0),
      3e-15, `rendered piston head H ${time}`);

    blocks.sideRodAssemblies.forEach((assembly, index) => {
      const side = index === 0 ? -1 : 1;
      const expectedP = new THREE.Vector3(
        state.pointP.x,
        state.pointP.y,
        side * geometry.sideRodPlaneZ,
      );
      const expectedC = new THREE.Vector3(
        state.crosshead.point.x,
        state.crosshead.point.y,
        side * geometry.sideRodPlaneZ,
      );
      vector3Near(worldPosition(assembly.startAnchor), expectedP, 2e-15,
        `side rod ${index + 1} crank end ${time}`);
      vector3Near(worldPosition(assembly.endAnchor), expectedC, 3e-15,
        `side rod ${index + 1} crosshead end ${time}`);
      near(angleDifference(assembly.group.rotation.z,
        state.connectingRods.angle), 0, 2e-16,
      `side rod ${index + 1} render angle ${time}`);
      vector3Near(contacts.parallelCrankPinsP[index].point,
        expectedP, 0, `crank contact ${index + 1} ${time}`);
      vector3Near(contacts.sideRodsAtCrossheadC[index].point,
        expectedC, 0, `crosshead contact ${index + 1} ${time}`);
    });
    vector3Near(contacts.crossheadInStraightGuides.point,
      new THREE.Vector3(state.crosshead.point.x,
        state.crosshead.point.y, 0),
      0, `guide contact ${time}`);
    vector3Near(contacts.pistonInFixedCylinder.point,
      new THREE.Vector3(state.piston.head.x,
        state.piston.head.y, 0.10),
      0, `piston contact ${time}`);
  }
  assert.equal(blocks.sideRodAssemblies[0].group.position.z,
    -geometry.sideRodPlaneZ);
  assert.equal(blocks.sideRodAssemblies[1].group.position.z,
    geometry.sideRodPlaneZ);
  disposeModel(model.root);
});

test('movement 346 closes one revolution with continuous state and no hidden correction', () => {
  const model = createMovementModel(catalog.movements[345]);
  const {
    canonicalStates,
    sourceAnimation,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(4);

  vector2Near(finish.pointP, start.pointP, 0,
    'cycle crank-pin closure');
  vector2Near(finish.crosshead.point, start.crosshead.point, 0,
    'cycle crosshead closure');
  vector2Near(finish.piston.head, start.piston.head, 0,
    'cycle piston closure');
  near(angleDifference(finish.connectingRods.angle,
    start.connectingRods.angle), 0, 0,
  'cycle connecting-rod-angle closure');
  vector2Near(finish.crosshead.velocity, start.crosshead.velocity, 0,
    'cycle crosshead-velocity closure');
  vector2Near(finish.crosshead.acceleration,
    start.crosshead.acceleration, 0,
    'cycle crosshead-acceleration closure');
  assert.equal(canonicalStates.cycleClosure.phase, 0);
  assert.equal(sourceAnimation.physicalCorrection.applied, false);

  for (let sample = 0; sample <= 4096; sample += 1) {
    const angle = -8 * FULL_TURN + sample * 16 * FULL_TURN / 4096;
    const state = stateAtInputAngle(angle);
    assert.ok(Number.isFinite(state.crosshead.point.y));
    assert.ok(Number.isFinite(state.crosshead.velocity.y));
    assert.ok(Number.isFinite(state.crosshead.acceleration.y));
    assert.ok(Number.isFinite(state.connectingRods.angularVelocity));
    assert.ok(Number.isFinite(state.connectingRods.angularAcceleration));
    near(state.connectingRods.lengthError, 0, 3e-15,
      `multi-turn rod closure ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 346 leaves movement 507 as the next authored draft', () => {
  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
});
