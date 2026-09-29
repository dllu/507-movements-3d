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

test('movement 326 is Brown’s planed-slot piston-rod guide', () => {
  const movement = catalog.movements[325];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 326);
  assert.equal(movement.number, '326');
  assert.match(movement.title, /^simple means of guiding/);
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'vertical-planed-slot-crosshead-slider-crank');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-rigid-flywheel-crank/);
  assert.match(mechanism, /finite-connecting-rod/);
  assert.match(mechanism, /slide-A/);
  assert.match(mechanism, /one-real-planed-vertical-slot/);
  assert.match(transmission.input, /flywheel and four-unit crank/);
  assert.match(transmission.output, /eight-unit stroke with zero yaw/);
  assert.equal(transmission.strokeToCrankRadiusRatio, 2);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.slideTranslationAxes, 1);
  assert.equal(degreesOfFreedom.slideRotation, 0);

  assert.equal(blocks.flywheel.parent, model.root);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.slideA.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.framePlate.parent, blocks.fixedFrame);
  assert.equal(blocks.leftSlideShoe.parent, blocks.slideA);
  assert.equal(blocks.rightSlideShoe.parent, blocks.slideA);
  assert.equal(blocks.pistonRod.parent, blocks.slideA);
  assert.equal(blocks.crankArm.parent, blocks.flywheel);
  assert.equal(blocks.flywheelRim.parent, blocks.flywheel);
  assert.equal(blocks.framePlate.userData.openingCount, 1);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role.includes('plain-slide-shoe-A-wrapping-planed-edge')).length, 2);
  assert.equal(roles.filter((role) =>
    role.includes('planed-true-guide-surface')).length, 2);
  assert.equal(roles.filter((role) =>
    /^flywheel-rigid-spoke-/.test(role)).length, 4);
  assert.equal(roles.filter((role) =>
    role === 'single-rigid-connecting-rod-from-crank-to-slide-A').length,
  1);
  assert.equal(roles.some((role) => /roller/i.test(role)), false);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 326 preserves the official canvas dimensions, timing, and source landmarks', () => {
  const movement = catalog.movements[325];
  const model = createMovementModel(movement);
  const {
    engravingPointToModelFront,
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
    connectingRodLength: 15.5,
    crankPinRadius: 0.3125,
    crankRadius: 4,
    flywheelInnerRadius: 13,
    flywheelOuterRadius: 15,
    guideAxisX: 0,
    guideSlotHalfWidth: 1,
    guideSlotLowerCenterY: -21.125,
    guideSlotUpperCenterY: -9.875,
    pistonRodBottomLocalY: -17.75,
    pistonRodTopLocalY: -1.536438,
    slideHeight: 2.75,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) => phase),
    [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(sourceAnimation.officialKeyframes[0].crankPin,
    new THREE.Vector2(4, 0));
  assert.deepEqual(sourceAnimation.officialKeyframes[1].slidePin,
    new THREE.Vector2(0, -11.5));
  assert.deepEqual(sourceAnimation.officialKeyframes[3].slidePin,
    new THREE.Vector2(0, -19.5));
  assert.match(sourceAnimation.referenceScope, /15.5-unit connecting rod/);
  assert.match(sourceAnimation.referenceScope, /true-surface vertical guide/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_326.html');

  const officialView = sourceReference.officialAnimationView;
  assert.deepEqual(officialView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-16.5, -27.875),
    viewHeight: 33,
    viewWidth: 33,
  });
  const crankCenterRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(),
  );
  near(crankCenterRaster.x, 16.5 * 525 / 33, 0,
    'official animation crank-center x');
  near(crankCenterRaster.y,
    525 - 27.875 * 525 / 33, 0,
  'official animation crank-center y');
  const crankPinRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(4 * geometry.sourceScale, 0),
  );
  near(crankPinRaster.x, 20.5 * 525 / 33, 0,
    'official phase-zero crank-pin x');
  near(crankPinRaster.y, crankCenterRaster.y, 0,
    'official phase-zero crank-pin y');

  const plate = sourceReference.brownPlate326;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 30);
  assert.deepEqual(plate.rasterCrankCenter, new THREE.Vector2(258, 89));
  assert.deepEqual(plate.rasterCrankPin, new THREE.Vector2(313, 91));
  assert.deepEqual(plate.rasterSlidePin, new THREE.Vector2(258, 329));
  assert.match(plate.inferredTopology, /without rollers/);
  assert.match(plate.inferredTopology, /vertical planed slot/);
  vector3Near(engravingPointToModelFront(plate.rasterCrankCenter),
    new THREE.Vector3(
      0,
      0,
      geometry.connectingRodPlaneZ + geometry.connectingRodDepth / 2,
    ),
  0, 'engraving crank center');
  near(engravingPointToModelFront(plate.rasterCrankPin).length()
    ** 2 - (geometry.connectingRodPlaneZ
      + geometry.connectingRodDepth / 2) ** 2,
  geometry.crankRadius ** 2, 5e-16, 'engraving crank radius');
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 326 enforces one exact finite connecting rod and an eight-unit stroke', () => {
  const model = createMovementModel(catalog.movements[325]);
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
      `connecting-rod length at ${sample}`);
    near(state.rodLengthResidual, 0, 9e-16,
      `connecting-rod residual at ${sample}`);
    vector2Near(state.rodVector,
      state.wristPin.clone().sub(state.crankPin), 0,
    `rod endpoint vector at ${sample}`);
    near(state.circleLineRadicand,
      geometry.connectingRodLength ** 2 - state.crankPin.x ** 2,
    0, `circle-line radicand at ${sample}`);
    near(state.wristPin.distanceTo(state.crankPin) ** 2,
      geometry.connectingRodLength ** 2, 1e-14,
    `squared rod closure at ${sample}`);
  }

  near(canonicalStates.topDeadCenter.sliderY,
    (4 - 15.5) * geometry.sourceScale, 5e-16,
  'source upper dead center');
  near(canonicalStates.bottomDeadCenter.sliderY,
    (-4 - 15.5) * geometry.sourceScale, 5e-16,
  'source lower dead center');
  near(canonicalStates.topDeadCenter.sliderY
    - canonicalStates.bottomDeadCenter.sliderY,
  geometry.pistonStroke, 5e-16, 'one crank-diameter stroke');
  near(geometry.pistonStroke / geometry.sourceScale, 8, 0,
    'eight source-unit piston stroke');
  assert.equal(geometry.crankToStrokeRatio, 2);
  disposeModel(model.root);
});

test('movement 326 constrains slide A between two planed slot faces with no rollers or yaw', () => {
  const model = createMovementModel(catalog.movements[325]);
  const {
    blocks,
    contacts,
    degreesOfFreedom,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.slideA.userData.hasRollers, false);
  assert.equal(blocks.leftSlideShoe.userData.hasRoller, false);
  assert.equal(blocks.rightSlideShoe.userData.hasRoller, false);
  assert.equal(blocks.leftSlideShoe.userData.contactSurfaceX,
    -geometry.guideSlotHalfWidth);
  assert.equal(blocks.rightSlideShoe.userData.contactSurfaceX,
    geometry.guideSlotHalfWidth);
  assert.equal(contacts.leftPlanedSlidingPair.fixedMember,
    blocks.leftPlanedFace);
  assert.equal(contacts.leftPlanedSlidingPair.movingMember,
    blocks.leftSlideShoe);
  assert.equal(contacts.rightPlanedSlidingPair.fixedMember,
    blocks.rightPlanedFace);
  assert.equal(contacts.rightPlanedSlidingPair.movingMember,
    blocks.rightSlideShoe);
  assert.equal(contacts.leftPlanedSlidingPair.type,
    'zero-clearance-planed-prismatic-contact');
  // The dark planed strips stand 0.003 clear of the slot wall and 0.003
  // proud of the frame front (flush, they z-fought with the frame).
  for (const [face, side] of [[blocks.leftPlanedFace, -1], [blocks.rightPlanedFace, 1]]) {
    const inner = face.position.x - side * face.geometry.parameters.width / 2;
    assert.ok(Math.abs(side * inner - geometry.guideSlotHalfWidth - 0.003) < 1e-9);
    assert.ok(Math.abs(face.position.z + face.geometry.parameters.depth / 2
      - geometry.frameFrontZ - 0.003) < 1e-9);
  }
  assert.equal(degreesOfFreedom.output,
    'one vertical translation of slide A and its piston-rod');

  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 1024);
    near(state.wristPin.x, 0, 0, `guide axis at ${sample}`);
    near(state.guide.axisResidual, 0, 0,
      `guide residual at ${sample}`);
    near(state.guide.leftContactResidual, 0, 0,
      `left planed contact at ${sample}`);
    near(state.guide.rightContactResidual, 0, 0,
      `right planed contact at ${sample}`);
    near(state.guide.rotation, 0, 0, `slide yaw at ${sample}`);
    near(state.slideA.position.x, 0, 0,
      `slide x translation at ${sample}`);
    near(state.slideA.rotation, 0, 0,
      `slide body rotation at ${sample}`);
    vector2Near(state.pistonRod.position, state.slideA.position, 0,
      `piston rod rigid with slide at ${sample}`);
  }

  const top = stateAtTime(geometry.canonicalTopTime ?? 1);
  const bottom = stateAtTime(3);
  assert.ok(top.sliderY + geometry.slideHeight / 2
    < geometry.guideSlotUpperCenterY);
  assert.ok(bottom.sliderY - geometry.slideHeight / 2
    > geometry.guideSlotLowerCenterY);
  disposeModel(model.root);
});

test('movement 326 analytic slider and connecting-rod rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[325]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.17, 0.63, 1.27, 1.83, 2.41, 3.34, 3.78]) {
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
    vector2Near(after.crankPin.clone().sub(before.crankPin)
      .multiplyScalar(1 / (2 * step)), state.crankPinVelocity,
    5e-10, `crank-pin velocity at ${time}`);
    vector2Near(after.crankPinVelocity.clone()
      .sub(before.crankPinVelocity).multiplyScalar(1 / (2 * step)),
    state.crankPinAcceleration, 1.1e-9,
    `crank-pin acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 326 keeps the flywheel, shaft, and crank as one indexed 15 rpm rotor', () => {
  const model = createMovementModel(catalog.movements[325]);
  const {
    animationTiming,
    blocks,
    canonicalTimes,
    geometry,
    sourceAnimation,
    stateAtTime,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.deepEqual(canonicalTimes, {
    bottomDeadCenter: 3,
    cycleClosure: 4,
    oppositeQuadrature: 2,
    sourceStart: 0,
    topDeadCenter: 1,
  });
  near(geometry.crankAngularSpeed, Math.PI / 2, 0,
    '15 rpm crank angular speed');
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(blocks.flywheelSpokes.length, 4);
  for (const spoke of blocks.flywheelSpokes) {
    assert.equal(spoke.parent, blocks.flywheel);
  }
  assert.equal(blocks.crankArm.parent, blocks.flywheel);
  assert.equal(blocks.crankDisk.parent, blocks.flywheel);
  assert.equal(blocks.flywheelHub.parent, blocks.flywheel);
  assert.equal(blocks.liveShaft.parent, blocks.flywheel);
  assert.equal(blocks.flywheelRotationIndex, undefined,
    'the plate draws no rotation index marks');
  assert.equal(blocks.crankRotationIndex, undefined);
  assert.equal(blocks.slideIndex, undefined);
  assert.equal(blocks.crankPinShaft.parent, blocks.flywheel);
  assert.equal(blocks.wristPinShaft.parent, blocks.slideA);

  for (const time of [0, 0.37, 1, 1.64, 2.5, 3.22, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.flywheel.rotation.z, state.crankAngle, 0,
      `rigid rotor angle at ${time}`);
    vector3Near(blocks.crankPinAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      state.crankPin.x,
      state.crankPin.y,
      geometry.crankPlaneZ,
    ), 5e-16, `crank pin rigid on rotor at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 326 renderer binds the crank, rod, slide, piston-rod, and guide through real depth', () => {
  const model = createMovementModel(catalog.movements[325]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  const leftGuideMatrix = blocks.leftPlanedFace.matrixWorld.clone();
  const rightGuideMatrix = blocks.rightPlanedFace.matrixWorld.clone();

  for (const time of [0, 0.31, 0.82, 1, 1.73, 2.44, 3, 3.62, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    vector3Near(blocks.slideA.position,
      new THREE.Vector3(0, state.sliderY, 0), 0,
    `rendered slide A at ${time}`);
    vector3Near(blocks.connectingRod.position,
      new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.connectingRodPlaneZ,
      ),
    0, `rendered connecting rod origin at ${time}`);
    near(blocks.connectingRod.rotation.z, state.rodAngle, 0,
      `rendered connecting rod angle at ${time}`);
    vector3Near(blocks.connectingRodCrankEyeAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      state.crankPin.x,
      state.crankPin.y,
      geometry.connectingRodPlaneZ,
    ), 5e-16, `rendered rod crank eye at ${time}`);
    vector3Near(blocks.connectingRodWristEyeAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      0,
      state.sliderY,
      geometry.connectingRodPlaneZ,
    ), 2e-15, `rendered rod wrist eye at ${time}`);
    vector3Near(blocks.wristPinAnchor.getWorldPosition(
      new THREE.Vector3(),
    ), new THREE.Vector3(
      0,
      state.sliderY,
      geometry.connectingRodPlaneZ,
    ), 5e-16, `rendered slide wrist pin at ${time}`);
    const crankPinWorld = blocks.crankPinShaft.getWorldPosition(
      new THREE.Vector3());
    near(crankPinWorld.x, state.crankPin.x, 2e-15,
      `rendered crank shaft x at ${time}`);
    near(crankPinWorld.y, state.crankPin.y, 2e-15,
      `rendered crank shaft y at ${time}`);
    const wristPinWorld = blocks.wristPinShaft.getWorldPosition(
      new THREE.Vector3());
    near(wristPinWorld.x, 0, 0, `rendered wrist shaft x at ${time}`);
    near(wristPinWorld.y, state.sliderY, 0,
      `rendered wrist shaft y at ${time}`);
    near(contacts.leftPlanedSlidingPair.relativeSlidingSpeed,
      state.sliderVelocityY, 0, `left sliding speed at ${time}`);
    near(contacts.rightPlanedSlidingPair.relativeSlidingSpeed,
      state.sliderVelocityY, 0, `right sliding speed at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
    assert.ok(blocks.leftPlanedFace.matrixWorld.equals(leftGuideMatrix));
    assert.ok(blocks.rightPlanedFace.matrixWorld.equals(rightGuideMatrix));
    model.root.traverse((object) => {
      for (const value of object.position.toArray()) {
        assert.ok(Number.isFinite(value), `finite position at ${time}`);
      }
      for (const value of object.quaternion.toArray()) {
        assert.ok(Number.isFinite(value), `finite quaternion at ${time}`);
      }
    });
  }

  assert.equal(blocks.framePlate.geometry.type, 'ExtrudeGeometry');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > geometry.flywheelOuterRadius * 2);
  assert.ok(size.y > 9, 'the piston rod no longer hangs below the drawn foot');
  assert.ok(size.z > 1.4,
    'flywheel, frame, captured shoes, crank, and rod use distinct depths');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 326 closes exactly and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[325]);
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
  near(closure.sliderY, start.sliderY, 0, 'slide closure');
  near(closure.rodAngle, start.rodAngle, 0,
    'connecting-rod closure');
  near(closure.unwrappedCrankAngle, Math.PI * 2, 0,
    'one unwrapped revolution');
  model.update(canonicalTimes.cycleClosure);
  vector3Near(blocks.slideA.position,
    new THREE.Vector3(0, start.sliderY, 0), 0,
  'rendered slide closure');
  near(blocks.flywheel.rotation.z, 0, 0,
    'rendered flywheel closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.mechanism,
    model.root.userData.mechanism);
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 326 hides the connecting rod inside the capped hollow standard', () => {
  const model = createMovementModel(catalog.movements[325]);
  const { blocks, geometry } = model.root.userData;
  const box = (object) => new THREE.Box3().setFromObject(object);
  const skin = box(blocks.standardFrontSkin);
  const walls = box(blocks.standardSideWalls);
  // Brown dots the rod inside the standard: the front skin lies in front of
  // the rod and the walls join it to the plate.
  assert.ok(skin.min.z > geometry.connectingRodPlaneZ + geometry.connectingRodDepth / 2);
  near(walls.min.z, geometry.frameFrontZ, 1e-6, 'walls meet the slotted back plate');
  near(walls.max.z, skin.min.z, 1e-6, 'walls meet the front skin');
  // The skin's top edge is the cap, below the crank shaft.
  assert.ok(skin.max.y < 0);
  const pin = box(blocks.crankPinShaft);
  assert.ok(skin.min.z > pin.max.z);
  // A cap flush with the top edge closes the top behind a narrow slot for
  // the rod; the crank dips into a pit whose floor is an arc concentric
  // with the shaft, just outside the crank's sweep.
  const cap = box(blocks.standardCap);
  near(cap.min.z, geometry.frameFrontZ, 1e-6, 'cap meets the back plate');
  const slot = skin.min.z - cap.max.z;
  assert.ok(slot > geometry.connectingRodDepth && slot < 0.3, `rod slot ${slot}`);
  near(cap.max.y, skin.max.y, 1e-6, 'cap is flush with the top edge');
  const radialExtent = (mesh, reduce) => {
    mesh.updateMatrixWorld(true);
    const position = mesh.geometry.attributes.position;
    const point = new THREE.Vector3();
    let value = reduce === Math.min ? Infinity : -Infinity;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      value = reduce(value, Math.hypot(point.x, point.y));
    }
    return value;
  };
  const pitRadius = radialExtent(blocks.standardCap, Math.min);
  assert.ok(pitRadius > 0.9 && pitRadius < 1.1, `pit radius ${pitRadius}`);
  for (let step = 0; step < 64; step += 1) {
    model.update(4 * step / 64);
    model.root.updateMatrixWorld(true);
    for (const part of [blocks.crankArm, blocks.crankPinShaft]) {
      assert.ok(radialExtent(part, Math.max) < pitRadius - 0.05,
        `crank clears the pit at ${step}`);
    }
  }
  // The piston rod runs inside the hollow standard, into the foot's bore.
  const foot = box(blocks.foundationFoot);
  for (const time of [0, 1, 2, 3]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const rod = box(blocks.pistonRod);
    assert.ok(rod.min.z > geometry.frameFrontZ && rod.max.z < skin.min.z);
    assert.ok(rod.min.y > foot.min.y && rod.min.y < -5.0, `rod end hidden at ${time}`);
  }
  disposeModel(model.root);
});

test('326 p104: the crankshaft pillow block is one extrusion seated on the crown', () => {
  const model = createMovementModel(catalog.movements[325]);
  model.update(0);
  model.root.updateMatrixWorld(true);
  const { blocks } = model.root.userData;
  assert.equal(blocks.bearingSupports.length, 0, 'no separate block foot');
  assert.equal(blocks.bearingHousing.userData.role,
    'fixed-crankshaft-pillow-block-housing-one-extrusion');
  const housing = new THREE.Box3().setFromObject(blocks.bearingHousing);
  const frame = new THREE.Box3().setFromObject(blocks.fixedFrame.children
    .find((part) => part.userData.role === 'source-proportioned-frame-solid-minus-real-guide-opening'));
  assert.ok(Math.abs(housing.min.y - frame.max.y) < 1e-6, 'foot sits on the crown');
  assert.ok(housing.min.z >= frame.min.z - 1e-9, 'no overhang behind the frame');
});
