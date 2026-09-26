import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

test('movement 210 is one curved slotted rocker, one captive follower, and one guided vertical bar', () => {
  const movement = catalog.movements[209];
  const model = createMovementModel(movement);
  const { blocks } = model.root.userData;

  assert.equal(movement.id, 210);
  assert.equal(movement.number, '210');
  assert.equal(
    movement.title,
    'Curved-Slot Rocker and Variable-Velocity Vertical Slide',
  );
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'offset-annular-slot-rocker-captive-roller-variable-velocity-vertical-slide',
  );
  assert.match(movement.description, /rectilinear motion of variable velocity/);
  assert.equal(
    model.root.userData.archetype,
    movement.archetype,
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(
    model.root.userData.mechanism,
    'rocking-c-shaped-arm-drives-a-prismatically-guided-bar-through-an-offset-circular-slot',
  );
  vector3Near(blocks.arm.userData.axis, Z_AXIS, 0, 'arm axis');
  vector3Near(blocks.inputShaft.userData.axis, Z_AXIS, 0, 'shaft axis');
  vector3Near(blocks.slider.userData.axis, Y_AXIS, 0, 'slider axis');
  assert.equal(blocks.plate.userData.curvedSlottedArm, true);
  assert.equal(blocks.followerRoller.parent, blocks.slider);
  assert.equal(blocks.followerPin.parent, blocks.slider);
  assert.equal(blocks.sliderBar.parent, blocks.slider);
  assert.equal(blocks.guideAssemblies.length, 2);
  assert.equal(blocks.guideSupports.length, 2);
  assert.equal(blocks.baseFeet.length, 2);

  const roles = [];
  let curvedArmCount = 0;
  let followerBodyCount = 0;
  let verticalBarCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.curvedSlottedArm) curvedArmCount += 1;
    if (object.userData.role === 'captive-follower-roller-body') {
      followerBodyCount += 1;
    }
    if (object.userData.role === 'guided-vertical-output-bar') {
      verticalBarCount += 1;
    }
  });
  assert.equal(curvedArmCount, 1);
  assert.equal(followerBodyCount, 1);
  assert.equal(verticalBarCount, 1);
  assert.equal(
    roles.filter((role) => role.includes('prismatic-guide')).length,
    2,
  );
  assert.equal(
    roles.some((role) => /belt|pulley|gear|sprocket/.test(role)),
    false,
    'the source mechanism contains no invented belt, pulley, or gear',
  );
  disposeModel(model.root);
});

test('movement 210 reconstructs the source-scaled annular slot, C-shaped body, and exact usable endpoints', () => {
  const model = createMovementModel(catalog.movements[209]);
  const {
    blocks,
    geometry,
    sourceAnchors,
    sourceAnimation,
    sourceRaster,
    stateAtArmAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;

  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  assert.equal(sourceRaster.sourceUrl, 'https://507movements.com/mm_210.html');
  assert.equal(sourceAnimation.available, true);
  vector2Near(
    sourceAnimation.constructionSlotCenter,
    new THREE.Vector2(1.74825, 3.597725),
    0,
    'official construction slot center',
  );
  vector2Near(
    sourceAnimation.constructionArmEndVector,
    new THREE.Vector2(-3.031441, -1.114066),
    0,
    'official construction end vector',
  );
  near(sourceRaster.fittedInnerSlotRadius, 99.27486476, 0,
    'source inner slot radius');
  near(sourceRaster.fittedOuterSlotRadius, 124.16338204, 0,
    'source outer slot radius');
  near(THREE.MathUtils.radToDeg(geometry.profileRotation),
    -5.547388316205213, 1e-12, 'source profile alignment');
  near(geometry.slotInnerRadius / geometry.sourcePixelScale,
    sourceRaster.fittedInnerSlotRadius, 2e-14, 'modeled inner radius');
  near(geometry.slotOuterRadius / geometry.sourcePixelScale,
    sourceRaster.fittedOuterSlotRadius, 2e-14, 'modeled outer radius');
  near(geometry.slotCenterRadius, 1.32, 2e-15, 'slot centerline radius');
  near(
    geometry.followerRadius,
    (geometry.slotOuterRadius - geometry.slotInnerRadius) / 2,
    2e-16,
    'follower fills the slot width',
  );
  near(transmission.slotSweepDegrees, 140.00000270481564, 2e-12,
    'construction slot sweep');
  near(geometry.upperCapCenter.distanceTo(geometry.slotCenterLocal),
    geometry.slotCenterRadius, 3e-16, 'upper slot cap center');
  near(geometry.lowerCapCenter.distanceTo(geometry.slotCenterLocal),
    geometry.slotCenterRadius, 3e-16, 'lower slot cap center');
  assert.ok(geometry.bodyOutline.length >= 230);
  assert.ok(geometry.slotBoundary.length >= 180);
  assert.equal(blocks.plate.geometry.parameters.shapes.length, 1,
    'the corrected cap leaves one connected C-shaped plate');
  assert.equal(blocks.plate.geometry.parameters.shapes[0].holes.length, 2,
    'the plate has a real curved slot and a real shaft bore');

  vector2Near(
    sourceAnchors.modeledPivot,
    sourceAnchors.shaftPivot,
    1e-13,
    'shaft pivot maps exactly to the engraving',
  );
  assert.ok(
    sourceAnchors.modeledSlotCenter.distanceTo(sourceAnchors.slotCenter) < 2.3,
    'the constructed slot center agrees with the raster fit',
  );
  assert.ok(
    sourceAnchors.modeledFollowerAtSource.distanceTo(
      sourceAnchors.rollerCenter,
    ) < 2.1,
    'the source-pose follower agrees with the raster fit',
  );
  const sourceState = stateAtTime(0);
  near(sourceState.armAngle, geometry.sourceArmAngle, 2e-16,
    'source arm orientation');
  near(sourceState.followerCenter.x, geometry.sliderX, 0,
    'source follower lies on the guide line');

  const lowerEndpoint = stateAtArmAngle(geometry.minimumArmAngle);
  const upperEndpoint = stateAtArmAngle(geometry.maximumArmAngle);
  near(lowerEndpoint.localSlotAngle, geometry.slotEndAngle, 1e-15,
    'lower reversal uses the lower slot endpoint');
  near(upperEndpoint.localSlotAngle, geometry.slotStartAngle, 1e-15,
    'upper reversal uses the upper slot endpoint');
  near(lowerEndpoint.lowerEndMargin, 0, 1e-15,
    'lower endpoint margin');
  near(upperEndpoint.upperEndMargin, 0, 1e-15,
    'upper endpoint margin');
  near(transmission.minimumArmAngleDegrees,
    -117.3816183381143, 2e-12, 'lower arm angle');
  near(transmission.maximumArmAngleDegrees,
    14.183829129823499, 2e-12, 'upper arm angle');
  assert.ok(
    transmission.maximumArmAngle - transmission.minimumArmAngle < Math.PI,
    'the arm uses the physically valid short rocking branch',
  );
  disposeModel(model.root);
});

test('movement 210 keeps the follower captive and the loaded wall rolling through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[209]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  let minimumSliderY = Infinity;
  let maximumSliderY = -Infinity;
  let minimumSliderRatio = Infinity;
  let maximumSliderRatio = -Infinity;
  let maximumConstraintError = 0;
  let maximumTangencyError = 0;
  let maximumNoSlipError = 0;
  let maximumPassiveSlip = 0;
  const activeWalls = new Set();

  for (let index = 0; index <= 32768; index += 1) {
    const time = transmission.cycleDuration * index / 32768;
    const state = stateAtTime(time);
    finiteStateNumbers(state, `state[${index}]`);
    minimumSliderY = Math.min(minimumSliderY, state.sliderY);
    maximumSliderY = Math.max(maximumSliderY, state.sliderY);
    minimumSliderRatio = Math.min(minimumSliderRatio, state.sliderRatio);
    maximumSliderRatio = Math.max(maximumSliderRatio, state.sliderRatio);
    maximumConstraintError = Math.max(
      maximumConstraintError,
      Math.abs(state.centerlineConstraintError),
      Math.abs(state.guideConstraintError),
    );
    maximumTangencyError = Math.max(
      maximumTangencyError,
      Math.abs(state.innerContact.tangencyError),
      Math.abs(state.outerContact.tangencyError),
    );
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      state.activeContact.noSlipError,
    );
    maximumPassiveSlip = Math.max(
      maximumPassiveSlip,
      state.passiveContact.slipSpeed,
    );
    activeWalls.add(state.activeContact.wall);

    assert.ok(state.armAngle >= geometry.minimumArmAngle - 2e-15);
    assert.ok(state.armAngle <= geometry.maximumArmAngle + 2e-15);
    assert.ok(state.upperEndMargin >= -3e-9);
    assert.ok(state.lowerEndMargin >= -3e-9);
    near(state.radialUnit.length(), 1, 5e-16,
      `radial unit at state ${index}`);
    near(
      state.innerContact.point.distanceTo(state.slotCenter),
      geometry.slotInnerRadius,
      7e-16,
      `inner wall radius at state ${index}`,
    );
    near(
      state.outerContact.point.distanceTo(state.slotCenter),
      geometry.slotOuterRadius,
      8e-16,
      `outer wall radius at state ${index}`,
    );
    near(
      state.innerContact.point.distanceTo(state.outerContact.point),
      geometry.followerRadius * 2,
      8e-16,
      `slot width at state ${index}`,
    );
    assert.ok(
      state.sliderVelocity * state.armAngularSpeed >= -2e-16,
      `positive geometric velocity ratio at state ${index}`,
    );
    assert.ok(
      state.sliderY + geometry.sliderBarBottom
        < Math.min(...geometry.guideYs),
      `bar remains through the lower guide at state ${index}`,
    );
    assert.ok(
      state.sliderY + geometry.sliderBarTop
        > Math.max(...geometry.guideYs),
      `bar remains through the upper guide at state ${index}`,
    );
  }

  assert.ok(maximumConstraintError < 5e-16);
  assert.ok(maximumTangencyError < 7e-16);
  assert.ok(maximumNoSlipError < 5e-16);
  assert.ok(maximumPassiveSlip > 2.3,
    'passive-wall sliding is exposed instead of misreported as dual rolling');
  assert.deepEqual([...activeWalls].sort(), ['inner', 'outer']);
  near(minimumSliderY, 0.5666488165108797, 3e-9,
    'minimum follower height');
  near(maximumSliderY, 2.149638764454137, 3e-9,
    'maximum follower height');
  assert.ok(maximumSliderY - minimumSliderY > 1.58);
  assert.ok(minimumSliderRatio > 0.15);
  assert.ok(maximumSliderRatio > 0.92);
  assert.ok(maximumSliderRatio - minimumSliderRatio > 0.77,
    'the offset circular slot produces a strongly variable velocity ratio');
  disposeModel(model.root);
});

test('movement 210 analytic velocity, acceleration, roller rate, reversals, and closure are continuous', () => {
  const model = createMovementModel(catalog.movements[209]);
  const {
    canonicalTimes,
    geometry,
    stateAtArmAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const angleStep = 0.0002;
  for (let index = 1; index < 2048; index += 1) {
    const armAngle = THREE.MathUtils.lerp(
      geometry.minimumArmAngle,
      geometry.maximumArmAngle,
      index / 2048,
    );
    const state = stateAtArmAngle(armAngle);
    const previous = stateAtArmAngle(armAngle - angleStep);
    const next = stateAtArmAngle(armAngle + angleStep);
    near(
      (next.sliderY - previous.sliderY) / (2 * angleStep),
      state.sliderRatio,
      1.2e-8,
      `analytic slider ratio at angle sample ${index}`,
    );
    near(
      (next.sliderY - 2 * state.sliderY + previous.sliderY)
        / angleStep ** 2,
      state.sliderSecondRatio,
      4e-8,
      `analytic second ratio at angle sample ${index}`,
    );
  }

  const timeStep = 0.00001;
  for (let index = 1; index < 4096; index += 1) {
    const time = transmission.cycleDuration * index / 4096;
    const state = stateAtTime(time);
    if (Math.abs(Math.sin(state.phase)) < 0.01) continue;
    const previous = stateAtTime(time - timeStep);
    const next = stateAtTime(time + timeStep);
    near(
      (next.sliderY - previous.sliderY) / (2 * timeStep),
      state.sliderVelocity,
      1.4e-10,
      `slider velocity at time sample ${index}`,
    );
    near(
      (next.sliderVelocity - previous.sliderVelocity) / (2 * timeStep),
      state.sliderAcceleration,
      1.2e-10,
      `slider acceleration at time sample ${index}`,
    );
    near(
      (next.rollerAngle - previous.rollerAngle) / (2 * timeStep),
      state.rollerAngularSpeed,
      2e-9,
      `loaded-wall roller rate at time sample ${index}`,
    );
  }

  const lower = stateAtTime(canonicalTimes.lowerReversal);
  const upper = stateAtTime(canonicalTimes.upperReversal);
  near(lower.armAngle, geometry.minimumArmAngle, 0,
    'lower arm reversal');
  near(upper.armAngle, geometry.maximumArmAngle, 6e-17,
    'upper arm reversal');
  near(lower.armAngularSpeed, 0, 9e-17, 'lower finite-speed reversal');
  near(upper.armAngularSpeed, 0, 0, 'upper finite-speed reversal');
  near(lower.sliderVelocity, 0, 4e-17, 'lower slider reversal');
  near(upper.sliderVelocity, 0, 0, 'upper slider reversal');
  assert.ok(Number.isFinite(lower.sliderAcceleration));
  assert.ok(Number.isFinite(upper.sliderAcceleration));

  const reversalStep = 0.000001;
  const justBeforeLower = stateAtTime(
    canonicalTimes.lowerReversal - reversalStep,
  );
  const justAfterLower = stateAtTime(
    canonicalTimes.lowerReversal + reversalStep,
  );
  assert.equal(justBeforeLower.activeContact.wall, 'outer');
  assert.equal(justAfterLower.activeContact.wall, 'inner');
  near(justAfterLower.rollerAngle, justBeforeLower.rollerAngle, 1e-11,
    'roller orientation is continuous at the lower wall handoff');
  const justBeforeUpper = stateAtTime(
    canonicalTimes.upperReversal - reversalStep,
  );
  const justAfterUpper = stateAtTime(
    canonicalTimes.upperReversal + reversalStep,
  );
  assert.equal(justBeforeUpper.activeContact.wall, 'inner');
  assert.equal(justAfterUpper.activeContact.wall, 'outer');
  near(justAfterUpper.rollerAngle, justBeforeUpper.rollerAngle, 1e-11,
    'roller orientation is continuous at the upper wall handoff');

  const source = stateAtTime(canonicalTimes.sourcePose);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  near(closure.armAngle, source.armAngle, 1.2e-16, 'arm cycle closure');
  near(closure.armAngularSpeed, source.armAngularSpeed, 0,
    'arm-speed cycle closure');
  near(closure.sliderY, source.sliderY, 0, 'slider cycle closure');
  near(closure.sliderVelocity, source.sliderVelocity, 0,
    'slider-speed cycle closure');
  near(
    closure.rollerAngle - source.rollerAngle,
    transmission.rollerAnglePerCycle,
    0,
    'roller accumulates the exact loaded-wall rolling travel',
  );
  assert.ok(Math.abs(transmission.rollerAnglePerCycle) > FULL_TURN * 6);
  disposeModel(model.root);
});

test('movement 210 renders exact transforms while 211–213 are distinct and authored', () => {
  const model = createMovementModel(catalog.movements[209]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const fixedGuidePositions = blocks.guideAssemblies.map(
    (guide) => guide.position.clone(),
  );
  const renderedTimes = [
    canonicalTimes.sourcePose,
    canonicalTimes.downstrokeMidpoint,
    canonicalTimes.lowerReversal,
    canonicalTimes.upstrokeMidpoint,
    canonicalTimes.upperReversal,
    canonicalTimes.cycleClosure,
  ];
  const sweptBounds = new THREE.Box3();

  for (const time of renderedTimes) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.arm.userData.rotor.rotation.z, state.armAngle, 0,
      'rendered arm angle');
    near(blocks.inputShaft.userData.rotor.rotation.z, state.armAngle, 0,
      'rendered shaft angle');
    near(blocks.slider.position.x, geometry.sliderX, 0,
      'rendered slider guide line');
    near(blocks.slider.position.y, state.sliderY, 0,
      'rendered slider height');
    near(blocks.followerRoller.userData.rotor.rotation.z,
      state.rollerAngle, 0, 'rendered roller angle');
    assert.equal(blocks.followerRoller.userData.activeWall,
      state.activeContact.wall);
    near(blocks.followerRoller.userData.angularSpeed,
      state.rollerAngularSpeed, 0, 'rendered roller speed');
    near(
      radialDistanceToAxis(
        blocks.armIndexTip.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(0, 0, 0),
        Z_AXIS,
      ),
      0.63,
      2e-15,
      'white shaft index remains rigid with the arm',
    );
    const followerCenterWorld = blocks.followerRoller.getWorldPosition(
      new THREE.Vector3(),
    );
    vector3Near(
      followerCenterWorld,
      new THREE.Vector3(state.followerCenter.x, state.followerCenter.y, 0),
      1e-15,
      'rendered follower center',
    );
    near(
      radialDistanceToAxis(
        blocks.followerIndexTip.getWorldPosition(new THREE.Vector3()),
        followerCenterWorld,
        Z_AXIS,
      ),
      geometry.followerRadius * 0.92,
      2e-15,
      'white follower index remains rigid with the roller',
    );
    blocks.guideAssemblies.forEach((guide, index) => {
      vector3Near(guide.position, fixedGuidePositions[index], 0,
        `guide ${index} stays fixed`);
    });
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }

  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 4.4, 'the rocking arm sweeps a real horizontal envelope');
  assert.ok(sweptSize.y > 8.4, 'the bar and arm sweep a real vertical envelope');
  assert.ok(sweptSize.z > 1.5, 'shaft, plate, and roller use real depth');
  assert.ok(sweptBounds.min.y < -3.3);
  assert.ok(sweptBounds.max.y > 5.0);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  const fit = model.root.userData.cameraFitBounds;
  assert.ok(fit.min.x <= sweptBounds.min.x + 0.03 && fit.max.x >= sweptBounds.max.x - 0.03,
    'camera bounds reserve the arm\'s complete swing');
  for (const guide of blocks.guideAssemblies) {
    assert.ok(fit.clone().expandByScalar(0.01).containsBox(new THREE.Box3().setFromObject(guide)),
      'camera bounds keep both drawn guide blocks in view');
  }
  assert.ok(fit.getSize(new THREE.Vector3()).y < 6.3,
    'the default view frames Brown\'s guide-to-guide span, not the bar\'s full overhang');

  const movement209 = createMovementModel(catalog.movements[208]);
  const movement211 = createMovementModel(catalog.movements[210]);
  const movement212 = createMovementModel(catalog.movements[211]);
  const movement213 = createMovementModel(catalog.movements[212]);
  assert.equal(catalog.movements[208].id, 209);
  assert.equal(catalog.movements[208].fidelity, 'authored');
  assert.equal(movement209.root.userData.fidelity, 'authored');
  assert.notEqual(movement209.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[210].id, 211);
  assert.equal(catalog.movements[210].fidelity, 'authored');
  assert.equal(movement211.root.userData.fidelity, 'authored');
  assert.notEqual(movement211.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[211].id, 212);
  assert.equal(catalog.movements[211].fidelity, 'authored');
  assert.equal(movement212.root.userData.fidelity, 'authored');
  assert.notEqual(movement212.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  disposeModel(movement209.root);
  disposeModel(movement211.root);
  disposeModel(movement212.root);
  disposeModel(movement213.root);
  disposeModel(model.root);
});
