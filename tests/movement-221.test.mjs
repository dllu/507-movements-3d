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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

test('movement 221 is an elliptical driver, guided compound B, and output A', () => {
  const movement = catalog.movements[220];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 221);
  assert.equal(movement.number, '221');
  assert.equal(
    movement.title,
    'Elliptical Driver and Guided Compound-Idler Output',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'focus-mounted-elliptical-driver-guided-moving-compound-idler-irregular-output',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'elliptical-c-drives-guided-compound-b-which-drives-output-a',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(blocks.driverBody.parent, blocks.driverAssembly.userData.rotor);
  assert.equal(blocks.guideFloor.parent, blocks.driverAssembly.userData.rotor);
  assert.equal(blocks.guideOuterRail.parent, blocks.driverAssembly.userData.rotor);
  assert.equal(blocks.guideInnerIsland.parent, blocks.driverAssembly.userData.rotor);
  assert.equal(blocks.compoundOuterGear.parent, blocks.compound.userData.rotor);
  assert.equal(blocks.compoundPinion.parent, blocks.compound.userData.rotor);
  assert.equal(blocks.carrierBeam.parent, blocks.carrier);
  assert.equal(blocks.guideRoller.parent, blocks.carrier);
  assert.equal(blocks.carrierCompoundAnchor.parent, blocks.carrier);
  assert.equal(blocks.outputGear.parent, model.root);
  assert.equal(blocks.compound.parent, model.root);
  assert.equal(blocks.driverAssembly.parent, model.root);

  for (const rotor of [
    blocks.driverAssembly,
    blocks.driverShaft,
    blocks.outputGear,
    blocks.outputShaft,
    blocks.compound,
    blocks.compoundOuterGear,
    blocks.compoundPinion,
  ]) {
    assert.ok(rotor.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  }
  assert.deepEqual(transmission.toothCounts, {
    compoundOuter: 32,
    compoundPinion: 15,
    ellipse: 30,
    output: 32,
  });
  assert.equal(geometry.outputTeeth, geometry.compoundOuterTeeth);
  assert.ok(geometry.compoundPinionPitchRadius
    < geometry.compoundOuterPitchRadius);
  near(
    geometry.carrierLength,
    geometry.outputPitchRadius + geometry.compoundOuterPitchRadius,
    0,
    'A-B arm is the fixed center distance of its outer gear pair',
  );
  assert.equal(transmission.armMotion, 'vibrating');
  assert.equal(transmission.variableOutputSpeed, true);

  const inventedFrames = [];
  model.root.traverse((object) => {
    if (/support-frame|base-rail|backdrop/.test(object.userData.role ?? '')) {
      inventedFrames.push(object);
    }
  });
  assert.deepEqual(inventedFrames, []);
  assert.ok(model.root.userData.cameraFitBounds?.isBox3);
  disposeModel(model.root);
});

test('movement 221 reconstructs the measured A, B, D centers and focal ellipse', () => {
  const model = createMovementModel(catalog.movements[220]);
  const {
    geometry,
    sourcePointToModel,
    sourceReference,
    stateAtDriverTravel,
  } = model.root.userData;
  const plate = sourceReference.plate221;

  assert.equal(sourceReference.sourceUrl, catalog.movements[220].sourceUrl);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual([
    plate.inferredOutputTeeth,
    plate.inferredCompoundOuterTeeth,
    plate.inferredCompoundPinionTeeth,
    plate.inferredEllipseTeeth,
  ], [32, 32, 15, 30]);

  const rasterA = sourcePointToModel(plate.rasterOutputCenterA);
  const rasterB = sourcePointToModel(plate.rasterCompoundCenterB);
  const rasterD = sourcePointToModel(plate.rasterDriverCenterD);
  vector2Near(
    new THREE.Vector2(rasterA.x, rasterA.y),
    geometry.outputCenter,
    0,
    'engraved A center',
  );
  vector2Near(
    new THREE.Vector2(rasterB.x, rasterB.y),
    geometry.sourceCompoundCenter,
    0,
    'engraved B center',
  );
  vector3Near(rasterD, new THREE.Vector3(), 0, 'engraved D center');
  vector2Near(
    geometry.sourceCalculatedCompoundCenter,
    geometry.sourceCompoundCenter,
    7e-14,
    'parallel ellipse and arm-circle intersection reproduces B',
  );
  near(
    geometry.outputCenter.distanceTo(geometry.sourceCompoundCenter),
    geometry.carrierLength,
    7e-14,
    'source A-B link length',
  );
  near(
    plate.rasterPitchSemiMajor * geometry.sourceScale,
    geometry.semiMajor,
    0,
    'engraved ellipse major semi-axis',
  );
  near(
    plate.rasterPitchSemiMinor * geometry.sourceScale,
    geometry.semiMinor,
    0,
    'engraved ellipse minor semi-axis',
  );
  near(
    Math.sqrt(geometry.semiMajor ** 2 - geometry.semiMinor ** 2),
    geometry.focalDistance,
    2e-16,
    'D is the upper focus, not the geometric ellipse center',
  );

  const sourceState = stateAtDriverTravel(0);
  vector2Near(
    sourceState.compoundCenter,
    geometry.sourceCompoundCenter,
    7e-14,
    'source compound center',
  );
  near(
    sourceState.contactParameter,
    geometry.sourceContactParameter,
    0,
    'source ellipse contact parameter',
  );
  near(sourceState.driverAngle, 0, 0, 'source C angle');
  near(sourceState.compoundAngle, 0, 3e-14, 'source compound B angle');
  near(
    sourceState.outputAngle,
    geometry.sourceOutputAngle,
    3e-14,
    'source A angle',
  );
  disposeModel(model.root);
});

test('movement 221 uses one common pitch and a real recessed parallel guide', () => {
  const model = createMovementModel(catalog.movements[220]);
  const {
    blocks,
    geometry,
    parameterAtPitchArc,
    pitchArcFromZero,
  } = model.root.userData;

  assert.equal(blocks.driverTeeth.length, geometry.ellipseTeeth);
  assert.equal(geometry.driverToothPitchArcs.length, geometry.ellipseTeeth);
  assert.equal(geometry.driverToothParameters.length, geometry.ellipseTeeth);
  for (let index = 0; index < geometry.ellipseTeeth; index += 1) {
    const targetArc = geometry.driverToothPitchArcs[index];
    near(
      targetArc,
      geometry.sourcePitchArc + index * geometry.circularPitch,
      0,
      `driver tooth ${index} equal-pitch target`,
    );
    near(
      pitchArcFromZero(geometry.driverToothParameters[index]),
      targetArc,
      2.5e-14,
      `driver tooth ${index} equal-pitch inverse`,
    );
    near(
      parameterAtPitchArc(targetArc),
      geometry.driverToothParameters[index],
      0,
      `driver tooth ${index} parameter inverse`,
    );
    assert.equal(
      blocks.driverTeeth[index].userData.role,
      'equal-pitch-elliptical-driver-tooth',
    );
  }
  near(
    geometry.pitchPerimeter,
    geometry.circularPitch * geometry.ellipseTeeth,
    0,
    'ellipse perimeter is thirty circular pitches',
  );
  for (const circularGear of [
    blocks.outputGear,
    blocks.compoundOuterGear,
    blocks.compoundPinion,
  ]) {
    near(
      circularGear.userData.module,
      geometry.module,
      3e-17,
      `${circularGear.userData.role} common module`,
    );
    assert.equal(circularGear.userData.toothProfile, 'true-involute');
  }

  assert.equal(blocks.guideFloor.userData.guideGrooveFloor, true);
  assert.equal(blocks.guideRoller.userData.guideFollower, true);
  assert.ok(geometry.guideOuterDistance > geometry.grooveOuterDistance);
  assert.ok(geometry.grooveOuterDistance > geometry.grooveInnerDistance);
  near(
    geometry.grooveOuterDistance - geometry.grooveInnerDistance,
    2 * geometry.grooveHalfWidth,
    2e-16,
    'guide g-h channel width',
  );
  assert.ok(geometry.grooveHalfWidth > geometry.guideRollerRadius);
  near(
    geometry.grooveHalfWidth - geometry.guideRollerRadius,
    0.003,
    2e-17,
    'roller running clearance in recessed guide',
  );
  assert.ok(geometry.driverGearZ > geometry.circularGearZ);
  const meshPlaneClearance = geometry.driverGearZ - geometry.driverGearDepth / 2
    - (geometry.circularGearZ + geometry.circularGearDepth / 2);
  near(meshPlaneClearance, 0.08, 5e-17,
    'small-pinion plane clears compound outer-wheel plane');
  const guideToRearGearClearance = geometry.circularGearZ
    - geometry.circularGearDepth / 2
    - (geometry.guideRailZ + geometry.guideRailDepth / 2);
  assert.ok(guideToRearGearClearance > 0.11);
  disposeModel(model.root);
});

test('movement 221 preserves both meshes, arm, and guide through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[220]);
  const {
    driverTravelAtContactParameter,
    geometry,
    stateAtDriverTravel,
  } = model.root.userData;
  let maximumArmError = 0;
  let maximumGuideError = 0;
  let maximumNormalError = 0;
  let maximumOuterCenterError = 0;
  let maximumSmallNoSlipError = 0;
  let maximumOuterNoSlipError = 0;
  let maximumInverseError = 0;
  let minimumOutputRatio = Infinity;
  let maximumOutputRatio = -Infinity;
  let minimumCarrierAngle = Infinity;
  let maximumCarrierAngle = -Infinity;
  let previousParameter = Infinity;
  for (let index = 0; index <= 32768; index += 1) {
    const travel = index / 32768 * FULL_TURN;
    const state = stateAtDriverTravel(travel);
    assert.ok(state.contactParameter <= previousParameter + 2e-14,
      `moving contact parameter reverses at sample ${index}`);
    previousParameter = state.contactParameter;
    maximumArmError = Math.max(maximumArmError, state.armLengthError);
    maximumGuideError = Math.max(
      maximumGuideError,
      state.guideConstraintError,
    );
    maximumNormalError = Math.max(
      maximumNormalError,
      state.pinionCenterNormalError,
    );
    maximumOuterCenterError = Math.max(
      maximumOuterCenterError,
      state.outerCenterDistanceError,
    );
    maximumSmallNoSlipError = Math.max(
      maximumSmallNoSlipError,
      state.smallMeshNoSlipError,
    );
    maximumOuterNoSlipError = Math.max(
      maximumOuterNoSlipError,
      state.outerNoSlipError,
    );
    maximumInverseError = Math.max(
      maximumInverseError,
      Math.abs(
        driverTravelAtContactParameter(state.contactParameter) - travel
      ),
    );
    minimumOutputRatio = Math.min(
      minimumOutputRatio,
      state.outputPerDriverAngle,
    );
    maximumOutputRatio = Math.max(
      maximumOutputRatio,
      state.outputPerDriverAngle,
    );
    minimumCarrierAngle = Math.min(minimumCarrierAngle, state.carrierAngle);
    maximumCarrierAngle = Math.max(maximumCarrierAngle, state.carrierAngle);
    near(state.contactNormal.dot(state.contactTangent), 0, 8e-16,
      `contact frame orthogonality at sample ${index}`);
  }
  assert.ok(maximumArmError < 1.7e-14);
  assert.ok(maximumGuideError < 1.9e-15);
  assert.ok(maximumNormalError < 1.5e-15);
  assert.ok(maximumOuterCenterError < 9e-16);
  assert.ok(maximumSmallNoSlipError < 4.1e-15);
  assert.ok(maximumOuterNoSlipError < 8e-15);
  assert.ok(maximumInverseError < 4.5e-15);
  near(previousParameter, geometry.sourceContactParameter - FULL_TURN, 2e-15,
    'one driver turn traverses one full ellipse');
  assert.ok(minimumOutputRatio > 0.97,
    'output A never reverses');
  assert.ok(maximumOutputRatio > 3.38,
    'output A has the required irregular speed rise');
  assert.ok(maximumOutputRatio / minimumOutputRatio > 3.47);
  assert.ok(minimumCarrierAngle < geometry.sourceCarrierAngle,
    'arm falls below the source position');
  assert.ok(maximumCarrierAngle > geometry.sourceCarrierAngle + 0.59,
    'arm rises above the source position');
  disposeModel(model.root);
});

test('movement 221 analytic rates and exact two-turn output closure agree', () => {
  const model = createMovementModel(catalog.movements[220]);
  const {
    geometry,
    stateAtDriverTravel,
    transmission,
  } = model.root.userData;
  const step = 1e-5;
  let maximumParameterRateError = 0;
  let maximumCarrierRateError = 0;
  let maximumCompoundRateError = 0;
  let maximumOutputRateError = 0;
  let maximumCenterRateError = 0;
  for (let index = 0; index <= 256; index += 1) {
    const travel = (index + 0.37) / 257 * FULL_TURN;
    const state = stateAtDriverTravel(travel);
    const previous = stateAtDriverTravel(travel - step);
    const next = stateAtDriverTravel(travel + step);
    const derivative = (nextValue, previousValue) => (
      nextValue - previousValue
    ) / (2 * step);
    maximumParameterRateError = Math.max(
      maximumParameterRateError,
      Math.abs(
        derivative(next.contactParameter, previous.contactParameter)
          - state.contactParameterPerDriverAngle
      ),
    );
    maximumCarrierRateError = Math.max(
      maximumCarrierRateError,
      Math.abs(
        derivative(next.carrierAngle, previous.carrierAngle)
          - state.carrierPerDriverAngle
      ),
    );
    maximumCompoundRateError = Math.max(
      maximumCompoundRateError,
      Math.abs(
        derivative(next.compoundAngle, previous.compoundAngle)
          - state.compoundPerDriverAngle
      ),
    );
    maximumOutputRateError = Math.max(
      maximumOutputRateError,
      Math.abs(
        derivative(next.outputAngle, previous.outputAngle)
          - state.outputPerDriverAngle
      ),
    );
    const finiteCenterDerivative = next.compoundCenter.clone()
      .sub(previous.compoundCenter).multiplyScalar(1 / (2 * step));
    maximumCenterRateError = Math.max(
      maximumCenterRateError,
      finiteCenterDerivative.distanceTo(state.compoundCenterPerDriverAngle),
    );
  }
  assert.ok(maximumParameterRateError < 2.4e-9);
  assert.ok(maximumCarrierRateError < 1.2e-9);
  assert.ok(maximumCompoundRateError < 8.3e-9);
  assert.ok(maximumOutputRateError < 6.8e-9);
  assert.ok(maximumCenterRateError < 7.5e-9);

  const source = stateAtDriverTravel(0);
  const closure = stateAtDriverTravel(FULL_TURN);
  near(closure.driverAngle - source.driverAngle, FULL_TURN, 0,
    'one C turn');
  near(
    closure.contactParameter - source.contactParameter,
    -FULL_TURN,
    2e-15,
    'one complete contact traversal',
  );
  vector2Near(closure.compoundCenter, source.compoundCenter, 2e-15,
    'compound center returns');
  near(closure.carrierAngle, source.carrierAngle, 3e-17,
    'vibrating arm returns');
  near(closure.compoundAngle - source.compoundAngle, -2 * FULL_TURN, 0,
    '15-tooth compound pinion makes two reverse turns');
  near(closure.outputAngle - source.outputAngle, 2 * FULL_TURN, 0,
    'equal outer gears give A two forward turns');
  near(transmission.compoundTurnsPerDriverTurn, -2, 0,
    'reported compound closure');
  near(transmission.outputTurnsPerDriverTurn, 2, 0,
    'reported output closure');
  near(
    geometry.pitchPerimeter / geometry.compoundPinionPitchRadius,
    2 * FULL_TURN,
    2e-15,
    'thirty ellipse pitches roll over fifteen pinion teeth',
  );
  disposeModel(model.root);
});

test('movement 221 runtime binds both planes and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[220]);
  const {
    blocks,
    canonicalTimes,
    geometry,
  } = model.root.userData;
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.driverAssembly.userData.rotor.rotation.z, state.driverAngle, 0,
      'rendered C angle');
    near(blocks.driverShaft.userData.rotor.rotation.z, state.driverAngle, 0,
      'rendered D shaft angle');
    near(blocks.outputGear.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered A angle');
    near(blocks.outputShaft.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered A shaft angle');
    near(blocks.compound.userData.rotor.rotation.z, state.compoundAngle, 0,
      'rendered compound B angle');
    vector2Near(
      new THREE.Vector2(blocks.compound.position.x, blocks.compound.position.y),
      state.compoundCenter,
      0,
      'rendered moving B center',
    );
    near(blocks.carrier.rotation.z, state.carrierAngle, 0,
      'rendered vibrating arm angle');
    near(blocks.smallMeshMarker.position.x, state.contactPoint.x, 0,
      'rendered C-B contact x');
    near(blocks.smallMeshMarker.position.y, state.contactPoint.y, 0,
      'rendered C-B contact y');
    near(blocks.outerMeshMarker.position.x, state.outerContactPoint.x, 0,
      'rendered B-A contact x');
    near(blocks.outerMeshMarker.position.y, state.outerContactPoint.y, 0,
      'rendered B-A contact y');
    const armEndWorld = blocks.carrierCompoundAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      new THREE.Vector2(armEndWorld.x, armEndWorld.y),
      state.compoundCenter,
      2.5e-15,
      'rendered arm end is compound center B',
    );
    const rollerWorld = blocks.guideRoller.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      new THREE.Vector2(rollerWorld.x, rollerWorld.y),
      state.compoundCenter,
      2.5e-15,
      'rendered guide roller stays concentric with B',
    );
    assert.ok(model.root.userData.contacts.ellipseToCompoundPinion.noSlipError
      < 4.1e-15);
    assert.ok(model.root.userData.contacts.compoundOuterToOutput.noSlipError
      < 8e-15);
  }
  near(
    blocks.compoundOuterGear.userData.rotor.rotation.z,
    geometry.compoundOuterLocalPhase,
    0,
    'outer B tooth grid is rigid on the compound',
  );
  near(
    blocks.compoundPinion.userData.rotor.rotation.z,
    geometry.compoundPinionLocalPhase,
    0,
    'small B tooth grid is rigid on the compound',
  );
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);

  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.7);
  assert.ok(size.y > 8.6);
  assert.ok(size.z > 1.4);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 50);

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement507.root);
  disposeModel(model.root);
});
