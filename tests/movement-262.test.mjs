import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

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

test('movement 262 is the end-view eccentric screw-cone friction reverser', () => {
  const movement = catalog.movements[261];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contactDefinition,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 262);
  assert.equal(movement.number, '262');
  assert.equal(
    movement.title,
    'Eccentric Screw-Cone Friction Reverser — End View',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'fixed-nut-screw-translated-eccentric-cone-edge-contact-friction-roller-reverser',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fixed-nut-E/);
  assert.match(mechanism, /eccentric-cone-B/);
  assert.match(mechanism, /reverses-roller-C/);
  assert.equal(blocks.coneBody.parent, blocks.screwConeAssembly);
  assert.equal(blocks.screwCore.parent, blocks.screwConeAssembly);
  assert.equal(blocks.leftInputJournal.parent, blocks.screwCore);
  assert.equal(blocks.rightScrewCore.parent, blocks.screwCore);
  assert.equal(blocks.screwThread.parent, blocks.screwConeAssembly);
  assert.equal(blocks.nut.parent, blocks.frame);
  assert.equal(blocks.nut.userData.axiallyFixed, true);
  assert.equal(blocks.rollerBody.parent, blocks.rollerRotor);
  assert.equal(blocks.rollerRotor.parent, blocks.rollerCarriage);
  assert.equal(contactDefinition.contactLoadChoice, 'spring');
  assert.equal(contactDefinition.sourcePermits, 'spring-or-weight');
  disposeModel(model.root);
});

test('movement 262 preserves the unavailable paired end and side source views', () => {
  const movement = catalog.movements[261];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate262263;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(sourceReference.pairedViews, {
    movement262: 'end-view',
    movement263: 'side-view',
  });
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 263);
  assert.equal(plate.identicalLocalAssetsForBothNumbers, true);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterEndView, {
    coneCenterB: { x: 69, y: 146 },
    coneOuterRadius: 55,
    rollerCenterC: { x: 70, y: 95 },
    rollerOuterRadius: 16,
    screwCenterD: { x: 69, y: 176 },
  });
  assert.deepEqual(plate.rasterSideView, {
    coneLargeEndX: 166,
    coneLargeRadius: 43,
    coneSmallEndX: 330,
    coneSmallRadius: 20,
    fixedNutCenterX: 383,
    rollerCenterX: 207,
    rollerOuterRadius: 13,
    screwAxisY: 146,
    screwThreadPitch: 7,
  });
  assert.match(plate.inferredTopology, /one eccentric conical body/);
  assert.match(plate.inferredTopology, /fixed nut E/);
  assert.match(plate.inferredTopology, /parallel-axis friction roller C/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 67,
    edition: 21,
    illustrationPage: 66,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 262 matches the measured cone, eccentric, roller, and lead proportions', () => {
  const model = createMovementModel(catalog.movements[261]);
  const { geometry, sourceReference } = model.root.userData;
  const { rasterEndView, rasterSideView } = sourceReference.plate262263;
  const rasterConeLength = rasterSideView.coneSmallEndX
    - rasterSideView.coneLargeEndX;
  const rasterEccentricity = rasterEndView.screwCenterD.y
    - rasterEndView.coneCenterB.y;

  near(
    geometry.coneSmallRadius / geometry.coneLargeRadius,
    rasterSideView.coneSmallRadius / rasterSideView.coneLargeRadius,
    0.02,
    'small-to-large cone radius ratio',
  );
  near(
    geometry.coneEccentricity / geometry.coneLargeRadius,
    rasterEccentricity / rasterEndView.coneOuterRadius,
    0.025,
    'eccentricity-to-large-radius ratio',
  );
  near(
    geometry.rollerRadius / geometry.coneLargeRadius,
    rasterSideView.rollerOuterRadius / rasterSideView.coneLargeRadius,
    0.003,
    'roller-to-large-cone radius ratio',
  );
  near(
    geometry.screwLead / geometry.coneLength,
    rasterSideView.screwThreadPitch / rasterConeLength,
    0.001,
    'screw-lead-to-cone-length ratio',
  );
  assert.ok(geometry.coneSmallRadius < geometry.coneEccentricity);
  assert.ok(geometry.coneLargeRadius > geometry.coneEccentricity);
  disposeModel(model.root);
});

test('movement 262 locks screw rotation and translation to fixed nut E', () => {
  const model = createMovementModel(catalog.movements[261]);
  const { blocks, geometry, transmission } = model.root.userData;
  const initial = transmission.configurationAtInputAngle(0);
  let maximumScrewLawError = 0;
  let maximumNutPhaseError = 0;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const inputAngle = geometry.maximumInputAngle * sample / 8192;
    const configuration = transmission.configurationAtInputAngle(inputAngle);
    maximumScrewLawError = Math.max(
      maximumScrewLawError,
      Math.abs(
        configuration.screwTranslation
          + geometry.screwLead * inputAngle / FULL_TURN,
      ),
    );
    maximumNutPhaseError = Math.max(
      maximumNutPhaseError,
      Math.abs(
        configuration.screwThreadPhaseAtNut
          - initial.screwThreadPhaseAtNut,
      ),
    );
  }
  assert.ok(maximumScrewLawError < 2e-16);
  assert.ok(maximumNutPhaseError < 2.2e-14);
  for (let turn = 0; turn < 3; turn += 1) {
    const first = transmission.configurationAtInputAngle(turn * FULL_TURN);
    const next = transmission.configurationAtInputAngle(
      (turn + 1) * FULL_TURN,
    );
    near(
      next.localContactAxialPosition - first.localContactAxialPosition,
      geometry.screwLead,
      7e-16,
      `one-lead axial advance on turn ${turn + 1}`,
    );
  }
  assert.equal(blocks.screwThread.userData.hand, geometry.screwThreadHand);
  assert.equal(blocks.screwThread.userData.lead, geometry.screwLead);
  assert.equal(geometry.screwThreadHand, -1);
  assert.ok(geometry.minimumThreadToConeAxialGap > 0);
  assert.ok(geometry.minimumScrewCoreToRollerAxialClearance > 0);
  disposeModel(model.root);
});

test('movement 262 maintains exact cone-to-roller edge contact without collision', () => {
  const model = createMovementModel(catalog.movements[261]);
  const { geometry, transmission } = model.root.userData;
  let maximumCoincidenceError = 0;
  let maximumTransformError = 0;
  let maximumConeRadiusError = 0;
  let maximumRollerRadiusError = 0;
  let maximumNormalLengthError = 0;
  let minimumFaceClearance = Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const inputAngle = geometry.maximumInputAngle * sample / 8192;
    const configuration = transmission.configurationAtInputAngle(inputAngle);
    const localRadialY = configuration.localConeContactPoint.y
      - geometry.coneEccentricity;
    const localRadialZ = configuration.localConeContactPoint.z;
    const rollerTransverseRadius = Math.hypot(
      configuration.rollerCenter.y - configuration.rollerContactPoint.y,
      configuration.rollerCenter.z - configuration.rollerContactPoint.z,
    );
    const farFaceConeRadius = transmission.coneRadiusAtLocalAxialPosition(
      configuration.localContactAxialPosition + geometry.rollerWidth,
    );
    maximumCoincidenceError = Math.max(
      maximumCoincidenceError,
      configuration.contactCoincidenceError,
    );
    maximumTransformError = Math.max(
      maximumTransformError,
      configuration.transformedContactError,
    );
    maximumConeRadiusError = Math.max(
      maximumConeRadiusError,
      Math.abs(
        Math.hypot(localRadialY, localRadialZ)
          - configuration.coneRadiusAtContact,
      ),
    );
    maximumRollerRadiusError = Math.max(
      maximumRollerRadiusError,
      Math.abs(rollerTransverseRadius - geometry.rollerRadius),
    );
    maximumNormalLengthError = Math.max(
      maximumNormalLengthError,
      Math.abs(configuration.contactNormal.length() - 1),
    );
    minimumFaceClearance = Math.min(
      minimumFaceClearance,
      configuration.coneRadiusAtContact - farFaceConeRadius,
    );
    near(
      configuration.coneAxisCenterAtContact.distanceTo(
        configuration.rollerContactPoint,
      ),
      configuration.coneRadiusAtContact,
      8e-16,
      `cone surface at ${sample}`,
    );
    assert.ok(configuration.contactAxialFraction >= 0);
    assert.ok(configuration.contactAxialFraction <= 1);
  }
  assert.ok(maximumCoincidenceError < 5e-16);
  assert.ok(maximumTransformError < 1.3e-15);
  assert.ok(maximumConeRadiusError < 5e-16);
  assert.ok(maximumRollerRadiusError < 4e-16);
  assert.ok(maximumNormalLengthError < 3e-16);
  near(
    minimumFaceClearance,
    geometry.minimumRollerFaceClearance,
    4e-16,
    'far roller edge remains clear of taper',
  );
  assert.ok(minimumFaceClearance > 0);
  disposeModel(model.root);
});

test('movement 262 obeys the exact signed rolling law through every reversal', () => {
  const model = createMovementModel(catalog.movements[261]);
  const {
    geometry,
    strokeAnalysis,
    transmission,
  } = model.root.userData;
  const derivativeStep = 1e-6;
  let maximumNoSlipError = 0;
  let maximumRatioError = 0;
  let minimumRatio = Infinity;
  let maximumRatio = -Infinity;

  for (let sample = 1; sample < 8192; sample += 1) {
    const inputAngle = geometry.maximumInputAngle * sample / 8192;
    const configuration = transmission.configurationAtInputAngle(inputAngle);
    const numericalRatio = (
      transmission.rollerAngleAtInputAngle(inputAngle + derivativeStep)
        - transmission.rollerAngleAtInputAngle(inputAngle - derivativeStep)
    ) / (2 * derivativeStep);
    const expectedRatio = (
      configuration.centerDistance
        * configuration.contactNormalDerivativePerInputRadian
        - configuration.coneRadiusAtContact
    ) / geometry.rollerRadius;
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      Math.abs(configuration.circumferentialNoSlipResidual),
    );
    maximumRatioError = Math.max(
      maximumRatioError,
      Math.abs(numericalRatio - configuration.rollerAngularRatio),
      Math.abs(expectedRatio - configuration.rollerAngularRatio),
    );
    minimumRatio = Math.min(minimumRatio, configuration.rollerAngularRatio);
    maximumRatio = Math.max(maximumRatio, configuration.rollerAngularRatio);
  }
  assert.ok(maximumNoSlipError < 7e-16);
  assert.ok(maximumRatioError < 6e-9);
  assert.ok(minimumRatio < 0);
  assert.ok(maximumRatio > 0);
  assert.equal(strokeAnalysis.directionChangeAngles.length, 6);
  assert.equal(strokeAnalysis.directionIntervals.length, 7);
  strokeAnalysis.directionIntervals.forEach((interval, index) => {
    assert.equal(interval.direction, index % 2 === 0 ? -1 : 1);
  });
  assert.ok(strokeAnalysis.shorterDirectionAngularTravel > 0);
  assert.ok(
    strokeAnalysis.shorterDirectionAngularTravel
      < strokeAnalysis.longerDirectionAngularTravel,
  );
  assert.equal(
    transmission.rollingLaw,
    'd(roller-angle)/d(input-angle)=((cone-radius+roller-radius)*d(contact-normal-angle)/d(input-angle)-cone-radius)/roller-radius',
  );
  disposeModel(model.root);
});

test('movement 262 traces one screw-pitch spiral while C stays in its guide plane', () => {
  const model = createMovementModel(catalog.movements[261]);
  const {
    driveSchedule,
    geometry,
    transmission,
  } = model.root.userData;
  const turnConfigurations = Array.from({ length: 4 }, (_, turn) => (
    transmission.configurationAtInputAngle(turn * FULL_TURN)
  ));

  turnConfigurations.forEach((configuration, turn) => {
    near(
      configuration.coneAxisCenterAtContact.y ** 2
        + configuration.coneAxisCenterAtContact.z ** 2,
      geometry.coneEccentricity ** 2,
      4e-16,
      `eccentric orbit at turn ${turn}`,
    );
    near(
      configuration.coneContactPoint.x,
      geometry.rollerContactAxialPosition,
      0,
      `fixed world contact plane at turn ${turn}`,
    );
    near(
      configuration.rollerCenter.x,
      geometry.rollerAxialCenter,
      0,
      `fixed roller axial station at turn ${turn}`,
    );
    near(configuration.rollerCenter.z, 0, 0,
      `roller guide plane at turn ${turn}`);
  });
  for (let turn = 0; turn < 3; turn += 1) {
    near(
      turnConfigurations[turn + 1].localContactAxialPosition
        - turnConfigurations[turn].localContactAxialPosition,
      transmission.contactSpiralPitch,
      7e-16,
      `spiral pitch on turn ${turn + 1}`,
    );
    assert.ok(
      turnConfigurations[turn + 1].coneRadiusAtContact
        < turnConfigurations[turn].coneRadiusAtContact,
    );
  }
  assert.ok(
    driveSchedule.demonstrationBeginsAtAxialFraction
      > driveSchedule.sourceIllustratedContactAxialFraction,
  );
  assert.match(driveSchedule.reasonForLaterConeStation, /direction reversals/);
  assert.equal(driveSchedule.sourcePrescribesUniformForwardInput, true);
  assert.equal(driveSchedule.sourcePrescribesReturnReversal, false);
  disposeModel(model.root);
});

test('movement 262 renders exact rates, closes smoothly, and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[261]);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const forward = stateAtTime(3);
  const reversal = stateAtTime(6);
  const reverse = stateAtTime(9);
  const closure = stateAtTime(timeline.cycleClosure);
  const derivativeStep = 1e-5;
  let maximumRollerRateError = 0;
  let maximumVerticalRateError = 0;

  for (let sample = 1; sample < 2048; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 2048;
    if (Math.abs(time - timeline.forwardTraverseEnd) < 2 * derivativeStep) {
      continue;
    }
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    maximumRollerRateError = Math.max(
      maximumRollerRateError,
      Math.abs(
        (after.rollerAngleUnwrapped - before.rollerAngleUnwrapped)
          / (2 * derivativeStep)
          - state.rollerAngularSpeed,
      ),
    );
    maximumVerticalRateError = Math.max(
      maximumVerticalRateError,
      Math.abs(
        (after.rollerCenter.y - before.rollerCenter.y)
          / (2 * derivativeStep)
          - state.rollerVerticalSpeed,
      ),
    );
  }
  assert.ok(maximumRollerRateError < 7e-9);
  assert.ok(maximumVerticalRateError < 4e-9);
  assert.ok(forward.inputAngularSpeed > 0);
  assert.ok(reverse.inputAngularSpeed < 0);
  near(start.inputAngularSpeed, 0, 0, 'start at rest');
  near(reversal.inputAngularSpeed, 0, 2e-15, 'smooth reversal at rest');
  for (const key of [
    'inputAngleUnwrapped',
    'inputAngularSpeed',
    'rollerAngleUnwrapped',
    'rollerAngularSpeed',
    'screwTranslation',
    'screwTranslationSpeed',
  ]) {
    near(closure[key], start[key], 0, `${key} closure`);
  }
  near(
    closure.rollerCenter.distanceTo(start.rollerCenter),
    0,
    0,
    'roller center closure',
  );
  for (const time of [0, 1.2, 3, 6, 8.4, 11.9, 12]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.screwConeAssembly.position.x, state.screwTranslation, 0,
      `rendered screw translation at ${time}`);
    near(blocks.screwConeAssembly.rotation.x, state.inputAngle, 0,
      `rendered screw rotation at ${time}`);
    near(blocks.rollerCarriage.position.y, state.rollerCenter.y, 0,
      `rendered roller height at ${time}`);
    near(blocks.rollerRotor.rotation.x, state.rollerAngle, 0,
      `rendered roller rotation at ${time}`);
    near(blocks.contactMarker.position.distanceTo(state.contactPoint), 0, 0,
      `rendered contact point at ${time}`);
    assert.ok(blocks.contactSpring.scale.y > 0);
  }
  near(animationTiming.authoredCyclePeriod, 12, 0, 'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0, 'display period');
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
