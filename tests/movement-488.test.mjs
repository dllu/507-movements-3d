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
  new URL('../src/simulation/authored-screw-propellers.js', import.meta.url),
  'utf8',
);

const ARCHETYPE =
  'two-blade-constant-lead-helicoid-screw-propeller-producing-axial-thrust';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[487];
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

test('movement 488 is one shaft and hub carrying exactly two opposite screw blades', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 488);
  assert.equal(movement.number, '488');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.bladeCount, 2);
  assert.equal(blocks.bladeAssemblies.length, 2);
  assert.equal(blocks.shaft.parent, blocks.rotor);
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.nose.parent, blocks.rotor);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.rigidShaftAndBladeRotation, 1);
  blocks.bladeAssemblies.forEach(({ assembly, blade, perimeter }, index) => {
    assert.equal(assembly.parent, blocks.rotor);
    assert.equal(blade.parent, assembly);
    assert.equal(perimeter.length, 4);
    near(assembly.rotation.x, index * Math.PI, 0,
      `opposite blade phase ${index}`);
  });

  const forbidden = [];
  model.root.traverse((object) => {
    if (/belt|gear|paddle|independent-blade-pivot/i.test(
      object.userData.role ?? '',
    )) forbidden.push(object.userData.role);
  });
  assert.deepEqual(forbidden, []);
  disposeModel(model.root);
});

test('movement 488 records Brown, unavailable animation, and ITTC model provenance', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate488;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_488.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Screw propeller.*blades are sections of a screw-thread.*working of a screw in a nut.*direction of the axis/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /no canvas model or source timing/s);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHubCenterPixels, [252, 263]);
  assert.deepEqual(plate.approximateShaftExtentPixels, [96, 418]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /two opposite broad swept blades.*one cylindrical hub.*continuous transverse shaft/s);
  assert.match(evidence.ittcCorroboration,
    /advance coefficient.*thrust coefficient.*torque coefficient.*open-water efficiency/s);
  assert.equal(sourceReference.ittcOpenWaterProcedureUrl,
    'https://ittc.info/media/1838/75-02-03-021.pdf');
  assert.match(evidence.reconstructionDisclosure,
    /Exact planform, constant pitch, handedness, direction.*independently engineered/s);
  disposeModel(model.root);
});

test('movement 488 blade points lie exactly on one constant-lead helicoid', () => {
  const { model } = movementModel();
  const {
    bladeSurfacePointScene,
    geometry,
    halfChordAngleAt,
    transmission,
  } = model.root.userData;
  for (let radialIndex = 0; radialIndex <= 40; radialIndex += 1) {
    const radialFraction = radialIndex / 40;
    const expectedRadius = THREE.MathUtils.lerp(
      geometry.rootRadiusSceneUnit,
      geometry.tipRadiusSceneUnit,
      radialFraction,
    );
    assert.ok(halfChordAngleAt(radialFraction) > 0);
    for (let chordIndex = 0; chordIndex <= 20; chordIndex += 1) {
      const chordFraction = -1 + 2 * chordIndex / 20;
      const point = bladeSurfacePointScene(radialFraction, chordFraction);
      const phi = Math.atan2(point.z, point.y);
      near(Math.hypot(point.y, point.z), expectedRadius, 8e-16,
        `radius u${radialIndex} v${chordIndex}`);
      near(point.x,
        geometry.helicalLeadCoefficientSceneUnit * phi,
        3e-16, `helical lead u${radialIndex} v${chordIndex}`);
      near(phi,
        chordFraction * halfChordAngleAt(radialFraction),
        3e-16, `finite blade patch angle u${radialIndex} v${chordIndex}`);
    }
  }
  near(geometry.helicalLeadCoefficientSceneUnit,
    geometry.screwPitchSceneUnitPerTurn / FULL_TURN, 0,
    'lead coefficient');
  assert.match(transmission.bladeSurfaceEquation,
    /x=\(P\/2pi\)\*phi; y=r\*cos\(phi\); z=r\*sin\(phi\)/s);
  disposeModel(model.root);
});

test('movement 488 twist follows the exact screw pitch and one turn advances one pitch', () => {
  const { model } = movementModel();
  const {
    geometry,
    helicalAdvanceForRotation,
    pitchAngleAtRadius,
    transmission,
  } = model.root.userData;
  const rootPitch = pitchAngleAtRadius(
    geometry.physicalRadiusMetre
      * geometry.rootRadiusSceneUnit / geometry.tipRadiusSceneUnit,
  );
  const tipPitch = pitchAngleAtRadius(geometry.physicalRadiusMetre);
  assert.ok(rootPitch > tipPitch);
  assert.ok(tipPitch > 0);
  near(Math.tan(tipPitch),
    geometry.physicalScrewPitchMetrePerTurn
      / (FULL_TURN * geometry.physicalRadiusMetre),
    2e-16, 'tip pitch angle');
  near(helicalAdvanceForRotation(0), 0, 0, 'zero rotation');
  near(helicalAdvanceForRotation(FULL_TURN),
    geometry.physicalScrewPitchMetrePerTurn, 1e-15,
    'one-turn screw advance');
  near(helicalAdvanceForRotation(-FULL_TURN),
    -geometry.physicalScrewPitchMetrePerTurn, 1e-15,
    'reverse-turn screw advance');
  assert.match(transmission.fixedNutAnalogy,
    /advance_x=P\*theta\/\(2pi\).*one positive turn.*one positive-X pitch/s);
  assert.match(transmission.localPitchAngleEquation,
    /beta\(r\)=atan\(P\/\(2\*pi\*r\)\)/s);
  disposeModel(model.root);
});

test('movement 488 has consistent positive-X thrust and exact open-water coefficients', () => {
  const { model } = movementModel();
  const { dynamics, flow, geometry, motion, transmission } =
    model.root.userData;
  const n = geometry.shaftSpeedRevolutionPerSecond;
  const d = geometry.physicalDiameterMetre;
  const rho = geometry.waterDensityKilogramPerCubicMetre;

  near(geometry.advanceCoefficient,
    geometry.advanceVelocityXMetrePerSecond / (n * d), 2e-16,
    'advance coefficient');
  near(geometry.thrustXNewton,
    geometry.thrustCoefficient * rho * n ** 2 * d ** 4,
    1e-10, 'ITTC thrust');
  near(-geometry.resistingWaterTorqueXNewtonMetre,
    geometry.torqueCoefficient * rho * n ** 2 * d ** 5,
    1e-10, 'ITTC torque');
  near(geometry.openWaterEfficiency,
    geometry.advanceCoefficient * geometry.thrustCoefficient
      / (FULL_TURN * geometry.torqueCoefficient),
    1e-12, 'ITTC efficiency');
  assert.ok(geometry.openWaterEfficiency > 0);
  assert.ok(geometry.openWaterEfficiency < 1);
  assert.ok(geometry.axialSlipFraction > 0);
  assert.ok(geometry.axialSlipFraction < 1);
  assert.ok(geometry.thrustXNewton > 0);
  assert.ok(geometry.engineDriveTorqueXNewtonMetre > 0);
  assert.ok(geometry.resistingWaterTorqueXNewtonMetre < 0);
  vectorNear(flow.acceleratedWaterDirection,
    new THREE.Vector3(-1, 0, 0), 0, 'aft wake');
  vectorNear(flow.vesselThrustDirection,
    new THREE.Vector3(1, 0, 0), 0, 'forward thrust');
  vectorNear(motion.rotationAxis,
    new THREE.Vector3(1, 0, 0), 0, 'shaft axis');
  assert.equal(motion.rotationSenseViewedFromPositiveX, 'counterclockwise');
  assert.match(dynamics.ittcOpenWaterModel,
    /J=V_A\/\(nD\).*K_T=T\/\(rho\*n\^2\*D\^4\).*eta_0=J\*K_T\/\(2\*pi\*K_Q\)/s);
  assert.match(transmission.openWaterEquations,
    /T=K_T\*rho\*n\^2\*D\^4.*Q=K_Q\*rho\*n\^2\*D\^5/s);
  disposeModel(model.root);
});

test('movement 488 state closes torque, power, ideal advance, and one-turn timing', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  near(geometry.cycleDuration,
    60 / geometry.shaftSpeedRevolutionPerMinute, 0,
    'representative period');
  near(geometry.angularVelocityX,
    FULL_TURN * geometry.shaftSpeedRevolutionPerSecond, 0,
    'shaft angular speed');

  for (const time of [0, 0.031, 0.17, 0.43, 0.66, 1.29]) {
    const state = stateAtTime(time);
    near(state.rotorAngleRadian, geometry.angularVelocityX * time, 0,
      `rotor angle ${time}`);
    near(state.idealFixedNutAdvanceXMetre,
      geometry.physicalScrewPitchMetrePerTurn
        * state.rotorAngleRadian / FULL_TURN,
      2e-15, `ideal advance ${time}`);
    near(state.netShaftTorqueXNewtonMetre, 0, 0,
      `shaft torque ${time}`);
    near(state.shaftInputPowerWatt,
      state.engineDriveTorqueXNewtonMetre * state.angularVelocityX,
      0, `input power ${time}`);
    near(state.usefulPropulsivePowerWatt,
      state.thrustXNewton * state.advanceVelocityXMetrePerSecond,
      0, `useful power ${time}`);
    near(state.shaftInputPowerWatt,
      state.usefulPropulsivePowerWatt + state.wakeAndSlipPowerWatt,
      0, `power split ${time}`);
    const closed = stateAtTime(time + geometry.cycleDuration);
    near(closed.cycleTime, state.cycleTime, 2e-16,
      `cycle time closure ${time}`);
    near(closed.rotorAngleRadian - state.rotorAngleRadian,
      FULL_TURN, 2e-15, `one turn ${time}`);
  }
  assert.match(dynamics.coefficientDisclosure,
    /90 rpm.*J=0\.75.*K_T=0\.18.*K_Q=0\.03.*not measurements/s);
  assert.match(transmission.shaftBalance,
    /tau_engine,x\+tau_water,x=0.*P_shaft=2\*pi\*n\*Q/s);
  disposeModel(model.root);
});

test('movement 488 renderer rotates shaft, hub, and both helicoid blades as one body', () => {
  const { model } = movementModel();
  const {
    bladeSurfacePointScene,
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const localOffsets = blocks.bladeAssemblies.map(
    ({ assembly }) => assembly.rotation.x,
  );
  vectorNear(blocks.bladeIndexMarker.position,
    bladeSurfacePointScene(0.78, 0.66), 0,
    'blade index authored position');

  for (const time of [0, 0.07, 0.19, 0.31, 0.52,
    geometry.cycleDuration]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.rotor.rotation.x, state.rotorAngleRadian, 0,
      `rendered shaft angle ${time}`);
    blocks.bladeAssemblies.forEach(({ assembly }, index) => {
      near(assembly.rotation.x, localOffsets[index], 0,
        `fixed blade phase ${index} at ${time}`);
    });
    model.root.updateMatrixWorld(true);
    const expectedLocal = bladeSurfacePointScene(0.78, 0.66)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), state.rotorAngleRadian)
      .add(blocks.rotor.position);
    vectorNear(blocks.bladeIndexMarker.getWorldPosition(new THREE.Vector3()),
      expectedLocal, 2e-14, `blade marker world position ${time}`);
  }

  model.update(0);
  model.root.updateMatrixWorld(true);
  const start = new THREE.Box3().setFromObject(blocks.rotor);
  model.update(geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  const end = new THREE.Box3().setFromObject(blocks.rotor);
  vectorNear(end.min, start.min, 2e-14, 'rotor AABB min closure');
  vectorNear(end.max, start.max, 2e-14, 'rotor AABB max closure');
  disposeModel(model.root);
});

test('movement 488 fixed supports stay still and wake markers move smoothly aft', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, stateAtTime } = model.root.userData;
  const fixedObjects = [
    blocks.base,
    ...blocks.bearings,
    ...blocks.pedestals,
    blocks.waterVolume,
    blocks.forwardThrustArrow,
    blocks.backwardWakeArrow,
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
    'aft marker position');
  assert.match(sourceText,
    /wakeCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /continuous time integral.*getPointAt arc-length sampling.*smooth endpoint fades/s);
  disposeModel(model.root);
});

test('movement 488 fits every propeller pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 360; sample += 1) {
    model.update(geometry.cycleDuration * sample / 360);
    model.root.updateMatrixWorld(true);
    model.root.traverseVisible(object => {
      const positions=object.geometry?.attributes.position;
      if(positions)for(let i=0;i<positions.count;i++)union.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld));
    });
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
