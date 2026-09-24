import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
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

test('movement 348 is Snyder’s two-stroke perpendicular-slot disk', () => {
  const movement = catalog.movements[347];
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

  assert.equal(movement.id, 348);
  assert.equal(movement.number, '348');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'snyder-double-stroke-perpendicular-slot-disk');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /two-perpendicular-through-slots/);
  assert.match(mechanism, /five-source-units-apart/);
  assert.match(mechanism, /guide-point-T/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.requiredClosure, /x=0/);
  assert.equal(transmission.reciprocationsPerInputRevolution, 2);
  assert.match(transmission.slideOrientationLaw, /exactly perpendicular/);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.diskAssembly.parent, model.root);
  assert.equal(blocks.rodAssembly.parent, model.root);
  assert.equal(blocks.primarySlide.assembly.parent, model.root);
  assert.equal(blocks.secondarySlide.assembly.parent, model.root);
  assert.equal(blocks.slottedDisk.parent, blocks.diskAssembly);
  assert.equal(blocks.slottedDisk.userData.actualThroughSlots, true);
  assert.equal(blocks.primaryRodAnchor.parent, blocks.rodAssembly);
  assert.equal(blocks.secondaryRodAnchor.parent, blocks.rodAssembly);
  assert.equal(blocks.guidePointAnchor.parent, blocks.rodAssembly);
  assert.equal(blocks.primarySlide.block.parent,
    blocks.primarySlide.assembly);
  assert.equal(blocks.secondarySlide.block.parent,
    blocks.secondarySlide.assembly);
  assert.equal(blocks.primarySlide.frontInspectionFace.parent,
    blocks.primarySlide.assembly);
  assert.equal(blocks.secondarySlide.frontInspectionFace.parent,
    blocks.secondarySlide.assembly);
  assert.equal(blocks.guideRails.length, 2);
  assert.equal(blocks.framePosts.length, 2);
  assert.equal(blocks.slotFloors.length, 2);
  assert.equal(blocks.slotEdges.length, 4);

  assert.equal(contacts.primarySlideInDiskSlot.fixedToInputMember,
    blocks.diskAssembly);
  assert.equal(contacts.primarySlideInDiskSlot.movingMember,
    blocks.primarySlide.assembly);
  assert.equal(contacts.secondarySlideInDiskSlot.fixedToInputMember,
    blocks.diskAssembly);
  assert.equal(contacts.secondarySlideInDiskSlot.movingMember,
    blocks.secondarySlide.assembly);
  assert.equal(contacts.primarySlideAtRodC1.members[1],
    blocks.rodAssembly);
  assert.equal(contacts.secondarySlideAtRodC2.members[1],
    blocks.rodAssembly);
  assert.equal(contacts.guidePointTInFixedVerticalSlot.fixedMember,
    blocks.fixedFrame);
  assert.equal(contacts.guidePointTInFixedVerticalSlot.movingMember,
    blocks.rodAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'rotating-disk-A-with-two-perpendicular-through-slots-a-a').length, 1);
  assert.equal(roles.filter((role) => role ===
    'connecting-rod-B-carrying-two-pivot-centers-five-units-apart').length, 1);
  assert.equal(roles.filter((role) => /front-inspection-face/.test(role))
    .length, 2);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 348 preserves the official canvas dimensions, law, phase, and timing', () => {
  const model = createMovementModel(catalog.movements[347]);
  const {
    canonicalStates,
    geometry,
    modelPointToOfficialAnimationRaster,
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
    'https://507movements.com/mm_348.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_rot-crossed-slot-disk-A',
    'add_rot_to-rod-B',
    'c_l_int-primary-slide-C1',
    'add_rot-primary-slide-c',
    'add_rot-secondary-slide-c-quarter-turn-offset',
  ]);
  assert.match(sourceAnimation.officialGuidePointFunction,
    /500\/sqrt\(625\*sin/);
  assert.equal(official.diskRadius, 6.5);
  assert.deepEqual(official.diskCenter, new THREE.Vector2(0, 0));
  assert.equal(official.slotHalfLength, 6);
  assert.equal(official.slotWidth, 1.2);
  assert.equal(official.slideLength, 1.5);
  assert.equal(official.slideWidth, 1.2);
  assert.equal(official.guideToPrimaryPivot, 25);
  assert.equal(official.guideToSecondaryPivot, 20);
  assert.equal(official.pivotSpacing, 5);
  assert.equal(official.rodHalfWidth, 1);
  assert.equal(official.rodBottomY, -26.5);
  assert.deepEqual(official.view, [-12, -12, 24, 24]);
  assert.equal(sourceAnimation.physicalClarification.applied, true);
  assert.equal(sourceAnimation.physicalClarification.changesSourceMotion,
    false);
  assert.match(sourceAnimation.physicalClarification.reason,
    /official add_rot_to solver fixes reference T on x=0/);

  const plate = sourceReference.brownPlate348;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 15);
  assert.match(plate.inferredTopology, /perpendicular crossed slots/);
  assert.equal(sourceReference.officialAnimationView.canvasWidth, 525);
  assert.equal(sourceReference.officialAnimationView.canvasHeight, 525);
  assert.equal(geometry.cyclePeriod, 4);
  near(geometry.inputAngularSpeed, Math.PI / 2, 0,
    'official 15-cpm shaft speed');

  vector2Near(
    modelPointToOfficialAnimationRaster(geometry.diskCenter),
    new THREE.Vector2(262.5, 262.5),
    0,
    'official animation disk center raster',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      canonicalStates.sourceStart.primarySlide.pivotC1,
    ),
    new THREE.Vector2(262.5, 262.5),
    0,
    'source-start primary pivot raster',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      canonicalStates.sourceStart.secondarySlide.pivotC2,
    ),
    new THREE.Vector2(262.5, 153.125),
    3e-14,
    'source-start secondary pivot raster',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      canonicalStates.firstLowerExtreme.primarySlide.pivotC1,
    ),
    new THREE.Vector2(262.5, 371.875),
    4e-14,
    'quarter-turn lower primary pivot raster',
  );
  disposeModel(model.root);
});

test('movement 348 closes both rotating-slot sliders and rigid rod through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[347]);
  const { geometry, sourceStateAtInputAngle, stateAtInputAngle } =
    model.root.userData;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const angle = FULL_TURN * sample / 32768;
    const source = sourceStateAtInputAngle(angle);
    const primary = source.primarySlide;
    const secondary = source.secondarySlide;
    near(primary.slotDirection.length(), 1, 3e-16,
      `primary unit slot axis ${sample}`);
    near(secondary.slotDirection.length(), 1, 3e-16,
      `secondary unit slot axis ${sample}`);
    near(primary.slotDirection.dot(secondary.slotDirection), 0, 0,
      `perpendicular slot axes ${sample}`);
    near(cross2(primary.pivotC1, primary.slotDirection), 0, 9e-16,
      `C1 in primary rotating slot ${sample}`);
    near(cross2(secondary.pivotC2, secondary.slotDirection), 0, 9e-16,
      `C2 in perpendicular rotating slot ${sample}`);
    near(source.guide.pointT.x, 0, 0,
      `T in fixed vertical guide ${sample}`);
    near(source.guide.pointT.distanceTo(primary.pivotC1), 25, 2e-14,
      `fixed T-C1 length ${sample}`);
    near(source.guide.pointT.distanceTo(secondary.pivotC2), 20, 2e-14,
      `fixed T-C2 length ${sample}`);
    near(primary.pivotC1.distanceTo(secondary.pivotC2), 5, 1e-14,
      `fixed C1-C2 pivot spacing ${sample}`);
    const c1ToT = source.guide.pointT.clone().sub(primary.pivotC1);
    const c1ToC2 = secondary.pivotC2.clone().sub(primary.pivotC1);
    near(cross2(c1ToT, c1ToC2), 0, 4e-14,
      `C1-C2-T collinearity ${sample}`);
    near(c1ToC2.dot(c1ToT) / c1ToT.lengthSq(), 0.2, 3e-16,
      `C2 lies five units above C1 on rod ${sample}`);
    near(source.guide.pointT.y,
      500 / Math.sqrt(source.radicand), 0,
      `official guide-height equation ${sample}`);
    assert.ok(source.guide.pointT.y >= 20 - 1e-14);
    assert.ok(source.guide.pointT.y <= 25 + 1e-14);

    const state = stateAtInputAngle(angle);
    near(state.rod.guideToPrimaryLengthError, 0, 4e-15,
      `model T-C1 error ${sample}`);
    near(state.rod.pivotSpacingError, 0, 2e-15,
      `model C1-C2 error ${sample}`);
    near(state.primarySlide.slotDirection.dot(
      state.secondarySlide.slotDirection), 0, 0,
    `model perpendicular slot axes ${sample}`);
    near(state.primarySlide.coordinate,
      primary.coordinate * geometry.sourceScale, 0,
    `primary slide coordinate scale ${sample}`);
    near(state.secondarySlide.coordinate,
      secondary.coordinate * geometry.sourceScale, 0,
    `secondary slide coordinate scale ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 348 produces exactly two five-unit reciprocations per shaft turn', () => {
  const model = createMovementModel(catalog.movements[347]);
  const { canonicalStates, geometry, transmission } = model.root.userData;
  const sourceStart = canonicalStates.sourceStart;
  const lower1 = canonicalStates.firstLowerExtreme;
  const upper2 = canonicalStates.repeatedUpperExtreme;
  const lower2 = canonicalStates.secondLowerExtreme;
  const finish = canonicalStates.cycleClosure;

  near(sourceStart.guide.sourceY, 25, 0, 'start upper extreme');
  near(lower1.guide.sourceY, 20, 0, 'first lower extreme');
  near(upper2.guide.sourceY, 25, 0, 'second upper extreme');
  near(lower2.guide.sourceY, 20, 0, 'second lower extreme');
  near(finish.guide.sourceY, 25, 0, 'cycle upper extreme');
  near(transmission.stroke, 5 * geometry.sourceScale, 0,
    'model output stroke');
  assert.equal(transmission.reciprocationsPerInputRevolution, 2);

  near(sourceStart.rod.angle, 0, 0, 'start rod vertical');
  near(lower1.rod.angle, 0, 0, 'quarter-turn rod vertical');
  near(lower2.rod.angle, 0, 0, 'three-quarter rod vertical');
  assert.ok(canonicalStates.eighthTurn.rod.angle < -0.11);
  near(sourceStart.primarySlide.coordinate, 0, 0,
    'start primary slide at O');
  near(sourceStart.secondarySlide.coordinate,
    5 * geometry.sourceScale, 2e-16,
  'start secondary slide five source units from O');
  near(lower1.primarySlide.coordinate,
    -5 * geometry.sourceScale, 2e-16,
  'quarter-turn primary slide at lower extreme');
  near(lower1.secondarySlide.coordinate, 0, 5e-17,
    'quarter-turn secondary slide at O');

  vector3Near(sourceStart.primarySlide.pivotC1,
    upper2.primarySlide.pivotC1, 3e-16,
    'output primary pivot repeats after half turn');
  vector3Near(sourceStart.secondarySlide.pivotC2,
    upper2.secondarySlide.pivotC2, 3e-16,
    'output secondary pivot repeats after half turn');
  near(upper2.disk.angle - sourceStart.disk.angle, Math.PI, 0,
    'input disk still advances half a turn');
  disposeModel(model.root);
});

test('movement 348 analytic slide, guide, and rod rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[347]);
  const { stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 1e-4;

  for (const time of [0.13, 0.41, 0.77, 1.19, 1.63, 2.22, 2.71, 3.36, 3.81]) {
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    for (const [name, point, velocity, beforePoint, afterPoint] of [
      ['guide T', state.guide.pointT, state.guide.velocity,
        beforeV.guide.pointT, afterV.guide.pointT],
      ['primary C1', state.primarySlide.pivotC1,
        state.primarySlide.velocity,
        beforeV.primarySlide.pivotC1, afterV.primarySlide.pivotC1],
      ['secondary C2', state.secondarySlide.pivotC2,
        state.secondarySlide.velocity,
        beforeV.secondarySlide.pivotC2, afterV.secondarySlide.pivotC2],
    ]) {
      const numericalVelocity = afterPoint.clone().sub(beforePoint)
        .multiplyScalar(1 / (2 * velocityStep));
      vector3Near(velocity, numericalVelocity, 5e-10,
        `${name} analytic velocity ${time}`);
      assert.ok(point.toArray().every(Number.isFinite));
    }
    near(state.rod.angularVelocity,
      (afterV.rod.angle - beforeV.rod.angle) / (2 * velocityStep),
      2e-10, `rod analytic angular velocity ${time}`);
    near(state.primarySlide.coordinateVelocity,
      (afterV.primarySlide.coordinate
        - beforeV.primarySlide.coordinate) / (2 * velocityStep),
      3e-10, `primary analytic slot speed ${time}`);
    near(state.secondarySlide.coordinateVelocity,
      (afterV.secondarySlide.coordinate
        - beforeV.secondarySlide.coordinate) / (2 * velocityStep),
      3e-10, `secondary analytic slot speed ${time}`);

    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    for (const [name, acceleration, beforeVelocity, afterVelocity] of [
      ['guide T', state.guide.acceleration,
        beforeA.guide.velocity, afterA.guide.velocity],
      ['primary C1', state.primarySlide.acceleration,
        beforeA.primarySlide.velocity, afterA.primarySlide.velocity],
      ['secondary C2', state.secondarySlide.acceleration,
        beforeA.secondarySlide.velocity, afterA.secondarySlide.velocity],
    ]) {
      const numericalAcceleration = afterVelocity.clone()
        .sub(beforeVelocity).multiplyScalar(1 / (2 * accelerationStep));
      vector3Near(acceleration, numericalAcceleration, 2e-7,
        `${name} analytic acceleration ${time}`);
    }
    near(state.rod.angularAcceleration,
      (afterA.rod.angularVelocity - beforeA.rod.angularVelocity)
        / (2 * accelerationStep),
      2e-7, `rod analytic angular acceleration ${time}`);
    near(state.primarySlide.coordinateAcceleration,
      (afterA.primarySlide.coordinateVelocity
        - beforeA.primarySlide.coordinateVelocity)
        / (2 * accelerationStep),
      2e-7, `primary analytic slot acceleration ${time}`);
    near(state.secondarySlide.coordinateAcceleration,
      (afterA.secondarySlide.coordinateVelocity
        - beforeA.secondarySlide.coordinateVelocity)
        / (2 * accelerationStep),
      2e-7, `secondary analytic slot acceleration ${time}`);
  }
  disposeModel(model.root);
});

test('movement 348 renderer keeps each visible slide aligned to its own disk slot', () => {
  const model = createMovementModel(catalog.movements[347]);
  const { blocks, contacts, geometry } = model.root.userData;

  for (const time of [0, 0.31, 0.5, 1, 1.47, 2, 2.69, 3, 3.58, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.diskAssembly.rotation.z, state.disk.angle, 0,
      `rendered disk angle ${time}`);
    vector3Near(blocks.rodAssembly.position,
      state.guide.pointT, 0, `rendered guide point T ${time}`);
    near(blocks.rodAssembly.rotation.z, state.rod.angle, 0,
      `rendered rod angle ${time}`);
    vector3Near(worldPosition(blocks.guidePointAnchor),
      state.guide.pointT, 0, `guide anchor T ${time}`);
    vector3Near(worldPosition(blocks.primaryRodAnchor),
      state.primarySlide.pivotC1, 2e-15,
      `rod primary anchor C1 ${time}`);
    vector3Near(worldPosition(blocks.secondaryRodAnchor),
      state.secondarySlide.pivotC2, 2e-15,
      `rod secondary anchor C2 ${time}`);
    vector3Near(worldPosition(blocks.primarySlide.pivotAnchor),
      state.primarySlide.pivotC1, 2e-16,
      `primary slide pivot C1 ${time}`);
    vector3Near(worldPosition(blocks.secondarySlide.pivotAnchor),
      state.secondarySlide.pivotC2, 2e-16,
      `secondary slide pivot C2 ${time}`);

    const primaryRenderedAxis = X_AXIS.clone().applyQuaternion(
      blocks.primarySlide.assembly.getWorldQuaternion(
        new THREE.Quaternion(),
      ),
    );
    const secondaryRenderedAxis = X_AXIS.clone().applyQuaternion(
      blocks.secondarySlide.assembly.getWorldQuaternion(
        new THREE.Quaternion(),
      ),
    );
    vector3Near(primaryRenderedAxis,
      state.primarySlide.slotDirection, 1e-15,
      `primary block follows primary slot ${time}`);
    vector3Near(secondaryRenderedAxis,
      state.secondarySlide.slotDirection, 1e-15,
      `secondary block follows perpendicular slot ${time}`);
    // Rendered poses start at Brown's phase offset; round-off matches the 1e-15 axis checks.
    near(primaryRenderedAxis.dot(secondaryRenderedAxis), 0, 1e-15,
      `rendered slide blocks remain perpendicular ${time}`);
    vector3Near(contacts.guidePointTInFixedVerticalSlot.point,
      state.guide.pointT, 0, `guide contact ${time}`);
    vector3Near(contacts.primarySlideAtRodC1.point,
      state.primarySlide.pivotC1, 0, `primary pivot contact ${time}`);
    vector3Near(contacts.secondarySlideAtRodC2.point,
      state.secondarySlide.pivotC2, 0, `secondary pivot contact ${time}`);
    vector3Near(contacts.primarySlideInDiskSlot.point,
      state.primarySlide.slotCenter, 0,
      `primary prismatic contact ${time}`);
    vector3Near(contacts.secondarySlideInDiskSlot.point,
      state.secondarySlide.slotCenter, 0,
      `secondary prismatic contact ${time}`);
  }
  assert.ok(geometry.visualSlideClearance > 0);
  assert.ok(geometry.visualSlideClearance < geometry.slotHalfWidth);
  disposeModel(model.root);
});

test('movement 348 is smooth, finite, and closes after one shaft revolution', () => {
  const model = createMovementModel(catalog.movements[347]);
  const { canonicalStates, stateAtInputAngle, stateAtTime } =
    model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(4);

  vector3Near(finish.guide.pointT, start.guide.pointT, 0,
    'guide-point cycle closure');
  vector3Near(finish.primarySlide.pivotC1,
    start.primarySlide.pivotC1, 0, 'primary-pivot cycle closure');
  vector3Near(finish.secondarySlide.pivotC2,
    start.secondarySlide.pivotC2, 0, 'secondary-pivot cycle closure');
  vector3Near(finish.guide.velocity, start.guide.velocity, 0,
    'guide velocity cycle closure');
  vector3Near(finish.guide.acceleration, start.guide.acceleration, 0,
    'guide acceleration cycle closure');
  near(finish.rod.angle, start.rod.angle, 0,
    'rod-angle cycle closure');
  near(finish.rod.angularVelocity, start.rod.angularVelocity, 0,
    'rod-rate cycle closure');
  near(finish.rod.angularAcceleration,
    start.rod.angularAcceleration, 0,
    'rod-acceleration cycle closure');
  assert.equal(canonicalStates.cycleClosure.phase, 0);

  for (let sample = 0; sample <= 8192; sample += 1) {
    const angle = -16 * FULL_TURN + sample * 32 * FULL_TURN / 8192;
    const state = stateAtInputAngle(angle);
    const values = [
      ...state.guide.pointT.toArray(),
      ...state.guide.velocity.toArray(),
      ...state.guide.acceleration.toArray(),
      ...state.primarySlide.pivotC1.toArray(),
      ...state.primarySlide.velocity.toArray(),
      ...state.primarySlide.acceleration.toArray(),
      ...state.secondarySlide.pivotC2.toArray(),
      ...state.secondarySlide.velocity.toArray(),
      ...state.secondarySlide.acceleration.toArray(),
      state.rod.angle,
      state.rod.angularVelocity,
      state.rod.angularAcceleration,
    ];
    assert.ok(values.every(Number.isFinite),
      `finite multi-turn state ${sample}`);
    near(state.rod.guideToPrimaryLengthError, 0, 4e-15,
      `multi-turn T-C1 closure ${sample}`);
    near(state.rod.pivotSpacingError, 0, 2e-15,
      `multi-turn C1-C2 closure ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 348 leaves movement 507 as the next authored draft', () => {
  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
});
