import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 275 is one vertical single-start worm driving one parallel rack', () => {
  const movement = catalog.movements[274];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 275);
  assert.equal(movement.number, '275');
  assert.equal(movement.title, 'Worm-Driven Rectilinear Rack');
  assert.equal(movement.category, 'Worm gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'single-start-vertical-worm-driving-parallel-translating-rack',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fixed-axis right-hand single-start vertical worm/);
  assert.match(mechanism, /nonrotating vertical rack/);
  assert.match(mechanism, /tooth pitch equals the worm lead/);
  assert.match(mechanism, /one rack-tooth-pitch/);
  assert.equal(transmission.wormStarts, 1);
  assert.equal(transmission.slidingContact, true);
  assert.match(transmission.constraintLaw, /wormLead/);
  assert.match(transmission.constraintLaw, /wormAngle/);

  assert.equal(blocks.worm.parent, model.root);
  assert.equal(blocks.wormRotor.parent, blocks.worm);
  assert.equal(blocks.rack.parent, model.root);
  vectorNear(blocks.worm.userData.axis, Y_AXIS, 0, 'worm axis');
  vectorNear(blocks.rack.userData.axis, Y_AXIS, 0, 'rack axis');
  assert.equal(blocks.rackTeeth.length, 9);
  assert.ok(blocks.rackTeeth.every((tooth) => tooth.parent === blocks.rack));
  assert.equal(blocks.rackSpine.parent, blocks.rack);
  assert.equal(blocks.wormThread.parent, blocks.wormRotor);
  assert.equal(blocks.wormCore.parent, blocks.wormRotor);
  assert.equal(blocks.rackGuides.length, 2);
  assert.equal(blocks.wormBearings.length, 2);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^equal-pitch-rack-tooth-/.test(role)).length, 9);
  assert.equal(roles.filter((role) =>
    /one-continuous-right-hand-worm-thread/.test(role)).length, 1);
  assert.equal(roles.filter((role) =>
    /^fixed-(upper|lower)-straight-rack-guide$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /fixed-(upper|lower)-worm-bearing/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /worm-wheel|pinion|spur-gear|bevel-gear|belt|pulley/.test(role)).length,
  0);
  disposeModel(model.root);
});

test('movement 275 records the unavailable source and fits its measured axes and edges', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate275;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /animation control unavailable/);
  assert.match(sourceAnimation.reason, /reconstructed independently/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[274].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.rasterWormAxisX, 285);
  assert.equal(plate.rasterWormCenterY, 329);
  assert.equal(plate.measurementUncertaintyPixels, 4);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterRackTop, { x: 195, y: 62 });
  assert.deepEqual(plate.rasterRackBottom, { x: 196, y: 433 });
  assert.deepEqual(plate.rasterRackSpineCenter, { x: 208, y: 248 });
  assert.deepEqual(plate.rasterRackToothTip, { x: 244, y: 267 });
  assert.deepEqual(plate.rasterWormShaftTop, { x: 285, y: 216 });
  assert.deepEqual(plate.rasterWormShaftBottom, { x: 285, y: 443 });
  assert.match(plate.inferredTopology, /vertical fixed-axis worm/);
  assert.match(plate.inferredTopology, /parallel nonrotating translating rack/);
  assert.match(plate.inferredTopology, /nine equal-pitch rack teeth/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });

  const expected = {
    rackBottom: sourcePointToModel(plate.rasterRackBottom),
    rackCenter: sourcePointToModel(plate.rasterRackSpineCenter),
    rackToothTip: sourcePointToModel(plate.rasterRackToothTip),
    rackTop: sourcePointToModel(plate.rasterRackTop),
    wormShaftBottom: sourcePointToModel(plate.rasterWormShaftBottom),
    wormShaftTop: sourcePointToModel(plate.rasterWormShaftTop),
  };
  const actual = {
    rackBottom: new THREE.Vector2(
      geometry.rackSpineCenterX - geometry.rackSpineWidth / 2,
      geometry.rackSpineBottomY,
    ),
    rackCenter: new THREE.Vector2(
      geometry.rackSpineCenterX,
      (geometry.rackSpineTopY + geometry.rackSpineBottomY) / 2,
    ),
    rackToothTip: new THREE.Vector2(
      geometry.rackToothTipX,
      geometry.sourceActiveToothY,
    ),
    // The measured top and bottom points lie on the spine's left outline.
    rackTop: new THREE.Vector2(
      geometry.rackSpineCenterX - geometry.rackSpineWidth / 2,
      geometry.rackSpineTopY,
    ),
    wormShaftBottom: new THREE.Vector2(
      geometry.wormAxisX,
      geometry.wormShaftMinimumY,
    ),
    wormShaftTop: new THREE.Vector2(
      geometry.wormAxisX,
      geometry.wormShaftMaximumY,
    ),
  };
  for (const key of Object.keys(expected)) {
    near(
      actual[key].distanceTo(expected[key]) / geometry.sourceScale,
      plate.sourceIdealizationPixelErrors[key],
      2e-14,
      `${key} recorded raster error`,
    );
    assert.ok(plate.sourceIdealizationPixelErrors[key]
      <= plate.measurementUncertaintyPixels,
    `${key} remains within plate uncertainty`);
  }
  assert.deepEqual(plate.sourceIdealizationPixelErrors, {
    rackBottom: 2.0000000000000018,
    rackCenter: 0.5000000000000004,
    rackToothTip: 0,
    rackTop: 1.0000000000000009,
    wormShaftBottom: 0,
    wormShaftTop: 0,
  });
  disposeModel(model.root);
});

test('movement 275 gives the one-start worm and rack one identical exact pitch', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    blocks,
    geometry,
    transmission,
  } = model.root.userData;

  near(geometry.wormLead, geometry.rackToothPitch, 0,
    'worm lead equals rack pitch');
  near(transmission.wormLead, geometry.wormLead, 0,
    'reported worm lead');
  near(transmission.rackToothPitch, geometry.rackToothPitch, 0,
    'reported rack pitch');
  near(transmission.rackTravelPerWormTurn, -geometry.wormLead, 0,
    'one turn advances one negative rack pitch');
  near(geometry.leadPerRadian * FULL_TURN, geometry.wormLead, 0,
    'lead per radian');
  near(geometry.wormWaveNumber * geometry.wormLead, FULL_TURN, 0,
    'one-start helix wave number');
  near(geometry.wormThreadTurns,
    (geometry.wormThreadMaximumY - geometry.wormThreadMinimumY)
      / geometry.wormLead,
    0,
    'visible helix turn count');
  assert.equal(blocks.wormThread.userData.handedness, 1);
  near(blocks.wormThread.userData.lead, geometry.wormLead, 0,
    'rendered helix lead');
  assert.deepEqual(geometry.rackToothIndices,
    [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
  blocks.rackTeeth.forEach((tooth, index) => {
    const toothIndex = geometry.rackToothIndices[index];
    near(tooth.position.y,
      geometry.sourceActiveToothY + toothIndex * geometry.rackToothPitch,
      0, `tooth ${toothIndex} source height`);
    near(tooth.userData.pitch, geometry.rackToothPitch, 0,
      `tooth ${toothIndex} pitch metadata`);
    if (index > 0) {
      near(tooth.position.y - blocks.rackTeeth[index - 1].position.y,
        geometry.rackToothPitch, 4e-16,
        `tooth spacing ${index - 1} to ${index}`);
    }
  });
  assert.ok(geometry.rackToothTipX > geometry.rackToothStartX);
  near(geometry.rackToothLength,
    geometry.rackToothTipX - geometry.rackToothStartX, 0,
    'rack tooth reaches worm');
  disposeModel(model.root);
});

test('movement 275 converts two smooth worm turns into exactly two rack pitches', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    geometry,
    stateAtPhase,
    timeline,
  } = model.root.userData;
  const source = stateAtPhase(0);
  const forwardMidpoint = stateAtPhase(Math.PI / 2);
  const farReversal = stateAtPhase(Math.PI);
  const returnMidpoint = stateAtPhase(3 * Math.PI / 2);
  const closed = stateAtPhase(FULL_TURN);

  assert.equal(source.stage, 'source-rack-up-worm-stopped-reversal');
  assert.equal(forwardMidpoint.stage,
    'worm-turning-forward-rack-descending');
  assert.equal(farReversal.stage,
    'rack-down-two-pitches-worm-stopped-reversal');
  assert.equal(returnMidpoint.stage,
    'worm-turning-reverse-rack-ascending');
  assert.equal(closed.stage, 'source-rack-up-worm-stopped-reversal');
  near(source.wormAngle, 0, 0, 'source worm angle');
  near(farReversal.wormAngle, geometry.maximumWormAngle, 0,
    'maximum two-turn worm angle');
  near(geometry.maximumWormAngle, 2 * FULL_TURN, 0,
    'two-turn travel angle');
  near(farReversal.rackDisplacement,
    -2 * geometry.rackToothPitch, 0,
    'two-pitch rack displacement');
  near(geometry.maximumRackTravel, 2 * geometry.rackToothPitch, 0,
    'maximum rack travel');
  near(closed.wormAngle, 0, 0, 'closed worm angle');
  near(closed.rackDisplacement, 0, 0, 'closed rack displacement');
  near(timeline.maximumWormTurns, 2, 0, 'timeline worm turns');

  let previous = source;
  let maximumLeadError = 0;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const phase = FULL_TURN * sample / 16384;
    const state = stateAtPhase(phase);
    maximumLeadError = Math.max(
      maximumLeadError,
      Math.abs(state.leadConstraintError),
    );
    near(state.rackDisplacement,
      -geometry.leadPerRadian * state.wormAngle, 0,
      `lead law at sample ${sample}`);
    near(state.rackSpeed,
      -geometry.leadPerRadian * state.wormAngularSpeed, 0,
      `velocity lead law at sample ${sample}`);
    near(state.rackAcceleration,
      -geometry.leadPerRadian * state.wormAngularAcceleration, 0,
      `acceleration lead law at sample ${sample}`);
    if (sample > 0 && sample <= 8192) {
      assert.ok(state.wormAngle >= previous.wormAngle - 1e-14);
      assert.ok(state.rackDisplacement
        <= previous.rackDisplacement + 1e-14);
    }
    if (sample > 8192) {
      assert.ok(state.wormAngle <= previous.wormAngle + 1e-14);
      assert.ok(state.rackDisplacement
        >= previous.rackDisplacement - 1e-14);
    }
    previous = state;
  }
  near(maximumLeadError, 0, 0, 'maximum lead constraint error');
  disposeModel(model.root);
});

test('movement 275 keeps the helical flank phase-locked with finite flank clearance', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    geometry,
    stateAtPhase,
  } = model.root.userData;
  let maximumPhaseError = 0;
  let maximumActivePhaseError = 0;
  let maximumSurfaceGap = 0;
  let maximumFlankNormalVelocityError = 0;
  let maximumRadialVelocityError = 0;
  let maximumSlidingSpeed = 0;

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtPhase(FULL_TURN * sample / 16384);
    near(state.threadTangent.length(), 1, 2.3e-16,
      `unit thread tangent at sample ${sample}`);
    near(state.flankNormal.length(), 1, 2.3e-16,
      `unit flank normal at sample ${sample}`);
    near(state.radialNormal.length(), 1, 0,
      `unit radial normal at sample ${sample}`);
    near(state.threadTangent.dot(state.flankNormal), 0, 1.2e-16,
      `thread/flank orthogonality at sample ${sample}`);
    near(state.radialNormal.dot(state.flankNormal), 0, 0,
      `radial/flank orthogonality at sample ${sample}`);
    near(
      state.contactThreadCenter.distanceTo(state.contactPoint),
      geometry.wormThreadTubeRadius + geometry.threadFlankClearance,
      3e-16,
      `thread-tube tangency at sample ${sample}`,
    );
    near(state.contactPoint.y, state.activeToothFlankY, 0,
      `rack flank contact height at sample ${sample}`);
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.threadPhaseError),
    );
    maximumActivePhaseError = Math.max(
      maximumActivePhaseError,
      Math.abs(state.activeFlankPhaseError),
    );
    maximumSurfaceGap = Math.max(
      maximumSurfaceGap,
      Math.abs(state.contactSurfaceGap - geometry.threadFlankClearance),
    );
    maximumFlankNormalVelocityError = Math.max(
      maximumFlankNormalVelocityError,
      Math.abs(state.flankNormalVelocityError),
    );
    maximumRadialVelocityError = Math.max(
      maximumRadialVelocityError,
      Math.abs(state.radialNormalVelocityError),
    );
    maximumSlidingSpeed = Math.max(
      maximumSlidingSpeed,
      Math.abs(state.slidingSpeedAlongThread),
    );
  }
  assert.ok(maximumPhaseError < 6e-15);
  assert.ok(maximumActivePhaseError < 7e-16);
  assert.ok(maximumSurfaceGap < 2.3e-16);
  assert.ok(maximumFlankNormalVelocityError < 1.7e-16);
  near(maximumRadialVelocityError, 0, 0,
    'no radial interpenetration velocity');
  assert.ok(maximumSlidingSpeed > 2.67,
    'worm/rack flank contact correctly includes sliding');
  disposeModel(model.root);
});

test('movement 275 analytic worm and rack rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[274]);
  const { stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const time of [0.31, 0.97, 1.73, 2.66, 3.57, 4.49, 5.38, 6.61, 7.43]) {
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    near(
      (after.wormAngle - before.wormAngle) / (2 * timeStep),
      state.wormAngularSpeed,
      6e-9,
      `worm angular speed at time ${time}`,
    );
    near(
      (after.wormAngle - 2 * state.wormAngle + before.wormAngle)
        / timeStep ** 2,
      state.wormAngularAcceleration,
      4e-7,
      `worm angular acceleration at time ${time}`,
    );
    near(
      (after.rackDisplacement - before.rackDisplacement)
        / (2 * timeStep),
      state.rackSpeed,
      6e-10,
      `rack speed at time ${time}`,
    );
    near(
      (after.rackDisplacement - 2 * state.rackDisplacement
        + before.rackDisplacement) / timeStep ** 2,
      state.rackAcceleration,
      6e-8,
      `rack acceleration at time ${time}`,
    );
    near(
      (after.contactPoint.y - before.contactPoint.y) / (2 * timeStep),
      state.rackSpeed,
      6e-10,
      `contact-point axial speed at time ${time}`,
    );
    near(state.wormSurfaceVelocity.z,
      state.wormAngularSpeed * model.root.userData.geometry.wormThreadRadius,
      0, `worm surface speed at time ${time}`);
  }
  disposeModel(model.root);
});

test('movement 275 renderer binds rotation, translation, contact, and covered guides', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const fixedObjects = [
    blocks.base,
    blocks.baseStem,
    blocks.rearPost,
    ...blocks.rackGuides,
    ...blocks.wormBearings,
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));

  near(animationTiming.authoredCyclePeriod, timeline.cyclePeriod, 0,
    'display timing uses complete forward-return cycle');
  assert.equal(animationTiming.targetCycleDuration, 2);
  assert.equal(blocks.wormRotor.parent, blocks.worm);
  near(blocks.rack.position.y, 0, 0, 'source rendered rack position');

  for (const time of [0, 0.63, 1.82, 2.74, 4, 5.31, 6.68, 8]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.wormRotor.rotation.y, state.wormAngle, 0,
      `rendered worm angle at ${time}`);
    near(blocks.worm.userData.angularSpeed, state.wormAngularSpeed, 0,
      `rendered worm speed at ${time}`);
    near(blocks.rack.position.y, state.rackDisplacement, 0,
      `rendered rack displacement at ${time}`);
    vectorNear(blocks.rack.userData.velocity,
      new THREE.Vector3(0, state.rackSpeed, 0), 0,
      `rendered rack velocity at ${time}`);
    assert.ok(state.upperGuideCoverage >= 0.3919999999999999,
      `upper guide remains covered at ${time}`);
    assert.ok(state.lowerGuideCoverage >= 0.264,
      `lower guide remains covered at ${time}`);
    near(model.root.userData.contacts.wormRackFlank.surfaceGap,
      state.contactSurfaceGap, 0,
      `rendered contact gap at ${time}`);
    near(model.root.userData.contacts.wormRackFlank.phaseError,
      state.threadPhaseError, 0,
      `rendered contact phase at ${time}`);
    assert.equal(
      model.root.userData.contacts.wormRackFlank.activeRackTooth,
      blocks.rackTeeth[4],
    );
    for (const fixed of fixedObjects) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed ${fixed.object.userData.role} position at ${time}`);
      near(fixed.object.quaternion.angleTo(fixed.quaternion), 0, 0,
        `fixed ${fixed.object.userData.role} orientation at ${time}`);
    }
  }
  near(
    Math.min(
      stateAtTime(0).upperGuideCoverage,
      stateAtTime(timeline.cyclePeriod / 2).upperGuideCoverage,
    ),
    geometry.rackSpineTopY - geometry.maximumRackTravel
      - geometry.upperRackGuideY,
    0,
    'minimum upper guide coverage',
  );
  near(
    Math.min(
      stateAtTime(0).lowerGuideCoverage,
      stateAtTime(timeline.cyclePeriod / 2).lowerGuideCoverage,
    ),
    geometry.lowerRackGuideY - geometry.rackSpineBottomY,
    0,
    'minimum lower guide coverage',
  );
  const whiteRoles = [];
  model.root.traverse((object) => {
    if (/white-/.test(object.userData.role ?? '')) {
      whiteRoles.push(object.userData.role);
    }
  });
  // Brown draws no indices; pass 51 removed them.
  assert.deepEqual(whiteRoles, []);
  disposeModel(model.root);
});

test('movement 275 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[274]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const source = stateAtTime(0);
  const closed = stateAtTime(timeline.cyclePeriod);

  near(closed.wormAngle, source.wormAngle, 0, 'worm angle closure');
  near(closed.wormAngularSpeed, source.wormAngularSpeed, 1.3e-15,
    'worm speed closure');
  near(closed.rackDisplacement, source.rackDisplacement, 0,
    'rack displacement closure');
  near(closed.rackSpeed, source.rackSpeed, 1.3e-16,
    'rack speed closure');
  vectorNear(closed.contactPoint, source.contactPoint, 0,
    'contact-point closure');
  near(closed.threadPhaseError, source.threadPhaseError, 0,
    'contact phase closure');

  model.update(0);
  const sourceRackPosition = blocks.rack.position.clone();
  const sourceWormQuaternion = blocks.wormRotor.quaternion.clone();
  model.update(timeline.cyclePeriod);
  vectorNear(blocks.rack.position, sourceRackPosition, 0,
    'rendered rack closure');
  near(blocks.wormRotor.quaternion.angleTo(sourceWormQuaternion), 0, 0,
    'rendered worm closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
