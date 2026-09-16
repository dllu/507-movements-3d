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

test('movement 222 is one eccentric spur driver, one idler, and two center links', () => {
  const movement = catalog.movements[221];
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

  assert.equal(movement.id, 222);
  assert.equal(movement.number, '222');
  assert.equal(
    movement.title,
    'Eccentric Spur Driver with Two-Link Moving Idler',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'eccentric-spur-driver-two-equal-center-links-moving-idler-irregular-output',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'eccentric-circular-c-drives-single-b-through-c-b-and-a-b-links',
  );
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(blocks.driverGear.parent, blocks.driverAssembly.userData.rotor);
  assert.equal(
    blocks.driverGeometricCenterAnchor.parent,
    blocks.driverAssembly.userData.rotor,
  );
  assert.equal(blocks.driverCenterJoint.parent,
    blocks.driverAssembly.userData.rotor);
  assert.equal(blocks.outputGear.parent, model.root);
  assert.equal(blocks.idlerGear.parent, model.root);
  assert.equal(blocks.outputLink.parent, model.root);
  assert.equal(blocks.driverLink.parent, model.root);
  assert.notEqual(blocks.idlerGear.parent, blocks.driverAssembly.userData.rotor,
    'B is one moving idler, not a compound fixed to C');
  assert.deepEqual(transmission.toothCounts, {
    driver: 24,
    idler: 18,
    output: 24,
  });
  assert.equal(geometry.outputTeeth, geometry.driverTeeth);
  near(
    geometry.carrierLength,
    geometry.outputPitchRadius + geometry.idlerPitchRadius,
    Number.EPSILON * 4,
    'A-B center link is one pitch-radius sum',
  );
  near(
    geometry.carrierLength,
    geometry.driverPitchRadius + geometry.idlerPitchRadius,
    Number.EPSILON * 4,
    'C-B center link is the same pitch-radius sum',
  );
  assert.ok(geometry.fullRotationAssemblyMargin > 1.19,
    'the eccentric crank can complete a turn without a four-bar toggle');

  for (const rotor of [
    blocks.driverAssembly,
    blocks.driverGear,
    blocks.driverShaft,
    blocks.idlerGear,
    blocks.idlerShaft,
    blocks.outputGear,
    blocks.outputShaft,
  ]) {
    assert.ok(rotor.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  }
  const inventedGuides = [];
  model.root.traverse((object) => {
    if (/groove|slot|guide|support-frame|base-rail/.test(
      object.userData.role ?? ''
    )) inventedGuides.push(object);
  });
  assert.deepEqual(inventedGuides, [],
    '222 replaces 221’s guide groove with the stated simple link');
  assert.ok(model.root.userData.cameraFitBounds?.isBox3);
  disposeModel(model.root);
});

test('movement 222 reconstructs the plate centers, tooth counts, and equal links', () => {
  const model = createMovementModel(catalog.movements[221]);
  const {
    geometry,
    sourcePointToModel,
    sourceReference,
    stateAtDriverTravel,
  } = model.root.userData;
  const plate = sourceReference.plate222;

  assert.equal(sourceReference.sourceUrl, catalog.movements[221].sourceUrl);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual([
    plate.inferredOutputTeeth,
    plate.inferredIdlerTeeth,
    plate.inferredDriverTeeth,
  ], [24, 18, 24]);
  const rasterA = sourcePointToModel(plate.rasterOutputCenterA);
  const rasterB = sourcePointToModel(plate.rasterIdlerCenterB);
  const rasterC = sourcePointToModel(plate.rasterDriverGeometricCenterC);
  const rasterD = sourcePointToModel(plate.rasterDriverShaftD);
  vector2Near(
    new THREE.Vector2(rasterA.x, rasterA.y),
    geometry.outputCenter,
    0,
    'engraved fixed output center A',
  );
  vector2Near(
    new THREE.Vector2(rasterB.x, rasterB.y),
    geometry.sourceRasterIdlerCenter,
    0,
    'engraved moving idler center B',
  );
  vector2Near(
    new THREE.Vector2(rasterC.x, rasterC.y),
    geometry.eccentricCenterVector,
    0,
    'engraved geometric center of C',
  );
  vector3Near(rasterD, new THREE.Vector3(), 0,
    'engraved eccentric shaft D');
  near(
    geometry.eccentricCenterVector.length(),
    geometry.eccentricity,
    0,
    'engraved eccentric offset C-D',
  );
  near(
    plate.sourceMeanLinkPixels * geometry.sourceScale,
    geometry.carrierLength,
    0,
    'mean of engraved A-B and B-C links fixes common pitch',
  );
  assert.ok(Math.abs(plate.sourceABPixels - plate.sourceBCPixels) < 2.1,
    'the plate depicts equal simple links');
  assert.ok(
    geometry.sourceCalculatedIdlerCenter.distanceTo(
      geometry.sourceRasterIdlerCenter,
    ) / geometry.sourceScale < 1.34,
    'exact equal-link intersection is within 1.34 source pixels of B',
  );

  const sourceState = stateAtDriverTravel(0);
  vector2Near(
    sourceState.driverGeometricCenter,
    geometry.eccentricCenterVector,
    0,
    'source C center',
  );
  vector2Near(
    sourceState.idlerCenter,
    geometry.sourceCalculatedIdlerCenter,
    0,
    'source B center',
  );
  near(sourceState.idlerAngle, geometry.sourceIdlerAngle, 0,
    'source idler phase');
  near(sourceState.outputAngle, geometry.sourceOutputAngle, 0,
    'source output phase');
  disposeModel(model.root);
});

test('movement 222 keeps both equal links and both meshes exact through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[221]);
  const {
    geometry,
    stateAtDriverTravel,
  } = model.root.userData;
  let maximumDriverLinkError = 0;
  let maximumOutputLinkError = 0;
  let maximumDriverCenterError = 0;
  let maximumOutputCenterError = 0;
  let maximumDriverNoSlipError = 0;
  let maximumOutputNoSlipError = 0;
  let minimumOutputRatio = Infinity;
  let maximumOutputRatio = -Infinity;
  let minimumIdlerRatio = Infinity;
  let maximumIdlerRatio = -Infinity;
  let minimumTriangleHeight = Infinity;
  for (let index = 0; index <= 32768; index += 1) {
    const travel = index / 32768 * FULL_TURN;
    const state = stateAtDriverTravel(travel);
    maximumDriverLinkError = Math.max(
      maximumDriverLinkError,
      state.driverLinkLengthError,
    );
    maximumOutputLinkError = Math.max(
      maximumOutputLinkError,
      state.outputLinkLengthError,
    );
    maximumDriverCenterError = Math.max(
      maximumDriverCenterError,
      state.driverToIdlerCenterDistanceError,
    );
    maximumOutputCenterError = Math.max(
      maximumOutputCenterError,
      state.idlerToOutputCenterDistanceError,
    );
    maximumDriverNoSlipError = Math.max(
      maximumDriverNoSlipError,
      state.driverToIdlerNoSlipError,
    );
    maximumOutputNoSlipError = Math.max(
      maximumOutputNoSlipError,
      state.idlerToOutputNoSlipError,
    );
    minimumOutputRatio = Math.min(
      minimumOutputRatio,
      state.outputPerDriverAngle,
    );
    maximumOutputRatio = Math.max(
      maximumOutputRatio,
      state.outputPerDriverAngle,
    );
    minimumIdlerRatio = Math.min(
      minimumIdlerRatio,
      state.idlerPerDriverAngle,
    );
    maximumIdlerRatio = Math.max(
      maximumIdlerRatio,
      state.idlerPerDriverAngle,
    );
    minimumTriangleHeight = Math.min(
      minimumTriangleHeight,
      state.triangleHeight,
    );
    near(
      state.driverGeometricCenter.length(),
      geometry.eccentricity,
      4e-16,
      `eccentric C-center orbit at sample ${index}`,
    );
  }
  assert.ok(maximumDriverLinkError < 1.4e-15);
  assert.ok(maximumOutputLinkError < 1.4e-15);
  assert.ok(maximumDriverCenterError < 1e-15);
  assert.ok(maximumOutputCenterError < 1e-15);
  assert.ok(maximumDriverNoSlipError < 1.4e-15);
  assert.ok(maximumOutputNoSlipError < 1e-15);
  assert.ok(minimumTriangleHeight > 1.843);
  assert.ok(minimumOutputRatio > 0.459,
    'output A never reverses');
  assert.ok(maximumOutputRatio > 1.54,
    'output A accelerates above the driver');
  assert.ok(maximumOutputRatio / minimumOutputRatio > 3.35,
    'A has visibly irregular circular speed');
  assert.ok(minimumIdlerRatio < -1.865);
  assert.ok(maximumIdlerRatio < -0.81,
    'idler B reverses throughout the cycle');
  disposeModel(model.root);
});

test('movement 222 common-pitch phases stay half a tooth apart at both contacts', () => {
  const model = createMovementModel(catalog.movements[221]);
  const {
    blocks,
    geometry,
    stateAtDriverTravel,
  } = model.root.userData;
  for (const gear of [blocks.driverGear, blocks.idlerGear, blocks.outputGear]) {
    near(gear.userData.module, geometry.module, 3e-17,
      `${gear.userData.role} common module`);
    assert.equal(gear.userData.toothProfile, 'true-involute');
  }
  near(
    geometry.outputPitchRadius + geometry.idlerPitchRadius,
    geometry.carrierLength,
    Number.EPSILON * 4,
    'A-B pitch contact distance',
  );
  near(
    geometry.driverPitchRadius + geometry.idlerPitchRadius,
    geometry.carrierLength,
    Number.EPSILON * 4,
    'C-B pitch contact distance',
  );
  let sourceDriverMeshPhase = null;
  let sourceOutputMeshPhase = null;
  for (let index = 0; index <= 4096; index += 1) {
    const state = stateAtDriverTravel(index / 4096 * FULL_TURN);
    const driverMeshPhase = geometry.driverTeeth / FULL_TURN * (
      state.driverLinkAngle
        - state.driverAngle - geometry.driverGearLocalPhase
    ) + geometry.idlerTeeth / FULL_TURN * (
      state.driverLinkAngle + Math.PI - state.idlerAngle
    );
    const outputMeshPhase = geometry.outputTeeth / FULL_TURN * (
      state.outputLinkAngle - state.outputAngle
    ) + geometry.idlerTeeth / FULL_TURN * (
      state.outputLinkAngle + Math.PI - state.idlerAngle
    );
    if (index === 0) {
      sourceDriverMeshPhase = driverMeshPhase;
      sourceOutputMeshPhase = outputMeshPhase;
      near(driverMeshPhase, 0.5, 2e-14,
        'C tooth begins in B gap');
      near(outputMeshPhase, 0.5, 2e-14,
        'B and A grids begin half-pitch staggered');
    }
    near(driverMeshPhase, sourceDriverMeshPhase, 1.5e-14,
      `C-B tooth phase at sample ${index}`);
    near(outputMeshPhase, sourceOutputMeshPhase, 1.5e-14,
      `B-A tooth phase at sample ${index}`);
  }

  assert.equal(geometry.gearZ, 0);
  assert.ok(geometry.outputLinkZ > geometry.gearDepth / 2);
  assert.ok(geometry.driverLinkZ > geometry.gearDepth / 2);
  assert.notEqual(geometry.outputLinkZ, geometry.driverLinkZ,
    'the two physical links have distinct non-colliding axial layers');
  const fixedGearClearance = geometry.fixedCenterDistance
    - 2 * (geometry.outputPitchRadius + geometry.module * 2.05 / 2);
  assert.ok(fixedGearClearance > 0.5,
    'fixed A and eccentric C bodies cannot collide');
  disposeModel(model.root);
});

test('movement 222 analytic rates and exact 24:18:24 closure agree', () => {
  const model = createMovementModel(catalog.movements[221]);
  const { stateAtDriverTravel, transmission } = model.root.userData;
  const step = 1e-5;
  let maximumDriverCenterRateError = 0;
  let maximumIdlerCenterRateError = 0;
  let maximumOutputLinkRateError = 0;
  let maximumDriverLinkRateError = 0;
  let maximumIdlerRateError = 0;
  let maximumOutputRateError = 0;
  for (let index = 0; index <= 256; index += 1) {
    const travel = (index + 0.31) / 257 * FULL_TURN;
    const state = stateAtDriverTravel(travel);
    const previous = stateAtDriverTravel(travel - step);
    const next = stateAtDriverTravel(travel + step);
    const derivative = (nextValue, previousValue) => (
      nextValue - previousValue
    ) / (2 * step);
    const driverCenterDerivative = next.driverGeometricCenter.clone()
      .sub(previous.driverGeometricCenter).multiplyScalar(1 / (2 * step));
    const idlerCenterDerivative = next.idlerCenter.clone()
      .sub(previous.idlerCenter).multiplyScalar(1 / (2 * step));
    maximumDriverCenterRateError = Math.max(
      maximumDriverCenterRateError,
      driverCenterDerivative.distanceTo(
        state.driverCenterVelocity.clone().divideScalar(
          state.driverAngularSpeed,
        ),
      ),
    );
    maximumIdlerCenterRateError = Math.max(
      maximumIdlerCenterRateError,
      idlerCenterDerivative.distanceTo(state.idlerCenterPerDriverAngle),
    );
    maximumOutputLinkRateError = Math.max(
      maximumOutputLinkRateError,
      Math.abs(
        derivative(next.outputLinkAngle, previous.outputLinkAngle)
          - state.outputLinkPerDriverAngle
      ),
    );
    maximumDriverLinkRateError = Math.max(
      maximumDriverLinkRateError,
      Math.abs(
        derivative(next.driverLinkAngle, previous.driverLinkAngle)
          - state.driverLinkPerDriverAngle
      ),
    );
    maximumIdlerRateError = Math.max(
      maximumIdlerRateError,
      Math.abs(
        derivative(next.idlerAngle, previous.idlerAngle)
          - state.idlerPerDriverAngle
      ),
    );
    maximumOutputRateError = Math.max(
      maximumOutputRateError,
      Math.abs(
        derivative(next.outputAngle, previous.outputAngle)
          - state.outputPerDriverAngle
      ),
    );
  }
  assert.ok(maximumDriverCenterRateError < 4.6e-10);
  assert.ok(maximumIdlerCenterRateError < 1.2e-9);
  assert.ok(maximumOutputLinkRateError < 3.5e-10);
  assert.ok(maximumDriverLinkRateError < 2.6e-10);
  assert.ok(maximumIdlerRateError < 1.1e-9);
  assert.ok(maximumOutputRateError < 1.7e-9);

  const source = stateAtDriverTravel(0);
  const closure = stateAtDriverTravel(FULL_TURN);
  near(closure.driverAngle - source.driverAngle, FULL_TURN, 0,
    'one eccentric C turn');
  vector2Near(closure.driverGeometricCenter, source.driverGeometricCenter,
    2e-16, 'C center orbit closure');
  vector2Near(closure.idlerCenter, source.idlerCenter, 2e-16,
    'B center four-bar closure');
  near(closure.outputLinkAngle, source.outputLinkAngle, 0,
    'A-B link returns');
  near(closure.driverLinkAngle, source.driverLinkAngle, 0,
    'C-B link returns');
  near(
    closure.idlerAngle - source.idlerAngle,
    -FULL_TURN * 4 / 3,
    2e-15,
    '24-to-18 driver-idler closure',
  );
  near(closure.outputAngle - source.outputAngle, FULL_TURN, 0,
    '24-to-18-to-24 train gives one output turn');
  near(transmission.idlerTurnsPerDriverTurn, -4 / 3, 0,
    'reported idler closure');
  near(transmission.outputTurnsPerDriverTurn, 1, 0,
    'reported output closure');
  near(transmission.driverToIdlerRatio, 4 / 3, 0,
    'C-to-B tooth ratio');
  near(transmission.idlerToOutputRatio, 3 / 4, 0,
    'B-to-A tooth ratio');
  disposeModel(model.root);
});

test('movement 222 runtime binds the eccentric and links while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[221]);
  const { blocks, canonicalTimes, geometry } = model.root.userData;
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.driverAssembly.userData.rotor.rotation.z, state.driverAngle, 0,
      'rendered eccentric C angle');
    near(blocks.driverShaft.userData.rotor.rotation.z, state.driverAngle, 0,
      'rendered eccentric shaft D angle');
    near(blocks.driverGear.userData.rotor.rotation.z,
      geometry.driverGearLocalPhase, 0,
      'C tooth grid stays rigid in the eccentric body');
    near(blocks.idlerGear.userData.rotor.rotation.z, state.idlerAngle, 0,
      'rendered B angle');
    near(blocks.idlerShaft.userData.rotor.rotation.z, state.idlerAngle, 0,
      'rendered B shaft angle');
    near(blocks.outputGear.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered A angle');
    near(blocks.outputShaft.userData.rotor.rotation.z, state.outputAngle, 0,
      'rendered A shaft angle');
    vector2Near(
      new THREE.Vector2(blocks.idlerGear.position.x, blocks.idlerGear.position.y),
      state.idlerCenter,
      0,
      'rendered moving B center',
    );
    const driverCenterWorld = blocks.driverGeometricCenterAnchor
      .getWorldPosition(new THREE.Vector3());
    vector2Near(
      new THREE.Vector2(driverCenterWorld.x, driverCenterWorld.y),
      state.driverGeometricCenter,
      3e-16,
      'rendered eccentric C center',
    );
    const outputLinkStart = blocks.outputLink.userData.boredMesh.position;
    const outputLinkEnd = new THREE.Vector3(geometry.carrierLength,0,0).applyAxisAngle(Z_AXIS,blocks.outputLink.userData.boredMesh.rotation.z).add(outputLinkStart);
    const driverLinkStart = blocks.driverLink.userData.boredMesh.position;
    const driverLinkEnd = new THREE.Vector3(geometry.carrierLength,0,0).applyAxisAngle(Z_AXIS,blocks.driverLink.userData.boredMesh.rotation.z).add(driverLinkStart);
    vector3Near(
      outputLinkStart,
      new THREE.Vector3(
        geometry.outputCenter.x,
        geometry.outputCenter.y,
        geometry.outputLinkZ,
      ),
      2e-14,
      'rendered A-B link starts at A',
    );
    vector3Near(
      outputLinkEnd,
      new THREE.Vector3(
        state.idlerCenter.x,
        state.idlerCenter.y,
        geometry.outputLinkZ,
      ),
      2e-14,
      'rendered A-B link ends at B',
    );
    vector3Near(
      driverLinkStart,
      new THREE.Vector3(
        state.driverGeometricCenter.x,
        state.driverGeometricCenter.y,
        geometry.driverLinkZ,
      ),
      2e-14,
      'rendered C-B link starts at C center',
    );
    vector3Near(
      driverLinkEnd,
      new THREE.Vector3(
        state.idlerCenter.x,
        state.idlerCenter.y,
        geometry.driverLinkZ,
      ),
      2e-14,
      'rendered C-B link ends at B',
    );
    near(blocks.driverContactMarker.position.x,
      state.driverToIdlerContactPoint.x, 0, 'rendered C-B contact x');
    near(blocks.driverContactMarker.position.y,
      state.driverToIdlerContactPoint.y, 0, 'rendered C-B contact y');
    near(blocks.outputContactMarker.position.x,
      state.idlerToOutputContactPoint.x, 0, 'rendered B-A contact x');
    near(blocks.outputContactMarker.position.y,
      state.idlerToOutputContactPoint.y, 0, 'rendered B-A contact y');
  }
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);

  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.9);
  assert.ok(size.y > 7.5);
  assert.ok(size.z > 1.3);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 25);

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
