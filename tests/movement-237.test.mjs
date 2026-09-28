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
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
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

test('movement 237 is one coaxial arm, one yielding pawl, and one twenty-tooth crown ratchet', () => {
  const movement = catalog.movements[236];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 237);
  assert.equal(movement.number, '237');
  assert.equal(movement.title, 'Top-Arm Crown Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'coaxial-vibrating-arm-pawl-twenty-tooth-crown-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.returnStrokeWheelDwell, true);
  assert.equal(transmission.pawlClimbsAxialRampOnReturn, true);
  assert.equal(transmission.noHoldingClickDepicted, true);
  near(transmission.outputTeethPerArmCycle, 1, 2e-15,
    'one crown pitch per arm cycle');
  assert.equal(blocks.crownWheel.parent, model.root);
  assert.equal(blocks.arm.parent, model.root);
  assert.equal(blocks.pawl.parent, blocks.arm.userData.rotor);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.crownWheel.userData.teeth, 20);
  assert.equal(blocks.crownWheel.userData.crownTeeth.length, 20);
  assert.equal(blocks.crownWheel.userData.driveFaceTicks.length, 20);
  let pawlCount = 0;
  let holdingClickCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role === 'single-vertically-yielding-crown-pawl') {
      pawlCount += 1;
    }
    if (/holding-click/.test(object.userData.role ?? '')) {
      holdingClickCount += 1;
    }
  });
  assert.equal(pawlCount, 1);
  assert.equal(holdingClickCount, 0);
  disposeModel(model.root);
});

test('movement 237 preserves the scanned layout, crown orientation, and source pose', () => {
  const model = createMovementModel(catalog.movements[236]);
  const {
    blocks,
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate237;

  assert.deepEqual(plate.rasterArmFulcrum.toArray(), [236, 195]);
  assert.deepEqual(plate.rasterPawlHinge.toArray(), [350, 125]);
  assert.deepEqual(plate.rasterPawlNose.toArray(), [387, 176]);
  assert.deepEqual(plate.rasterHandleEnd.toArray(), [422, 80]);
  assert.deepEqual(plate.rasterWheelLeft.toArray(), [87, 235]);
  assert.deepEqual(plate.rasterWheelRight.toArray(), [400, 226]);
  assert.deepEqual(plate.rasterOutputShaftBottom.toArray(), [239, 453]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredCrownTeeth, 20);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one coaxial reciprocating top arm/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  vectorNear(geometry.axis, new THREE.Vector3(0, 1, 0), 0,
    'vertical common axis');
  vectorNear(blocks.arm.userData.axis, geometry.axis, 0,
    'top arm axis');
  vectorNear(blocks.crownWheel.userData.axis, geometry.axis, 0,
    'crown-wheel axis');
  vectorNear(blocks.outputShaft.userData.axis, geometry.axis, 0,
    'output-shaft axis');
  near(geometry.toothPitch, FULL_TURN / 20, 0, 'twenty-tooth pitch');
  near(
    geometry.armHandleRadius / geometry.wheelOuterRadius,
    2.55 / 1.82,
    1e-15,
    'source handle-to-wheel proportion',
  );
  // A seated nose climbs the whole ramp on return: 1.8 pitches of swing.
  near(THREE.MathUtils.radToDeg(geometry.armSwing), 32.4, 2e-14,
    'one pitch plus return overtravel');
  // The nose seats in the root: it touches the face below a third of the
  // tooth height, just clear of the next ramp.
  assert.ok(geometry.pawlSeatHeight - geometry.wheelBaseHeight
    < geometry.wheelToothHeight / 3);
  near(
    geometry.crownMountPhase,
    geometry.highArmAngle
      + geometry.baseTipAngleOffset
      - geometry.faceContactOffset
      - geometry.overtravel,
    2e-16,
    'source drive-face mounting phase',
  );
  const source = stateAtCycleCoordinate(geometry.sourceCyclePhase);
  near(source.armAngle, 0, 2e-17, 'engraving arm pose');
  assert.equal(source.driveEngaged, true);
  assert.equal(source.stage, 'clockwise-drive-against-axial-face');
  // The seated pawl hangs steeply, so less of its thrust is tangential.
  assert.ok(source.driveCompressionTorque < -0.55);
  disposeModel(model.root);
});

test('movement 237 builds twenty rising axial ramps with radial drive faces', () => {
  const model = createMovementModel(catalog.movements[236]);
  const {
    blocks,
    crownSurfaceHeightAt,
    geometry,
  } = model.root.userData;
  const teeth = blocks.crownWheel.userData.crownTeeth;

  for (const [index, tooth] of teeth.entries()) {
    assert.equal(tooth.userData.index, index);
    assert.equal(tooth.userData.rampRisesCounterclockwise, true);
    near(
      tooth.userData.lowAngle,
      geometry.crownMountPhase + index * geometry.toothPitch,
      2e-15,
      `tooth ${index} low angle`,
    );
    near(
      tooth.userData.driveFaceAngle,
      geometry.crownMountPhase + (index + 1) * geometry.toothPitch,
      2e-15,
      `tooth ${index} radial face`,
    );
    // One curved wedge per pitch: helicoidal ramp, true-arc walls flush with
    // the cup (radii exactly the cup's), and the radial drive face.
    const positions = tooth.geometry.getAttribute('position');
    assert.ok(positions.count > 100);
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const radius = Math.hypot(positions.getX(vertex), positions.getY(vertex));
      assert.ok(Math.abs(radius - geometry.wheelOuterRadius) < 2e-6
        || Math.abs(radius - geometry.wheelInnerRadius) < 2e-6);
    }
    let minimumHeight = Infinity;
    let maximumHeight = -Infinity;
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      minimumHeight = Math.min(minimumHeight, positions.getZ(vertex));
      maximumHeight = Math.max(maximumHeight, positions.getZ(vertex));
    }
    near(minimumHeight, geometry.wheelBaseHeight, 2e-8,
      `tooth ${index} base`);
    near(maximumHeight, geometry.wheelTipHeight, 2e-8,
      `tooth ${index} tip`);
    const low = crownSurfaceHeightAt(
      tooth.userData.lowAngle + geometry.toothPitch * 0.001,
      0,
    );
    const middle = crownSurfaceHeightAt(
      tooth.userData.lowAngle + geometry.toothPitch * 0.5,
      0,
    );
    const high = crownSurfaceHeightAt(
      tooth.userData.lowAngle + geometry.toothPitch * 0.999,
      0,
    );
    assert.ok(low.height < middle.height);
    assert.ok(middle.height < high.height);
    near(middle.height, geometry.wheelToothHeight / 2, 3e-15,
      `tooth ${index} half-height ramp`);
  }
  disposeModel(model.root);
});

test('movement 237 approaches, contacts, and drives exactly one clockwise crown pitch', () => {
  const model = createMovementModel(catalog.movements[236]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const samples = 32_768;
  let previousWheelAngle = 0;
  let maximumClockwiseSpeed = 0;
  let approachSamples = 0;
  let driveSamples = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const coordinate = 0.5 * sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(state.pawlLengthError < 4e-15);
    assert.ok(state.wheelAngle <= previousWheelAngle + 2e-14);
    assert.ok(state.wheelAngularSpeed <= 2e-13);
    assert.equal(state.activeToothIndex, 0);
    if (state.driveEngaged) {
      driveSamples += 1;
      assert.equal(state.stage, 'clockwise-drive-against-axial-face');
      near(state.faceTangentDistance, geometry.pawlNoseRadius, 7e-16,
        `face normal contact at ${coordinate}`);
      assert.ok(Math.abs(state.driveContactCenterError) < 8e-16);
      assert.ok(state.driveNormalVelocityError < 5e-15);
      assert.ok(state.driveCompressionTorque < -0.55);
      near(
        state.wheelAngle,
        -(state.driveTravel - geometry.overtravel),
        3e-15,
        `one-to-one loaded stroke at ${coordinate}`,
      );
      maximumClockwiseSpeed = Math.max(
        maximumClockwiseSpeed,
        -state.wheelAngularSpeed,
      );
    } else {
      approachSamples += 1;
      assert.equal(state.stage, 'clockwise-lost-motion-approach');
      // The nose rides down the ramp into the root before the face.
      assert.equal(state.pawlMode, 'pawl-riding-down-ramp-into-root');
      assert.ok(state.pawlLiftAngle >= 0);
      near(state.wheelAngle, 0, 0, `approach dwell at ${coordinate}`);
      near(state.wheelAngularSpeed, 0, 0,
        `approach output speed at ${coordinate}`);
    }
    previousWheelAngle = state.wheelAngle;
  }
  assert.ok(approachSamples > 10_000);
  assert.ok(driveSamples > 10_000);
  assert.ok(maximumClockwiseSpeed > 0.34);
  assert.ok(timeline.driveContactPhase > 0.22);
  assert.ok(timeline.driveContactPhase < 0.24);
  near(stateAtCycleCoordinate(0.5).wheelAngle, -geometry.toothPitch, 2e-15,
    'loaded stroke advances one pitch');
  disposeModel(model.root);
});

test('movement 237 return pawl remains rigid and clears or follows every crown ramp', () => {
  const model = createMovementModel(catalog.movements[236]);
  const {
    geometry,
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const samples = 65_536;
  const modes = new Set();
  let previousTip = null;
  let maximumTipStep = 0;
  let maximumClearance = 0;
  let maximumLift = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const coordinate = 0.5 + 0.5 * sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    modes.add(state.pawlMode);
    near(state.wheelAngle, -geometry.toothPitch, 2e-15,
      `return dwell angle at ${coordinate}`);
    near(state.wheelAngularSpeed, 0, 0,
      `return dwell speed at ${coordinate}`);
    assert.ok(state.pawlLengthError < 4e-15);
    assert.ok(state.resetProfileClearance >= -2e-8,
      `clearance ${state.resetProfileClearance} at ${coordinate}`);
    if (state.rampContactEngaged) {
      assert.ok(Math.abs(state.resetProfileClearance) < 0.00021);
      assert.ok(state.returnConstraintVelocityError < 0.09);
    }
    if (previousTip) {
      maximumTipStep = Math.max(
        maximumTipStep,
        state.tipWorld.distanceTo(previousTip),
      );
    }
    previousTip = state.tipWorld;
    maximumClearance = Math.max(maximumClearance, state.resetProfileClearance);
    maximumLift = Math.max(maximumLift, state.pawlLiftAngle);
  }
  assert.deepEqual(modes, new Set([
    'clear-over-low-crown-ramp',
    'pawl-climbing-crown-ramp',
    // Near the crest the lifted plate's edge rides the tooth's top corner.
    'pawl-edge-riding-crown-crest',
    'pawl-prescribed-crest-clearance-and-drop',
  ]));
  assert.ok(maximumTipStep < 5e-5,
    `return nose maximum sample step ${maximumTipStep}`);
  // The drop clears the crest by about 0.1 before landing on the next ramp.
  assert.ok(maximumClearance > 0.09);
  near(
    stateAtCycleCoordinate(timeline.faceReleasePhase).pawlLiftAngle,
    geometry.peakLiftAngle,
    2e-14,
    'pawl reaches the crown crest',
  );
  assert.ok(maximumLift >= geometry.peakLiftAngle - 1e-14);
  assert.ok(maximumLift < geometry.peakLiftAngle + 0.006);
  near(stateAtCycleCoordinate(0.5).pawlLiftAngle, 0, 0,
    'pawl starts return seated');
  // The return ends with the nose dropped onto the next ramp; the drive
  // stroke's approach rides it down into the root, seated at the face.
  near(stateAtCycleCoordinate(1 - 1e-9).pawlLiftAngle,
    stateAtCycleCoordinate(1).pawlLiftAngle, 1e-6,
    'pawl lands on the next ramp where the approach begins');
  assert.ok(stateAtCycleCoordinate(1).pawlLiftAngle > 0.2);
  near(stateAtCycleCoordinate(timeline.driveContactPhase).pawlLiftAngle, 0, 1e-9,
    'pawl seated in the root when it meets the face');
  const beforeRelease = stateAtCycleCoordinate(
    timeline.faceReleasePhase - 1e-8,
  );
  const afterRelease = stateAtCycleCoordinate(
    timeline.faceReleasePhase + 1e-8,
  );
  near(beforeRelease.pawlLiftAngle, afterRelease.pawlLiftAngle, 4e-8,
    'continuous lift through crown-face release');
  near(
    beforeRelease.pawlLiftAngularSpeed,
    afterRelease.pawlLiftAngularSpeed,
    2e-6,
    'continuous pawl speed through crown-face release',
  );
  disposeModel(model.root);
});

test('movement 237 analytic arm, wheel, pawl, and nose speeds match finite differences', () => {
  const model = createMovementModel(catalog.movements[236]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const coordinateStep = 1e-6;
  const secondsPerCoordinate = 1 / geometry.cyclesPerSecond;
  const scalarSpeedAt = (coordinate, key) => (
    stateAtCycleCoordinate(coordinate + coordinateStep)[key]
      - stateAtCycleCoordinate(coordinate - coordinateStep)[key]
  ) / (2 * coordinateStep * secondsPerCoordinate);
  const vectorSpeedAt = (coordinate, key) => (
    stateAtCycleCoordinate(coordinate + coordinateStep)[key].clone()
      .sub(stateAtCycleCoordinate(coordinate - coordinateStep)[key])
      .multiplyScalar(1 / (2 * coordinateStep * secondsPerCoordinate))
  );
  for (const coordinate of [0.05, 0.12, 0.24, 0.34, 0.44,
    0.6, 0.68, 0.76, 0.82, 0.86, 0.9, 0.96]) {
    const state = stateAtCycleCoordinate(coordinate);
    near(state.armAngularSpeed, scalarSpeedAt(coordinate, 'armAngle'), 2e-8,
      `arm speed at ${coordinate}`);
    near(state.wheelAngularSpeed,
      scalarSpeedAt(coordinate, 'wheelAngle'), 2e-8,
      `wheel speed at ${coordinate}`);
    // The baked lift is a C1 monotone Hermite; central differences across its
    // knots differ from the analytic slope by up to about 1e-5 relative.
    near(state.pawlLiftAngularSpeed,
      scalarSpeedAt(coordinate, 'pawlLiftAngle'), 1e-5,
      `pawl lift speed at ${coordinate}`);
    vectorNear(state.tipVelocity, vectorSpeedAt(coordinate, 'tipWorld'), 1e-5,
      `pawl nose velocity at ${coordinate}`);
  }
  disposeModel(model.root);
});

test('movement 237 accumulates one-way indexes and closes after twenty arm cycles', () => {
  const model = createMovementModel(catalog.movements[236]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  let previousWheelAngle = stateAtCycleCoordinate(0).wheelAngle;
  let dwellSamples = 0;
  for (let sample = 1; sample <= 65_536; sample += 1) {
    const state = stateAtCycleCoordinate(2 * sample / 65_536);
    assert.ok(state.wheelAngle <= previousWheelAngle + 3e-14,
      `no output reversal at sample ${sample}`);
    if (state.wheelDwelling) dwellSamples += 1;
    previousWheelAngle = state.wheelAngle;
  }
  assert.ok(dwellSamples > 40_000,
    `intermittent dwell samples ${dwellSamples}`);
  for (let cycle = 0; cycle <= 40; cycle += 1) {
    near(
      stateAtCycleCoordinate(cycle).wheelAngle,
      -cycle * geometry.toothPitch,
      3e-14,
      `accumulated tooth index ${cycle}`,
    );
  }
  near(stateAtCycleCoordinate(20).wheelAngle, -FULL_TURN, 3e-14,
    'twenty arm cycles close one wheel revolution');
  near(stateAtCycleCoordinate(40).wheelAngle, -2 * FULL_TURN, 6e-14,
    'forty arm cycles close two wheel revolutions');
  disposeModel(model.root);
});

test('movement 237 renderer binds the coaxial rotors and closes before movement 339', () => {
  const model = createMovementModel(catalog.movements[236]);
  const {
    animationTiming,
    blocks,
    transmission,
  } = model.root.userData;

  for (const time of [0, 0.5, 1, 1.5, 2, 3, 4]) {
    model.update(time);
    const state = model.root.userData.kinematics;
    near(blocks.arm.userData.rotor.rotation.z, state.armAngle, 0,
      `rendered arm at ${time}`);
    near(blocks.crownWheel.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered crown wheel at ${time}`);
    near(blocks.outputShaft.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered output shaft at ${time}`);
    near(blocks.pawl.rotation.x, -state.pawlLiftAngle, 0,
      `rendered yielding pawl at ${time}`);
    assert.equal(blocks.driveContactMarker.visible, state.driveEngaged);
    assert.equal(blocks.rampContactMarker.visible, state.rampContactEngaged);
    model.root.updateMatrixWorld(true);
    vectorNear(
      blocks.pawlTipMarker.getWorldPosition(new THREE.Vector3()),
      state.tipWorld,
      5e-15,
      `rendered pawl nose at ${time}`,
    );
  }
  assert.equal(animationTiming.authoredCyclePeriod, transmission.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.ok(animationTiming.displayCycleDuration >= 4);
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  // Thin open cup (outer radius 1.64) and the plate's 1.40 handle proportion.
  assert.ok(size.x > 3.9);
  assert.ok(size.y > 2.8);
  assert.ok(size.z > 3.5);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 54);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});

test('movement 237 p92: the arm is a round rod on the pawl hinge axis, centred in the barrel', () => {
  const model = createMovementModel(catalog.movements[236]);
  const { blocks } = model.root.userData;
  const barrel = blocks.pawlHingeBarrel;
  const barrelRadius = barrel.geometry.parameters.radiusTop;
  const halfLength = barrel.geometry.parameters.height / 2;
  const axisX = barrel.position.x;
  const armMeshes = [];
  blocks.arm.userData.rotor.traverse((object) => {
    if (object.isMesh && object.userData.role === 'source-radial-top-arm-and-handle') armMeshes.push(object);
  });
  assert.equal(armMeshes.length, 3);
  for (const rod of armMeshes) {
    assert.equal(rod.geometry.type, 'CylinderGeometry');
    const radius = rod.geometry.parameters.radiusTop;
    assert.ok(radius <= 0.7 * barrelRadius, `rod ${radius} vs barrel ${barrelRadius}`);
    // The rod's centreline and surface where it crosses each barrel face.
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(rod.quaternion);
    for (const face of [axisX - halfLength, axisX + halfLength]) {
      const t = (face - rod.position.x) / direction.x;
      if (Math.abs(t) > rod.geometry.parameters.height / 2) continue;
      const offset = Math.hypot(rod.position.y + t * direction.y, rod.position.z + t * direction.z);
      const cosTilt = Math.abs(direction.x);
      assert.ok(offset < 0.2 * barrelRadius, `rod enters the barrel off centre by ${offset}`);
      assert.ok(offset + radius / cosTilt < barrelRadius, 'rod stays inside the barrel face');
    }
    if (rod.userData.hingeEntry) {
      near(rod.userData.hingeEntry.y, 0, 1e-12, 'entry on hinge axis (y)');
      near(rod.userData.hingeEntry.z, 0, 1e-12, 'entry on hinge axis (z)');
      assert.ok(Math.abs(rod.userData.hingeEntry.x - axisX) < halfLength);
    }
  }
  disposeModel(model.root);
});
