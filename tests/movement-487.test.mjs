import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-common-paddle-wheels.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'eight-fixed-radial-paddles-on-one-rigid-transverse-vessel-wheel';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[486];
  return { model: createMovementModel(movement), movement };
}

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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 487 is one rigid shaft wheel with eight fixed radial paddles', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 487);
  assert.equal(movement.number, '487');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.paddleCount, 8);
  assert.equal(blocks.spokeAssemblies.length, 8);
  assert.equal(blocks.paddles.length, 8);
  assert.equal(blocks.rims.length, 2);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.rigidWheelRotation, 1);
  assert.equal(degreesOfFreedom.paddleHinges, 0);
  assert.equal(blocks.shaft.parent, blocks.rotor);
  assert.equal(blocks.hub.parent, blocks.rotor);
  blocks.spokeAssemblies.forEach((assembly, index) => {
    assert.equal(assembly.assembly.parent, blocks.rotor);
    assert.equal(assembly.paddle.parent, assembly.assembly);
    assert.equal(assembly.spokes.length, 2);
    near(assembly.assembly.rotation.z, index * FULL_TURN / 8, 0,
      `fixed paddle offset ${index}`);
  });

  const forbidden = [];
  model.root.traverse((object) => {
    if (/belt|paddle-pivot|crank|eccentric/i.test(
      object.userData.role ?? '',
    )) forbidden.push(object.userData.role);
  });
  assert.deepEqual(forbidden, []);
  disposeModel(model.root);
});

test('movement 487 preserves Brown and the official eight-paddle vector model', () => {
  const { model, movement } = movementModel();
  const { geometry, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate487;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_487.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Common paddle-wheel.*buckets.*press backward.*water.*forward movement of the vessel/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCyclePeriodSecond, 4);
  assert.equal(sourceAnimation.officialRigidRotationMultiplier, 1);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHubCenterPixels, [264, 257]);
  assert.equal(plate.approximateRimOuterRadiusPixels, 154);
  assert.equal(plate.approximateOuterPaddleRadiusPixels, 200);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence,
    /eight equally spaced radial arms.*annular rim.*eight short rectangular paddle boards/s);
  assert.match(evidence.officialAnimationEvidence,
    /15 cycles per minute.*radii are 2\.5.*9 and 10.*13/s);
  assert.match(evidence.reconstructionDisclosure,
    /selected clockwise propulsion direction.*independently engineered/s);

  near(geometry.hubRadiusSceneUnit / geometry.sceneScale, 2.5, 1e-14,
    'official hub radius');
  near(geometry.rimInnerRadiusSceneUnit / geometry.sceneScale, 9, 1e-14,
    'official inner rim radius');
  near(geometry.rimOuterRadiusSceneUnit / geometry.sceneScale, 10, 1e-14,
    'official outer rim radius');
  near(geometry.paddleOuterRadiusSceneUnit / geometry.sceneScale, 13,
    1e-14, 'official paddle-tip radius');
  disposeModel(model.root);
});

test('movement 487 holds every spoke, rim, hub, shaft, and paddle to one exact angle', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  near(geometry.cycleDuration, 4, 0, 'official cycle');
  near(geometry.angularVelocityZ, -Math.PI / 2, 0,
    'clockwise angular velocity');

  for (const time of [0, 0.13, 0.71, 1.5, 2.37, 3.81, 4, 8.4]) {
    const state = stateAtTime(time);
    near(state.rotorAngleRadian, geometry.angularVelocityZ * time, 0,
      `unwrapped rotor angle at ${time}`);
    state.paddleStates.forEach((paddle, index) => {
      near(paddle.angleRadian,
        state.rotorAngleRadian + index * FULL_TURN / 8,
        0, `paddle phase ${index} at ${time}`);
    });
  }
  assert.match(transmission.rigidConstraint,
    /theta_shaft=theta_hub=theta_rim_1=theta_rim_2.*theta_paddle_i=theta_shaft\+2\*pi\*i\/8/s);
  disposeModel(model.root);
});

test('movement 487 bottom paddles press water backward and receive forward thrust', () => {
  const { model } = movementModel();
  const {
    dynamics,
    flow,
    motion,
    paddleHydrodynamicsAtAngle,
    stateAtTime,
  } = model.root.userData;
  const bottom = paddleHydrodynamicsAtAngle(3 * Math.PI / 2);
  const top = paddleHydrodynamicsAtAngle(Math.PI / 2);

  near(bottom.immersedFraction, 1, 0, 'bottom paddle immersed');
  assert.ok(bottom.paddleVelocityMetrePerSecond.x < 0);
  assert.ok(bottom.normalRelativeSpeedMetrePerSecond < 0);
  assert.ok(bottom.waterForceOnPaddleNewton.x > 0);
  near(bottom.waterForceOnPaddleNewton.y, 0, 2e-12,
    'bottom force has no vertical component');
  assert.ok(bottom.hydrodynamicLoadTorqueZNewtonMetre > 0);
  near(top.immersedFraction, 0, 0, 'top paddle clear of water');
  vectorNear(top.waterForceOnPaddleNewton, new THREE.Vector2(), 0,
    'top paddle force');

  const state = stateAtTime(0);
  assert.ok(state.thrustXNewton > 0);
  assert.ok(state.hydrodynamicLoadTorqueZNewtonMetre > 0);
  assert.ok(state.engineDriveTorqueZNewtonMetre < 0);
  assert.ok(state.angularVelocityZ < 0);
  vectorNear(flow.backwardWaterDirection, new THREE.Vector3(-1, 0, 0),
    0, 'backward water direction');
  vectorNear(flow.forwardVesselDirection, new THREE.Vector3(1, 0, 0),
    0, 'forward vessel direction');
  vectorNear(motion.rotationAxis, new THREE.Vector3(0, 0, 1), 0,
    'shaft axis');
  assert.equal(motion.rotationSenseViewedFromPositiveZ, 'clockwise');
  assert.match(dynamics.reactionPair,
    /bottom-paddle motion is negative X.*presses water backward.*positive-X thrust/s);
  disposeModel(model.root);
});

test('movement 487 immersion grows continuously from first contact to full depth', () => {
  const { model } = movementModel();
  const { geometry, paddleImmersionAtAngle } = model.root.userData;
  const firstContact = Math.asin(
    geometry.physicalWaterlineYMetre
      / geometry.physicalPaddleOuterRadiusMetre,
  );
  const fullContact = Math.asin(
    geometry.physicalWaterlineYMetre
      / geometry.physicalPaddleInnerRadiusMetre,
  );
  near(paddleImmersionAtAngle(firstContact).immersedFraction, 0, 2e-15,
    'outer edge first contact');
  near(paddleImmersionAtAngle(fullContact).immersedFraction, 1, 2e-15,
    'inner edge reaches water');

  let previous = -Infinity;
  for (let sample = 0; sample <= 400; sample += 1) {
    const angle = THREE.MathUtils.lerp(firstContact, fullContact, sample / 400);
    const immersion = paddleImmersionAtAngle(angle);
    assert.ok(immersion.immersedFraction >= previous - 2e-14,
      `immersion monotonic at sample ${sample}`);
    assert.ok(immersion.immersedFraction >= 0);
    assert.ok(immersion.immersedFraction <= 1);
    near(immersion.immersedAreaSquareMetre,
      immersion.immersedFraction
        * (geometry.physicalPaddleOuterRadiusMetre
          - geometry.physicalPaddleInnerRadiusMetre)
        * geometry.physicalPaddleWidthMetre,
      2e-15, `immersed area ${sample}`);
    previous = immersion.immersedFraction;
  }
  disposeModel(model.root);
});

test('movement 487 closes torque and separates useful propulsion from wake loss', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  let minimumThrust = Infinity;
  let minimumInputPower = Infinity;
  let minimumWakePower = Infinity;
  let maximumEfficiency = -Infinity;
  for (let sample = 0; sample < 1440; sample += 1) {
    const time = geometry.cycleDuration * sample / 1440;
    const state = stateAtTime(time);
    near(state.netShaftTorqueZNewtonMetre, 0, 1e-10,
      `torque balance ${sample}`);
    near(state.shaftInputPowerWatt,
      state.engineDriveTorqueZNewtonMetre * state.angularVelocityZ,
      1e-10, `shaft power ${sample}`);
    near(state.usefulPropulsivePowerWatt,
      state.thrustXNewton * geometry.vesselSpeedXMetrePerSecond,
      1e-10, `useful power ${sample}`);
    near(state.shaftInputPowerWatt,
      state.usefulPropulsivePowerWatt + state.wakeAndSlipPowerWatt,
      1e-10, `power partition ${sample}`);
    minimumThrust = Math.min(minimumThrust, state.thrustXNewton);
    minimumInputPower = Math.min(minimumInputPower,
      state.shaftInputPowerWatt);
    minimumWakePower = Math.min(minimumWakePower,
      state.wakeAndSlipPowerWatt);
    maximumEfficiency = Math.max(maximumEfficiency,
      state.usefulPropulsivePowerWatt / state.shaftInputPowerWatt);
  }
  assert.ok(minimumThrust > 0);
  assert.ok(minimumInputPower > 0);
  assert.ok(minimumWakePower > 0);
  assert.ok(maximumEfficiency > 0 && maximumEfficiency < 1);
  assert.match(dynamics.hydrodynamicAssumption,
    /normal quadratic drag.*reduced-order force model, not CFD/s);
  assert.match(dynamics.powerBalance,
    /tau_engine=-tau_water.*useful propulsive power.*wake and slip/s);
  assert.match(transmission.hydrodynamicForceEquation,
    /0\.5\*rho\*C_D\*A_sub\*abs\(v_n\)\*v_n/s);

  for (const time of [0, 0.31, 1.77, 3.59]) {
    const a = stateAtTime(time);
    const b = stateAtTime(time + geometry.cycleDuration);
    near(b.thrustXNewton, a.thrustXNewton, 2e-10,
      `one-turn thrust closure ${time}`);
    near(b.hydrodynamicLoadTorqueZNewtonMetre,
      a.hydrodynamicLoadTorqueZNewtonMetre, 6e-10,
      `one-turn torque closure ${time}`);
  }
  disposeModel(model.root);
});

test('movement 487 renderer binds all eight radial boards to the one wheel angle', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.23, 0.91, 1.82, 2.73, 3.64, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.rotor.rotation.z, state.rotorAngleRadian, 0,
      `rendered rotor angle ${time}`);
    model.root.updateMatrixWorld(true);
    blocks.spokeAssemblies.forEach((assembly, index) => {
      near(assembly.assembly.rotation.z, index * FULL_TURN / 8, 0,
        `unchanged local index ${index}`);
      const angle = state.paddleStates[index].angleRadian;
      const center = assembly.paddle.getWorldPosition(new THREE.Vector3());
      const radialCenter = (
        geometry.paddleInnerRadiusSceneUnit
        + geometry.paddleOuterRadiusSceneUnit
      ) / 2;
      vectorNear(center, new THREE.Vector3(
        radialCenter * Math.cos(angle),
        0.22 + radialCenter * Math.sin(angle),
        0,
      ), 2e-14, `paddle center ${index} at ${time}`);
      const radialAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(
        assembly.paddle.getWorldQuaternion(new THREE.Quaternion()),
      );
      vectorNear(radialAxis,
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0),
        2e-14, `paddle radial orientation ${index} at ${time}`);
    });
  }

  model.update(0);
  model.root.updateMatrixWorld(true);
  const start = new THREE.Box3().setFromObject(blocks.rotor);
  model.update(geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  const end = new THREE.Box3().setFromObject(blocks.rotor);
  vectorNear(end.min, start.min, 2e-14, 'one-cycle rotor AABB minimum');
  vectorNear(end.max, start.max, 2e-14, 'one-cycle rotor AABB maximum');
  disposeModel(model.root);
});

test('movement 487 fixed frame stays still and wake markers use smooth arc-length paths', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, stateAtTime } = model.root.userData;
  const fixedObjects = [
    ...blocks.baseRails,
    ...blocks.bearings,
    ...blocks.supportLegs,
    blocks.waterSurface,
    blocks.waterVolume,
    blocks.backwardWaterArrow,
    blocks.forwardVesselArrow,
  ];
  model.root.updateMatrixWorld(true);
  const beforeMatrices = fixedObjects.map(
    (object) => object.matrixWorld.clone(),
  );
  const beforeX = blocks.wakeMarkerSets[0][0].position.x;
  model.update(0.1901);
  model.root.updateMatrixWorld(true);
  fixedObjects.forEach((object, index) => {
    assert.ok(object.matrixWorld.equals(beforeMatrices[index]),
      `fixed object ${index} moved`);
  });
  assert.ok(blocks.wakeMarkerSets[0][0].position.x < beforeX);
  const state = stateAtTime(0.1901);
  const progress = flow.wakeMarkerProgress(
    state.wakeMarkerTravelTurns,
    0,
    0,
  );
  vectorNear(blocks.wakeMarkerSets[0][0].position,
    flow.wakeCurves[0].getPointAt(progress), 1e-14,
    'first wake marker arc-length position');
  assert.match(sourceText,
    /wakeCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /continuous time integral.*getPointAt arc-length sampling.*smooth endpoint fades/s);
  disposeModel(model.root);
});

test('movement 487 fits every wheel pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 360; sample += 1) {
    model.update(geometry.cycleDuration * sample / 360);
    model.root.updateMatrixWorld(true);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const waterBounds = new THREE.Box3().setFromObject(
    model.root.userData.blocks.waterVolume,
  );
  assert.ok(model.root.userData.groundFloorY <= waterBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
