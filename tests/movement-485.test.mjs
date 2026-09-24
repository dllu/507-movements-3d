import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { createAuthoredCommonWindmillMovement } from '../src/simulation/authored-common-windmills.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const sourceText = await readFile(
  new URL('../src/simulation/authored-common-windmills.js', import.meta.url),
  'utf8',
);

const ARCHETYPE =
  'four-twisted-oblique-lattice-sails-on-one-horizontal-windshaft-direct-axial-wind-to-rigid-rotation';
const FULL_TURN = Math.PI * 2;

// Rigidity of the white indices is checked on the unpresented factory model;
// Brown's plate does not draw them, so source presentation removes them.
function unpresentedModel() {
  return { model: createAuthoredCommonWindmillMovement(catalog.movements[484]) };
}

function movementModel() {
  const movement = catalog.movements[484];
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

test('movement 485 is one common windshaft carrying exactly four oblique lattice sails', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, dynamics, geometry } =
    model.root.userData;

  assert.equal(movement.id, 485);
  assert.equal(movement.number, '485');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.sailCount, 4);
  assert.equal(blocks.sails.length, 4);
  assert.equal(blocks.windshaft.parent, blocks.rotor);
  assert.equal(blocks.hub.parent, blocks.rotor);
  assert.equal(blocks.hubRim.parent, blocks.rotor);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.rigidWindshaftAndFourSailRotation, 1);
  assert.equal(degreesOfFreedom.capYawLockedToDisplayedWindDirection, 0);

  blocks.sails.forEach(({ lattice, panel, perimeter, sail, stock }, index) => {
    assert.equal(sail.parent, blocks.rotor);
    assert.equal(panel.parent, sail);
    assert.equal(stock.parent, sail);
    assert.equal(lattice.length, 10);
    assert.equal(perimeter.length, 4);
    near(sail.rotation.z, index * Math.PI / 2, 0,
      `sail spacing ${index}`);
  });
  const panels = [];
  const belts = [];
  const waterBuckets = [];
  model.root.traverse((object) => {
    if (/continuous-twisted-oblique-surface/.test(
      object.userData.role ?? '')) panels.push(object);
    if (object.userData.isBelt || /belt/i.test(object.userData.role ?? '')) {
      belts.push(object);
    }
    if (/bucket/i.test(object.userData.role ?? '')) waterBuckets.push(object);
  });
  assert.equal(panels.length, 4);
  assert.deepEqual(belts, []);
  assert.deepEqual(waterBuckets, []);
  assert.match(dynamics.rigidRotor,
    /All four sail stocks.*one rotor.*exactly one angle and angular speed/s);
  disposeModel(model.root);
});

test('movement 485 records Brown’s unavailable original and separates evidence from reconstruction', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate485;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_485.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Common wind-mill.*direct action of the wind upon the oblique sails/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHubCenterPixels, [171, 192]);
  assert.deepEqual(plate.approximateSailTipPixels,
    [161, 13, 54, 202, 108, 389, 278, 282]);
  assert.deepEqual(plate.approximateTowerBoundsPixels,
    [193, 137, 391, 469]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /four broad lattice-faced trapezoidal sails at right angles.*one.*shaft and hub/s);
  assert.match(evidence.hauksbeeWhistonCorroboration,
    /Plate V figure 2.*wind blows parallel to the axis.*same circular motion/s);
  assert.match(evidence.sheltonCorroboration,
    /1919.*four.*usual number.*17-degree inner and 8-degree outer/s);
  assert.match(evidence.williamsburgCorroboration,
    /four arms fixed to one windshaft.*counterclockwise.*52-foot.*20 rpm.*20 mph/s);
  assert.match(evidence.reconstructionDisclosure,
    /17-to-8-degree twist.*power coefficient.*independently engineered/s);
  assert.match(sourceReference.hauksbeeWhistonUrl, /gutenberg\.org/);
  assert.match(sourceReference.sheltonUrl, /gutenberg\.org/);
  assert.match(sourceReference.williamsburgUrl, /gutenberg\.org/);
  disposeModel(model.root);
});

test('movement 485 constructs every sail as the same exact 17-to-8-degree twisted midsurface', () => {
  const { model } = movementModel();
  const { bladePointScene, blocks, geometry, transmission } =
    model.root.userData;

  near(geometry.rootPitchRadian, THREE.MathUtils.degToRad(17), 0,
    'root weather angle');
  near(geometry.tipPitchRadian, THREE.MathUtils.degToRad(8), 0,
    'tip weather angle');
  for (const [sailIndex, { panel }] of blocks.sails.entries()) {
    const panelGeometry = panel.geometry;
    const data = panelGeometry.userData;
    const positions = panelGeometry.getAttribute('position');
    assert.equal(data.segments, geometry.bladeSegments);
    assert.equal(data.sourceVertexCount, 2 * (geometry.bladeSegments + 1));
    assert.ok(positions.count > data.sourceVertexCount);
    near(data.rootRadiusSceneUnit, geometry.rootRadiusSceneUnit, 0,
      `root radius sail ${sailIndex}`);
    near(data.tipRadiusSceneUnit, geometry.tipRadiusSceneUnit, 0,
      `tip radius sail ${sailIndex}`);
    near(data.rootChordSceneUnit, geometry.rootChordSceneUnit, 0,
      `root chord sail ${sailIndex}`);
    near(data.tipChordSceneUnit, geometry.tipChordSceneUnit, 0,
      `tip chord sail ${sailIndex}`);
    for (let station = 0; station <= geometry.bladeSegments; station += 6) {
      const u = station / geometry.bladeSegments;
      for (let side = 0; side < 2; side += 1) {
        const chordFraction = side === 0 ? -1 : 1;
        const actual = new THREE.Vector3().fromBufferAttribute(
          positions,
          2 * station + side,
        );
        actual.add(new THREE.Vector3().fromBufferAttribute(positions, data.sourceVertexCount + 2 * station + side)).multiplyScalar(0.5);
        vectorNear(actual, bladePointScene(u, chordFraction), 8e-8,
          `sail ${sailIndex} station ${station} side ${side}`);
      }
    }
  }
  const rootLeading = bladePointScene(0, 1);
  const tipLeading = bladePointScene(1, 1);
  near(rootLeading.z / -rootLeading.x,
    Math.tan(geometry.rootPitchRadian), 2e-16,
    'root surface slope');
  near(tipLeading.z / -tipLeading.x,
    Math.tan(geometry.tipPitchRadian), 2e-16,
    'tip surface slope');
  assert.ok(geometry.tipChordSceneUnit > geometry.rootChordSceneUnit);
  assert.match(transmission.surfaceEquation,
    /p\(u,v\).*tan\(beta\(u\)\).*17deg.*8deg/s);
  disposeModel(model.root);
});

test('movement 485 resolves negative-Z wind into the same positive torque on all four sails', () => {
  const { model } = movementModel();
  const { bladePointScene, bladeSectionAt, blocks, dynamics, motion } =
    model.root.userData;
  const section = bladeSectionAt(0.55);

  assert.ok(section.positiveTangentialForceFraction > 0);
  near(section.positiveTangentialForceFraction,
    Math.sin(section.pitchRadian), 5e-17,
    'tangential fraction of pressure direction');
  vectorNear(motion.windDirection, new THREE.Vector3(0, 0, -1), 0,
    'wind direction');
  vectorNear(motion.rotationAxis, new THREE.Vector3(0, 0, 1), 0,
    'shaft axis');
  for (const [index, { sail }] of blocks.sails.entries()) {
    const position = bladePointScene(0.55, 0)
      .applyQuaternion(sail.quaternion);
    const force = section.localWindwardForceDirection.clone()
      .applyQuaternion(sail.quaternion);
    const positiveTangent = section.localPositiveTangentialDirection.clone()
      .applyQuaternion(sail.quaternion);
    assert.ok(force.dot(positiveTangent) > 0,
      `positive tangential force on sail ${index}`);
    assert.ok(position.clone().cross(force).z > 0,
      `positive-Z torque on sail ${index}`);
  }
  assert.equal(motion.rotationSenseViewedFromFrontPositiveZ,
    'counterclockwise');
  assert.match(dynamics.directObliqueAction,
    /negative-Z wind pressure.*negative-X tangential component.*positive-Z rotation/s);
  disposeModel(model.root);
});

test('movement 485 ties its representative wind speed, rotor speed, torque, and load through one power balance', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const expectedOmega = geometry.referenceRotorSpeedRevolutionPerMinute
    * FULL_TURN / 60;
  const expectedArea = Math.PI * geometry.physicalRotorRadiusMetre ** 2;
  const expectedSailArea = geometry.sailCount
    * (geometry.physicalRotorRadiusMetre
      - geometry.physicalBladeRootRadiusMetre)
    * (geometry.physicalRootChordMetre
      + geometry.physicalTipChordMetre) / 2;
  const expectedAvailablePower = 0.5
    * geometry.airDensityKilogramPerCubicMetre
    * expectedArea
    * geometry.windSpeedMagnitudeMetrePerSecond ** 3;
  const state = stateAtTime(1.91);

  near(2 * geometry.physicalRotorRadiusMetre, 15.8496, 0,
    '52-foot rotor diameter in metres');
  near(geometry.windSpeedMagnitudeMetrePerSecond, 8.9408, 0,
    '20 mph in metres per second');
  near(geometry.referenceRotorSpeedRevolutionPerMinute, 20, 0,
    'representative rpm');
  near(geometry.shaftAngularVelocityRadianPerSecond,
    expectedOmega, 0, 'shaft angular speed');
  near(geometry.cycleDuration, FULL_TURN / expectedOmega, 0,
    'cycle duration');
  near(geometry.tipSpeedRatio,
    expectedOmega * geometry.physicalRotorRadiusMetre
      / geometry.windSpeedMagnitudeMetrePerSecond,
    0, 'tip-speed ratio');
  near(geometry.sweptAreaSquareMetre, expectedArea, 0, 'swept area');
  near(geometry.totalSailAreaSquareMetre,
    expectedSailArea, 0, 'total sail area');
  near(geometry.sailSolidity, expectedSailArea / expectedArea, 0,
    'sail solidity');
  near(state.availableWindPowerWatt, expectedAvailablePower, 0,
    'available wind power');
  near(state.shaftPowerWatt,
    geometry.powerCoefficient * expectedAvailablePower, 0,
    'shaft power');
  near(state.drivingTorqueZNewtonMetre,
    state.shaftPowerWatt / expectedOmega, 0, 'driving torque');
  near(state.resistingLoadTorqueZNewtonMetre,
    -state.drivingTorqueZNewtonMetre, 0, 'opposing load');
  assert.match(dynamics.aerodynamicAssumption,
    /disclosed power coefficient.*signed energy model rather than CFD/s);
  assert.match(transmission.powerEquation,
    /P_shaft=C_P.*abs\(U_z\)\^3.*tau_load=-tau_z/s);
  disposeModel(model.root);
});

test('movement 485 renderer keeps all sails, hub, and windshaft on one rigid angle', () => {
  const { model } = unpresentedModel();
  const { bladePointScene, blocks, geometry, stateAtTime } =
    model.root.userData;
  const sailRotations = blocks.sails.map(({ sail }) => sail.rotation.z);
  const rigidLocals = [
    blocks.windshaft,
    blocks.hub,
    blocks.hubRim,
    blocks.windshaftIndex,
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));

  for (const time of [0, 0.37, 0.91, 1.5, 2.28, 3, 4.6]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.rotor.rotation.z, state.rotorAngleRadian, 0,
      `rotor angle at ${time}`);
    blocks.sails.forEach(({ sail }, index) => {
      near(sail.rotation.z, sailRotations[index], 0,
        `fixed sail offset ${index} at ${time}`);
    });
    rigidLocals.forEach(({ object, position, quaternion }, index) => {
      vectorNear(object.position, position, 0,
        `rigid local position ${index} at ${time}`);
      near(object.quaternion.angleTo(quaternion), 0, 0,
        `rigid local orientation ${index} at ${time}`);
    });
    model.root.updateMatrixWorld(true);
    const expectedIndex = bladePointScene(0.79, 0.73);
    blocks.sails[0].sail.localToWorld(expectedIndex);
    vectorNear(blocks.sailIndexMarker.getWorldPosition(new THREE.Vector3()),
      expectedIndex, 2e-15, `first-sail index at ${time}`);
  }
  model.update(0);
  model.root.updateMatrixWorld(true);
  const initialIndex = blocks.sailIndexMarker.getWorldPosition(
    new THREE.Vector3(),
  );
  model.update(geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  vectorNear(blocks.sailIndexMarker.getWorldPosition(new THREE.Vector3()),
    initialIndex, 8e-16, 'one-revolution closure');
  disposeModel(model.root);
});

test('movement 485 keeps tower, bearings, cap, and tail fixed while only the windshaft rotates', () => {
  const { model } = movementModel();
  const { blocks, dynamics } = model.root.userData;
  const fixedObjects = [
    blocks.foundation,
    blocks.tower,
    blocks.capTurntable,
    ...blocks.bearings,
    blocks.tailRod,
    blocks.tailVane,
    ...blocks.windows,
    blocks.door,
  ];
  const fixedMatrices = fixedObjects.map((object) => {
    object.updateMatrixWorld(true);
    return object.matrixWorld.clone();
  });
  for (const time of [0.2, 0.8, 1.7, 2.9, 4.1]) {
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
      near(difference, 0, 0,
        `fixed structure ${index} at ${time}`);
    });
  }
  assert.match(dynamics.yawScope,
    /tail member.*held head-on.*cap yaw.*intentionally locked/s);
  disposeModel(model.root);
});

test('movement 485 wind markers integrate axial travel and use smooth arc-length sampling', () => {
  const { model } = movementModel();
  const { blocks, dynamics, flow, geometry, stateAtTime } =
    model.root.userData;
  near(geometry.markerPacketAdvanceMetre,
    geometry.windSpeedMagnitudeMetrePerSecond * geometry.cycleDuration / 4,
    0, 'packet advance');

  for (const time of [0, 0.29, 0.83, 1.42, 2.37, 3]) {
    const state = stateAtTime(time);
    near(state.windAxialDisplacementMetre,
      geometry.windVelocityZMetrePerSecond * time, 0,
      `wind displacement at ${time}`);
    near(state.markerTravelTurns,
      -state.windAxialDisplacementMetre
        / geometry.markerPacketAdvanceMetre,
      0, `marker turns at ${time}`);
    model.update(time);
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
          3e-15, `wind marker fade ${pathIndex}/${markerIndex} at ${time}`);
      });
    });
  }
  model.update(0);
  const startPositions = blocks.windMarkerSets.flat().map((marker) =>
    marker.position.clone());
  model.update(geometry.cycleDuration);
  blocks.windMarkerSets.flat().forEach((marker, index) => {
    vectorNear(marker.position, startPositions[index], 5e-14,
      `wind marker closure ${index}`);
  });
  model.update(0.17);
  const beforeZ = blocks.windMarkerSets[0][0].position.z;
  model.update(0.1701);
  assert.ok(blocks.windMarkerSets[0][0].position.z < beforeZ);
  assert.match(sourceText,
    /windCurves\[pathIndex\]\.getPointAt\(progress\)/);
  assert.match(dynamics.markerContinuity,
    /analytic integral of constant axial velocity.*getPointAt arc-length/s);
  disposeModel(model.root);
});

test('movement 485 fits every sail pose and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 240; sample += 1) {
    model.update(geometry.cycleDuration * sample / 240);
    model.root.updateMatrixWorld(true);
    union.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  const foundationBounds = new THREE.Box3().setFromObject(
    blocks.foundation,
  );
  assert.ok(model.root.userData.groundFloorY <= foundationBounds.min.y);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});
