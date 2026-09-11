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
    '../src/simulation/authored-pivoted-sail-windmills.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'six-arm-vertical-axis-windmill-with-individually-pivoted-sails-face-on-power-and-edge-on-return';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[485];
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

test('movement 486 is one vertical shaft with six arms and six independent sail pivots', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 486);
  assert.equal(movement.number, '486');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.sailCount, 6);
  assert.equal(blocks.armAssemblies.length, 6);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.verticalRotorRotation, 1);
  assert.equal(degreesOfFreedom.individuallyConstrainedSailPivots, 6);
  assert.equal(blocks.verticalShaft.parent, blocks.rotor);
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.squareShaftBoss.parent, blocks.rotor);

  const hinges = [];
  const panels = [];
  const belts = [];
  model.root.traverse((object) => {
    if (/^independent-sail-pivot-/.test(object.userData.role ?? '')) {
      hinges.push(object);
    }
    if (/^pivoted-flat-sail-panel-/.test(object.userData.role ?? '')) {
      panels.push(object);
    }
    if (object.userData.isBelt || /belt/i.test(object.userData.role ?? '')) {
      belts.push(object);
    }
  });
  assert.equal(hinges.length, 6);
  assert.equal(panels.length, 6);
  assert.deepEqual(belts, []);
  blocks.armAssemblies.forEach(({ armAssembly, hinge, panel }, index) => {
    assert.equal(armAssembly.parent, blocks.rotor);
    assert.equal(hinge.parent, armAssembly);
    assert.equal(panel.parent, hinge);
    near(armAssembly.rotation.y, index * FULL_TURN / 6, 0,
      `arm offset ${index}`);
    near(hinge.position.x, geometry.rotorRadiusSceneUnit, 0,
      `hinge radius ${index}`);
  });
  disposeModel(model.root);
});

test('movement 486 preserves the official six-vane canvas timing and editorial correction', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate486;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_486.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Plan of a vertical wind-mill.*sails are so pivoted.*edges.*returning.*faces.*action of the wind/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCyclePeriodSecond, 4);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  assert.deepEqual(sourceAnimation.officialPivotPhaseSchedule,
    [0, 0.5, 7 / 12]);
  assert.deepEqual(sourceAnimation.officialSailPhaseOffsets,
    [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHubCenterPixels, [263, 263]);
  assert.equal(plate.approximatePivotCircleRadiusPixels, 143);
  assert.equal(plate.approximateSailPivotPixels.length, 6);
  assert.deepEqual(plate.approximateWindArrowPixels,
    [263, 475, 263, 390]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /six equal radial arms.*six separate outer pivots.*wind arrow/s);
  assert.match(evidence.officialAnimationEvidence,
    /15 cycles per minute.*sixth-turn increments.*one-twelfth-turn, 30-degree pivot/s);
  assert.match(evidence.officialEditorialNote,
    /animation illustrates the intended motion.*Brown.*flip.*too early/s);
  assert.match(evidence.reconstructionDisclosure,
    /30-degree post-top flip.*four-second source cycle.*C2 flip timing/s);
  disposeModel(model.root);
});

test('movement 486 holds a sail radial for the power half-turn, flips it after the top, and returns it edge-on', () => {
  const { model } = movementModel();
  const { dynamics, geometry, sailStateAtRotorAngle, transmission } =
    model.root.userData;
  const delta = geometry.pivotTransitionAngleRadian;

  near(delta, Math.PI / 6, 0, 'official 30-degree change sector');
  for (const angle of [-Math.PI / 3, 0, Math.PI / 3, Math.PI / 2]) {
    const state = sailStateAtRotorAngle(angle, 0);
    assert.equal(state.pivotMode, 'radial-face-presenting-power-stroke');
    near(state.worldPanelYawRadian, angle, 1e-14,
      `radial panel at azimuth ${angle}`);
    near(state.faceProjectionFraction, Math.abs(Math.cos(angle)),
      1e-14, `face projection at azimuth ${angle}`);
  }
  const flipStart = sailStateAtRotorAngle(Math.PI / 2, 0);
  const flipMiddle = sailStateAtRotorAngle(Math.PI / 2 + delta / 2, 0);
  const flipEnd = sailStateAtRotorAngle(Math.PI / 2 + delta, 0);
  near(flipStart.worldPanelYawRadian, Math.PI / 2, 0, 'flip start');
  assert.equal(flipMiddle.pivotMode,
    'C2-180-degree-flip-after-top-dead-line');
  assert.ok(flipMiddle.worldPanelYawRadian > Math.PI / 2);
  assert.ok(flipMiddle.worldPanelYawRadian < 3 * Math.PI / 2);
  near(flipEnd.worldPanelYawRadian, 3 * Math.PI / 2, 0,
    '180-degree flip end');
  for (const angle of [2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3]) {
    const state = sailStateAtRotorAngle(angle, 0);
    assert.equal(state.pivotMode, 'wind-aligned-edge-on-return-stroke');
    near(state.worldPanelYawRadian, 3 * Math.PI / 2, 0,
      `fixed return yaw at ${angle}`);
    near(state.faceProjectionFraction, 0, 2e-16,
      `edge projection at ${angle}`);
  }
  near(sailStateAtRotorAngle(FULL_TURN, 0).worldPanelYawRadian,
    FULL_TURN, 0, 'oriented vane closes after one rotor turn');
  assert.match(dynamics.sourceTimingDisclosure,
    /radial half-turn.*30-degree post-top flip.*wind-aligned remainder/s);
  assert.match(transmission.hingeConstraint,
    /radial power half-turn.*advances pi.*wind_axis/s);
  disposeModel(model.root);
});

test('movement 486 endpoint-matched flip law is C2 at both 30-degree boundaries', () => {
  const { model } = movementModel();
  const { dynamics, geometry, sailStateAtRotorAngle } =
    model.root.userData;
  const epsilon = 1e-5;
  const yaw = (angle) =>
    sailStateAtRotorAngle(angle, 0).worldPanelYawRadian;
  const boundaries = [
    { angle: Math.PI / 2, derivative: 1 },
    {
      angle: Math.PI / 2 + geometry.pivotTransitionAngleRadian,
      derivative: 0,
    },
  ];
  for (const { angle, derivative } of boundaries) {
    const leftVelocity = (yaw(angle) - yaw(angle - epsilon)) / epsilon;
    const rightVelocity = (yaw(angle + epsilon) - yaw(angle)) / epsilon;
    const leftAcceleration = (
      yaw(angle) - 2 * yaw(angle - epsilon) + yaw(angle - 2 * epsilon)
    ) / epsilon ** 2;
    const rightAcceleration = (
      yaw(angle + 2 * epsilon) - 2 * yaw(angle + epsilon) + yaw(angle)
    ) / epsilon ** 2;
    near(leftVelocity, derivative, 3e-7,
      `left angular derivative at ${angle}`);
    near(rightVelocity, derivative, 3e-7,
      `right angular derivative at ${angle}`);
    near(leftAcceleration, 0, 0.02,
      `left angular acceleration at ${angle}`);
    near(rightAcceleration, 0, 0.02,
      `right angular acceleration at ${angle}`);
  }
  const flipPolynomial = geometry.sourcePhaseFlipQuintic;
  near(flipPolynomial(0), 0, 0, 'flip polynomial start value');
  near(flipPolynomial(1), 6, 0, 'six transition radians per sector radian');
  assert.match(dynamics.c2PivotTiming,
    /180 degrees.*30-degree sector.*position, angular velocity, and angular acceleration.*continuously/s);
  disposeModel(model.root);
});

test('movement 486 uses the correct wind, shaft, and torque directions in plan', () => {
  const { model } = movementModel();
  const { dynamics, motion, sailStateAtRotorAngle, transmission } =
    model.root.userData;
  vectorNear(motion.windDirection, new THREE.Vector3(0, 0, -1), 0,
    'negative-Z wind');
  vectorNear(motion.rotationAxis, new THREE.Vector3(0, 1, 0), 0,
    'vertical shaft');
  assert.ok(motion.shaftAngularVelocityVector.y > 0);
  assert.equal(motion.rotationSenseViewedFromAbovePositiveY,
    'counterclockwise');

  const right = sailStateAtRotorAngle(0, 0);
  assert.equal(right.faceProjectionFraction, 1);
  assert.equal(right.signedLeverFraction, 1);
  assert.equal(right.torqueWeight, 1);
  const left = sailStateAtRotorAngle(Math.PI, 0);
  near(left.faceProjectionFraction, 0, 2e-16, 'left edge-on sail');
  assert.ok(left.signedLeverFraction < 0);
  near(left.torqueWeight, 0, 2e-16, 'left return torque');
  const flip = sailStateAtRotorAngle(7 * Math.PI / 12, 0);
  assert.ok(flip.signedLeverFraction < 0);
  assert.ok(flip.faceProjectionFraction > 0.9);
  assert.ok(flip.torqueWeight < 0,
    'brief counter-torque during the physical vane flip is retained');
  assert.match(dynamics.directDragAction,
    /Negative-Z wind.*positive-X.*positive-Y torque.*counter-torque is included/s);
  assert.match(transmission.windToRotationSign,
    /U_z<0.*x>0.*tau_y.*>0/);
  disposeModel(model.root);
});

test('movement 486 closes the reduced-order power, torque-ripple, flywheel, and load balance', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const expectedArea = 2 * geometry.physicalRotorRadiusMetre
    * geometry.physicalSailHeightMetre;
  const expectedAvailablePower = 0.5
    * geometry.airDensityKilogramPerCubicMetre
    * expectedArea * geometry.windSpeedMagnitudeMetrePerSecond ** 3;
  const expectedOmega = FULL_TURN / geometry.cycleDuration;

  near(geometry.officialCyclesPerMinute, 15, 0, 'official cpm');
  near(geometry.cycleDuration, 4, 0, 'official period');
  near(geometry.shaftAngularVelocityRadianPerSecond,
    expectedOmega, 0, 'shaft speed');
  near(geometry.tipSpeedRatio,
    expectedOmega * geometry.physicalRotorRadiusMetre
      / geometry.windSpeedMagnitudeMetrePerSecond,
    0, 'tip-speed ratio');
  near(geometry.sweptAreaSquareMetre, expectedArea, 0, 'swept area');
  near(geometry.totalSailAreaSquareMetre,
    geometry.sailCount * geometry.physicalSailWidthMetre
      * geometry.physicalSailHeightMetre,
    0, 'total sail area');
  near(geometry.availableWindPowerWatt, expectedAvailablePower, 0,
    'available power');
  near(geometry.meanShaftPowerWatt,
    geometry.powerCoefficient * expectedAvailablePower, 0,
    'mean shaft power');
  near(geometry.meanDrivingTorqueYNewtonMetre,
    geometry.meanShaftPowerWatt / expectedOmega, 0,
    'mean torque');

  let meanRipple = 0;
  for (let sample = 0; sample < 6000; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * (sample + 0.5) / 6000,
    );
    assert.ok(state.summedTorqueWeight > 0);
    assert.ok(state.instantaneousAerodynamicTorqueYNewtonMetre > 0);
    near(state.netTorqueYNewtonMetre, 0, 2e-14,
      `uniform-speed balance ${sample}`);
    near(state.flywheelBufferTorqueYNewtonMetre,
      geometry.meanDrivingTorqueYNewtonMetre
        - state.instantaneousAerodynamicTorqueYNewtonMetre,
      0, `flywheel buffer ${sample}`);
    near(state.meanLoadTorqueYNewtonMetre,
      -geometry.meanDrivingTorqueYNewtonMetre, 0,
      `mean load ${sample}`);
    meanRipple += state.torqueRippleFactor;
  }
  near(meanRipple / 6000, 1, 2e-12, 'cycle-average torque ripple');
  assert.match(dynamics.aerodynamicAssumption,
    /flywheel buffer exactly absorbs.*torque ripple.*uniform/s);
  assert.match(transmission.torqueRippleBalance,
    /tau_aero\(t\)\+tau_flywheel_buffer\(t\)\+tau_load=0/s);
  disposeModel(model.root);
});

test('movement 486 renderer binds every arm radius and every hinge yaw to the analytic state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const armOffsets = blocks.armAssemblies.map(
    ({ armAssembly }) => armAssembly.rotation.y,
  );

  for (const time of [0, 0.43, 1, 1.46, 2.2, 3.17, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.rotor.rotation.y, state.rotorAngleRadian, 0,
      `rotor angle at ${time}`);
    model.root.updateMatrixWorld(true);
    blocks.armAssemblies.forEach((assembly, index) => {
      near(assembly.armAssembly.rotation.y, armOffsets[index], 0,
        `rigid arm offset ${index} at ${time}`);
      near(assembly.hinge.rotation.y,
        state.sailStates[index].hingeLocalYawRadian, 0,
        `hinge angle ${index} at ${time}`);
      const hingeWorld = assembly.hinge.getWorldPosition(new THREE.Vector3());
      near(Math.hypot(hingeWorld.x, hingeWorld.z),
        geometry.rotorRadiusSceneUnit, 2e-15,
        `hinge orbit radius ${index} at ${time}`);
      const panelAxis = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(assembly.panel.getWorldQuaternion(
          new THREE.Quaternion(),
        ));
      const yaw = state.sailStates[index].worldPanelYawRadian;
      vectorNear(panelAxis,
        new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
        2e-15, `panel world yaw ${index} at ${time}`);
    });
  }
  model.update(0);
  model.root.updateMatrixWorld(true);
  const initialPanelCorners = blocks.armAssemblies.flatMap(({ panel }) => {
    const box = new THREE.Box3().setFromObject(panel);
    return [box.min.clone(), box.max.clone()];
  });
  model.update(geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  blocks.armAssemblies.flatMap(({ panel }) => {
    const box = new THREE.Box3().setFromObject(panel);
    return [box.min.clone(), box.max.clone()];
  }).forEach((corner, index) => {
    vectorNear(corner, initialPanelCorners[index], 1e-14,
      `one-cycle panel geometry closure ${index}`);
  });
  disposeModel(model.root);
});

test('movement 486 fixed frame stays still and its wind markers move smoothly in negative Z', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, geometry, stateAtTime } =
    model.root.userData;
  const fixedObjects = [
    blocks.base,
    ...blocks.supportCross,
    blocks.sweepRing,
    blocks.lowerBearing,
    ...blocks.windArrows,
  ];
  const fixedMatrices = fixedObjects.map((object) => {
    object.updateMatrixWorld(true);
    return object.matrixWorld.clone();
  });
  near(geometry.markerPacketAdvanceMetre,
    geometry.windSpeedMagnitudeMetrePerSecond * geometry.cycleDuration / 4,
    0, 'marker packet advance');

  for (const time of [0, 0.37, 1.18, 2.73, 4]) {
    const state = stateAtTime(time);
    near(state.windAxialDisplacementMetre,
      geometry.windVelocityZMetrePerSecond * time, 0,
      `wind displacement ${time}`);
    model.update(time);
    model.root.updateMatrixWorld(true);
    fixedObjects.forEach((object, index) => {
      const difference = object.matrixWorld.elements.reduce(
        (maximum, value, elementIndex) => Math.max(
          maximum,
          Math.abs(value - fixedMatrices[index].elements[elementIndex]),
        ),
        0,
      );
      near(difference, 0, 0, `fixed frame ${index} at ${time}`);
    });
    blocks.windMarkerSets.forEach((markers, pathIndex) => {
      markers.forEach((marker, markerIndex) => {
        const progress = flow.markerProgress(
          state.markerTravelTurns,
          pathIndex,
          markerIndex,
        );
        vectorNear(marker.position,
          flow.windCurves[pathIndex].getPointAt(progress), 3e-15,
          `wind marker ${pathIndex}/${markerIndex} at ${time}`);
        near(marker.scale.x, Math.sin(Math.PI * progress) ** 0.5,
          3e-15, `wind fade ${pathIndex}/${markerIndex} at ${time}`);
      });
    });
  }
  model.update(0.19);
  const beforeZ = blocks.windMarkerSets[0][0].position.z;
  model.update(0.1901);
  assert.ok(blocks.windMarkerSets[0][0].position.z < beforeZ);
  assert.match(sourceText,
    /windCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /analytic integral.*negative-Z velocity.*getPointAt arc-length/s);
  disposeModel(model.root);
});

test('movement 486 fits every pivot pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 360; sample += 1) {
    model.update(geometry.cycleDuration * sample / 360);
    model.root.updateMatrixWorld(true);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const baseBounds = new THREE.Box3().setFromObject(blocks.base);
  assert.ok(model.root.userData.groundFloorY <= baseBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
