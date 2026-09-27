import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'stream-driven-inclined-archimedes-screw-with-one-to-one-lower-water-wheel-and-gravity-low-rising-pockets';
const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 443 is one rigid oblique rotor containing the lower wheel, shaft, casing, and helix', () => {
  const movement = catalog.movements[442];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 443);
  assert.equal(movement.number, '443');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism,
    /lower paddle wheel, central shaft, transparent casing, and five-turn helical flight form one rigid rotor/);
  assert.match(data.mechanism,
    /drive wheel and screw rotate at exactly the same angle and speed/);
  assert.match(data.mechanism,
    /advances a gravity-low water pocket upward by one pitch/);
  assert.equal(blocks.screwAssembly.parent, model.root);
  assert.equal(blocks.rotor.parent, blocks.screwAssembly);
  assert.equal(blocks.centralShaft.parent, blocks.rotor);
  assert.equal(blocks.helicalFlight.parent, blocks.rotor);
  assert.equal(blocks.casing.parent, blocks.rotor);
  // Source presentation removes the white rotation stripe Brown does not draw.
  assert.equal(blocks.casingIndex.parent, null);
  assert.equal(blocks.waterWheel.parent, blocks.rotor);
  assert.equal(blocks.paddles.length, geometry.waterWheelPaddleCount);
  assert.equal(blocks.waterPockets.length, geometry.waterPocketCount);
  blocks.waterPockets.forEach((pocket) =>
    assert.equal(pocket.parent, blocks.screwAssembly));
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.waterWheelIndependent, false);
  assert.equal(degreesOfFreedom.helicalFlightIndependent, false);
  assert.equal(degreesOfFreedom.waterPocketAxialMotionIndependent, false);
  assert.equal(degreesOfFreedom.screwAxisTranslationIndependent, false);

  const belts = [];
  const ropes = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  assert.equal(roles.filter((role) =>
    /^stream-driven-lower-paddle-/.test(role)).length, 12);
  assert.equal(roles.filter((role) =>
    /^gravity-low-water-pocket-advancing-one-pitch/.test(role)).length,
  5);
  assert.ok(roles.includes('five-turn-helical-water-lifting-passage'));
  assert.ok(roles.includes(
    'continuous-water-discharge-from-top-of-spiral-passage'));
  disposeModel(model.root);
});

test('movement 443 source evidence and reconstruction limits are explicit', () => {
  const movement = catalog.movements[442];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate443;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_443.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Archimedes’s screw to raising water.*supply stream being the motive power/);
  assert.match(movement.description, /oblique shaft.*spiral passage/);
  assert.match(movement.description, /lower end of which is immersed/);
  assert.match(movement.description,
    /conveyed upward continuously.*discharged at the top/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*Animated control is unavailable/);
  assert.equal(dynamics.fluidCaptureLeakageSloshPressureViscosityPaddleHydrodynamicsBearingFrictionAndRotationalInertiaModeled,
    false);
  assert.match(dynamics.pocketTransport,
    /gravity-low generator.*exactly one screw pitch per rotor revolution/);
  assert.match(dynamics.pocketTransport,
    /fades to zero scale at the outlet/);
  assert.match(dynamics.streamDrive,
    /positive local-z direction.*moment.*positive/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateLowerWheelCenterPixels, [391, 367]);
  assert.deepEqual(plate.approximateScrewUpperEndPixels, [86, 75]);
  assert.deepEqual(plate.approximateUpperDischargePixels, [73, 117]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /inclined cylindrical screw body.*internal dotted helix.*coaxial paddle wheel/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, screw diameter, pitch, turn count.*independently engineered/);
  disposeModel(model.root);
});

test('movement 443 reconstructed axis is oblique, fixed, and immersed only at its lower end', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { geometry, sourcePose } = model.root.userData;
  const expectedAxis = geometry.upperEnd.clone()
    .sub(geometry.lowerEnd)
    .normalize();
  const mappedYAxis = Y_AXIS.clone()
    .applyQuaternion(geometry.assemblyQuaternion);
  const projectedGravityWorld = geometry.projectedGravityLocal.clone()
    .applyQuaternion(geometry.assemblyQuaternion);
  const lowerCasingEdge = geometry.lowerEnd.clone().addScaledVector(
    projectedGravityWorld,
    geometry.casingRadius,
  );

  vectorNear(geometry.axisDirection, expectedAxis, 2e-16,
    'oblique axis direction');
  vectorNear(mappedYAxis, geometry.axisDirection, 2e-16,
    'assembly local y maps to shaft axis');
  near(geometry.axisDirection.length(), 1, 2e-16, 'unit axis');
  assert.ok(geometry.axisDirection.x < 0);
  assert.ok(geometry.axisDirection.y > 0);
  near(geometry.screwLength,
    geometry.upperEnd.distanceTo(geometry.lowerEnd), 0,
  'source endpoint length');
  near(geometry.screwPitch,
    geometry.screwLength / geometry.helixTurns, 0,
  'five-turn pitch');
  vectorNear(geometry.projectedGravityLocal,
    new THREE.Vector3(-1, 0, 0), 2e-16,
  'gravity-low casing generator');
  assert.ok(lowerCasingEdge.y < geometry.streamSurfaceY,
    'lower casing sector is immersed');
  assert.ok(geometry.upperEnd.y > geometry.streamSurfaceY,
    'upper discharge is above stream');
  assert.ok(geometry.waterWheelCenter.y < geometry.streamSurfaceY + 0.2,
    'lower wheel center lies at stream level');
  near(sourcePose.screwAngle, 0, 0, 'source screw angle');
  near(sourcePose.waterWheelAngle, 0, 0, 'source wheel angle');
  disposeModel(model.root);
});

test('movement 443 lower water wheel and screw flight have exact one-to-one angle, speed, and acceleration', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;
  const customSpeed = 0.73;
  const customAcceleration = -0.14;

  for (const revolutions of [0, 0.13, 0.91, 1.27, 2.58, 4.93]) {
    const angle = FULL_TURN * revolutions;
    const state = stateAtInputAngle(
      angle,
      customSpeed,
      customAcceleration,
    );
    sameAngle(state.waterWheelAngle, state.screwAngle, 0,
      `one-to-one angle at ${revolutions} revolutions`);
    near(state.waterWheelAngularSpeed, state.screwAngularSpeed, 0,
      `one-to-one speed at ${revolutions} revolutions`);
    near(state.waterWheelAngularAcceleration,
      state.screwAngularAcceleration, 0,
      `one-to-one acceleration at ${revolutions} revolutions`);
    near(state.screwAngularSpeed, customSpeed, 0, 'input speed');
    near(state.screwAngularAcceleration, customAcceleration, 0,
      'input acceleration');
    update(angle / geometry.inputAngularSpeed);
    sameAngle(blocks.rotor.rotation.y, state.screwAngle, 1e-14,
      `rendered rigid rotor angle at ${revolutions}`);
  }
  disposeModel(model.root);
});

test('movement 443 lower stream force has the positive moment required by the screw rotation', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  near(geometry.streamDriveTorque,
    geometry.waterWheelRadius * geometry.representativeStreamForce,
    0, 'stream torque magnitude');
  assert.ok(geometry.streamDriveTorque > 0);
  for (const revolutions of [0, 0.17, 0.72, 1.31, 3.44, 4.89]) {
    const state = stateAtInputAngle(FULL_TURN * revolutions);
    assert.ok(state.screwAngularSpeed > 0);
    assert.ok(state.streamDriveTorque > 0);
    assert.ok(state.streamVelocityAtBottomDotWheelTangent > 0,
      `stream agrees with immersed-paddle tangent at ${revolutions}`);
  }
  disposeModel(model.root);
});

test('movement 443 every water packet lies on the rotating helix at the fixed gravity-low generator', () => {
  const model = createMovementModel(catalog.movements[442]);
  const {
    geometry,
    stateAtInputAngle,
    worldFromAssemblyLocal,
  } = model.root.userData;

  for (const revolutions of [0, 0.11, 0.87, 1.24, 2.63, 4.91]) {
    const state = stateAtInputAngle(FULL_TURN * revolutions);
    state.waterPocketStates.forEach((pocket, index) => {
      sameAngle(pocket.bladeWorldCrossAngle,
        geometry.bottomCrossAngle, 8e-14,
        `pocket ${index} intersects rotating helix at ${revolutions}`);
      near(pocket.localPosition.x,
        geometry.waterPocketRadius * Math.cos(geometry.bottomCrossAngle),
      0, `pocket ${index} gravity-low x`);
      near(pocket.localPosition.z,
        geometry.waterPocketRadius * Math.sin(geometry.bottomCrossAngle),
      0, `pocket ${index} gravity-low z`);
      near(pocket.localPosition.y,
        -geometry.screwLength / 2
          + geometry.screwLength * pocket.axialFraction,
      0, `pocket ${index} axial coordinate`);
      vectorNear(pocket.worldPosition,
        worldFromAssemblyLocal(pocket.localPosition), 0,
      `pocket ${index} world transform`);
    });
  }

  const before = stateAtInputAngle(FULL_TURN * 0.20)
    .waterPocketStates[0];
  const after = stateAtInputAngle(FULL_TURN * 1.20)
    .waterPocketStates[0];
  near(after.localPosition.y - before.localPosition.y,
    geometry.screwPitch, 2e-15,
  'one shaft revolution advances one pitch');
  const worldAdvance = after.worldPosition.clone().sub(before.worldPosition);
  vectorNear(worldAdvance,
    geometry.axisDirection.clone().multiplyScalar(geometry.screwPitch),
  2e-15, 'one-pitch advance follows oblique axis');
  disposeModel(model.root);
});

test('movement 443 each individual flow marker resets only while invisibly C2-faded', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;
  const epsilonRevolutions = 1e-6;

  for (let index = 0; index < geometry.waterPocketCount; index += 1) {
    const resetRevolution = geometry.helixTurns - index;
    const before = stateAtInputAngle(
      FULL_TURN * (resetRevolution - epsilonRevolutions),
    ).waterPocketStates[index];
    const atReset = stateAtInputAngle(
      FULL_TURN * resetRevolution,
    ).waterPocketStates[index];
    const after = stateAtInputAngle(
      FULL_TURN * (resetRevolution + epsilonRevolutions),
    ).waterPocketStates[index];
    assert.ok(before.axialFraction > 0.999999);
    near(atReset.axialFraction, 0, 2e-16,
      `marker ${index} resets at inlet`);
    assert.ok(after.axialFraction < 0.000001);
    assert.ok(before.scale < 2e-12,
      `marker ${index} fades before outlet reset`);
    near(atReset.scale, 0, 0,
      `marker ${index} invisible at reset`);
    assert.ok(after.scale < 2e-12,
      `marker ${index} fades into inlet`);
    update(resetRevolution * geometry.shaftRevolutionDuration);
    assert.equal(blocks.waterPockets[index].visible, false);
    near(blocks.waterPockets[index].scale.x, 0, 0,
      `rendered pocket ${index} has zero reset scale`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN * geometry.helixTurns);
  closure.waterPocketStates.forEach((pocket, index) => {
    vectorNear(pocket.localPosition,
      source.waterPocketStates[index].localPosition, 0,
    `material marker ${index} full transport closure`);
    near(pocket.scale, source.waterPocketStates[index].scale, 0,
      `material marker ${index} scale closure`);
  });
  disposeModel(model.root);
});

test('movement 443 axial water speed and acceleration follow screw pitch exactly', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (const [angle, speed, acceleration] of [
    [0.31, 0.56, 0],
    [5.7, 1.12, -0.23],
    [13.4, -0.44, 0.18],
  ]) {
    const state = stateAtInputAngle(angle, speed, acceleration);
    near(state.axialWaterSpeed,
      geometry.screwPitch * speed / FULL_TURN, 0,
    'pitch-speed relation');
    near(state.axialWaterAcceleration,
      geometry.screwPitch * acceleration / FULL_TURN, 0,
    'pitch-acceleration relation');
  }
  disposeModel(model.root);
});

test('movement 443 update binds the rotor and flow markers while fixed casing supports and trough remain fixed', () => {
  const model = createMovementModel(catalog.movements[442]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.screwAssembly, blocks.base,
    blocks.streamBed, blocks.streamWater, blocks.dischargeTrough,
    blocks.upperDischarge, ...blocks.bearings, ...blocks.bearingSupports];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const shaftRevolutions of [0, 0.31, 0.99, 1.01, 2.47, 4.92]) {
    const time = shaftRevolutions * geometry.shaftRevolutionDuration;
    const state = stateAtTime(time);
    update(time);
    sameAngle(blocks.rotor.rotation.y, state.screwAngle, 2e-15,
      `rotor update at ${shaftRevolutions} revolutions`);
    state.waterPocketStates.forEach((pocket, index) => {
      // Pass 69: each pocket is an annular sector of the passage centred on
      // the gravity-low line at the pocket's axial coordinate.
      const mesh = blocks.waterPockets[index];
      const lowLine = Math.atan2(pocket.localPosition.z, pocket.localPosition.x);
      vectorNear(mesh.position, new THREE.Vector3(geometry.pocketCentreRadius * Math.cos(lowLine),
        pocket.localPosition.y, geometry.pocketCentreRadius * Math.sin(lowLine)), 1e-15,
        `pocket ${index} axial position at ${shaftRevolutions}`);
      const facing = new THREE.Vector3(1, 0, 0).applyEuler(mesh.rotation);
      const radial = new THREE.Vector3(pocket.localPosition.x, 0, pocket.localPosition.z).normalize();
      vectorNear(facing, radial, 1e-12, `pocket ${index} faces the low line at ${shaftRevolutions}`);
      near(mesh.scale.x, pocket.scale, 0,
        `pocket ${index} fade at ${shaftRevolutions}`);
      assert.equal(blocks.waterPockets[index].visible,
        pocket.scale > 0.002);
    });
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${shaftRevolutions}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.transportCycleDuration);
  near(closure.screwAngle, source.screwAngle, 0,
    'rotor full material-cycle closure');
  closure.waterPocketStates.forEach((pocket, index) => vectorNear(
    pocket.localPosition,
    source.waterPocketStates[index].localPosition,
    0,
    `flow marker ${index} timed closure`,
  ));
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.shaftRevolutionDuration);
  assert.ok(model.root.userData.animationTiming.displayCycleDuration >= 11);
  assert.equal(model.root.userData.motion.screwRevolutionsPerMaterialStateCycle,
    geometry.helixTurns);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 443 screw', () => {
  const movement443 = catalog.movements[442];
  const movement507 = catalog.movements[506];
  const model443 = createMovementModel(movement443);
  const model507 = createMovementModel(movement507);

  assert.equal(movement443.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model443.root);
  disposeModel(model507.root);
});
