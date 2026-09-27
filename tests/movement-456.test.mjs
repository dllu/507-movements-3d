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
  'cary-fixed-heart-cam-two-opposed-radial-sliding-piston-rotary-pump';
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

test('movement 456 separates the fixed heart cam from rotating axle A, drum B, and two radial pistons c', () => {
  const movement = catalog.movements[455];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 456);
  assert.equal(movement.number, '456');
  assert.equal(movement.title, 'Cary’s rotary pump');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.casing.parent, model.root);
  assert.equal(blocks.fixedHeartCam.parent, model.root);
  assert.equal(blocks.drum.parent, model.root);
  assert.equal(blocks.axle.parent, blocks.drum);
  assert.equal(blocks.drumShell.parent, blocks.drum);
  assert.equal(blocks.pistons.length, 2);
  assert.equal(blocks.pistons[0].carrier.parent, blocks.drum);
  assert.equal(blocks.pistons[1].carrier.parent, blocks.drum);
  assert.equal(blocks.pistons[0].piston.parent,
    blocks.pistons[0].carrier);
  assert.equal(blocks.pistons[1].piston.parent,
    blocks.pistons[1].carrier);
  near(blocks.pistons[1].carrier.rotation.z, Math.PI, 0,
    'second piston guide diametrically opposite');
  assert.equal(blocks.portSeparatorE.parent, model.root);
  assert.equal(blocks.inletF.parent, model.root);
  assert.equal(blocks.dischargeH.shell.parent, model.root);
  assert.equal(geometry.pistonCount, 2);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.piston1Independent, false);
  assert.equal(degreesOfFreedom.piston2Independent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'fixed-heart-shaped-cam-a-surrounding-axle-A',
    'revolving-drum-B-rigidly-attached-to-axle-A',
    'cam-driven-sliding-piston-c-1',
    'cam-driven-sliding-piston-c-2',
    'fixed-port-separator-E-cleared-by-retracted-piston',
    'fixed-suction-pipe-F-feeding-port-L',
    'fixed-discharge-pipe-H-connected-from-port-M',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 456 source record maps A, B, a, c, E, F, H, L, and M without inventing source timing', () => {
  const movement = catalog.movements[455];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate456;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_456.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Cary’s rotary pump/);
  assert.match(movement.description,
    /revolving drum, B, attached to an axle, A/);
  assert.match(movement.description,
    /Heart-shaped cam, a.*is also fixed/);
  assert.match(movement.description,
    /sliding-pistons, c, c.*obedience to form of cam/);
  assert.match(movement.description, /ports, L and M/);
  assert.match(movement.description,
    /forced back to its seat when opposite E.*other piston.*inner side/);
  assert.match(movement.description,
    /exit-pipe, H.*suction-pipe, F/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.fullFluidPressureLeakagePistonSealFrictionCamContactForceTorqueAndCavitationModeled,
    false,
  );
  assert.match(dynamics.camContactModel,
    /finite roller.*heart cam.*working dwell/);
  assert.match(dynamics.flowModel,
    /F-to-L suction and M-to-H discharge.*not predicted/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateAxleACenterPixels, [197, 210]);
  assert.deepEqual(plate.approximatePortEPixels, [207, 350]);
  assert.deepEqual(plate.approximatePortLPixels, [119, 346]);
  assert.deepEqual(plate.approximatePortMPixels, [270, 337]);
  assert.deepEqual(plate.approximateSuctionFCenterPixels, [113, 425]);
  assert.deepEqual(plate.approximateDischargeHCenterPixels, [399, 207]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /clockwise arrows on drum B.*stationary heart profile.*inlet F.*separator E.*port M.*curved H/);
  assert.match(evidence.reconstructionDisclosure,
    /no cam equation, casing depth, drum speed.*independently engineered/);
  disposeModel(model.root);
});

test('movement 456 source pose and port identities preserve the engraved clockwise flow routing', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  assert.equal(sourcePose.clockwise, true);
  near(sourcePose.rotorAngle, geometry.sourceRotorAngle, 0,
    'source diagonal drum angle');
  assert.equal(source.clockwise, true);
  assert.ok(source.rotorAngularSpeed < 0);
  assert.equal(source.suctionPipe, 'F');
  assert.equal(source.inletChamberPort, 'L');
  assert.equal(source.dischargeEntryPort, 'M');
  assert.equal(source.dischargePipe, 'H');
  assert.deepEqual(sourcePose.pistonCamRadii,
    source.pistons.map(({ camRadius }) => camRadius));
  assert.deepEqual(sourcePose.pistonTipRadii,
    source.pistons.map(({ tipRadius }) => tipRadius));
  disposeModel(model.root);
});

test('movement 456 every piston inner end follows the fixed heart cam and its body length remains constant', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { camRadiusAtAngle, geometry, stateAtInputAngle } =
    model.root.userData;
  for (let sample = 0; sample < 30000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 30000);
    for (const piston of state.pistons) {
      near(piston.camRadius, camRadiusAtAngle(piston.absoluteAngle), 0,
        `fixed cam radius at ${sample}`);
      near(piston.followerPoint.length(), piston.camRadius, 4e-16,
        `inner follower contact at ${sample}`);
      near(piston.tipRadius - piston.camRadius,
        geometry.pistonLength, 5e-16,
      `constant piston body length at ${sample}`);
      near(piston.tipPoint.distanceTo(piston.followerPoint),
        geometry.pistonLength, 7e-16,
      `radial piston endpoint spacing at ${sample}`);
      assert.ok(piston.camRadius >= geometry.camMinimumRadius - 1e-14);
      assert.ok(piston.camRadius <= geometry.camMaximumRadius + 1e-14);
    }
  }
  disposeModel(model.root);
});

test('movement 456 dwell cam seats a piston at E while the opposite remains against the wall', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 720; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 720);
    for (let i=0;i<2;i++) if(state.pistons[i].oppositePortSeparator)
      near(state.pistons[1-i].tipRadius,geometry.casingInnerRadius,1e-12,'opposite working dwell');
  }

  const firstAtEInput = geometry.sourceRotorAngle + Math.PI / 2;
  const firstAtE = stateAtInputAngle(firstAtEInput);
  near(firstAtE.pistons[0].absoluteAngle,
    geometry.separatorCenterAngle, 0, 'first piston at E');
  near(firstAtE.pistons[0].tipRadius,
    geometry.drumOuterRadius, 5e-16, 'first piston retracted to seat');
  near(firstAtE.pistons[0].extensionFromSeat, 0, 5e-16,
    'zero extension at E');
  near(firstAtE.pistons[1].tipRadius,
    geometry.casingInnerRadius, 5e-16, 'opposite piston reaches wall');
  assert.equal(firstAtE.pistons[1].touchesCasing, true);

  const secondAtE = stateAtInputAngle(firstAtEInput + Math.PI);
  near(secondAtE.pistons[1].tipRadius,
    geometry.drumOuterRadius, 5e-16, 'second piston retracted to seat');
  near(secondAtE.pistons[0].tipRadius,
    geometry.casingInnerRadius, 5e-16, 'first piston now reaches wall');
  disposeModel(model.root);
});

test('movement 456 retracting piston clears fixed separator E throughout its angular sector', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { geometry, separatorInnerRadiusAtAngle, stateAtInputAngle } =
    model.root.userData;
  let separatorSamples = 0;
  for (let sample = 0; sample < 60000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 60000);
    const crossing = state.pistons.filter(
      ({ oppositePortSeparator }) => oppositePortSeparator,
    );
    assert.ok(crossing.length <= 1,
      `only one piston can cross narrow E sector at ${sample}`);
    for (const piston of crossing) {
      separatorSamples += 1;
      near(piston.separatorInnerRadius,
        separatorInnerRadiusAtAngle(piston.absoluteAngle), 0,
      `fixed separator boundary at ${sample}`);
      assert.ok(piston.tipRadius < piston.separatorInnerRadius,
        `positive E clearance at ${sample}`);
      assert.ok(piston.separatorInnerRadius - piston.tipRadius
        <= geometry.separatorClearance + 1e-14);
    }
  }
  assert.ok(separatorSamples > 0);
  disposeModel(model.root);
});

test('movement 456 analytic piston radial velocity and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.31, 1.17, 2.64, 4.22, 5.71]) {
    const before = stateAtInputAngle(angle - step).pistons[0];
    const state = stateAtInputAngle(angle).pistons[0];
    const after = stateAtInputAngle(angle + step).pistons[0];
    const numericVelocity = (after.camRadius - before.camRadius)
      / (2 * step) * geometry.inputAngularSpeed;
    // Central differences at step 1e-6 are round-off limited (~eps/step)
    // on the steeper heart-cam flanks.
    near(state.camRadiusVelocity, numericVelocity, 1e-9,
      `radial velocity at ${angle}`);
    const numericAcceleration = (
      after.camRadiusVelocity - before.camRadiusVelocity
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.camRadiusAcceleration, numericAcceleration, 7e-10,
      `radial acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 456 ideal swept-rate is a disclosed geometric diagnostic and uniform for uniform drum speed', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { stateAtInputAngle } = model.root.userData;
  const reference = stateAtInputAngle(0).schematicSweptFlowRate;
  assert.ok(reference > 0);
  for (let sample = 0; sample <= 12000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    near(state.schematicSweptFlowRate, reference, 0,
      `uniform geometric sweep at ${sample}`);
    assert.equal(state.clockwise, true);
  }
  disposeModel(model.root);
});

test('movement 456 renderer rotates A/B and translates each c while cam a, casing, E, F, and H remain fixed', () => {
  const model = createMovementModel(catalog.movements[455]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.casing, blocks.fixedHeartCam,
    blocks.portSeparatorE, blocks.inletF, blocks.dischargeH.shell,
    blocks.frontCover];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const fixedQuaternions = fixedBlocks.map((block) =>
    block.quaternion.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.drum.rotation.z, state.rotorAngle, 0,
      `drum angle at ${phase}`);
    state.pistons.forEach((piston, index) => near(
      blocks.pistons[index].piston.position.x,
      piston.camRadius + geometry.pistonLength / 2,
      0,
      `piston c ${index + 1} translation at ${phase}`,
    ));
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedPositions[index], 0,
        `fixed position at ${phase}`);
      near(block.quaternion.angleTo(fixedQuaternions[index]), 0, 0,
        `fixed orientation at ${phase}`);
    });
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  angleNear(closure.rotorAngle, source.rotorAngle, 2e-15,
    'drum pose closure');
  near(closure.pistons[0].camRadius, source.pistons[0].camRadius, 5e-16,
    'piston closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 6.2);
  assert.ok(model.root.userData.animationTiming.displayCycleDuration >= 6.2);
  disposeModel(model.root);
});

test('movement 456 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement456 = catalog.movements[455];
  const movement507 = catalog.movements[506];
  const model456 = createMovementModel(movement456);
  const model507 = createMovementModel(movement507);
  model456.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model456.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement456.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model456.root);
  disposeModel(model507.root);
});
