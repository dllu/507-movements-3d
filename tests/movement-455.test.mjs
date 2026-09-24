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
  'old-two-hinged-vane-rotary-pump-with-fixed-abutment-lower-inlet-and-upper-outlet';
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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

test('movement 455 has one fixed circular casing, one two-valve rotor, two ports, and one fixed closing abutment', () => {
  const movement = catalog.movements[454];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 455);
  assert.equal(movement.number, '455');
  assert.equal(movement.title, 'Old rotary pump');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.casing.parent, model.root);
  assert.equal(blocks.rotor.parent, model.root);
  assert.equal(blocks.abutment.parent, model.root);
  assert.equal(blocks.inlet.parent, model.root);
  assert.equal(blocks.outlet.parent, model.root);
  assert.equal(blocks.valves.length, 2);
  assert.equal(blocks.valves[0].carrier.parent, blocks.rotor);
  assert.equal(blocks.valves[1].carrier.parent, blocks.rotor);
  assert.equal(blocks.valves[0].hinge.parent, blocks.valves[0].carrier);
  assert.equal(blocks.valves[1].hinge.parent, blocks.valves[1].carrier);
  near(blocks.valves[1].carrier.rotation.z, Math.PI, 0,
    'diametrically opposite second carrier');
  assert.equal(geometry.valveCount, 2);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.valve1Independent, false);
  assert.equal(degreesOfFreedom.valve2Independent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'fixed-circular-outer-cylinder-casing',
    'central-two-valve-rotor-turning-clockwise',
    'hinged-sweeping-valve-1',
    'hinged-sweeping-valve-2',
    'fixed-lower-side-abutment-folding-each-passing-valve',
    'fixed-lower-aperture-water-entrance',
    'fixed-upper-aperture-water-exit',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 455 source record preserves the port, wall-fit, and abutment claims while disclosing the fold reconstruction', () => {
  const movement = catalog.movements[454];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate455;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_455.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Old rotary pump/);
  assert.match(movement.description,
    /Lower aperture entrance.*upper for exit/);
  assert.match(movement.description,
    /Central part revolves with its valves/);
  assert.match(movement.description,
    /fit accurately to inner surface of outer cylinder/);
  assert.match(movement.description,
    /projection.*abutment to close the valves/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.fullFluidPressureLeakageValveImpactFrictionTorqueAndCavitationModeled,
    false,
  );
  assert.match(dynamics.flowModel,
    /captioned direction only.*not a pressure-resolved performance prediction/);
  assert.match(dynamics.valveContactModel,
    /baked polygon-contact closing branch.*positive contact moment arm.*prescribed hold and quintic return/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateCasingCenterPixels, [276, 250]);
  assert.deepEqual(plate.approximateRotorLeftHingePixels, [191, 237]);
  assert.deepEqual(plate.approximateRotorRightHingePixels, [354, 244]);
  assert.deepEqual(plate.approximateAbutmentCenterPixels, [344, 349]);
  assert.deepEqual(plate.approximateLowerEntranceCenterPixels, [259, 438]);
  assert.deepEqual(plate.approximateUpperExitCenterPixels, [434, 116]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /circular fixed casing.*two opposite hinge pins.*bottom inlet arrow.*upper-right outlet arrow.*hatched fixed wedge/);
  assert.match(evidence.reconstructionDisclosure,
    /no casing depth, rotor speed, valve fold law.*independently engineered/);
  disposeModel(model.root);
});

test('movement 455 source pose has two fully extended wall-fitting valves and clockwise transport', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.clockwise, true);
  near(sourcePose.rotorAngle, 0, 0, 'source rotor angle');
  assert.deepEqual(sourcePose.valveFoldFractions, [0, 0]);
  near(sourcePose.valveHingeAngles[1] - sourcePose.valveHingeAngles[0],
    Math.PI, 0, 'source hinges opposite');
  assert.equal(source.clockwise, true);
  assert.ok(source.rotorAngularSpeed < 0);
  assert.equal(source.foldedValveIndex, null);
  for (const valve of source.valves) {
    assert.equal(valve.sealedToCasing, true);
    near(valve.flapAngle, 0, 0, 'source blade radial');
    near(valve.tipRadius, geometry.casingInnerRadius, 4e-16,
      'source blade reaches wall');
  }
  disposeModel(model.root);
});

test('movement 455 rotor keeps its valves diametrically opposite and wall-sealed outside the abutment sector', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    angleNear(
      state.valves[1].hingeAngle - state.valves[0].hingeAngle,
      Math.PI,
      0,
      `opposite hinges at ${sample}`,
    );
    for (const valve of state.valves) {
      near(valve.hingePoint.length(), geometry.rotorRadius, 4e-16,
        `fixed hinge radius at ${sample}`);
      if (valve.sealedToCasing) {
        near(valve.tipRadius, geometry.casingInnerRadius, 7e-16,
          `wall fit outside abutment at ${sample}`);
        near(valve.flapAngle, 0, 0,
          `radial valve outside abutment at ${sample}`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 455 each folding valve remains inside the fixed abutment clearance envelope and they never fold together', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let foldedSamples = 0;
  let fullyFoldedSamples = 0;
  for (let sample = 0; sample < 60000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 60000);
    const folded = state.valves.filter(({ closedByAbutment }) =>
      closedByAbutment);
    assert.ok(folded.length <= 1,
      `at most one vane in the closing/return sequence at ${sample}`);
    for (const valve of folded) {
      foldedSamples += 1;
      assert.ok(valve.tipRadius <= valve.abutmentInnerRadius + 1e-14,
        `valve tip clears fixed wedge at ${sample}`);
      assert.ok(valve.tipRadius <= geometry.casingInnerRadius + 1e-14);
      if (valve.foldFraction === 1) {
        fullyFoldedSamples += 1;
        near(valve.flapAngle, geometry.maximumFoldAngle, 0,
          `full fold angle at ${sample}`);
        assert.ok(valve.tipRadius < geometry.casingInnerRadius - 0.4);
      }
    }
  }
  assert.ok(foldedSamples > 0);
  assert.ok(fullyFoldedSamples > 0);
  disposeModel(model.root);
});

test('movement 455 contact closure and release remain continuous with a smooth prescribed return', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { foldProfileAtHingeAngle, geometry } = model.root.userData;
  for(let i=0;i<=3600;i++){
    const angle=-i*Math.PI/1800,before=foldProfileAtHingeAngle(angle-1e-8),after=foldProfileAtHingeAngle(angle+1e-8);
    assert.ok(Math.abs(before.fraction-after.fraction)<1e-6,'continuous finite contact branch');
  }
  for(const degrees of [145,178]){
    const profile=foldProfileAtHingeAngle(-degrees*Math.PI/180);
    near(profile.fractionDerivativeByTravel,0,1e-12,'zero return endpoint speed');
    near(profile.fractionSecondDerivativeByTravel,0,1e-12,'zero return endpoint acceleration');
  }
  const midHoldAngle=geometry.abutmentStartAngle-(geometry.foldInTravel+geometry.foldHoldEndTravel)/2;
  near(foldProfileAtHingeAngle(midHoldAngle).fraction,1,0,'closed hold');
  disposeModel(model.root);
});

test('movement 455 second valve repeats the first valve fold exactly one half-turn later', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample <= 20000; sample += 1) {
    const angle = Math.PI * sample / 20000;
    const first = stateAtInputAngle(angle).valves[0];
    const secondLater = stateAtInputAngle(angle + Math.PI).valves[1];
    near(secondLater.foldFraction, first.foldFraction, 2e-13, // steeper square-block branch
      `half-turn fold repeat at ${sample}`);
    near(secondLater.flapAngle, first.flapAngle, 4e-14,
      `half-turn flap-angle repeat at ${sample}`);
    near(secondLater.tipRadius, first.tipRadius, 3e-14,
      `half-turn tip repeat at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 455 flap angular speed and acceleration match the C2 profile derivatives', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.24, 0.36, 1.27, 1.45]) {
    const before = stateAtInputAngle(angle - step).valves[0];
    const state = stateAtInputAngle(angle).valves[0];
    const after = stateAtInputAngle(angle + step).valves[0];
    const numericSpeed = (after.flapAngle - before.flapAngle)
      / (2 * step) * geometry.inputAngularSpeed;
    near(state.flapAngularSpeed, numericSpeed, 3e-9,
      `flap speed at ${angle}`);
    const numericAcceleration = (
      after.flapAngularSpeed - before.flapAngularSpeed
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.flapAngularAcceleration, numericAcceleration, 2e-8,
      `flap acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 455 schematic swept-rate diagnostic follows sealing fraction without claiming pressure performance', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample <= 16000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    assert.ok(state.activeSealFactor >= 1 - 1e-14);
    assert.ok(state.activeSealFactor <= 2 + 1e-14);
    near(state.schematicSweptFlowRate,
      geometry.sweptVolumePerRadian
        * geometry.inputAngularSpeed * state.activeSealFactor,
    2e-15, `schematic sweep diagnostic at ${sample}`);
  }
  const source = stateAtInputAngle(0);
  near(source.activeSealFactor, 2, 0, 'two source seals');
  near(source.schematicSweptFlowRate,
    2 * geometry.sweptVolumePerRadian * geometry.inputAngularSpeed,
  0, 'source sweep diagnostic');
  disposeModel(model.root);
});

test('movement 455 renderer rotates only the rotor and dependent hinges while casing, ports, and abutment remain fixed', () => {
  const model = createMovementModel(catalog.movements[454]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.casing, blocks.abutment,
    blocks.inlet, blocks.outlet, blocks.frontCover];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const rotationVector = (block) => new THREE.Vector3(
    block.rotation.x,
    block.rotation.y,
    block.rotation.z,
  );
  const fixedRotations = fixedBlocks.map(rotationVector);

  for (const phase of [0, 0.08, 0.16, 0.25, 0.5, 0.58, 0.66,
    0.75, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.rotor.rotation.z, state.rotorAngle, 0,
      `rotor angle at ${phase}`);
    state.valves.forEach((valve, index) => near(
      blocks.valves[index].hinge.rotation.z,
      valve.flapAngle,
      0,
      `valve ${index + 1} fold at ${phase}`,
    ));
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedPositions[index], 0,
        `fixed position at ${phase}`);
      vectorNear(rotationVector(block), fixedRotations[index], 0,
        `fixed orientation at ${phase}`);
    });
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  angleNear(closure.rotorAngle, source.rotorAngle, 0,
    'rotor pose closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 455 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement455 = catalog.movements[454];
  const movement507 = catalog.movements[506];
  const model455 = createMovementModel(movement455);
  const model507 = createMovementModel(movement507);
  model455.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model455.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement455.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model455.root);
  disposeModel(model507.root);
});
