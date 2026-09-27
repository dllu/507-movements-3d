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
  'hero-aeolipile-with-twin-hollow-pivot-risers-horizontal-axis-steam-globe-four-tangential-bent-nozzles-and-momentum-balanced-reaction-speed';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[473];
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

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
}

function distanceFromXAxis(point, axisOrigin) {
  return Math.hypot(point.y - axisOrigin.y, point.z - axisOrigin.z);
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

test('movement 474 is Brown’s twin-pivot four-nozzle horizontal-axis aeolipile', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 474);
  assert.equal(movement.number, '474');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.match(model.root.userData.mechanism,
    /two fixed hollow risers.*left and right horizontal trunnion feeds/s);
  assert.match(model.root.userData.mechanism,
    /four equally handed right-angle bends/);
  assert.match(model.root.userData.mechanism,
    /rotate as one rigid assembly opposite the jets/);
  assert.equal(geometry.nozzleCount, 4);
  assert.equal(blocks.fixedFeedPipes.length, 2);
  assert.equal(blocks.fixedFeedSteamCores.length, 2);
  assert.equal(blocks.rotatingTrunnions.length, 2);
  assert.equal(blocks.nozzlePipes.length, 4);
  assert.equal(blocks.nozzleSteamCores.length, 4);
  assert.equal(blocks.nozzleCollars.length, 4);
  assert.equal(blocks.exhaustPlumes.length, 4);
  assert.equal(blocks.feedMarkers.length, 10);
  assert.equal(blocks.exhaustMarkers.length, 24);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 0);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.nozzleAndGlobeIndependent, false);

  for (const rotating of [blocks.globe, blocks.globeSteam,
    blocks.pivotManifold, blocks.rotationBand,
    ...blocks.rotatingTrunnions, ...blocks.nozzlePipes,
    ...blocks.nozzleSteamCores, ...blocks.nozzleCollars]) {
    assert.ok(rotating.parent === blocks.rotor, `${rotating.userData.role} parent`);
  }
  // Brown draws no steam plumes; the source presentation removes them.
  for (const plume of blocks.exhaustPlumes) {
    assert.equal(plume.parent, null, `${plume.userData.role} not presented`);
  }
  for (const fixed of [blocks.boiler, blocks.boilerLid,
    blocks.boilerRim, blocks.boilerWater, blocks.boilerSteamSpace,
    ...blocks.fixedFeedPipes, ...blocks.fixedFeedSteamCores,
    ...blocks.stationaryBearingCollars, ...blocks.boilerHandles,
    ...blocks.standLegs]) {
    assert.ok(fixed.parent === model.root, `${fixed.userData.role} parent`);
  }
  // Brown draws no white steam beads or globe spots.
  for (const removed of [blocks.hearthRing, ...blocks.flames, blocks.foundation,
    ...blocks.rotationMarkers, ...blocks.feedMarkers, ...blocks.exhaustMarkers]) {
    assert.ok(removed.parent === null, `source presentation removes ${removed.userData.role}`);
  }

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^rotating-hollow-bent-steam-arm-\d+-of-four$/.test(role)).length, 4);
  assert.equal(roles.filter((role) =>
    /^tangential-steam-outlet-\d+-of-four$/.test(role)).length, 4);
  for (const role of [
    'fixed-sealed-lower-steam-boiler',
    'fixed-left-hollow-steam-riser-and-pivot-feed',
    'fixed-right-hollow-steam-riser-and-pivot-feed',
    'rotating-hollow-steam-globe',
    'horizontal-steam-manifold-on-pivot-axis',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 474 records Brown’s plate, unavailable animation, and Hero variant without conflating them', () => {
  const { model, movement } = movementModel();
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate474;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_474.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /two pipes conducting steam/);
  assert.match(movement.description, /forming pivots/);
  assert.match(movement.description, /escape of steam through a number of bent arms/);
  assert.match(movement.description, /same principle as Barker’s mill, 438/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /marks Animated unavailable.*no absolute timing/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateGlobeCenterPixels, [261, 201]);
  assert.deepEqual(plate.approximateBoilerCenterPixels, [259, 370]);
  assert.equal(plate.approximateNozzleTipsPixels.length, 4);
  assert.equal(plate.approximatePivotRiserPixels.length, 2);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence,
    /boiler over a fire.*two opposed risers.*four visible bent outlet arms/);
  assert.match(evidence.historicalComparison,
    /Woodcroft’s 1851 translation.*one bent boiler feed.*two bent outlet pipes/);
  assert.match(evidence.historicalComparison,
    /follows Brown’s later plate and caption/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, pressure, temperature, nozzle bore.*or speed/);
  assert.match(sourceReference.heroPrimaryTranslation,
    /Pneumatics 50.*Woodcroft \(1851\)/);
  assert.match(sourceReference.heroTranslationUrl, /gutenberg\.org/);
  assert.match(dynamics.assumptionScope,
    /steady-running momentum and drag balance/);
  disposeModel(model.root);
});

test('movement 474 two complete steam routes meet opposite ends of one horizontal pivot diameter', () => {
  const { model } = movementModel();
  const { flowPaths, geometry } = model.root.userData;
  const [leftCurve, rightCurve] = flowPaths.feedCurves;
  const [leftTrunnion, rightTrunnion] = geometry.feedTrunnionPoints;

  assert.equal(flowPaths.feedCurves.length, 2);
  vectorNear(leftCurve.getPointAt(1), geometry.globeCenter, 0,
    'left steam path reaches globe center');
  vectorNear(rightCurve.getPointAt(1), geometry.globeCenter, 0,
    'right steam path reaches globe center');
  vectorNear(new THREE.Line3(leftCurve.curves.at(-1).v1,leftCurve.curves.at(-1).v2).closestPointToPoint(leftTrunnion,true,new THREE.Vector3()), leftTrunnion, 0,
    'left visible riser reaches left trunnion');
  vectorNear(new THREE.Line3(rightCurve.curves.at(-1).v1,rightCurve.curves.at(-1).v2).closestPointToPoint(rightTrunnion,true,new THREE.Vector3()), rightTrunnion, 0,
    'right visible riser reaches right trunnion');
  near(leftTrunnion.y, rightTrunnion.y, 0, 'pivot ends share height');
  near(leftTrunnion.z, rightTrunnion.z, 0, 'pivot ends share depth');
  near(leftTrunnion.x, -rightTrunnion.x, 0, 'pivot ends oppose');
  near(leftTrunnion.distanceTo(rightTrunnion),
    2 * geometry.globeRadius, 1e-15, 'pivot diameter');
  const pivotDirection = rightTrunnion.clone().sub(leftTrunnion).normalize();
  vectorNear(pivotDirection, new THREE.Vector3(1, 0, 0), 0,
    'common horizontal pivot axis');
  assert.ok(leftCurve.getLength() > geometry.globeRadius * 2);
  near(leftCurve.getLength(), rightCurve.getLength(), 3e-15,
    'mirrored feed lengths');
  disposeModel(model.root);
});

test('movement 474 nozzle flow follows the disclosed subcritical isentropic steam calculation', () => {
  const { model } = movementModel();
  const { geometry, thermodynamics } = model.root.userData;
  const gamma = geometry.steamHeatCapacityRatio;
  const gasConstant = geometry.steamSpecificGasConstant;
  const expectedCriticalRatio = (2 / (gamma + 1)) ** (
    gamma / (gamma - 1)
  );
  const expectedExitTemperature = geometry.boilerTemperatureKelvin
    * geometry.pressureRatio ** ((gamma - 1) / gamma);
  const expectedExitSpeed = Math.sqrt(
    2 * gamma / (gamma - 1) * gasConstant
      * (geometry.boilerTemperatureKelvin - expectedExitTemperature),
  );
  const expectedExitDensity = geometry.atmosphericPressurePascal
    / (gasConstant * expectedExitTemperature);
  const expectedArea = Math.PI * geometry.nozzleBoreRadiusMetre ** 2;
  const expectedMassFlow = geometry.dischargeCoefficient
    * expectedExitDensity * expectedArea * expectedExitSpeed;

  near(geometry.pressureRatio,
    geometry.atmosphericPressurePascal / geometry.boilerPressurePascal,
    0, 'pressure ratio');
  near(geometry.criticalPressureRatio, expectedCriticalRatio, 0,
    'critical pressure ratio');
  assert.ok(geometry.pressureRatio > geometry.criticalPressureRatio);
  assert.equal(thermodynamics.choked, false);
  assert.equal(thermodynamics.pressureRegime,
    'subcritical isentropic expansion to atmosphere');
  near(geometry.exitTemperatureKelvin, expectedExitTemperature, 0,
    'isentropic exit temperature');
  near(geometry.idealExitSpeedMetrePerSecond, expectedExitSpeed, 2e-13,
    'isentropic energy equation');
  near(geometry.exitSteamDensityKilogramPerCubicMetre,
    expectedExitDensity, 0, 'ideal-gas exit density');
  near(geometry.nozzleFlowAreaSquareMetre, expectedArea, 0,
    'nozzle bore area');
  near(geometry.massFlowPerNozzleKilogramPerSecond,
    expectedMassFlow, 1e-18, 'single-nozzle mass flow');
  near(geometry.totalMassFlowKilogramPerSecond,
    geometry.nozzleCount * expectedMassFlow, 3e-18,
    'equal four-way flow');
  disposeModel(model.root);
});

test('movement 474 four nozzle centers stay equally pitched in the plane normal to the pivot axis', () => {
  const { model } = movementModel();
  const { geometry, reactionStateAtAngle, sourcePose } = model.root.userData;

  for (const rotorAngle of [0, 0.17, 0.63, 1.31, 2.54, 4.78, 6.19]) {
    const state = reactionStateAtAngle(rotorAngle);
    assert.equal(state.nozzles.length, geometry.nozzleCount);
    for (let index = 0; index < geometry.nozzleCount; index += 1) {
      const nozzle = state.nozzles[index];
      const next = state.nozzles[(index + 1) % geometry.nozzleCount];
      near(nozzle.nozzlePoint.x, geometry.globeCenter.x, 0,
        `nozzle ${index + 1} remains in normal plane`);
      near(distanceFromXAxis(nozzle.nozzlePoint, geometry.globeCenter),
        geometry.nozzleOrbitRadius, 8e-16,
        `nozzle ${index + 1} orbit radius`);
      near(THREE.MathUtils.euclideanModulo(
        next.worldAngle - nozzle.worldAngle,
        FULL_TURN,
      ), geometry.nozzlePitch, 3e-15,
      `nozzle ${index + 1} pitch`);
      near(nozzle.jetDirection.dot(new THREE.Vector3(1, 0, 0)), 0, 0,
        'jet is normal to pivot axis');
      near(nozzle.jetDirection.dot(nozzle.radial), 0, 2e-16,
        'jet tangent to nozzle orbit');
      near(nozzle.jetDirection.length(), 1, 2e-16,
        'unit jet direction');
    }
  }
  assert.equal(sourcePose.nozzles.length, 4);
  vectorNear(sourcePose.nozzles[0].nozzlePoint,
    reactionStateAtAngle(0).nozzles[0].nozzlePoint, 0,
    'source pose nozzle');
  disposeModel(model.root);
});

test('movement 474 globe and every bent arm obey one exact negative-x rigid rotation', () => {
  const { model } = movementModel();
  const { geometry, reactionStateAtAngle } = model.root.userData;

  for (let sample = -360; sample <= 720; sample += 1) {
    const rotorAngle = sample * FULL_TURN / 360;
    const state = reactionStateAtAngle(rotorAngle);
    assert.ok(state.angularSpeed < 0);
    for (const nozzle of state.nozzles) {
      sameAngle(nozzle.worldAngle, nozzle.localAngle + rotorAngle,
        3e-15, 'rigid nozzle angle');
      const localRadius = Math.hypot(
        nozzle.localNozzlePoint.y,
        nozzle.localNozzlePoint.z,
      );
      near(localRadius, geometry.nozzleOrbitRadius, 3e-16,
        'local nozzle radius');
      const rotatedLocal = nozzle.localNozzlePoint.clone().applyAxisAngle(
        new THREE.Vector3(1, 0, 0),
        rotorAngle,
      ).add(geometry.globeCenter);
      vectorNear(nozzle.nozzlePoint, rotatedLocal, 4e-15,
        'rigid transformed nozzle point');
    }
  }
  disposeModel(model.root);
});

test('movement 474 absolute exhaust momentum produces four equal reinforcing reaction moments', () => {
  const { model } = movementModel();
  const { geometry, reactionStateAtAngle } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const state = reactionStateAtAngle(sample * FULL_TURN / 720);
    let torqueSum = 0;
    for (const nozzle of state.nozzles) {
      vectorNear(nozzle.relativeExitVelocity,
        nozzle.tangent.clone().multiplyScalar(
          geometry.idealExitSpeedMetrePerSecond,
        ), 0, 'relative steam velocity');
      vectorNear(nozzle.absoluteExitVelocity,
        nozzle.tangent.clone().multiplyScalar(
          geometry.idealExitSpeedMetrePerSecond
            + state.angularSpeed
              * geometry.physicalNozzleOrbitRadiusMetre,
        ), 0, 'absolute steam velocity');
      vectorNear(nozzle.reactionForceNewton,
        nozzle.absoluteExitVelocity.clone().multiplyScalar(
          -geometry.massFlowPerNozzleKilogramPerSecond,
        ), 0, 'Newton-third-law reaction force');
      const reconstructedTorque = new THREE.Vector3().crossVectors(
        nozzle.physicalLever,
        nozzle.reactionForceNewton,
      ).x;
      near(nozzle.reactionTorqueNewtonMetre, reconstructedTorque, 0,
        'reaction moment about pivot');
      assert.ok(nozzle.reactionTorqueNewtonMetre < 0);
      assert.ok(nozzle.absoluteExitVelocity.dot(nozzle.nozzleVelocity) < 0,
        'steam exits opposite local rotor motion');
      torqueSum += nozzle.reactionTorqueNewtonMetre;
    }
    near(state.totalJetTorqueNewtonMetre, torqueSum, 0,
      'four reinforcing moments sum exactly');
    for (const nozzle of state.nozzles) {
      near(nozzle.reactionTorqueNewtonMetre,
        state.totalJetTorqueNewtonMetre / geometry.nozzleCount,
        6e-17, 'equal nozzle moment');
    }
  }
  disposeModel(model.root);
});

test('movement 474 displayed running speed is the positive root of exact jet-drag torque balance', () => {
  const { model } = movementModel();
  const { geometry, reactionStateAtAngle, transmission } =
    model.root.userData;
  const q = geometry.terminalSpeedMagnitude;
  const polynomialResidual = geometry.effectiveQuadraticDragCoefficient
    * q ** 2 + geometry.momentumSlopeNewtonMetreSecond * q
    - geometry.stationaryJetTorqueNewtonMetre;
  const state = reactionStateAtAngle(0.83);

  assert.ok(q > 0);
  near(geometry.steadyAngularSpeed, -q, 0, 'negative reaction speed');
  near(polynomialResidual, 0, 1.2e-16, 'steady speed root');
  near(state.totalJetTorqueNewtonMetre + state.dragTorqueNewtonMetre,
    0, 1.2e-16, 'steady torque balance');
  near(state.netTorqueNewtonMetre, 0, 1.2e-16,
    'reported net torque');
  assert.ok(state.dragTorqueNewtonMetre > 0);
  assert.ok(state.totalJetTorqueNewtonMetre < 0);
  near(geometry.cycleDuration, FULL_TURN / q, 0,
    'one physical revolution period');
  near(geometry.steadyRevolutionsPerMinute, q * 60 / FULL_TURN, 0,
    'derived physical rpm');
  assert.ok(q < geometry.idealExitSpeedMetrePerSecond
    / geometry.physicalNozzleOrbitRadiusMetre);
  assert.match(transmission.jetTorqueEquation,
    /N\*m_dot\*r\*\(v_exit\+omega\*r\)/);
  assert.match(transmission.dragTorqueEquation,
    /-c\*omega\*abs\(omega\)/);
  assert.match(transmission.steadySpeedEquation, /c\*q\^2/);
  disposeModel(model.root);
});

test('movement 474 analytic nozzle velocity and acceleration match finite differences', () => {
  const { model } = movementModel();
  const { geometry, reactionStateAtAngle } = model.root.userData;
  const timeStep = 1e-5;
  const angleStep = geometry.steadyAngularSpeed * timeStep;

  for (const angle of [0.13, 0.47, 0.91, 1.63, 2.72, 3.88, 5.31]) {
    const center = reactionStateAtAngle(angle);
    const before = reactionStateAtAngle(angle - angleStep);
    const after = reactionStateAtAngle(angle + angleStep);
    for (const index of [0, 1, 3]) {
      const numericalVelocity = after.nozzles[index].nozzlePoint.clone()
        .sub(before.nozzles[index].nozzlePoint)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = after.nozzles[index].nozzleVelocity
        .clone().sub(before.nozzles[index].nozzleVelocity)
        .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalVelocity, center.nozzles[index].nozzleVelocity,
        1.4e-8, `nozzle ${index + 1} velocity at ${angle}`);
      vectorNear(numericalAcceleration,
        center.nozzles[index].nozzleAcceleration,
        1.1e-7, `nozzle ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 474 renderer rotates only the globe assembly and advances all steam markers smoothly by arc length', () => {
  const { model } = movementModel();
  const { blocks, flowPaths, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.boiler, blocks.boilerLid, blocks.boilerRim,
    blocks.boilerWater, blocks.boilerSteamSpace, ...blocks.fixedFeedPipes,
    ...blocks.stationaryBearingCollars, ...blocks.boilerHandles,
    blocks.hearthRing, ...blocks.standLegs, blocks.foundation];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const phase of [0, 0.09, 0.21, 0.38, 0.57, 0.76, 0.93]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    sameAngle(blocks.rotor.rotation.x, state.rotorAngle, 2e-16,
      `rendered rotor angle at ${phase}`);
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed boiler/support position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed boiler/support orientation');
    });
  }

  const phase = 0.137;
  model.update(phase * geometry.cycleDuration);
  const feedProgress = THREE.MathUtils.euclideanModulo(
    phase * geometry.feedMarkerPassesPerCycle,
    1,
  );
  const exhaustProgress = THREE.MathUtils.euclideanModulo(
    phase * geometry.exhaustMarkerPassesPerCycle,
    1,
  );
  vectorNear(blocks.feedMarkers[0].position,
    flowPaths.feedCurves[0].getPointAt(feedProgress), 0,
    'feed marker uses arc-length path');
  vectorNear(blocks.exhaustMarkers[0].position,
    flowPaths.exhaustCurves[0].getPointAt(exhaustProgress), 5e-16,
    'exhaust marker uses arc-length path');
  near(blocks.feedMarkers[0].scale.x,
    Math.sin(Math.PI * feedProgress) ** 0.55, 0,
    'feed endpoint fade');
  near(blocks.exhaustMarkers[0].scale.x,
    Math.sin(Math.PI * exhaustProgress) ** 0.55, 2e-16,
    'exhaust endpoint fade');

  model.update(0);
  near(blocks.feedMarkers[0].scale.x, 0, 0,
    'feed marker recycles invisibly');
  near(blocks.exhaustMarkers[0].scale.x, 0, 0,
    'exhaust marker recycles invisibly');
  model.update(geometry.cycleDuration);
  near(blocks.feedMarkers[0].scale.x, 0, 0,
    'feed marker closes invisibly');
  near(blocks.exhaustMarkers[0].scale.x, 0, 0,
    'exhaust marker closes invisibly');
  sameAngle(blocks.rotor.rotation.x, 0, 0, 'rotor cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 474 has finite fitted bounds and movement 507 remains the next authored frontier', () => {
  const movement474 = catalog.movements[473];
  const movement507 = catalog.movements[506];
  const model474 = createMovementModel(movement474);
  const model507 = createMovementModel(movement507);
  const fitBounds = model474.root.userData.cameraFitBounds;

  for (let index = 0; index <= 24; index += 1) {
    model474.update(index / 24
      * model474.root.userData.geometry.cycleDuration);
    model474.root.updateMatrixWorld(true);
    const renderedBounds = new THREE.Box3().setFromObject(model474.root);
    for (const coordinate of [renderedBounds.min.x, renderedBounds.min.y,
      renderedBounds.min.z, renderedBounds.max.x, renderedBounds.max.y,
      renderedBounds.max.z]) assert.ok(Number.isFinite(coordinate));
    assert.ok(renderedBounds.min.x >= fitBounds.min.x - 1e-9);
    assert.ok(renderedBounds.min.y >= fitBounds.min.y - 1e-9);
    assert.ok(renderedBounds.min.z >= fitBounds.min.z - 1e-9);
    assert.ok(renderedBounds.max.x <= fitBounds.max.x + 1e-9);
    assert.ok(renderedBounds.max.y <= fitBounds.max.y + 1e-9);
    assert.ok(renderedBounds.max.z <= fitBounds.max.z + 1e-9);
  }
  assert.equal(movement474.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model474.root);
  disposeModel(model507.root);
});

test('movement 474 bowl mouth ends flush under the lid with no ledge or overlap at the joint', () => {
  const { model } = movementModel();
  const { blocks } = model.root.userData;
  model.root.updateMatrixWorld(true);
  const bowl = new THREE.Box3().setFromObject(blocks.boiler);
  const lid = new THREE.Box3().setFromObject(blocks.boilerLid);
  near(bowl.max.y, lid.min.y, 1e-6, 'bowl mouth meets the lid underside');
  const radius = (box) => Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z);
  near(radius(lid), radius(bowl), 1e-3, 'lid edge flush with the bowl mouth');
  disposeModel(model.root);
});
