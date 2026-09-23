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

test('movement 330 is Brown’s prolonged-rod and forked-connecting-rod guide', () => {
  const movement = catalog.movements[329];
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

  assert.equal(movement.id, 330);
  assert.equal(movement.number, '330');
  assert.match(movement.title, /^piston-rod is prolonged/);
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'prolonged-piston-rod-fixed-guide-A-forked-connecting-rod');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /finite-forked-rod/);
  assert.match(mechanism, /prolonged-piston-rod/);
  assert.match(mechanism, /fixed-guide-A/);
  assert.match(transmission.crankToPiston, /finite offset slider-crank/);
  assert.match(transmission.forkClearance, /front and rear lower prongs/);
  assert.match(transmission.guideConstraint, /x = 0/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.pistonRodTranslationAxes, 1);
  assert.equal(degreesOfFreedom.pistonRodRotation, 0);

  assert.ok(blocks.fixedFrame.parent === model.root);
  assert.equal(blocks.topBeam, undefined, 'plate draws no gallows beam');
  assert.ok(blocks.frameColumn.parent === blocks.fixedFrame);
  assert.ok(blocks.columnCapital.parent === blocks.fixedFrame);
  assert.ok(blocks.flywheelRim.parent === blocks.crankRotor);
  assert.ok(blocks.liveShaft.parent === blocks.crankRotor);
  assert.ok(blocks.bearingHousing.parent === blocks.fixedFrame);
  assert.ok(blocks.guideA.parent === blocks.fixedFrame);
  assert.ok(blocks.guideCollar.parent === blocks.guideA);
  assert.ok(blocks.guideBracket.parent === blocks.guideA);
  assert.ok(blocks.cylinderBody.parent === blocks.fixedFrame);
  assert.ok(blocks.crankRotor.parent === model.root);
  assert.ok(blocks.crankArm.parent === blocks.crankRotor);
  assert.ok(blocks.crankPinAnchor.parent === blocks.crankRotor);
  assert.ok(blocks.forkedConnectingRod.parent === model.root);
  assert.ok(blocks.forkCrankAnchor.parent ===
    blocks.forkedConnectingRod);
  assert.ok(blocks.forkCenterWristAnchor.parent ===
    blocks.forkedConnectingRod);
  assert.ok(blocks.pistonAssembly.parent === model.root);
  assert.ok(blocks.pistonRod.parent === blocks.pistonAssembly);
  assert.ok(blocks.commonWristPin.parent === blocks.pistonAssembly);
  assert.equal(contacts.crankPinToForkedRod.crankMember,
    blocks.crankRotor);
  assert.equal(contacts.crankPinToForkedRod.rodMember,
    blocks.forkedConnectingRod);
  assert.equal(contacts.pistonRodInGuideA.fixedMember, blocks.guideA);
  assert.equal(contacts.pistonRodInGuideA.movingMember,
    blocks.pistonAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /lower-fork-prong-clearing-prolonged-piston-rod$/.test(role)).length,
  2);
  assert.equal(roles.filter((role) =>
    /fork-transition-branch$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /fork-wrist-eye$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    role === 'one-piece-piston-rod-prolonged-upward-through-guide-A')
    .length, 1);
  assert.equal(roles.some((role) => /roller|generic|procedural/i.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 330 maps its source pose directly from Brown’s engraving', () => {
  const movement = catalog.movements[329];
  const model = createMovementModel(movement);
  const {
    canonicalStates,
    engravingPointToModelFront,
    geometry,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate330;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.demonstrationCyclesPerMinute, 15);
  assert.equal(sourceAnimation.demonstrationCycleSeconds, 4);
  assert.match(sourceAnimation.referenceScope, /single-to-fork transition/);
  assert.match(sourceAnimation.referenceScope, /guide A/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_330.html');
  assert.equal(sourceReference.officialAnimationView, null);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterCrankCenter,
    new THREE.Vector2(245, 52));
  assert.deepEqual(plate.rasterCrankPin,
    new THREE.Vector2(201, 78));
  assert.deepEqual(plate.rasterPistonWrist,
    new THREE.Vector2(207, 374));
  assert.deepEqual(plate.rasterGuideCenterA,
    new THREE.Vector2(207, 208));
  assert.deepEqual(plate.rasterForkJunction,
    new THREE.Vector2(205, 164));
  assert.deepEqual(plate.rasterCylinderAxisPoint,
    new THREE.Vector2(207, 469));
  assert.equal(plate.rasterPistonAxisX, 207);
  assert.match(plate.inferredTopology, /forks in depth/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });

  vector3Near(engravingPointToModelFront(plate.rasterCrankCenter),
    new THREE.Vector3(
      geometry.crankCenter.x,
      geometry.crankCenter.y,
      0.72,
    ), 0, 'engraving crank center mapping');
  vector3Near(engravingPointToModelFront(plate.rasterCrankPin),
    new THREE.Vector3(
      canonicalStates.sourceEngravingPose.crankPin.x,
      canonicalStates.sourceEngravingPose.crankPin.y,
      0.72,
    ), 3e-16, 'engraving crank-pin mapping');
  vector3Near(engravingPointToModelFront(plate.rasterPistonWrist),
    new THREE.Vector3(
      0,
      canonicalStates.sourceEngravingPose.sliderY,
      0.72,
    ), 5e-16, 'engraving piston-wrist mapping');
  vector3Near(engravingPointToModelFront(plate.rasterGuideCenterA),
    new THREE.Vector3(0, geometry.guideY, 0.72), 0,
    'engraving guide-A mapping');
  near(plate.rasterCrankCenter.distanceTo(plate.rasterCrankPin)
    * geometry.engravingScale, geometry.crankRadius, 0,
  'engraving crank-radius scale');
  near(plate.rasterCrankPin.distanceTo(plate.rasterPistonWrist)
    * geometry.engravingScale, geometry.connectingRodLength, 0,
  'engraving connecting-rod scale');
  near(sourceReference.normalizedEngravingGeometry.forkStartFraction,
    geometry.forkStartFraction, 0, 'engraving fork transition fraction');
  assert.equal(sourceReference.normalizedEngravingGeometry
    .guideAIsCollinearWithCylinder, true);
  disposeModel(model.root);
});

test('movement 330 solves its offset crank, finite rod, and dead centers exactly', () => {
  const model = createMovementModel(catalog.movements[329]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 4096);
    near(state.crankPin.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 7e-16, `crank radius at ${sample}`);
    near(state.rodLength, geometry.connectingRodLength, 9e-16,
      `finite connecting-rod length at ${sample}`);
    near(state.rodLengthResidual, 0, 9e-16,
      `connecting-rod closure at ${sample}`);
    vector2Near(state.rodVector,
      state.wristPin.clone().sub(state.crankPin), 0,
    `rod endpoint vector at ${sample}`);
    near(state.wristPin.x, geometry.pistonAxisX, 0,
      `piston axis at ${sample}`);
    near(state.pistonAxisResidual, 0, 0,
      `piston-axis residual at ${sample}`);
    near(state.pistonRotation, 0, 0,
      `zero piston yaw at ${sample}`);
    near(state.circleLineRadicand,
      geometry.connectingRodLength ** 2
        - (geometry.pistonAxisX - state.crankPin.x) ** 2,
    0, `circle-line closure radicand at ${sample}`);
  }

  near(canonicalStates.upperDeadCenter.sliderY,
    geometry.upperDeadCenterY, 9e-16, 'analytic upper dead center');
  near(canonicalStates.lowerDeadCenter.sliderY,
    geometry.lowerDeadCenterY, 9e-16, 'analytic lower dead center');
  near(canonicalStates.upperDeadCenter.sliderY
    - canonicalStates.lowerDeadCenter.sliderY,
  geometry.pistonStroke, 9e-16, 'offset-crank piston stroke');
  near(geometry.upperDeadCenterY,
    geometry.crankCenter.y - Math.sqrt(
      (geometry.connectingRodLength - geometry.crankRadius) ** 2
        - geometry.crankOffset ** 2,
    ), 0, 'near collinear closure');
  near(geometry.lowerDeadCenterY,
    geometry.crankCenter.y - Math.sqrt(
      (geometry.connectingRodLength + geometry.crankRadius) ** 2
        - geometry.crankOffset ** 2,
    ), 0, 'far collinear closure');
  disposeModel(model.root);
});

test('movement 330 keeps the prolonged rod inside collinear guide A', () => {
  const model = createMovementModel(catalog.movements[329]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.guideA.userData.fixed, true);
  assert.equal(blocks.guideA.userData.axisX, geometry.pistonAxisX);
  assert.equal(blocks.guideCollar.userData.innerRadius,
    geometry.guideInnerRadius);
  assert.equal(contacts.pistonRodInGuideA.type,
    'one-axis-prismatic-guide');
  near(contacts.pistonRodInGuideA.radialClearance, 0.027, 2e-17,
    'real guide-collar radial clearance');
  near(blocks.cylinderBody.position.x, geometry.pistonAxisX, 0,
    'cylinder centerline');
  near(blocks.guideA.position.x, geometry.pistonAxisX, 0,
    'guide-A centerline');

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 4096);
    near(state.guide.axisResidual, 0, 0,
      `guide-axis residual at ${sample}`);
    near(state.guide.rodRotation, 0, 0,
      `guide prevents rod yaw at ${sample}`);
    near(state.guide.innerRadius, geometry.guideInnerRadius, 0,
      `guide bore radius at ${sample}`);
    near(state.guide.radialClearance,
      contacts.pistonRodInGuideA.radialClearance, 0,
    `guide clearance at ${sample}`);
    assert.ok(state.guide.extensionTopAboveGuide > 0.34,
      `prolonged rod reaches above guide A at ${sample}`);
    assert.ok(state.guide.extensionBottomBelowGuide > 2.83,
      `same rod continues below guide A at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 330 fork gives the piston rod real clearance in depth', () => {
  const model = createMovementModel(catalog.movements[329]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;

  assert.equal(blocks.forkProngs.length, 2);
  assert.equal(blocks.forkBranches.length, 2);
  assert.equal(blocks.forkWristAnchors.length, 2);
  assert.equal(blocks.forkWristEyes.length, 4);
  near(geometry.forkDepthClearance,
    geometry.forkHalfSpacing - geometry.forkProngDepth / 2
      - geometry.pistonRodDepth / 2,
  0, 'surface-to-surface fork clearance');
  assert.ok(geometry.forkDepthClearance > 0.15);
  near(blocks.forkProngs[0].position.z,
    -geometry.forkHalfSpacing, 0, 'rear prong plane');
  near(blocks.forkProngs[1].position.z,
    geometry.forkHalfSpacing, 0, 'front prong plane');
  near(blocks.pistonRod.position.z, geometry.connectingRodPlaneZ, 0,
    'piston rod occupies the fork mid-plane');

  for (const time of [0, 0.31, 0.84, 1.56, 2.27, 3.13, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    const center = new THREE.Vector3(
      state.wristPin.x,
      state.wristPin.y,
      geometry.connectingRodPlaneZ,
    );
    vector3Near(blocks.forkCenterWristAnchor.getWorldPosition(
      new THREE.Vector3()), center, 1.3e-15,
    `fork center wrist at ${time}`);
    for (const [index, side] of [-1, 1].entries()) {
      vector3Near(blocks.forkWristAnchors[index].getWorldPosition(
        new THREE.Vector3()), new THREE.Vector3(
        state.wristPin.x,
        state.wristPin.y,
        geometry.connectingRodPlaneZ + side * geometry.forkHalfSpacing,
      ), 1.3e-15, `${side < 0 ? 'rear' : 'front'} fork wrist at ${time}`);
    }
    near(state.fork.separation, geometry.forkHalfSpacing * 2, 0,
      `fork separation at ${time}`);
    near(state.fork.depthClearance, geometry.forkDepthClearance, 0,
      `fork clearance at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 330 analytic crank, rod, and piston rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[329]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.11, 0.47, 1.03, 1.72, 2.19, 2.83, 3.61]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    vector2Near(after.crankPin.clone().sub(before.crankPin)
      .multiplyScalar(1 / (2 * step)), state.crankPinVelocity,
    2e-10, `crank-pin velocity at ${time}`);
    vector2Near(after.crankPinVelocity.clone()
      .sub(before.crankPinVelocity).multiplyScalar(1 / (2 * step)),
    state.crankPinAcceleration, 4e-10,
    `crank-pin acceleration at ${time}`);
    near((after.sliderY - before.sliderY) / (2 * step),
      state.sliderVelocityY, 8e-11,
    `piston velocity at ${time}`);
    near((after.sliderVelocityY - before.sliderVelocityY)
      / (2 * step), state.sliderAccelerationY, 3e-10,
    `piston acceleration at ${time}`);
    near((after.rodAngle - before.rodAngle) / (2 * step),
      state.rodAngularVelocity, 5e-11,
    `forked-rod angular velocity at ${time}`);
    near((after.rodAngularVelocity - before.rodAngularVelocity)
      / (2 * step), state.rodAngularAcceleration, 8e-11,
    `forked-rod angular acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 330 renderer binds the crank, fork, guide, and piston in 3D', () => {
  const model = createMovementModel(catalog.movements[329]);
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
  model.root.updateMatrixWorld(true);
  const fixedFrameMatrix = blocks.fixedFrame.matrixWorld.clone();
  const guideMatrix = blocks.guideA.matrixWorld.clone();
  for (const time of [0, 0.29, 0.91, 1.48, 2.05, 2.72, 3.39, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.crankRotor.rotation.z, state.crankAngle, 0,
      `rendered crank angle at ${time}`);
    vector3Near(blocks.forkedConnectingRod.position,
      new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.connectingRodPlaneZ,
      ), 0, `rendered fork origin at ${time}`);
    near(blocks.forkedConnectingRod.rotation.z, state.rodAngle, 0,
      `rendered fork angle at ${time}`);
    vector3Near(blocks.pistonAssembly.position,
      new THREE.Vector3(geometry.pistonAxisX, state.sliderY, 0), 0,
    `rendered piston translation at ${time}`);
    near(blocks.pistonAssembly.rotation.z, 0, 0,
      `rendered piston yaw at ${time}`);
    vector3Near(blocks.crankPinAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.crankPin.x,
      state.crankPin.y,
      geometry.connectingRodPlaneZ,
    ), 7e-16, `rendered crank-pin anchor at ${time}`);
    vector3Near(blocks.forkCrankAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.crankPin.x,
      state.crankPin.y,
      geometry.connectingRodPlaneZ,
    ), 0, `rendered fork crank eye at ${time}`);
    vector3Near(blocks.pistonWristAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      geometry.pistonAxisX,
      state.sliderY,
      geometry.connectingRodPlaneZ,
    ), 0, `rendered piston wrist at ${time}`);
    vector3Near(contacts.crankPinToForkedRod.point,
      new THREE.Vector3(
        state.crankPin.x,
        state.crankPin.y,
        geometry.connectingRodPlaneZ,
      ), 0, `rendered crank contact at ${time}`);
    vector3Near(contacts.forkedRodToPistonCrosshead.point,
      new THREE.Vector3(
        geometry.pistonAxisX,
        state.sliderY,
        geometry.connectingRodPlaneZ,
      ), 0, `rendered forked wrist contact at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
    assert.ok(blocks.guideA.matrixWorld.equals(guideMatrix));
  }

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.y > 8.8);
  assert.ok(size.z > 2,
    'bearing, crank, depth fork, piston, and frame are spatially separated');
  // Brown's side view looks along the crank plane, so the camera faces +x.
  assert.ok(model.cameraDirection.x > 10 * Math.abs(model.cameraDirection.z));
  assert.ok(model.cameraDirection.y > 0);
  const crop = model.root.userData.cameraFitBounds;
  const columnBox = new THREE.Box3().setFromObject(blocks.frameColumn);
  const flywheelBox = new THREE.Box3().setFromObject(blocks.flywheelRim);
  const cylinderTopBox = new THREE.Box3().setFromObject(blocks.cylinderTop);
  assert.ok(columnBox.max.z < geometry.connectingRodPlaneZ
    && columnBox.min.z > flywheelBox.max.z,
    'plate order: fork, column, flywheel along the shaft');
  assert.ok(crop.min.z < flywheelBox.min.z && crop.max.z > geometry.connectingRodPlaneZ);
  assert.ok(crop.min.y < flywheelBox.min.y && crop.max.y < flywheelBox.max.y,
    'only the flywheel lower rim is inside the plate');
  assert.ok(crop.min.y < cylinderTopBox.min.y
    && crop.min.y > new THREE.Box3().setFromObject(blocks.cylinderBody).min.y,
    'plate shows only the cylinder top');

  const model329 = createMovementModel(catalog.movements[328]);
  assert.equal(model329.root.userData.fidelity, 'authored');
  assert.notEqual(model329.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model329.root.userData.blocks.planetGearB.userData.teeth, 24);
  assert.equal(model.root.userData.blocks.forkProngs.length, 2);
  disposeModel(model329.root);
  disposeModel(model.root);
});

test('movement 330 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[329]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'demonstration phase closure');
  near(closure.crankAngle, start.crankAngle, 0,
    'crank closure');
  vector2Near(closure.crankPin, start.crankPin, 0,
    'crank-pin closure');
  vector2Near(closure.wristPin, start.wristPin, 0,
    'piston-wrist closure');
  near(closure.rodAngle, start.rodAngle, 0,
    'forked-rod closure');
  near(closure.sliderY, start.sliderY, 0,
    'piston closure');
  near(closure.unwrappedCrankAngle,
    geometry.initialCrankAngle + Math.PI * 2, 0,
  'one unwrapped crank turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.crankRotor.rotation.z, start.crankAngle, 0,
    'rendered crank closure');
  vector3Near(blocks.pistonAssembly.position,
    new THREE.Vector3(0, start.sliderY, 0), 0,
  'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
