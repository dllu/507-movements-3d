import { assertReadableTiming } from './helpers/display-timing.mjs';
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

test('movement 327 is the French opposed-roller crosshead guide', () => {
  const movement = catalog.movements[326];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 327);
  assert.equal(movement.number, '327');
  assert.match(movement.title, /^Differs from 326/);
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'opposed-guide-roller-crosshead-slider-crank');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /three-unit-crank/);
  assert.match(mechanism, /nineteen-unit-rod/);
  assert.match(mechanism, /two-counter-rotating-rollers/);
  assert.match(mechanism, /guide-bars-A-A/);
  assert.match(transmission.input, /three-unit crank/);
  assert.match(transmission.output, /six-unit vertical piston stroke/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.crossheadTranslationAxes, 1);
  assert.equal(degreesOfFreedom.crossheadRotation, 0);

  assert.equal(blocks.flywheel.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.crosshead.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.leftRoller.parent, blocks.crosshead);
  assert.equal(blocks.rightRoller.parent, blocks.crosshead);
  assert.equal(blocks.pistonRod.parent, blocks.crosshead);
  assert.equal(blocks.leftGuideBarA.parent, blocks.fixedFrame);
  assert.equal(blocks.rightGuideBarA.parent, blocks.fixedFrame);
  assert.equal(blocks.crankArm.parent, blocks.flywheel);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'left-guide-roller').length,
    1);
  assert.equal(roles.filter((role) => role === 'right-guide-roller').length,
    1);
  assert.equal(roles.filter((role) =>
    /straight-guide-bar-A$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /roller-axle-fixed-in-crosshead$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^flywheel-rigid-spoke-/.test(role)).length, 4);
  assert.equal(roles.some((role) => /plain-slide-shoe/.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 327 preserves Brown’s A A landmarks and official canvas dimensions', () => {
  const movement = catalog.movements[326];
  const model = createMovementModel(movement);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.officialGeometry, {
    connectingRodLength: 19,
    crankInitialAngle: Math.PI / 2,
    crankRadius: 3,
    flywheelInnerRadius: 13,
    flywheelOuterRadius: 15,
    guideBarCenterHalfSpacing: 6.25,
    guideBarHalfWidth: 0.375,
    guideContactHalfSpacing: 5.875,
    pistonRodBottomLocalY: -14,
    pistonRodTopLocalY: -0.375,
    rollerCenterHalfSpacing: 4.375,
    rollerRadius: 1.5,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) => phase),
    [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(sourceAnimation.officialKeyframes[0].crankPin,
    new THREE.Vector2(0, 3));
  assert.deepEqual(sourceAnimation.officialKeyframes[0].crossheadPin,
    new THREE.Vector2(0, -16));
  assert.deepEqual(sourceAnimation.officialKeyframes[2].crossheadPin,
    new THREE.Vector2(0, -22));
  assert.match(sourceAnimation.referenceScope, /opposed 1.5-unit rollers/);
  assert.match(sourceAnimation.referenceScope, /guide-bars A A/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_327.html');

  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-16, -26.734242),
    viewHeight: 32,
    viewWidth: 32,
  });
  const originRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(),
  );
  near(originRaster.x, 16 * 525 / 32, 0,
    'official crank-center raster x');
  near(originRaster.y, 525 - 26.734242 * 525 / 32, 0,
    'official crank-center raster y');
  const leftContactRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(-5.875 * geometry.sourceScale,
      -16 * geometry.sourceScale),
  );
  near(leftContactRaster.x, (16 - 5.875) * 525 / 32, 0,
    'official left guide contact raster x');
  near(leftContactRaster.y,
    525 - (26.734242 - 16) * 525 / 32, 2e-13,
  'official top-state roller raster y');

  const plate = sourceReference.brownPlate327;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 24);
  assert.deepEqual(plate.rasterCrankCenter, new THREE.Vector2(264, 56));
  assert.deepEqual(plate.rasterCrossheadPin, new THREE.Vector2(267, 330));
  assert.deepEqual(plate.rasterLeftGuideRoller,
    new THREE.Vector2(216, 328));
  assert.deepEqual(plate.rasterRightGuideRoller,
    new THREE.Vector2(322, 328));
  assert.match(plate.inferredTopology, /two guide rollers/);
  assert.match(plate.inferredTopology, /two straight fixed guide-bars A A/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 327 solves its three-unit crank, nineteen-unit rod, and six-unit stroke exactly', () => {
  const model = createMovementModel(catalog.movements[326]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 2048; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 2048);
    near(state.crankPin.length(), geometry.crankRadius, 5e-16,
      `crank radius at ${sample}`);
    near(state.rodLength, geometry.connectingRodLength, 9e-16,
      `rod length at ${sample}`);
    near(state.rodLengthResidual, 0, 9e-16,
      `rod residual at ${sample}`);
    vector2Near(state.rodVector,
      state.wristPin.clone().sub(state.crankPin), 0,
    `rod endpoint vector at ${sample}`);
    near(state.wristPin.x, 0, 0, `piston axis at ${sample}`);
    near(state.wristPin.distanceTo(state.crankPin) ** 2,
      geometry.connectingRodLength ** 2, 1.1e-14,
    `squared rod closure at ${sample}`);
  }

  near(canonicalStates.sourceStartTopDeadCenter.sliderY,
    -16 * geometry.sourceScale, 5e-16, 'source top dead center');
  near(canonicalStates.bottomDeadCenter.sliderY,
    -22 * geometry.sourceScale, 5e-16, 'source bottom dead center');
  near(canonicalStates.sourceStartTopDeadCenter.sliderY
    - canonicalStates.bottomDeadCenter.sliderY,
  geometry.pistonStroke, 5e-16, 'six-unit stroke');
  near(geometry.pistonStroke / geometry.sourceScale, 6, 0,
    'six source-unit piston stroke');
  disposeModel(model.root);
});

test('movement 327 rollers remain tangent to A A and counter-rotate without slip', () => {
  const model = createMovementModel(catalog.movements[326]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.leftGuideBarA.userData.contactX,
    -geometry.guideContactHalfSpacing);
  assert.equal(blocks.rightGuideBarA.userData.contactX,
    geometry.guideContactHalfSpacing);
  assert.equal(blocks.leftRoller.userData.radius, geometry.rollerRadius);
  assert.equal(blocks.rightRoller.userData.radius, geometry.rollerRadius);
  assert.equal(contacts.leftRollerOnGuideBarA.fixedMember,
    blocks.leftGuideBarA);
  assert.equal(contacts.leftRollerOnGuideBarA.movingMember,
    blocks.leftRoller);
  assert.equal(contacts.rightRollerOnGuideBarA.fixedMember,
    blocks.rightGuideBarA);
  assert.equal(contacts.rightRollerOnGuideBarA.movingMember,
    blocks.rightRoller);

  for (let sample = 0; sample <= 2048; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 2048);
    near(state.leftRoller.center.x,
      -geometry.rollerCenterHalfSpacing, 0,
    `left roller center x at ${sample}`);
    near(state.rightRoller.center.x,
      geometry.rollerCenterHalfSpacing, 0,
    `right roller center x at ${sample}`);
    near(state.leftRoller.contactPoint.x,
      -geometry.guideContactHalfSpacing, 3e-16,
    `left guide tangency at ${sample}`);
    near(state.rightRoller.contactPoint.x,
      geometry.guideContactHalfSpacing, 3e-16,
    `right guide tangency at ${sample}`);
    near(state.leftRoller.center.distanceTo(
      state.leftRoller.contactPoint), geometry.rollerRadius, 2e-16,
    `left roller radius at ${sample}`);
    near(state.rightRoller.center.distanceTo(
      state.rightRoller.contactPoint), geometry.rollerRadius, 2e-16,
    `right roller radius at ${sample}`);
    near(state.guide.leftFaceResidual, 0, 3e-16,
      `left face residual at ${sample}`);
    near(state.guide.rightFaceResidual, 0, 3e-16,
      `right face residual at ${sample}`);
    near(state.guide.leftNoSlipVelocityResidual, 0, 3e-16,
      `left no-slip velocity at ${sample}`);
    near(state.guide.rightNoSlipVelocityResidual, 0, 3e-16,
      `right no-slip velocity at ${sample}`);
    near(state.leftRoller.angle, -state.rightRoller.angle, 0,
      `opposite roller angles at ${sample}`);
    near(state.leftRoller.angularVelocity,
      -state.rightRoller.angularVelocity, 0,
    `opposite roller speeds at ${sample}`);
    near(state.leftRoller.angularAcceleration,
      -state.rightRoller.angularAcceleration, 0,
    `opposite roller accelerations at ${sample}`);
    near(state.guide.crossheadRotation, 0, 0,
      `zero crosshead yaw at ${sample}`);
  }

  const bottom = stateAtTime(2);
  near(bottom.leftRoller.angle, -4, 2e-15,
    'left roller turns four radians over downward stroke');
  near(bottom.rightRoller.angle, 4, 2e-15,
    'right roller turns four radians over downward stroke');
  disposeModel(model.root);
});

test('movement 327 analytic crank, crosshead, rod, and roller rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[326]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.13, 0.52, 1.18, 1.71, 2.36, 3.11, 3.73]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    near((after.sliderY - before.sliderY) / (2 * step),
      state.sliderVelocityY, 4e-10,
    `slider velocity at ${time}`);
    near((after.sliderVelocityY - before.sliderVelocityY) / (2 * step),
      state.sliderAccelerationY, 1.1e-9,
    `slider acceleration at ${time}`);
    near((after.rodAngle - before.rodAngle) / (2 * step),
      state.rodAngularVelocity, 4e-10,
    `rod angular velocity at ${time}`);
    near((after.rodAngularVelocity - before.rodAngularVelocity)
      / (2 * step), state.rodAngularAcceleration, 1.1e-9,
    `rod angular acceleration at ${time}`);
    near((after.leftRoller.angle - before.leftRoller.angle)
      / (2 * step), state.leftRoller.angularVelocity, 1.1e-9,
    `left roller angular velocity at ${time}`);
    near((after.rightRoller.angle - before.rightRoller.angle)
      / (2 * step), state.rightRoller.angularVelocity, 1.1e-9,
    `right roller angular velocity at ${time}`);
    near((after.leftRoller.angularVelocity
      - before.leftRoller.angularVelocity) / (2 * step),
    state.leftRoller.angularAcceleration, 4e-9,
    `left roller angular acceleration at ${time}`);
    vector2Near(after.crankPin.clone().sub(before.crankPin)
      .multiplyScalar(1 / (2 * step)), state.crankPinVelocity,
    5e-10, `crank-pin velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 327 renderer gives both no-slip rollers independent spin', () => {
  const model = createMovementModel(catalog.movements[326]);
  const {
    animationTiming,
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(blocks.leftRoller.userData.rotationIndex, undefined,
    'Brown draws plain rollers without index marks');
  assert.equal(blocks.rightRoller.userData.rotationIndex, undefined);
  assert.equal(blocks.leftRoller.userData.tread.parent,
    blocks.leftRoller);
  assert.equal(blocks.rightRoller.userData.tread.parent,
    blocks.rightRoller);

  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  const leftGuideMatrix = blocks.leftGuideBarA.matrixWorld.clone();
  const rightGuideMatrix = blocks.rightGuideBarA.matrixWorld.clone();
  for (const time of [0, 0.29, 0.76, 1.24, 2, 2.61, 3.44, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vector3Near(blocks.crosshead.position,
      new THREE.Vector3(0, state.sliderY, 0), 0,
    `rendered crosshead at ${time}`);
    near(blocks.leftRoller.rotation.z, state.leftRoller.angle, 0,
      `rendered left roller spin at ${time}`);
    near(blocks.rightRoller.rotation.z, state.rightRoller.angle, 0,
      `rendered right roller spin at ${time}`);
    vector3Near(blocks.connectingRod.position,
      new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.connectingRodPlaneZ,
      ),
    0, `rendered rod origin at ${time}`);
    near(blocks.connectingRod.rotation.z, state.rodAngle, 0,
      `rendered rod angle at ${time}`);
    vector3Near(blocks.connectingRodWristEyeAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      0,
      state.sliderY,
      geometry.connectingRodPlaneZ,
    ), 1.6e-15, `rendered rod wrist eye at ${time}`);
    vector3Near(blocks.wristPinAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      0,
      state.sliderY,
      geometry.connectingRodPlaneZ,
    ), 5e-16, `rendered crosshead wrist at ${time}`);
    vector3Near(blocks.crankPinAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      state.crankPin.x,
      state.crankPin.y,
      geometry.crankPlaneZ,
    ), 7e-16, `rendered crank pin at ${time}`);
    const crankPinShaftCenter = blocks.crankPinShaft.getWorldPosition(
      new THREE.Vector3(),
    );
    near(crankPinShaftCenter.x, state.crankPin.x, 2e-15,
      `crank pin shaft x at ${time}`);
    near(crankPinShaftCenter.y, state.crankPin.y, 2e-15,
      `crank pin shaft y at ${time}`);
    const wristPinShaftCenter = blocks.wristPinShaft.getWorldPosition(
      new THREE.Vector3(),
    );
    near(wristPinShaftCenter.x, 0, 0, `wrist pin shaft x at ${time}`);
    near(wristPinShaftCenter.y, state.sliderY, 2e-15,
      `wrist pin shaft y at ${time}`);
    near(contacts.leftRollerOnGuideBarA.relativeSlipSpeed, 0, 3e-16,
      `rendered left rolling slip at ${time}`);
    near(contacts.rightRollerOnGuideBarA.relativeSlipSpeed, 0, 3e-16,
      `rendered right rolling slip at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
    assert.ok(blocks.leftGuideBarA.matrixWorld.equals(leftGuideMatrix));
    assert.ok(blocks.rightGuideBarA.matrixWorld.equals(rightGuideMatrix));
  }
  disposeModel(model.root);
});

test('movement 327 has a fully spatial frame, bearing, cylinder, guides, and linkage distinct from 326', () => {
  const model = createMovementModel(catalog.movements[326]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(blocks.topBeam.parent, blocks.fixedFrame);
  assert.equal(blocks.cylinderBody.parent, blocks.fixedFrame);
  assert.equal(blocks.cylinderTopCap.parent, blocks.fixedFrame);
  assert.equal(blocks.gland.parent, blocks.fixedFrame);
  assert.equal(blocks.bearingHousing.parent, blocks.fixedFrame);
  assert.equal(blocks.bearingBore.parent, blocks.fixedFrame);
  assert.equal(blocks.liveShaft.parent, blocks.flywheel);
  assert.equal(blocks.flywheelSpokes.length, 4);
  assert.equal(blocks.rollerAxles.length, 2);
  assert.equal(blocks.crankPinShaft.parent, blocks.flywheel,
    'crank pin is carried by the crank, not re-posed by the frame');
  assert.equal(blocks.wristPinShaft.parent, blocks.crosshead);
  for (const undrawn of ['outerFramePosts', 'lowerCrossBase', 'crossheadIndex',
    'flywheelRotationIndex', 'crankRotationIndex']) {
    assert.equal(blocks[undrawn], undefined, `${undrawn} is not in Brown's plate`);
  }
  model.root.traverse((object) => {
    assert.doesNotMatch(object.userData.role ?? '', /index|outer-engine-frame-post/);
  });
  model.root.updateMatrixWorld(true);
  const rimBox = new THREE.Box3().setFromObject(blocks.flywheelRim);
  for (const fixed of [blocks.topBeam, blocks.leftGuideBarA, blocks.rightGuideBarA]) {
    assert.ok(rimBox.max.z < new THREE.Box3().setFromObject(fixed).min.z,
      'flywheel runs wholly behind the crossbeam and columns');
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > geometry.flywheelOuterRadius * 2);
  assert.ok(size.y > 10);
  assert.ok(size.z > 1.4,
    'rear flywheel, frame, rollers, crosshead, and front rod use real depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model326 = createMovementModel(catalog.movements[325]);
  assert.equal(model326.root.userData.fidelity, 'authored');
  assert.notEqual(model326.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model326.root.userData.blocks.slideA.userData.hasRollers,
    false);
  assert.equal(model.root.userData.blocks.leftRoller.userData.radius,
    geometry.rollerRadius);
  assert.equal(Object.keys(model326.root.userData.contacts).length, 2);
  assert.equal(Object.keys(model.root.userData.contacts).length, 2);
  disposeModel(model326.root);
  disposeModel(model.root);
});

test('movement 327 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[326]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.crankAngle, start.crankAngle, 0, 'crank closure');
  vector2Near(closure.crankPin, start.crankPin, 0,
    'crank-pin closure');
  vector2Near(closure.wristPin, start.wristPin, 0,
    'wrist-pin closure');
  near(closure.rodAngle, start.rodAngle, 0,
    'connecting-rod closure');
  near(closure.leftRoller.angle, start.leftRoller.angle, 0,
    'left roller closure');
  near(closure.rightRoller.angle, start.rightRoller.angle, 0,
    'right roller closure');
  near(closure.unwrappedRotorAngle, Math.PI * 2, 0,
    'one unwrapped flywheel turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.flywheel.rotation.z, 0, 0,
    'rendered flywheel closure');
  near(blocks.leftRoller.rotation.z, 0, 0,
    'rendered left roller closure');
  near(blocks.rightRoller.rotation.z, 0, 0,
    'rendered right roller closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('327 p104: broad strap connecting rod and round piston rod', () => {
  const model = createMovementModel(catalog.movements[326]);
  const { blocks } = model.root.userData;
  assert.ok(blocks.connectingRodBody === undefined
    || blocks.connectingRodBody.geometry.parameters.height >= 0.2);
  let shank;
  blocks.connectingRod.traverse((o) => {
    if (o.userData.role === 'constant-length-connecting-rod-shank') shank = o;
  });
  assert.ok(shank.geometry.parameters.height >= 0.2, 'shank about 2.5x the old wire');
  assert.equal(blocks.pistonRod.geometry.type, 'CylinderGeometry');
});
