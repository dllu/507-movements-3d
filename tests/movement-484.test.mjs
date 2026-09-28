import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { createAuthoredHelicalCurrentRotorMovement } from '../src/simulation/authored-helical-current-rotors.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-helical-current-rotors.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'single-one-turn-radial-helical-ribbon-around-horizontal-cylinder-axial-flow-to-rigid-shaft-rotation';
const FULL_TURN = Math.PI * 2;

// Rigidity of the white indices is checked on the unpresented factory model;
// Brown's plate does not draw them, so source presentation removes them.
function unpresentedModel() {
  return { model: createAuthoredHelicalCurrentRotorMovement(catalog.movements[483]) };
}

function movementModel() {
  const movement = catalog.movements[483];
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

test('movement 484 is one radial spiral wound once around one rigid horizontal cylinder', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, dynamics, geometry } =
    model.root.userData;

  assert.equal(movement.id, 484);
  assert.equal(movement.number, '484');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.helixTurns, 1);
  // Brown's front crossing runs down-left from the right-hand lobe: left-handed.
  assert.equal(geometry.helixHandedness, -1);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.rotorRotationAboutHorizontalAxis, 1);
  assert.equal(degreesOfFreedom.loadWheelRotationRigidWithShaft, 1);
  assert.equal(blocks.helicalBlade.parent, blocks.rotor);
  assert.equal(blocks.coreCylinder.parent, blocks.rotor);
  assert.equal(blocks.shaft.parent, blocks.rotor);
  // Brown draws no load wheel; source presentation removes it.
  assert.equal(blocks.loadWheel.parent, null);
  assert.ok(model.root.userData.sourcePresentation.removedRoles.includes('rigid-load-wheel-on-output-shaft'));
  assert.equal(blocks.bearings.length, 2);
  assert.equal(blocks.supports.length, 2);

  const singleFlights = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role === 'single-one-turn-radial-helical-ribbon') {
      singleFlights.push(object);
    }
    if (object.userData.isBelt || /belt/i.test(object.userData.role ?? '')) {
      belts.push(object);
    }
  });
  assert.deepEqual(singleFlights, [blocks.helicalBlade]);
  assert.deepEqual(belts, []);
  assert.match(dynamics.singleFlight,
    /Exactly one radial helical ribbon makes exactly one turn/);
  disposeModel(model.root);
});

test('movement 484 preserves Brown’s unavailable source and discloses the reconstructed operating point', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate484;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_484.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /spiral wound round a cylinder.*wind or a stream of water.*rotary motion/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateAxisEndpointsPixels,
    [[68, 283], [463, 283]]);
  assert.deepEqual(plate.approximateCylinderBoundsPixels,
    [111, 238, 398, 330]);
  assert.deepEqual(plate.approximateHelixOuterExtremaPixels,
    [112, 153, 395, 420]);
  assert.deepEqual(plate.approximateLeftBearingPixels, [91, 283]);
  assert.deepEqual(plate.approximateRightBearingPixels, [431, 283]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /one horizontal cylindrical core.*two plain upright standards.*one complete turn/s);
  assert.match(evidence.fullerCorroboration,
    /John Douglas Pitts Fuller’s 1834 Key.*items 23–24/s);
  assert.match(evidence.fullerCorroboration,
    /near-verbatim later statement/);
  assert.match(evidence.reconstructionDisclosure,
    /left-handed winding is read from the plate.*flow speed.*torque coefficient.*independently engineered/s);
  assert.match(sourceReference.fullerKeyUrl, /books\.google\.com/);
  disposeModel(model.root);
});

test('movement 484 blade midsurface vertices form one exact left-handed radial helical ribbon', () => {
  const { model } = movementModel();
  const { blocks, geometry, helixPointScene, transmission } =
    model.root.userData;
  const bladeGeometry = blocks.helicalBlade.geometry;
  const bladeData = bladeGeometry.userData;
  const positions = bladeGeometry.getAttribute('position');

  assert.equal(bladeData.turns, 1);
  assert.equal(bladeData.handedness, -1);
  assert.equal(bladeData.segments, geometry.helixSegments);
  assert.equal(bladeData.sourceVertexCount, 2 * (geometry.helixSegments + 1));
  assert.ok(positions.count > bladeData.sourceVertexCount);
  near(bladeData.innerRadius, geometry.coreRadiusSceneUnit, 0,
    'inner ribbon radius');
  near(bladeData.outerRadius, geometry.outerRadiusSceneUnit, 0,
    'outer ribbon radius');
  near(bladeData.length, geometry.cylinderLengthSceneUnit, 0,
    'ribbon axial length');

  for (let index = 0; index <= geometry.helixSegments; index += 16) {
    const u = index / geometry.helixSegments;
    const inner = new THREE.Vector3().fromBufferAttribute(
      positions,
      2 * index,
    );
    const outer = new THREE.Vector3().fromBufferAttribute(
      positions,
      2 * index + 1,
    );
    inner.add(new THREE.Vector3().fromBufferAttribute(positions, bladeData.sourceVertexCount + 2 * index)).multiplyScalar(0.5);
    outer.add(new THREE.Vector3().fromBufferAttribute(positions, bladeData.sourceVertexCount + 2 * index + 1)).multiplyScalar(0.5);
    vectorNear(inner, helixPointScene(u, geometry.coreRadiusSceneUnit),
      8e-8, `inner helix station ${index}`);
    vectorNear(outer, helixPointScene(u, geometry.outerRadiusSceneUnit),
      8e-8, `outer helix station ${index}`);
    near(Math.hypot(inner.y, inner.z), geometry.coreRadiusSceneUnit,
      8e-8, `inner radius station ${index}`);
    near(Math.hypot(outer.y, outer.z), geometry.outerRadiusSceneUnit,
      8e-8, `outer radius station ${index}`);
  }
  const start = helixPointScene(0, geometry.outerRadiusSceneUnit);
  const middle = helixPointScene(0.5, geometry.outerRadiusSceneUnit);
  const end = helixPointScene(1, geometry.outerRadiusSceneUnit);
  near(start.x, -geometry.cylinderLengthSceneUnit / 2, 0, 'left endpoint');
  near(end.x, geometry.cylinderLengthSceneUnit / 2, 0, 'right endpoint');
  near(start.y, geometry.outerRadiusSceneUnit, 0, 'left high projection');
  near(middle.y, -geometry.outerRadiusSceneUnit, 0, 'low midpoint');
  near(end.y, geometry.outerRadiusSceneUnit, 0, 'right high projection');
  near(Math.atan2(end.z, end.y) - Math.atan2(start.z, start.y), 0,
    3e-16, 'end orientation closes after one turn');
  assert.match(transmission.helixEquation,
    /theta0\+h\*2\*pi\*N\*u/);
  disposeModel(model.root);
});

test('movement 484 converts positive-X axial flow to the correctly signed shaft speed', () => {
  const { model } = movementModel();
  const { dynamics, flow, geometry, motion, stateAtTime, transmission } =
    model.root.userData;
  const expectedOmega = -geometry.helixHandedness
    * FULL_TURN * geometry.axialToRotorCoupling
    * geometry.axialFlowSpeedMetrePerSecond
    / geometry.physicalPitchMetre;

  near(geometry.shaftAngularVelocityRadianPerSecond,
    expectedOmega, 0, 'signed shaft speed');
  near(geometry.cycleDuration,
    FULL_TURN / Math.abs(expectedOmega), 0, 'rotation period');
  vectorNear(flow.direction, new THREE.Vector3(1, 0, 0), 0,
    'current direction');
  vectorNear(motion.rotationAxis, new THREE.Vector3(1, 0, 0), 0,
    'rotation axis');
  vectorNear(motion.shaftAngularVelocityVector,
    new THREE.Vector3(expectedOmega, 0, 0), 0,
    'angular-velocity vector');
  assert.ok(expectedOmega > 0);
  assert.equal(motion.rotationSenseViewedFromPositiveX, 'counterclockwise');
  near(stateAtTime(geometry.cycleDuration).rotorAngleRadian,
    FULL_TURN, 0, 'one cycle rotation');
  near(-(-geometry.helixHandedness)
    * FULL_TURN * geometry.axialToRotorCoupling
    * geometry.axialFlowSpeedMetrePerSecond
    / geometry.physicalPitchMetre,
  -expectedOmega, 0, 'reversing handedness reverses speed');
  near(-geometry.helixHandedness
    * FULL_TURN * geometry.axialToRotorCoupling
    * -geometry.axialFlowSpeedMetrePerSecond
    / geometry.physicalPitchMetre,
  -expectedOmega, 0, 'reversing flow reverses speed');
  assert.match(dynamics.reciprocalScrewAction,
    /positive-X axial flow produces positive-X shaft rotation/);
  assert.match(transmission.angularSpeedEquation,
    /omega_x=-handedness.*U_axial\/pitch/);
  disposeModel(model.root);
});

test('movement 484 torque, opposing load, and extracted shaft power share one disclosed model', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const expectedArea = Math.PI * (
    geometry.physicalOuterRadiusMetre ** 2
      - geometry.physicalCoreRadiusMetre ** 2
  );
  const expectedDynamicPressure = 0.5
    * geometry.workingFluidDensityKilogramPerCubicMetre
    * geometry.axialFlowSpeedMetrePerSecond ** 2;
  const expectedTorqueMagnitude = geometry.torqueCoefficient
    * expectedDynamicPressure * expectedArea
    * geometry.physicalOuterRadiusMetre;
  const state = stateAtTime(2.73);

  near(geometry.sweptAnnulusAreaSquareMetre, expectedArea, 0,
    'swept annulus');
  near(geometry.flowDynamicPressurePascal, expectedDynamicPressure, 0,
    'dynamic pressure');
  near(state.drivingTorqueXNewtonMetre,
    -geometry.helixHandedness * expectedTorqueMagnitude, 0,
    'driving torque');
  near(state.resistingLoadTorqueXNewtonMetre,
    -state.drivingTorqueXNewtonMetre, 0, 'steady opposing load');
  near(state.shaftPowerWatt,
    state.drivingTorqueXNewtonMetre
      * state.shaftAngularVelocityRadianPerSecond,
    0, 'shaft power');
  assert.ok(state.shaftPowerWatt > 0);
  near(geometry.tipSpeedRatio,
    Math.abs(state.shaftAngularVelocityRadianPerSecond)
      * geometry.physicalOuterRadiusMetre
      / geometry.axialFlowSpeedMetrePerSecond,
    0, 'tip-speed ratio');
  assert.match(dynamics.assumptionScope,
    /quasi-steady torque coefficient.*rather than CFD/s);
  assert.match(dynamics.energyBalance,
    /same positive-X sign.*positive extracted shaft power/s);
  assert.match(transmission.torqueEquation,
    /C_Q.*rho\*U\^2\/2.*R_outer/);
  disposeModel(model.root);
});

test('movement 484 renderer keeps cylinder, spiral, shaft, and load wheel exactly rigid', () => {
  const { model } = unpresentedModel();
  const { blocks, geometry, helixPointScene, stateAtTime } =
    model.root.userData;
  const rigidChildren = [
    blocks.shaft,
    blocks.coreCylinder,
    blocks.helicalBlade,
    blocks.innerBladeEdge.edge,
    blocks.outerBladeEdge.edge,
    ...blocks.bladeEndRails,
    blocks.bladeMarker,
    blocks.loadWheel,
  ];
  const localPositions = rigidChildren.map((object) => object.position.clone());
  const localQuaternions = rigidChildren.map((object) =>
    object.quaternion.clone());

  for (const time of [0, 0.63, 1.5, 2.91, 4.8, 6, 8.2]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.rotor.rotation.x, state.rotorAngleRadian, 0,
      `rotor angle at ${time}`);
    near(state.loadWheelAngleRadian, state.rotorAngleRadian, 0,
      `load-wheel angle at ${time}`);
    rigidChildren.forEach((object, index) => {
      vectorNear(object.position, localPositions[index], 0,
        `rigid child position ${index} at ${time}`);
      near(object.quaternion.angleTo(localQuaternions[index]), 0, 0,
        `rigid child orientation ${index} at ${time}`);
    });
    model.root.updateMatrixWorld(true);
    const expectedMarker = helixPointScene(
      geometry.bladeMarkerParameter,
      geometry.outerRadiusSceneUnit,
    );
    blocks.rotor.localToWorld(expectedMarker);
    vectorNear(blocks.bladeMarker.getWorldPosition(new THREE.Vector3()),
      expectedMarker, 2e-15, `blade index world position at ${time}`);
  }
  model.update(0);
  model.root.updateMatrixWorld(true);
  const initialMarker = blocks.bladeMarker.getWorldPosition(
    new THREE.Vector3(),
  );
  model.update(geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  vectorNear(blocks.bladeMarker.getWorldPosition(new THREE.Vector3()),
    initialMarker, 8e-16, 'one-cycle rigid closure');
  disposeModel(model.root);
});

test('movement 484 current markers use integrated travel and smooth arc-length paths', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, geometry, stateAtTime } =
    model.root.userData;

  near(geometry.markerPacketAdvanceMetre,
    geometry.axialFlowSpeedMetrePerSecond * geometry.cycleDuration / 4,
    0, 'packet advance distance');
  for (const time of [0, 0.31, 1.22, 2.77, 4.93, 6]) {
    const state = stateAtTime(time);
    near(state.axialFluidDisplacementMetre,
      geometry.axialFlowSpeedMetrePerSecond * time, 0,
      `integrated axial displacement at ${time}`);
    near(state.markerTravelTurns,
      state.axialFluidDisplacementMetre / geometry.markerPacketAdvanceMetre,
      0, `marker travel at ${time}`);
    model.update(time);
    blocks.flowMarkerSets.forEach((markers, pathIndex) => {
      markers.forEach((marker, markerIndex) => {
        const progress = flow.markerProgress(
          state.markerTravelTurns,
          pathIndex,
          markerIndex,
        );
        vectorNear(marker.position,
          flow.flowCurves[pathIndex].getPointAt(progress), 3e-15,
          `current marker ${pathIndex}/${markerIndex} at ${time}`);
        near(marker.scale.x, Math.sin(Math.PI * progress) ** 0.48,
          3e-15, `current fade ${pathIndex}/${markerIndex} at ${time}`);
      });
    });
  }
  const before = 0.211;
  const after = before + 1e-4;
  model.update(before);
  const xBefore = blocks.flowMarkerSets[0][0].position.x;
  model.update(after);
  assert.ok(blocks.flowMarkerSets[0][0].position.x > xBefore);
  model.update(0);
  const startPositions = blocks.flowMarkerSets.flat().map((marker) =>
    marker.position.clone());
  model.update(geometry.cycleDuration);
  blocks.flowMarkerSets.flat().forEach((marker, index) => {
    vectorNear(marker.position, startPositions[index], 5e-14,
      `marker cycle closure ${index}`);
  });
  assert.match(sourceText,
    /flowCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /analytic integral U\*t.*getPointAt arc-length sampling/s);
  disposeModel(model.root);
});

test('movement 484 keeps bearings fixed, fits every pose, and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const fixedPositions = [
    ...blocks.bearings,
    ...blocks.supports.map(({ support }) => support),
  ].map((object) => object.position.clone());
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 240; sample += 1) {
    model.update(geometry.cycleDuration * sample / 240);
    model.root.updateMatrixWorld(true);
    // Precise bounds: the rotated blade's loose box overstates its 1.54 radius by up to √2.
    union.union(new THREE.Box3().setFromObject(model.root, true));
    [
      ...blocks.bearings,
      ...blocks.supports.map(({ support }) => support),
    ].forEach((object, index) => {
      vectorNear(object.position, fixedPositions[index], 0,
        `fixed bearing/support ${index} at sample ${sample}`);
    });
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
