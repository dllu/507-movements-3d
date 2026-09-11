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
    '../src/simulation/authored-feathering-paddle-wheels.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'four-upright-feathering-paddles-linked-to-control-ring-on-stationary-eccentric';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[488];
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

test('movement 489 has four pivoted buckets, four cranks, one loose ring, and one fixed eccentric', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 489);
  assert.equal(movement.number, '489');
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.bucketCount, 4);
  assert.equal(blocks.buckets.length, 4);
  assert.equal(blocks.mainArms.length, 4);
  assert.equal(blocks.mainPivotPins.length, 4);
  assert.equal(blocks.controlArms.length, 4);
  assert.equal(blocks.controlPins.length, 4);
  assert.equal(blocks.fixedEccentric.parent, model.root);
  assert.equal(blocks.controlRing.parent, blocks.controlRotor);
  assert.equal(blocks.mainShaft.parent, blocks.mainRotor);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.mainRotorRotation, 1);
  assert.equal(degreesOfFreedom.bucketOrientationCoordinatesConstrainedToZero,
    4);
  blocks.buckets.forEach(({ bucket, crank, panel }) => {
    assert.equal(bucket.parent, model.root);
    assert.equal(crank.parent, bucket);
    assert.equal(panel.parent, bucket);
  });

  const belts = [];
  model.root.traverse((object) => {
    if (/belt/i.test(object.userData.role ?? '')) belts.push(object);
  });
  assert.deepEqual(belts, []);
  disposeModel(model.root);
});

test('movement 489 preserves the official eccentric proportions, directions, and timing', () => {
  const { model, movement } = movementModel();
  const { geometry, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate489;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_489.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /buckets, a, a, are pivoted into the arms, b, b.*cranks, c, c.*ring, d.*stationary eccentric, e.*keeps the buckets always upright/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCyclePeriodSecond, 4);
  assert.equal(sourceAnimation.officialMainRotorRotationMultiplier, -1);
  assert.equal(sourceAnimation.officialControlRingRotationMultiplier, -1);
  assert.equal(sourceAnimation.officialBucketTranslationWithoutRotation, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  near(geometry.armRadiusSceneUnit / geometry.sourceScale, 12, 3e-15,
    'official arm radius');
  near(geometry.eccentricOffsetSceneUnit / geometry.sourceScale, 3, 1e-15,
    'official eccentric offset');
  near(geometry.stationaryEccentricRadiusSceneUnit / geometry.sourceScale,
    5, 1e-15, 'official eccentric radius');
  near(geometry.controlRingRadiusSceneUnit / geometry.sourceScale, 7, 1e-15,
    'official control ring radius');
  near(geometry.mainShaftRadiusSceneUnit / geometry.sourceScale, 1.9,
    2e-16, 'official shaft radius');
  assert.deepEqual(geometry.initialBucketAngles,
    [3 * Math.PI / 4, Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateMainShaftCenterPixels, [248, 275]);
  assert.deepEqual(plate.approximateEccentricCenterPixels, [281, 275]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.officialAnimationEvidence,
    /arm pivots at radius 12.*eccentric offset 3.*radius 5.*ring radius 7.*minus one.*15 cycles per minute.*zero rotation/s);
  disposeModel(model.root);
});

test('movement 489 exact eccentric closure keeps every crank horizontal and equal', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const expectedOffset = new THREE.Vector2(
    geometry.eccentricOffsetSceneUnit,
    0,
  );

  for (let sample = 0; sample <= 1440; sample += 1) {
    const time = geometry.cycleDuration * sample / 1440;
    const state = stateAtTime(time);
    near(state.controlRingAngleRadian, state.rotorAngleRadian, 0,
      `ring angle ${sample}`);
    state.bucketStates.forEach((bucket, index) => {
      vectorNear(bucket.controlPinScene.clone().sub(bucket.mainPivotScene),
        expectedOffset, 8e-16,
        `constant crank vector bucket ${index} sample ${sample}`);
      near(bucket.mainPivotScene.distanceTo(
        new THREE.Vector2(geometry.rotorCenter.x, geometry.rotorCenter.y)),
      geometry.armRadiusSceneUnit, 2e-15,
      `main orbit radius bucket ${index} sample ${sample}`);
      near(bucket.controlPinScene.distanceTo(
        new THREE.Vector2(
          geometry.eccentricCenter.x,
          geometry.eccentricCenter.y,
        )), geometry.armRadiusSceneUnit, 1e-15,
      `control orbit radius bucket ${index} sample ${sample}`);
      near(bucket.panelWorldYawRadian, 0, 0,
        `upright bucket ${index} sample ${sample}`);
    });
  }
  assert.match(transmission.crankClosure,
    /p_i=O\+R\(theta\)p_i0; q_i=E\+R\(theta\)p_i0; q_i-p_i=E-O/s);
  assert.match(transmission.orientationConstraint,
    /theta_bucket_i=atan2.*=0; omega_bucket_i=0/s);
  assert.match(transmission.ringConstraint,
    /theta_ring=theta_main.*ring center E and eccentric e are fixed/s);
  disposeModel(model.root);
});

test('movement 489 buckets cross edgewise and work broad-face on the submerged bottom arc', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime } = model.root.userData;
  const angleTime = (angle) => angle / geometry.angularVelocityZ;
  const right = stateAtTime(angleTime(-geometry.initialBucketAngles[1]))
    .bucketStates[1];
  const bottom = stateAtTime(angleTime(
    -Math.PI / 2 - geometry.initialBucketAngles[1],
  )).bucketStates[1];
  const left = stateAtTime(angleTime(
    Math.PI - geometry.initialBucketAngles[1],
  )).bucketStates[1];

  near(right.orbitAngleRadian, 0, 2e-16, 'right-side crossing angle');
  near(right.bucketVelocityMetrePerSecond.x, 0, 2e-15,
    'right-side normal velocity');
  assert.ok(right.bucketVelocityMetrePerSecond.y < 0);
  near(right.immersedFraction, 0, 0, 'right-side bucket clear');
  near(bottom.orbitAngleRadian, -Math.PI / 2, 3e-16,
    'bottom angle');
  assert.ok(bottom.bucketVelocityMetrePerSecond.x < 0);
  near(bottom.bucketVelocityMetrePerSecond.y, 0, 2e-15,
    'bottom vertical velocity');
  near(bottom.immersedFraction, 1, 0, 'bottom bucket immersed');
  assert.ok(bottom.waterForceXNewton > 0);
  assert.ok(bottom.hydrodynamicLoadTorqueZNewtonMetre > 0);
  near(left.orbitAngleRadian, Math.PI, 5e-16, 'left crossing angle');
  near(left.bucketVelocityMetrePerSecond.x, 0, 2e-15,
    'left-side normal velocity');
  assert.ok(left.bucketVelocityMetrePerSecond.y > 0);
  near(left.immersedFraction, 0, 0, 'left-side bucket clear');
  assert.match(dynamics.reactionPair,
    /bottom travel gives negative-X.*press water backward.*positive X/s);
  disposeModel(model.root);
});

test('movement 489 immersion varies continuously with the vertical bucket center', () => {
  const { model } = movementModel();
  const { bucketImmersionAtCenterY, geometry } = model.root.userData;
  const firstContactY = geometry.physicalWaterlineYMetre
    + geometry.physicalBucketHeightMetre / 2;
  const fullContactY = geometry.physicalWaterlineYMetre
    - geometry.physicalBucketHeightMetre / 2;
  near(bucketImmersionAtCenterY(firstContactY).immersedFraction, 0,
    2e-16, 'first contact');
  near(bucketImmersionAtCenterY(fullContactY).immersedFraction, 1,
    2e-16, 'full contact');
  let previous = -Infinity;
  for (let sample = 0; sample <= 400; sample += 1) {
    const centerY = THREE.MathUtils.lerp(
      firstContactY,
      fullContactY,
      sample / 400,
    );
    const immersion = bucketImmersionAtCenterY(centerY);
    assert.ok(immersion.immersedFraction >= previous - 2e-15);
    near(immersion.immersedAreaSquareMetre,
      immersion.immersedHeightMetre * geometry.physicalBucketWidthMetre,
      0, `immersed area ${sample}`);
    previous = immersion.immersedFraction;
  }
  disposeModel(model.root);
});

test('movement 489 maintains positive thrust and closes shaft and propulsive power', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  let minimumThrust = Infinity;
  let minimumInputPower = Infinity;
  let minimumWakeLoss = Infinity;
  for (let sample = 0; sample < 1440; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1440);
    near(state.netShaftTorqueZNewtonMetre, 0, 1e-11,
      `torque closure ${sample}`);
    near(state.shaftInputPowerWatt,
      state.engineDriveTorqueZNewtonMetre * state.angularVelocityZ,
      1e-10, `shaft power ${sample}`);
    near(state.usefulPropulsivePowerWatt,
      state.thrustXNewton * geometry.vesselSpeedXMetrePerSecond,
      1e-10, `useful power ${sample}`);
    near(state.shaftInputPowerWatt,
      state.usefulPropulsivePowerWatt + state.wakeAndSlipPowerWatt,
      1e-10, `power split ${sample}`);
    minimumThrust = Math.min(minimumThrust, state.thrustXNewton);
    minimumInputPower = Math.min(minimumInputPower,
      state.shaftInputPowerWatt);
    minimumWakeLoss = Math.min(minimumWakeLoss,
      state.wakeAndSlipPowerWatt);
  }
  assert.ok(minimumThrust > 0);
  assert.ok(minimumInputPower > 0);
  assert.ok(minimumWakeLoss > 0);
  assert.match(dynamics.hydrodynamicAssumption,
    /submerged vertical area.*quadratic normal drag.*not CFD/s);
  assert.match(transmission.powerBalance,
    /tau_engine,z\+tau_water,z=0.*P_input=tau_engine,z\*omega_z/s);
  disposeModel(model.root);
});

test('movement 489 renderer binds both rotating frames and leaves all bucket faces vertical', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const mainOffsets = blocks.mainArms.map((arm) => arm.rotation.z);
  const controlOffsets = blocks.controlArms.map((arm) => arm.rotation.z);

  for (const time of [0, 0.19, 0.72, 1.31, 2.24, 3.59, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.mainRotor.rotation.z, state.rotorAngleRadian, 0,
      `main angle ${time}`);
    near(blocks.controlRotor.rotation.z, state.controlRingAngleRadian, 0,
      `control angle ${time}`);
    model.root.updateMatrixWorld(true);
    state.bucketStates.forEach((bucketState, index) => {
      near(blocks.mainArms[index].rotation.z, mainOffsets[index], 0,
        `main local phase ${index}`);
      near(blocks.controlArms[index].rotation.z, controlOffsets[index], 0,
        `control local phase ${index}`);
      vectorNear(blocks.buckets[index].bucket.position,
        new THREE.Vector3(
          bucketState.mainPivotScene.x,
          bucketState.mainPivotScene.y,
          0,
        ), 0, `bucket pivot render ${index} at ${time}`);
      near(blocks.buckets[index].bucket.rotation.z, 0, 0,
        `bucket yaw ${index} at ${time}`);
      const verticalAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(
        blocks.buckets[index].panel.getWorldQuaternion(
          new THREE.Quaternion(),
        ),
      );
      vectorNear(verticalAxis, new THREE.Vector3(0, 1, 0), 0,
        `vertical panel ${index} at ${time}`);
      const controlPin = blocks.controlPins[index]
        .getWorldPosition(new THREE.Vector3());
      vectorNear(new THREE.Vector2(controlPin.x, controlPin.y),
        bucketState.controlPinScene, 2e-14,
        `control pin ${index} at ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 489 fixed eccentric stays still and wake markers move smoothly backward', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, stateAtTime } = model.root.userData;
  const fixedObjects = [
    blocks.fixedEccentric,
    blocks.eccentricIndex,
    blocks.bearing,
    ...blocks.supportLegs,
    blocks.base,
    blocks.waterSurface,
    blocks.waterVolume,
    blocks.backwardWaterArrow,
    blocks.forwardVesselArrow,
  ];
  model.root.updateMatrixWorld(true);
  const matrices = fixedObjects.map((object) => object.matrixWorld.clone());
  const beforeX = blocks.wakeMarkerSets[0][0].position.x;
  model.update(0.0001);
  model.root.updateMatrixWorld(true);
  fixedObjects.forEach((object, index) => {
    assert.ok(object.matrixWorld.equals(matrices[index]),
      `fixed object ${index} moved`);
  });
  assert.ok(blocks.wakeMarkerSets[0][0].position.x < beforeX);
  const state = stateAtTime(0.0001);
  const progress = flow.wakeMarkerProgress(
    state.wakeMarkerTravelTurns,
    0,
    0,
  );
  vectorNear(blocks.wakeMarkerSets[0][0].position,
    flow.wakeCurves[0].getPointAt(progress), 1e-14,
    'wake marker arc-length point');
  assert.match(sourceText,
    /wakeCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /continuous time integral.*getPointAt arc-length sampling.*smooth endpoint fades/s);
  disposeModel(model.root);
});

test('movement 489 fits every feathering pose and leaves spinning movement 507 as the frontier', () => {
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
