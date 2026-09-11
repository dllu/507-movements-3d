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

test('movement 329 is the fixed-annulus epicyclic piston-rod guide', () => {
  const movement = catalog.movements[328];
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

  assert.equal(movement.id, 329);
  assert.equal(movement.number, '329');
  assert.match(movement.title, /^piston-rod guide/);
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'fixed-annulus-planet-wrist-straight-line-piston-guide');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fixed-48-tooth-annulus-D/);
  assert.match(mechanism, /24-tooth-planet-B/);
  assert.match(mechanism, /opposite-radius-four-wrist/);
  assert.match(transmission.input, /plate C/);
  assert.match(transmission.output, /x = 0/);
  assert.equal(transmission.outputStrokeSourceUnits, 16);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.equal(degreesOfFreedom.pistonRodTranslationAxes, 1);
  assert.equal(degreesOfFreedom.pistonRodRotation, 0);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.fixedRingD.parent, blocks.fixedFrame);
  assert.equal(blocks.annulusOuterBand.parent, blocks.fixedFrame);
  assert.equal(blocks.centralBearing.parent, blocks.fixedFrame);
  assert.equal(blocks.cylinderBody.parent, blocks.fixedFrame);
  assert.equal(blocks.inputCarrierC.parent, model.root);
  assert.equal(blocks.flywheelRim.parent, blocks.inputCarrierC);
  assert.equal(blocks.carrierCrankArmC.parent, blocks.inputCarrierC);
  assert.equal(blocks.carrierCrankPin.parent, blocks.inputCarrierC);
  assert.equal(blocks.inputShaft.parent, blocks.inputCarrierC);
  assert.equal(blocks.planetGearB.parent, model.root);
  assert.equal(blocks.planetCenterAnchor.parent, blocks.planetGearB);
  assert.equal(blocks.planetWristPin.parent, blocks.planetGearB);
  assert.equal(blocks.planetWristAnchor.parent, blocks.planetGearB);
  assert.equal(blocks.pistonAssembly.parent, model.root);
  assert.equal(blocks.pistonRodA.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonHead.parent, blocks.pistonAssembly);
  assert.equal(blocks.pistonWristAnchor.parent, blocks.pistonAssembly);
  assert.equal(contacts.planetWheelBToFixedInternalGearD.fixedMember,
    blocks.fixedRingD);
  assert.equal(contacts.planetWheelBToFixedInternalGearD.movingMember,
    blocks.planetGearB);
  assert.equal(contacts.wheelBWristToPistonRodA.wheelMember,
    blocks.planetGearB);
  assert.equal(contacts.wheelBWristToPistonRodA.pistonMember,
    blocks.pistonAssembly);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /stationary-forty-eight-tooth.*gear-D/.test(role)).length, 1);
  assert.equal(roles.filter((role) =>
    /orbiting-twenty-four-tooth.*wheel-B/.test(role)).length, 1);
  assert.equal(roles.filter((role) =>
    /plate-C-rigid-flywheel-spoke-/.test(role)).length, 4);
  assert.equal(roles.filter((role) =>
    role === 'source-dimension-vertical-piston-rod-A').length, 1);
  assert.equal(roles.some((role) =>
    /connecting-rod|generic|procedural|slider-crank/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 329 preserves the official dimensions, transforms, and view', () => {
  const movement = catalog.movements[328];
  const model = createMovementModel(movement);
  const {
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
    carrierCrankRadius: 4,
    fixedRingOuterRadius: 9,
    fixedRingPitchRadius: 8,
    fixedRingTeeth: 48,
    flywheelInnerRadius: 13.5,
    flywheelOuterRadius: 15,
    pistonHeadBottomLocalY: -23.5,
    pistonHeadTopLocalY: -22.5,
    pistonRodBottomLocalY: -22.5,
    pistonRodHalfWidth: 0.375,
    pistonRodTopLocalY: -0.927025,
    planetPitchRadius: 4,
    planetTeeth: 24,
    planetWristRadius: 4,
  });
  assert.deepEqual(sourceAnimation.officialKeyframes.map(({ phase }) =>
    phase), [0, 0.25, 0.5, 0.75, 1]);
  vector2Near(sourceAnimation.officialKeyframes[0].planetCenter,
    new THREE.Vector2(4, 0), 0, 'official initial planet center');
  vector2Near(sourceAnimation.officialKeyframes[0].pistonWrist,
    new THREE.Vector2(0, 0), 0, 'official initial piston wrist');
  vector2Near(sourceAnimation.officialKeyframes[1].planetCenter,
    new THREE.Vector2(0, 4), 3e-16, 'official upper planet center');
  vector2Near(sourceAnimation.officialKeyframes[1].pistonWrist,
    new THREE.Vector2(0, 8), 0, 'official upper dead center');
  vector2Near(sourceAnimation.officialKeyframes[3].planetCenter,
    new THREE.Vector2(0, -4), 8e-16, 'official lower planet center');
  vector2Near(sourceAnimation.officialKeyframes[3].pistonWrist,
    new THREE.Vector2(0, -8), 0, 'official lower dead center');
  near(sourceAnimation.officialKeyframes[1].carrierAngle,
    Math.PI / 2, 0, 'official quarter-turn carrier');
  near(sourceAnimation.officialKeyframes[1].planetAngle,
    Math.PI * 3 / 2, 0, 'official opposite planet rotation');
  assert.match(sourceAnimation.referenceScope, /24-tooth radius-4 wheel B/);
  assert.match(sourceAnimation.referenceScope, /fixed 48-tooth radius-8/);
  assert.match(sourceAnimation.sourceNote, /circular plate C/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_329.html');

  assert.deepEqual(sourceReference.officialAnimationView, {
    canvasHeight: 525,
    canvasWidth: 525,
    minimum: new THREE.Vector2(-16.5, -17.297248),
    viewHeight: 33,
    viewWidth: 33,
  });
  const originRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(),
  );
  near(originRaster.x, 262.5, 0,
    'official fixed-annulus center raster x');
  near(originRaster.y,
    525 - 17.297248 * 525 / 33, 0,
  'official fixed-annulus center raster y');
  const upperWristRaster = modelPointToOfficialAnimationRaster(
    new THREE.Vector2(0, 8 * 0.21),
  );
  near(upperWristRaster.x, originRaster.x, 0,
    'official wrist remains on raster centerline');
  near(upperWristRaster.y, originRaster.y - 8 * 525 / 33, 1e-13,
    'official upper wrist raster y');

  assert.deepEqual(sourceReference.officialAnimationImplementation, {
    carrierTransform: 'rotation +cyclePos about [0, 0]',
    pistonTransform: 'translation to wheel B crank_pin',
    planetTransform:
      'rotation -cyclePos about carrier crank_pin [4, 0]',
    planetWristLocal: new THREE.Vector2(-4, 0),
  });
  const plate = sourceReference.brownPlate329;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 32);
  assert.deepEqual(plate.rasterFixedRingCenterD,
    new THREE.Vector2(264, 236));
  assert.deepEqual(plate.rasterPlanetCenterB,
    new THREE.Vector2(214, 194));
  assert.deepEqual(plate.rasterPistonWristA,
    new THREE.Vector2(264, 153));
  assert.match(plate.inferredTopology, /opposite pitch-circle wrist/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    edition: 21,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 329 has an exact common-module 24:48 internal gear mesh', () => {
  const model = createMovementModel(catalog.movements[328]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const ring = blocks.fixedRingD;
  const planet = blocks.planetGearB;

  assert.equal(ring.userData.teeth, 48);
  assert.equal(planet.userData.teeth, 24);
  assert.equal(ring.userData.toothProfile, 'true-involute-internal');
  assert.equal(planet.userData.toothProfile, 'true-involute');
  near(ring.userData.pitchRadius, geometry.fixedRingPitchRadius, 0,
    'fixed ring pitch radius');
  near(planet.userData.pitchRadius, geometry.planetPitchRadius, 0,
    'planet pitch radius');
  near(ring.userData.module, planet.userData.module, 0,
    'common ring/planet module');
  near(ring.userData.circularPitch,
    Math.PI * planet.userData.module, 0, 'common circular pitch');
  near(ring.userData.pitchRadius / planet.userData.pitchRadius, 2, 0,
    'double-diameter fixed annulus');
  near(ring.userData.teeth / planet.userData.teeth, 2, 0,
    'double tooth-count fixed annulus');
  near(geometry.carrierCrankRadius,
    geometry.fixedRingPitchRadius - geometry.planetPitchRadius, 0,
  'internal-mesh carrier center distance');
  assert.ok(
    geometry.carrierCrankRadius + planet.userData.outerRadius
      <= ring.userData.rootRadius,
    'planet tooth tips fit the annulus root spaces',
  );
  assert.ok(
    ring.userData.tipRadius - geometry.carrierCrankRadius
      >= planet.userData.rootRadius,
    'annulus tooth tips fit the planet root spaces',
  );
  assert.equal(ring.userData.rotor.children.length, 1,
    'annulus is one continuous involute tooth solid');
  assert.equal(contacts.planetWheelBToFixedInternalGearD.type,
    'internal-involute-gear-mesh');
  assert.equal(ring.userData.fixed, true);

  for (let sample = 0; sample <= 4096; sample += 1) {
    const state = stateAtTime(geometry.cyclePeriod * sample / 4096);
    near(state.mesh.centerDistance, geometry.carrierCrankRadius, 5e-16,
      `planet orbit radius at ${sample}`);
    near(state.mesh.centerDistanceResidual, 0, 2e-16,
      `internal center-distance residual at ${sample}`);
    near(state.planetAngularVelocity,
      -state.carrierAngularVelocity, 0,
    `opposite carrier/planet speed at ${sample}`);
    near(state.planetUnwrappedAngle,
      -state.unwrappedCarrierAngle, 0,
    `opposite carrier/planet phase at ${sample}`);
    near(state.mesh.meshPhaseInvariant, 0, 0,
      `24:48 epicyclic mesh invariant at ${sample}`);
    vector2Near(state.mesh.planetPitchPoint,
      state.mesh.pitchContactPoint, 5e-16,
    `shared internal pitch point at ${sample}`);
    vector2Near(state.mesh.pitchPointResidual,
      new THREE.Vector2(), 5e-16,
    `pitch-point residual at ${sample}`);
    vector2Near(state.mesh.planetContactVelocity,
      state.mesh.fixedRingContactVelocity, 5e-16,
    `zero relative pitch velocity at ${sample}`);
    vector2Near(state.mesh.slipVelocity,
      new THREE.Vector2(), 5e-16, `zero pitch-line slip at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 329 makes the planet wrist trace one exact straight line', () => {
  const model = createMovementModel(catalog.movements[328]);
  const {
    canonicalStates,
    geometry,
    stateAtTime,
  } = model.root.userData;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const time = geometry.cyclePeriod * sample / 8192;
    const state = stateAtTime(time);
    const expectedCenter = new THREE.Vector2(
      Math.cos(state.carrierAngle),
      Math.sin(state.carrierAngle),
    ).multiplyScalar(geometry.carrierCrankRadius);
    const expectedLocalWrist = new THREE.Vector2(
      -geometry.planetPitchRadius,
      0,
    ).rotateAround(new THREE.Vector2(), state.planetAngle);
    const expectedWrist = expectedCenter.clone().add(expectedLocalWrist);
    vector2Near(state.planetCenter, expectedCenter, 0,
      `carrier crank-pin closure at ${sample}`);
    vector2Near(state.wristRadiusVector, expectedLocalWrist, 8e-16,
      `wheel-B local wrist transform at ${sample}`);
    vector2Near(state.wristPin, expectedWrist, 9e-16,
      `wheel-B wrist location at ${sample}`);
    near(state.wristRadiusVector.length(), geometry.planetPitchRadius,
      5e-16, `four-unit wrist radius at ${sample}`);
    near(state.wristPin.x, 0, 0,
      `exact vertical piston axis at ${sample}`);
    near(state.pistonAxisResidual, 0, 0,
      `piston-axis residual at ${sample}`);
    near(state.pistonY,
      2 * geometry.carrierCrankRadius * Math.sin(state.carrierAngle),
    0, `sinusoidal straight output at ${sample}`);
    near(state.piston.rotation, 0, 0,
      `zero piston-rod yaw at ${sample}`);
  }

  near(canonicalStates.upperDeadCenter.pistonY,
    2 * geometry.carrierCrankRadius, 0, 'upper dead center');
  near(canonicalStates.lowerDeadCenter.pistonY,
    -2 * geometry.carrierCrankRadius, 0, 'lower dead center');
  near(canonicalStates.upperDeadCenter.pistonY
    - canonicalStates.lowerDeadCenter.pistonY,
  geometry.pistonStroke, 0, 'sixteen-source-unit piston stroke');
  near(geometry.pistonStroke / geometry.sourceScale, 16, 0,
    'source stroke is four carrier radii');
  disposeModel(model.root);
});

test('movement 329 analytic orbit and piston rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[328]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;

  for (const time of [0.13, 0.49, 0.92, 1.37, 2.16, 2.74, 3.58]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    vector2Near(after.planetCenter.clone().sub(before.planetCenter)
      .multiplyScalar(1 / (2 * step)), state.planetCenterVelocity,
    2e-10, `planet-center velocity at ${time}`);
    vector2Near(after.planetCenterVelocity.clone()
      .sub(before.planetCenterVelocity).multiplyScalar(1 / (2 * step)),
    state.planetCenterAcceleration, 4e-10,
    `planet-center acceleration at ${time}`);
    vector2Near(after.wristPin.clone().sub(before.wristPin)
      .multiplyScalar(1 / (2 * step)), state.wristVelocity,
    3e-10, `piston-wrist velocity at ${time}`);
    vector2Near(after.wristVelocity.clone().sub(before.wristVelocity)
      .multiplyScalar(1 / (2 * step)), state.wristAcceleration,
    7e-10, `piston-wrist acceleration at ${time}`);
    near((after.pistonY - before.pistonY) / (2 * step),
      state.pistonVelocityY, 3e-10,
    `piston velocity at ${time}`);
    near((after.pistonVelocityY - before.pistonVelocityY)
      / (2 * step), state.pistonAccelerationY, 7e-10,
    `piston acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 329 renderer carries B around D while A remains upright', () => {
  const model = createMovementModel(catalog.movements[328]);
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
  const fixedRingMatrix = blocks.fixedRingD.matrixWorld.clone();
  for (const time of [0, 0.23, 0.75, 1, 1.68, 2.5, 3, 3.73, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.inputCarrierC.rotation.z, state.carrierAngle, 0,
      `rendered carrier C angle at ${time}`);
    vector3Near(blocks.planetGearB.position,
      new THREE.Vector3(
        state.planetCenter.x,
        state.planetCenter.y,
        geometry.gearPlaneZ,
      ), 0, `rendered wheel B center at ${time}`);
    near(blocks.planetGearB.rotation.z, state.planetAngle, 0,
      `rendered wheel B spin at ${time}`);
    vector3Near(blocks.pistonAssembly.position,
      new THREE.Vector3(0, state.pistonY, 0), 0,
    `rendered piston assembly at ${time}`);
    near(blocks.pistonAssembly.rotation.z, 0, 0,
      `rendered piston remains upright at ${time}`);
    vector3Near(blocks.carrierCrankPinAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.planetCenter.x,
      state.planetCenter.y,
      geometry.gearPlaneZ,
    ), 7e-16, `rendered carrier pin at ${time}`);
    vector3Near(blocks.planetCenterAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.planetCenter.x,
      state.planetCenter.y,
      geometry.gearPlaneZ,
    ), 0, `rendered wheel B center anchor at ${time}`);
    vector3Near(blocks.planetWristAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      state.wristPin.x,
      state.wristPin.y,
      geometry.pistonPlaneZ,
    ), 8e-16, `rendered wheel B wrist at ${time}`);
    vector3Near(blocks.pistonWristAnchor.getWorldPosition(
      new THREE.Vector3()), new THREE.Vector3(
      0,
      state.pistonY,
      geometry.pistonPlaneZ,
    ), 0, `rendered piston A wrist at ${time}`);
    vector3Near(contacts.planetWheelBToFixedInternalGearD.pitchPoint,
      new THREE.Vector3(
        state.mesh.pitchContactPoint.x,
        state.mesh.pitchContactPoint.y,
        geometry.gearPlaneZ,
      ), 0, `rendered internal pitch contact at ${time}`);
    vector3Near(contacts.wheelBWristToPistonRodA.point,
      new THREE.Vector3(0, state.pistonY, geometry.pistonPlaneZ), 0,
    `rendered wheel/piston joint at ${time}`);
    vector2Near(contacts.planetWheelBToFixedInternalGearD.slipVelocity,
      new THREE.Vector2(), 5e-16,
    `rendered internal mesh slip at ${time}`);
    assert.ok(blocks.fixedFrame.matrixWorld.equals(fixedFrameMatrix));
    assert.ok(blocks.fixedRingD.matrixWorld.equals(fixedRingMatrix));
  }
  disposeModel(model.root);
});

test('movement 329 is a fully spatial engine distinct from Cartwright 328', () => {
  const model = createMovementModel(catalog.movements[328]);
  const { blocks, geometry } = model.root.userData;

  assert.equal(blocks.sideBearings.length, 2);
  assert.equal(blocks.supportLegs.length, 4);
  assert.equal(blocks.flywheelSpokes.length, 4);
  assert.equal(blocks.gland.parent, blocks.fixedFrame);
  assert.equal(blocks.cylinderTop.parent, blocks.fixedFrame);
  assert.equal(blocks.cylinderBase.parent, blocks.fixedFrame);
  assert.equal(blocks.wristBoss.parent, blocks.pistonAssembly);
  assert.equal(blocks.wristRing.parent, blocks.pistonAssembly);
  near(blocks.planetGearB.userData.toothIndexOffset,
    Math.PI / geometry.planetTeeth, 0,
  'planet tooth/gap phase at the source start');

  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > geometry.flywheelOuterRadius * 2);
  assert.ok(size.y > 8);
  assert.ok(size.z > 1.6,
    'rear flywheel, carrier, annulus, planet, and front piston use depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const model328 = createMovementModel(catalog.movements[327]);
  assert.equal(model328.root.userData.fidelity, 'authored');
  assert.notEqual(model328.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(model328.root.userData.blocks.leftWheelC.userData.teeth, 30);
  assert.equal(model.root.userData.blocks.fixedRingD.userData.teeth, 48);
  assert.equal(Object.keys(model328.root.userData.contacts).length, 2);
  assert.equal(Object.keys(model.root.userData.contacts).length, 3);
  disposeModel(model328.root);
  disposeModel(model.root);
});

test('movement 329 closes exactly and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[328]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'carrier phase closure');
  near(closure.carrierAngle, start.carrierAngle, 0,
    'carrier C closure');
  near(closure.planetAngle, start.planetAngle, 0,
    'planet B closure');
  vector2Near(closure.planetCenter, start.planetCenter, 0,
    'planet orbit closure');
  vector2Near(closure.wristPin, start.wristPin, 0,
    'piston wrist closure');
  near(closure.pistonY, start.pistonY, 0,
    'piston A closure');
  near(closure.unwrappedCarrierAngle, Math.PI * 2, 0,
    'one unwrapped carrier turn');
  near(closure.planetUnwrappedAngle, -Math.PI * 2, 0,
    'one opposite unwrapped planet turn');
  model.update(canonicalTimes.cycleClosure);
  near(blocks.inputCarrierC.rotation.z, 0, 0,
    'rendered carrier closure');
  near(blocks.planetGearB.rotation.z, 0, 0,
    'rendered planet closure');
  vector3Near(blocks.pistonAssembly.position,
    new THREE.Vector3(), 0, 'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
