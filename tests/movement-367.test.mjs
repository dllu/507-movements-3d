import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 367 is a two-link parallel ruler with an ivory scale and a lower-blade brass indicator arc', () => {
  const movement = catalog.movements[366];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 367);
  assert.equal(movement.number, '367');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(
    movement.archetype,
    'graduated-ivory-scale-brass-arc-two-link-parallel-ruler',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /two-straight-parallel-ruler-blades/);
  assert.match(data.mechanism, /two-equal-parallel-links/);
  assert.match(data.mechanism, /brass-arc-reading-separation/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /manual opening angle/);
  assert.match(degreesOfFreedom.note, /removes relative blade rotation/);
  assert.match(degreesOfFreedom.note, /not a third pinned link/);

  assert.equal(blocks.lowerBlade.parent, model.root);
  assert.equal(blocks.upperBlade.parent, model.root);
  assert.equal(blocks.lowerBlade.userData.fixed, true);
  assert.equal(blocks.parallelLinks.length, 2);
  for (const link of blocks.parallelLinks) {
    assert.equal(link.parent, model.root);
    assert.equal(link.userData.pivotBosses.length, 2);
    assert.equal(link.userData.arm.parent, link);
  }
  assert.equal(blocks.brassArc.parent, model.root);
  assert.equal(blocks.brassArcPivot.parent, model.root);
  assert.equal(blocks.brassArcTip.parent, model.root);
  assert.equal(blocks.ivoryScale.parent, blocks.upperBlade);
  assert.equal(blocks.scaleTicks.length, geometry.scaleTickCount);
  for (const tick of blocks.scaleTicks) {
    assert.equal(tick.parent, blocks.upperBlade);
  }

  const roles = [];
  const belts = [];
  const toothedObjects = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (Number.isInteger(object.userData.teeth)) toothedObjects.push(object);
  });
  for (const role of [
    'fixed-lower-ruler-blade-straight-rigid-body',
    'translating-upper-ruler-blade-straight-rigid-body',
    'one-of-two-equal-parallel-ornamental-link-arms',
    'through-pin-of-parallel-link',
    'graduated-ivory-scale-on-lower-edge-of-upper-blade',
    'major-distance-graduation-on-ivory-scale',
    'minor-distance-graduation-on-ivory-scale',
    'fixed-to-lower-blade-brass-arc-crossing-graduated-scale',
    'fastening-pivot-of-brass-indicating-arc-on-lower-blade',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.equal(toothedObjects.length, 0);
  disposeModel(model.root);
});

test('movement 367 records the unavailable animation, Brown scale description, and all source-visible ruler components', () => {
  const movement = catalog.movements[366];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate367;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_367.html');
  assert.match(movement.description, /parallel ruler/);
  assert.match(movement.description, /required distances apart/);
  assert.match(movement.description, /without setting out/);
  assert.match(movement.description, /graduated ivory scale/);
  assert.match(movement.description, /outer edge of the brass arc/);
  assert.match(movement.description, /width between blades/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesTimingMassOrFriction, false);
  assert.match(data.dynamics.treatment, /smooth manual demonstration/);
  assert.match(data.dynamics.treatment, /position-setting device/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.upperBladeLeft.toArray(), [68, 157]);
  assert.deepEqual(plate.upperBladeRight.toArray(), [510, 232]);
  assert.deepEqual(plate.lowerBladeLeft.toArray(), [22, 298]);
  assert.deepEqual(plate.lowerBladeRight.toArray(), [466, 366]);
  assert.deepEqual(plate.leftUpperPivot.toArray(), [100, 193]);
  assert.deepEqual(plate.leftLowerPivot.toArray(), [176, 330]);
  assert.deepEqual(plate.rightUpperPivot.toArray(), [361, 194]);
  assert.deepEqual(plate.rightLowerPivot.toArray(), [436, 329]);
  assert.deepEqual(plate.ivoryScaleLeft.toArray(), [188, 225]);
  assert.deepEqual(plate.ivoryScaleRight.toArray(), [373, 225]);
  assert.deepEqual(plate.brassArcLowerFastening.toArray(), [350, 334]);
  assert.deepEqual(plate.brassArcScaleIncidence.toArray(), [213, 222]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /two equal matching ornamental links/);
  assert.match(evidence.engravingEvidence, /one curved brass indicator/);
  assert.match(evidence.reconstructionDisclosure, /fitted circular arc/);
  assert.match(evidence.reconstructionDisclosure, /no numerical dimensions/);
  disposeModel(model.root);
});

test('movement 367 two equal links form an exact parallelogram and both straight blade directions remain parallel at every opening', () => {
  const model = createMovementModel(catalog.movements[366]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;

  assert.equal(geometry.lowerPivotXs.length, 2);
  assert.equal(geometry.upperPivotLocalXs.length, 2);
  near(
    geometry.lowerPivotXs[1] - geometry.lowerPivotXs[0],
    geometry.upperPivotLocalXs[1] - geometry.upperPivotLocalXs[0],
    0,
    'equal pivot spacing on both blades',
  );
  for (let sample = 0; sample <= 1600; sample += 1) {
    const time = geometry.demonstrationPeriod * 2 * sample / 1600;
    const state = stateAtTime(time);
    for (let index = 0; index < 2; index += 1) {
      const lowerPoint = state.lowerLinkPoints[index];
      const upperPoint = state.upperLinkPoints[index];
      near(lowerPoint.distanceTo(upperPoint), geometry.linkLength,
        1e-15, `link ${index} length`);
      near(upperPoint.x - lowerPoint.x,
        geometry.linkLength * Math.cos(state.linkAngle), 1e-15,
        `link ${index} x projection`);
      near(upperPoint.z - lowerPoint.z,
        geometry.linkLength * Math.sin(state.linkAngle), 1e-15,
        `link ${index} z projection`);
      const upperPivotFromBlade = new THREE.Vector3(
        state.upperBladePosition.x + geometry.upperPivotLocalXs[index],
        0.17,
        state.upperBladePosition.z,
      );
      vectorNear(upperPoint, upperPivotFromBlade, 8e-16,
        `link ${index} upper pivot lies on upper blade`);
    }
    vectorNear(
      state.upperLinkPoints[1].clone().sub(state.upperLinkPoints[0]),
      state.lowerLinkPoints[1].clone().sub(state.lowerLinkPoints[0]),
      1e-15,
      'equal blade pivot vectors',
    );
    near(state.bladeGap,
      state.upperBladePosition.z - geometry.lowerBladeCenterZ
        - geometry.bladeWidth,
      1e-15, 'edge-to-edge blade gap');
  }
  assert.match(data.transmission.bladeLaw, /neither blade rotates/);
  assert.match(data.transmission.linkLaw, /exact parallelogram/);
  disposeModel(model.root);
});

test('movement 367 brass arc intersects the moving upper scale at the exact point whose reading equals the blade-edge gap', () => {
  const model = createMovementModel(catalog.movements[366]);
  const data = model.root.userData;
  const {
    curves,
    geometry,
    incidenceGeometry,
    stateAtTime,
  } = data;

  for (let sample = 0; sample <= 1200; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 1200;
    const state = stateAtTime(time);
    assert.ok(state.incidenceArcParameter >= 0);
    assert.ok(state.incidenceArcParameter <= 1);
    const onArc = curves.brassArc.getPoint(state.incidenceArcParameter);
    vectorNear(onArc, state.incidencePoint, 1.2e-15,
      'incidence point lies on fixed brass arc');
    near(
      state.incidencePoint.z,
      state.upperBladePosition.z - geometry.bladeWidth / 2
        + geometry.scaleEdgeInset,
      3e-16,
      'incidence point lies on upper scale edge',
    );
    near(
      state.incidencePoint.x - state.upperBladePosition.x,
      state.scaleReadingLocalX,
      2e-16,
      'incidence local scale coordinate',
    );
    near(state.scaleReading, state.bladeGap, 0,
      'scale reads actual blade gap');
    near(
      incidenceGeometry.arcRiseAtParameter(
        state.incidenceArcParameter,
      ),
      state.incidenceRise,
      1.1e-15,
      'arc rise inversion',
    );
    const independentlySolved = incidenceGeometry.scaleIncidenceAtAngle(
      state.linkAngle,
    );
    vectorNear(independentlySolved.worldPoint,
      state.incidencePoint, 0, 'independent incidence solution');
  }
  assert.match(data.transmission.arcReadingLaw, /intersected/);
  assert.match(data.transmission.arcReadingLaw, /actual edge gap/);
  disposeModel(model.root);
});

test('movement 367 every ivory tick is calibrated by the same inverse linkage-and-arc equation rather than arbitrary linear spacing', () => {
  const model = createMovementModel(catalog.movements[366]);
  const data = model.root.userData;
  const { blocks, calibration, geometry, incidenceGeometry } = data;

  assert.equal(calibration.scaleCalibration.length,
    geometry.scaleTickCount);
  near(calibration.scaleCalibration[0].gap,
    geometry.minimumBladeGap, 0, 'minimum tick gap');
  near(calibration.scaleCalibration.at(-1).gap,
    geometry.maximumBladeGap, 0, 'maximum tick gap');
  for (let index = 0; index < geometry.scaleTickCount; index += 1) {
    const entry = calibration.scaleCalibration[index];
    const tick = blocks.scaleTicks[index];
    near(tick.position.x, entry.localX, 0,
      `tick ${index} rendered position`);
    near(tick.userData.bladeGap, entry.gap, 0,
      `tick ${index} stored gap`);
    near(entry.localX, calibration.scaleXAtGap(entry.gap), 0,
      `tick ${index} inverse calibration`);
    const angle = calibration.linkAngleAtGap(entry.gap);
    near(incidenceGeometry.bladeGapAtAngle(angle), entry.gap,
      7e-16, `tick ${index} round-trip gap`);
    if (index > 0) {
      assert.ok(entry.gap > calibration.scaleCalibration[index - 1].gap);
      assert.ok(entry.localX < calibration.scaleCalibration[index - 1].localX);
    }
  }
  assert.ok(geometry.scaleMaximumX - geometry.scaleMinimumX > .7);
  const xSteps = calibration.scaleCalibration.slice(1).map(
    (entry, index) => entry.localX
      - calibration.scaleCalibration[index].localX,
  );
  assert.ok(Math.max(...xSteps) - Math.min(...xSteps) > 0.01,
    'nonlinear scale geometry produces unequal tick spacing');
  assert.match(data.transmission.scaleLaw, /same link-gap/);
  assert.match(data.transmission.scaleLaw, /not by visual linear spacing/);
  disposeModel(model.root);
});

test('movement 367 harmonic manual demonstration reaches both calibrated limits smoothly and analytic rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[366]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const minimumTime = (
    FULL_TURN - geometry.sourcePhaseAngle
  ) / (FULL_TURN / geometry.demonstrationPeriod);
  const maximumTime = (
    Math.PI - geometry.sourcePhaseAngle
  ) / (FULL_TURN / geometry.demonstrationPeriod);
  const minimum = stateAtTime(minimumTime);
  const maximum = stateAtTime(maximumTime);
  near(minimum.linkAngle, geometry.minimumLinkAngle, 3e-16,
    'minimum link angle');
  near(minimum.bladeGap, geometry.maximumBladeGap, 5e-16,
    'maximum blade gap');
  near(minimum.linkAngularSpeed, 0, 2e-16,
    'maximum-gap reversal speed');
  assert.equal(minimum.stage, 'maximum-blade-opening-reversal');
  near(maximum.linkAngle, geometry.maximumLinkAngle, 0,
    'maximum link angle');
  near(maximum.bladeGap, geometry.minimumBladeGap, 0,
    'minimum blade gap');
  near(maximum.linkAngularSpeed, 0, 1e-15,
    'minimum-gap reversal speed');
  assert.equal(maximum.stage, 'minimum-blade-opening-reversal');

  const step = 1e-5;
  for (const time of [-5.2, 0, 0.8, 2.9, 5.1, 8, 13.4]) {
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    near(
      (after.linkAngle - before.linkAngle) / (2 * step),
      state.linkAngularSpeed,
      1e-10,
      `angular speed at ${time}`,
    );
    near(
      (after.bladeGap - before.bladeGap) / (2 * step),
      state.bladeGapRate,
      1e-10,
      `gap speed at ${time}`,
    );
    const numericalUpperVelocity = after.upperBladePosition.clone()
      .sub(before.upperBladePosition)
      .multiplyScalar(1 / (2 * step));
    vectorNear(numericalUpperVelocity, state.upperBladeVelocity,
      2e-10, `upper blade velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 367 renderer preserves both link closures, scale incidence, and smooth blade motion over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[366]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let maximumLinkError = 0;
  let maximumArcPointError = 0;
  let largestBladeStep = 0;
  let previousPosition = null;
  const stages = new Set();

  assert.equal(animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.demonstrationPeriod * frame / 1200;
    model.update(time);
    const state = data.currentState;
    stages.add(state.stage);
    vectorNear(blocks.upperBlade.position,
      state.upperBladePosition, 0, 'rendered upper blade position');
    for (const link of blocks.parallelLinks) {
      near(link.rotation.y, -state.linkAngle, 0,
        'rendered common link angle');
    }
    for (const linkConstraint of data.constraints.parallelLinks) {
      maximumLinkError = Math.max(maximumLinkError,
        Math.abs(linkConstraint.endpointError));
    }
    const arcPoint = data.curves.brassArc.getPoint(
      data.constraints.arcScaleIncidence.arcParameter,
    );
    maximumArcPointError = Math.max(
      maximumArcPointError,
      arcPoint.distanceTo(
        data.constraints.arcScaleIncidence.incidencePoint,
      ),
    );
    near(data.constraints.arcScaleIncidence.scaleEdgeZ,
      state.incidencePoint.z, 3e-16, 'rendered scale-edge incidence');
    near(data.constraints.parallelBlades.rotationDifference, 0, 0,
      'rendered blade parallelism');
    if (previousPosition !== null) {
      largestBladeStep = Math.max(
        largestBladeStep,
        blocks.upperBlade.position.distanceTo(previousPosition),
      );
    }
    previousPosition = blocks.upperBlade.position.clone();
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(maximumLinkError < 5e-16);
  assert.ok(maximumArcPointError < 1.2e-15);
  assert.ok(largestBladeStep < 0.0033);
  assert.ok(stages.has('opening-blades-while-reading-scale'));
  assert.ok(stages.has('closing-blades-while-reading-scale'));
  disposeModel(model.root);
});

test('movement 367 returns exactly to its source-measured pose before movement 507', () => {
  const movement367 = catalog.movements[366];
  const movement507 = catalog.movements[506];
  const model367 = createMovementModel(movement367);
  const data = model367.root.userData;
  const { geometry, stateAtTime } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(start.linkAngle, geometry.sourceLinkAngle, 0,
    'source-measured starting link angle');
  near(closure.linkAngle, start.linkAngle, 0,
    'link-angle closure');
  near(closure.linkAngularSpeed, start.linkAngularSpeed, 0,
    'link-speed closure');
  near(closure.bladeGap, start.bladeGap, 0, 'gap closure');
  near(closure.scaleReadingLocalX, start.scaleReadingLocalX, 0,
    'scale-reading closure');
  vectorNear(closure.upperBladePosition,
    start.upperBladePosition, 0, 'upper-blade closure');
  vectorNear(closure.incidencePoint,
    start.incidencePoint, 0, 'incidence closure');

  const model507 = createMovementModel(movement507);
  assert.equal(movement367.id, 367);
  assert.equal(movement367.fidelity, 'authored');
  assert.equal(model367.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model367.root);
});
