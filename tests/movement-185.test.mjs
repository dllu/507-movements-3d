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
  const actualVector = new THREE.Vector2(actual.x, actual.y);
  const expectedVector = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actualVector.distanceTo(expectedVector) <= tolerance,
    `${message}: expected ${expectedVector.toArray()}, received ${actualVector.toArray()}`,
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

test('movement 185 is the source-scaled locomotive Stephenson link rather than a generic joint', () => {
  const movement = catalog.movements[184];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    reversingAnchorAt,
    selectorAtTime,
    selectorLawAtCyclePhase,
    solveLinkPose,
    sourcePointFromRaster,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;
  const {
    backwardEccentricRod,
    backwardSheave,
    backwardStrap,
    dieBlock,
    diePin,
    expansionLink,
    forwardEccentricRod,
    forwardSheave,
    forwardStrap,
    handleKnob,
    innerLinkRail,
    inputRotor,
    inputShaft,
    linkEndBridges,
    linkPinAssemblies,
    lowerRockerArm,
    outerLinkRail,
    outputRocker,
    quadrantNotches,
    reversingHandle,
    reversingQuadrant,
    suspensionLug,
    suspensionRod,
    upperRockerArm,
    valveGuide,
    valveLink,
    valveSlider,
    valveStem,
  } = blocks;

  assert.equal(movement.id, 185);
  assert.equal(movement.number, '185');
  assert.equal(
    movement.title,
    'Locomotive Stephenson Expansion-Link Valve Gear',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.match(movement.description, /Two eccentrics are used for one valve/s);
  assert.match(movement.description, /forward and the other for the backward movement/s);
  assert.match(movement.description, /curved slotted bar/s);
  assert.match(movement.description, /link, which can be raised or lowered/s);
  assert.match(movement.description, /slide and pin connected/s);
  assert.match(movement.description, /slide is in the middle/s);
  assert.match(movement.description, /steam is worked expansively/s);
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_185.html');
  assert.equal(
    movement.archetype,
    'locomotive-opposed-eccentric-suspended-stephenson-expansion-link-die-rocker-valve-gear',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'two-opposed-eccentrics-finite-rods-suspended-curved-slotted-link-captured-die-rocker-guided-valve',
  );
  for (const fn of [
    reversingAnchorAt,
    selectorAtTime,
    selectorLawAtCyclePhase,
    solveLinkPose,
    sourcePointFromRaster,
    stateAtInputAngle,
    stateAtTime,
  ]) assert.equal(typeof fn, 'function');

  // The visible topology is exactly the source mechanism: one shaft carries
  // two opposed eccentrics, two free straps and finite rods feed one rigid
  // expansion link, a lifting rod selects its height, and one captured die
  // drives the valve through a fixed-axis rocker.
  for (const object of [
    backwardEccentricRod,
    backwardSheave,
    backwardStrap,
    dieBlock,
    diePin,
    expansionLink,
    forwardEccentricRod,
    forwardSheave,
    forwardStrap,
    handleKnob,
    innerLinkRail,
    inputRotor,
    inputShaft,
    lowerRockerArm,
    outerLinkRail,
    outputRocker,
    reversingHandle,
    reversingQuadrant,
    suspensionLug,
    suspensionRod,
    upperRockerArm,
    valveGuide,
    valveLink,
    valveSlider,
    valveStem,
  ]) assert.ok(object?.isObject3D);
  assert.notEqual(forwardSheave, backwardSheave);
  assert.notEqual(forwardStrap, backwardStrap);
  assert.notEqual(forwardEccentricRod, backwardEccentricRod);
  assert.equal(forwardSheave.parent, inputRotor);
  assert.equal(backwardSheave.parent, inputRotor);
  assert.equal(linkPinAssemblies.length, 2);
  assert.equal(linkEndBridges.length, 2);
  assert.equal(quadrantNotches.length, 9);
  assert.equal(suspensionLug.parent, expansionLink);
  assert.equal(
    suspensionRod.userData.kinematicConstraint,
    'fixed-length-reversing-anchor-to-rigid-link-lifting-lug',
  );
  near(
    forwardSheave.position.y,
    geometry.eccentricity,
    0,
    'forward eccentric local throw',
  );
  near(
    backwardSheave.position.y,
    -geometry.eccentricity,
    0,
    'backward eccentric local throw',
  );
  near(
    geometry.aheadEccentricRodLength,
    geometry.asternEccentricRodLength,
    1e-14,
    'equal source eccentric rods',
  );
  assert.ok(geometry.forwardLayerZ > 0);
  assert.ok(geometry.backwardLayerZ < 0);
  assert.ok(geometry.forwardLayerZ - geometry.backwardLayerZ > 0.45);
  near(geometry.linkSlotRadius / geometry.scale, 26, 1e-14,
    'source expansion-link radius ratio');
  // Pass 72: Brown's short quadrant; full gear keeps the die between the
  // rod pins in his 1.29x link.
  near(geometry.maximumReversingAngle, 0.22, 0,
    'source-scale reversing-sector sweep');
  near(
    geometry.reversingShortArmLength / geometry.scale,
    9.5,
    1e-14,
    'source reversing short arm ratio',
  );
  near(
    geometry.suspensionRodLength / geometry.scale,
    15,
    2e-14,
    'source vertical suspension length ratio',
  );

  const forbiddenBelts = [];
  const forbiddenCams = [];
  const forbiddenUniversalJoints = [];
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (object.userData.mechanismBelt || object.userData.selectorBelt) {
      forbiddenBelts.push(object);
    }
    if (/(?:^|-)cam(?:-|$)/i.test(role) && !/camera/i.test(role)) {
      forbiddenCams.push(object);
    }
    if (/universal-joint/i.test(role)) forbiddenUniversalJoints.push(object);
  });
  assert.deepEqual(forbiddenBelts, []);
  assert.deepEqual(forbiddenCams, []);
  assert.deepEqual(forbiddenUniversalJoints, []);

  // One uniform raster scale preserves the characteristic long eccentric
  // rods and the relative positions of the link, handle pivot, and valve gear.
  vector2Near(
    sourcePointFromRaster(geometry.sourceRasterShaftCenter),
    geometry.shaftCenter,
    1e-15,
    'engraved common shaft center',
  );
  const source = canonicalStates.sourcePartialGear;
  assert.ok(
    sourcePointFromRaster(geometry.sourceRasterLinkCenter)
      .distanceTo(source.diePoint) < 0.22,
    'source die remains within the engraved square-block tolerance',
  );
  assert.ok(
    sourcePointFromRaster(geometry.sourceRasterAheadLinkPin)
      .distanceTo(source.aheadLinkPin) < 0.25,
    'source upper rod pin',
  );
  assert.ok(
    sourcePointFromRaster(geometry.sourceRasterAsternLinkPin)
      .distanceTo(source.asternLinkPin) < 0.17,
    'source lower rod pin',
  );
  assert.ok(
    sourcePointFromRaster(geometry.sourceRasterReversingPivot)
      .distanceTo(geometry.reversingPivot) < 0.29,
    'source reversing-handle pivot',
  );
  near(source.selector, geometry.sourceSelector, 1e-15,
    'source is shown in partial forward gear');
  near(source.inputAngle, geometry.sourceInputAngle, 1e-15,
    'source input pose');
  assert.equal(source.stage, 'partial-gear-expansive-cutoff');
  assert.ok(source.dieSlotParameter > 0.02);
  assert.ok(source.dieSlotParameter < 0.03);
  assert.ok(
    Math.abs(source.dieSlotParameter)
      < geometry.freeDieHalfAngle / 4,
  );

  disposeModel(model.root);
});

test('movement 185 closes both eccentric rods, suspension, curved die, rocker, and valve over every gear setting', () => {
  const model = createMovementModel(catalog.movements[184]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    reversingAnchorAt,
    selectorAtTime,
    selectorLawAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
  } = model.root.userData;

  assert.equal(
    canonicalStates.forwardAtQuarterTurn.stage,
    'forward-eccentric-in-full-gear',
  );
  assert.equal(
    canonicalStates.backwardAtQuarterTurn.stage,
    'backward-eccentric-in-full-gear',
  );
  assert.equal(
    canonicalStates.midGearAtQuarterTurn.stage,
    'mid-gear-with-only-link-slip',
  );
  near(canonicalStates.forwardAtQuarterTurn.selector, -1, 0,
    'full-forward selector');
  near(canonicalStates.backwardAtQuarterTurn.selector, 1, 0,
    'full-backward selector');
  near(canonicalStates.midGearAtQuarterTurn.selector, 0, 0,
    'mid-gear selector');

  // The link is lowered toward one end for forward gear and raised toward the
  // other for backward gear. Brown's finite suspension creates a small real
  // link-slip stroke at mid-gear, but it is far below either full-gear stroke.
  const selectors = [-1, geometry.sourceSelector, 0, 1];
  const ranges = new Map(selectors.map((selector) => [selector, {
    dieMaximum: -Infinity,
    dieMinimum: Infinity,
    valveMaximum: -Infinity,
    valveMinimum: Infinity,
    valveSamples: [],
  }]));
  for (let index = 0; index < 4096; index += 1) {
    const angle = FULL_TURN * index / 4096;
    for (const selector of selectors) {
      const state = stateAtInputAngle(angle, selector);
      const range = ranges.get(selector);
      range.dieMinimum = Math.min(
        range.dieMinimum,
        state.dieSlotParameter,
      );
      range.dieMaximum = Math.max(
        range.dieMaximum,
        state.dieSlotParameter,
      );
      range.valveMinimum = Math.min(
        range.valveMinimum,
        state.valveStemPoint.x,
      );
      range.valveMaximum = Math.max(
        range.valveMaximum,
        state.valveStemPoint.x,
      );
      range.valveSamples.push(state.valveStemPoint.x);
    }
  }
  const strokeAt = (selector) => {
    const range = ranges.get(selector);
    return range.valveMaximum - range.valveMinimum;
  };
  const forwardStroke = strokeAt(-1);
  const sourceStroke = strokeAt(geometry.sourceSelector);
  const midStroke = strokeAt(0);
  const backwardStroke = strokeAt(1);
  // Pass 72: in Brown's short (1.29x) link the die stops short of the rod
  // pins in full gear, so the full-gear strokes are about twice mid gear's.
  assert.ok(forwardStroke > 0.26);
  assert.ok(backwardStroke > 0.23);
  assert.ok(backwardStroke > forwardStroke * 0.87);
  assert.ok(backwardStroke < forwardStroke * 0.90);
  assert.ok(midStroke < Math.min(forwardStroke, backwardStroke) * 0.55);
  assert.ok(sourceStroke > midStroke * 1.35);
  assert.ok(sourceStroke < backwardStroke * 0.75);
  assert.ok(ranges.get(-1).dieMinimum > 0.02);
  assert.ok(ranges.get(1).dieMaximum < -0.02);
  assert.ok(Math.abs(ranges.get(0).dieMinimum) < 0.051);
  assert.ok(Math.abs(ranges.get(0).dieMaximum) < 0.056);

  // Full forward and full backward valve signals are phase-reversed rather
  // than two unrelated sine waves or a change of amplitude alone.
  const forwardSamples = ranges.get(-1).valveSamples;
  const backwardSamples = ranges.get(1).valveSamples;
  const forwardMean = forwardSamples.reduce((sum, value) => sum + value, 0)
    / forwardSamples.length;
  const backwardMean = backwardSamples.reduce((sum, value) => sum + value, 0)
    / backwardSamples.length;
  let covariance = 0;
  let forwardVariance = 0;
  let backwardVariance = 0;
  for (let index = 0; index < forwardSamples.length; index += 1) {
    const forward = forwardSamples[index] - forwardMean;
    const backward = backwardSamples[index] - backwardMean;
    covariance += forward * backward;
    forwardVariance += forward ** 2;
    backwardVariance += backward ** 2;
  }
  const correlation = covariance / Math.sqrt(
    forwardVariance * backwardVariance,
  );
  // Pass 72: the shared mid-gear (slip) component is now about half the
  // full-gear stroke, so the reversed signals correlate less strongly.
  assert.ok(correlation < -0.6);

  // Dense mixed-selector sampling catches a Newton branch change, the wrong
  // circle-circle die intersection, or any disconnected finite link.
  const dense = {
    aheadRod: 0,
    asternRod: 0,
    branchSeparation: Infinity,
    dieSlot: 0,
    eccentricOpposition: 0,
    linkPinSpacing: 0,
    outputRocker: 0,
    suspensionRod: 0,
    valveGuide: 0,
    valveRod: 0,
  };
  let maximumIterations = 0;
  let maximumLinkAngle = 0;
  let maximumSlotParameter = 0;
  for (let index = 0; index < 32768; index += 1) {
    const angle = FULL_TURN * index / 32768;
    const selector = -1 + 2 * (index % 17) / 16;
    const state = stateAtInputAngle(angle, selector);
    dense.aheadRod = Math.max(dense.aheadRod, state.aheadRodLengthError);
    dense.asternRod = Math.max(dense.asternRod, state.asternRodLengthError);
    dense.branchSeparation = Math.min(
      dense.branchSeparation,
      state.dieBranchSeparation,
    );
    dense.dieSlot = Math.max(
      dense.dieSlot,
      state.dieSlotContactError,
    );
    dense.eccentricOpposition = Math.max(
      dense.eccentricOpposition,
      state.eccentricOppositionError,
    );
    dense.linkPinSpacing = Math.max(
      dense.linkPinSpacing,
      state.linkPinSpacingError,
    );
    dense.outputRocker = Math.max(
      dense.outputRocker,
      state.outputRockerLowerArmError,
    );
    dense.suspensionRod = Math.max(
      dense.suspensionRod,
      state.suspensionRodLengthError,
    );
    dense.valveGuide = Math.max(
      dense.valveGuide,
      state.valveGuideError,
    );
    dense.valveRod = Math.max(
      dense.valveRod,
      state.valveRodLengthError,
    );
    maximumIterations = Math.max(maximumIterations, state.iterations);
    maximumLinkAngle = Math.max(
      maximumLinkAngle,
      Math.abs(state.linkAngle),
    );
    maximumSlotParameter = Math.max(
      maximumSlotParameter,
      Math.abs(state.dieSlotParameter),
    );
    near(
      state.aheadEccentricCenter.distanceTo(geometry.shaftCenter),
      geometry.eccentricity,
      1e-15,
      'forward eccentric radial throw',
    );
    near(
      state.asternEccentricCenter.distanceTo(geometry.shaftCenter),
      geometry.eccentricity,
      1e-15,
      'backward eccentric radial throw',
    );
    near(
      state.reversingAnchor.distanceTo(geometry.reversingPivot),
      geometry.reversingShortArmLength,
      8e-16,
      'reversing lever short-arm radius',
    );
    assert.equal(Number.isFinite(state.valveStemPoint.x), true);
  }
  assert.ok(dense.aheadRod < 1.4e-14);
  assert.ok(dense.asternRod < 1.4e-14);
  assert.ok(dense.suspensionRod < 2.2e-14);
  assert.ok(dense.eccentricOpposition < 1e-15);
  assert.ok(dense.linkPinSpacing < 6e-16);
  assert.ok(dense.dieSlot < 1.8e-15);
  assert.ok(dense.outputRocker < 5.4e-15);
  assert.ok(dense.valveGuide < 1e-15);
  assert.ok(dense.valveRod < 2.3e-16);
  assert.ok(dense.branchSeparation > 0.159);
  assert.ok(maximumIterations <= 6);
  assert.ok(maximumLinkAngle > 0.49);
  assert.ok(maximumLinkAngle < 0.50);
  // Pass 72: Brown's link is 1.29x its pin spacing overall; the die block
  // stays clear of the closed slot ends and between the eccentric-rod pins.
  const halfSpacing = geometry.linkPinSpacing / 2;
  near((2 * geometry.linkSlotRadius * Math.sin(geometry.visibleLinkHalfAngle)
    + geometry.linkEndThickness) / geometry.linkPinSpacing, 1.29, 0.01,
  'Brown link-to-pin-spacing ratio');
  const pinSlotAngle = Math.asin(halfSpacing / Math.hypot(halfSpacing,
    geometry.linkSlotCenterLocal.x - geometry.aheadLinkPinLocal.x));
  assert.ok(maximumSlotParameter > 0.14);
  assert.ok(maximumSlotParameter < geometry.freeDieHalfAngle);
  assert.ok(maximumSlotParameter + geometry.dieHalfLength / geometry.linkSlotRadius
    < pinSlotAngle, 'die block stays between the rod pins');

  // The selected die branch remains continuous at every fixed gear setting.
  for (const selector of [-1, -0.5, 0, 0.5, 1]) {
    let previous = stateAtInputAngle(0, selector);
    let maximumRockerStep = 0;
    let maximumLinkStep = 0;
    for (let index = 1; index <= 8192; index += 1) {
      const state = stateAtInputAngle(
        FULL_TURN * (index % 8192) / 8192,
        selector,
      );
      maximumRockerStep = Math.max(
        maximumRockerStep,
        Math.abs(wrapAngle(state.rockerAngle - previous.rockerAngle)),
      );
      maximumLinkStep = Math.max(
        maximumLinkStep,
        Math.abs(wrapAngle(state.linkAngle - previous.linkAngle)),
      );
      previous = state;
    }
    assert.ok(maximumRockerStep < 0.0016);
    assert.ok(maximumLinkStep < 0.0010);
  }

  // The public selector cycle dwells at every explanatory state. Quintic
  // transitions make position, rate, and acceleration continuous at all eight
  // boundaries, and eight shaft turns make the loop close exactly.
  const boundaries = Object.values(geometry.selectorBreaks);
  for (const boundary of boundaries) {
    const atBoundary = selectorLawAtCyclePhase(boundary);
    near(atBoundary.ratePerPhase, 0, 3e-14,
      `selector rate at phase ${boundary}`);
    near(atBoundary.accelerationPerPhaseSquared, 0, 2e-12,
      `selector acceleration at phase ${boundary}`);
    const epsilon = 1e-8;
    const left = selectorLawAtCyclePhase(boundary - epsilon);
    const right = selectorLawAtCyclePhase(boundary + epsilon);
    assert.ok(Math.abs(left.value - right.value) < 3e-13);
    assert.ok(Math.abs(left.ratePerPhase - right.ratePerPhase) < 4e-11);
    assert.ok(
      Math.abs(
        left.accelerationPerPhaseSquared
          - right.accelerationPerPhaseSquared
      ) < 0.002,
    );
  }
  near(selectorAtTime(canonicalTimes.sourcePartialGear), geometry.sourceSelector,
    1e-15, 'source selector dwell');
  near(selectorAtTime(canonicalTimes.forwardFullGear), -1, 1e-15,
    'forward selector dwell');
  near(selectorAtTime(canonicalTimes.midGear), 0, 1e-15,
    'mid-gear selector dwell');
  near(selectorAtTime(canonicalTimes.backwardFullGear), 1, 1e-15,
    'backward selector dwell');
  near(selectorAtTime(canonicalTimes.nextSourcePartialGear),
    geometry.sourceSelector, 1e-15, 'selector cycle closure');
  const sourceTime = stateAtTime(0);
  const closedTime = stateAtTime(geometry.selectorPeriod);
  for (const key of [
    'inputAngle',
    'linkAngle',
    'rockerAngle',
    'selector',
  ]) near(closedTime[key], sourceTime[key], 0, `closed ${key}`);
  for (const key of [
    'aheadEccentricCenter',
    'asternEccentricCenter',
    'diePoint',
    'linkPosition',
    'reversingAnchor',
    'suspensionPin',
    'valveStemPoint',
  ]) vector2Near(closedTime[key], sourceTime[key], 0, `closed ${key}`);
  // Pass 71: the lever reverses the engine. The shaft turns forward in
  // forward gear, backward in backward gear and stops in mid gear; the loop
  // nets exactly one forward turn, so it closes seamlessly.
  near(model.root.userData.inputAngleAtPhase(1), FULL_TURN, 1e-9, 'one net forward turn per demonstration');
  assert.ok(stateAtTime(canonicalTimes.forwardFullGear).inputAngularSpeed > 1);
  assert.ok(stateAtTime(canonicalTimes.backwardFullGear).inputAngularSpeed < -1);
  near(stateAtTime(canonicalTimes.midGear).inputAngularSpeed, 0, 1e-12, 'engine stopped in mid gear');
  assert.ok(sourceTime.inputAngularSpeed > 1, 'Brown\'s partial forward gear runs forward');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, geometry.selectorPeriod);
  for (const selector of [-1, -0.25, 0, 0.4, 1]) {
    vector2Near(
      reversingAnchorAt(selector),
      stateAtInputAngle(1.37, selector).reversingAnchor,
      1e-15,
      'selector-controlled suspension anchor',
    );
  }

  disposeModel(model.root);
});

test('movement 185 rendered transforms keep every analytical joint visibly attached in separate depth layers', () => {
  const model = createMovementModel(catalog.movements[184]);
  const {
    blocks,
    canonicalTimes,
    geometry,
  } = model.root.userData;
  const {
    backwardEccentricRod,
    backwardSheave,
    backwardStrap,
    cameraEnvelope,
    dieBlock,
    diePin,
    expansionLink,
    fixedFrame,
    forwardEccentricRod,
    forwardSheave,
    forwardStrap,
    inputRotor,
    linkPinAssemblies,
    outputRocker,
    reversingHandle,
    reversingQuadrant,
    suspensionLug,
    suspensionRod,
    valveGuide,
    valveLink,
    valveSlider,
  } = blocks;

  for (const time of [
    canonicalTimes.sourcePartialGear,
    canonicalTimes.forwardFullGear,
    canonicalTimes.midGear,
    canonicalTimes.backwardFullGear,
    geometry.selectorPeriod * 0.84,
  ]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    vector2Near(
      worldPoint(forwardSheave),
      state.aheadEccentricCenter,
      2e-15,
      'rendered forward sheave center',
    );
    vector2Near(
      worldPoint(backwardSheave),
      state.asternEccentricCenter,
      2e-15,
      'rendered backward sheave center',
    );
    vector2Near(
      forwardStrap.position,
      state.aheadEccentricCenter,
      2e-15,
      'rendered forward strap center',
    );
    vector2Near(
      backwardStrap.position,
      state.asternEccentricCenter,
      2e-15,
      'rendered backward strap center',
    );
    vector2Near(
      worldPoint(linkPinAssemblies[0]),
      state.aheadLinkPin,
      2e-15,
      'rendered upper link pin',
    );
    vector2Near(
      worldPoint(linkPinAssemblies[1]),
      state.asternLinkPin,
      2e-15,
      'rendered lower link pin',
    );
    vector2Near(
      worldPoint(suspensionLug),
      state.suspensionPin,
      2e-15,
      'rendered link lifting lug',
    );
    vector2Near(
      worldPoint(dieBlock),
      state.diePoint,
      2e-15,
      'rendered captured die',
    );
    vector2Near(
      worldPoint(valveSlider),
      state.valveStemPoint,
      2e-15,
      'rendered guided valve output',
    );
    vector2Near(
      worldPoint(outputRocker),
      geometry.outputRockerPivot,
      2e-15,
      'fixed rendered output-rocker pivot',
    );
    vector2Near(
      worldPoint(reversingHandle),
      geometry.reversingPivot,
      2e-15,
      'fixed rendered reversing pivot',
    );
    near(inputRotor.rotation.z, state.inputAngle, 1e-15,
      'rendered common-shaft angle');
    near(expansionLink.rotation.z, state.linkAngle, 1e-15,
      'rendered rigid expansion-link angle');
    near(reversingHandle.rotation.z, state.reversingAngle, 1e-15,
      'rendered reversing-handle angle');
    near(outputRocker.rotation.z, state.rockerAngle, 1e-15,
      'rendered output-rocker angle');
    near(
      dieBlock.rotation.z,
      state.linkAngle - state.dieSlotParameter,
      1e-15,
      'die body follows the curved-slot tangent',
    );
    near(
      model.root.userData.contacts.dieInExpansionLink.contactError,
      state.dieSlotContactError,
      0,
      'published rendered die contact',
    );
  }

  // The pin spans the link and rocker planes, while the two eccentric rods,
  // selector, output gear, and rear frame occupy intentionally distinct z
  // layers. This is an assembled 3D mechanism, not coplanar line art.
  assert.ok(diePin.geometry.parameters.height > 1.49);
  assert.ok(geometry.forwardLayerZ > geometry.backwardLayerZ);
  assert.ok(outputRocker.position.z > reversingHandle.position.z);
  assert.ok(reversingHandle.position.z > expansionLink.position.z);
  const frameBox = new THREE.Box3().setFromObject(fixedFrame);
  const linkBox = new THREE.Box3().setFromObject(expansionLink);
  const rockerBox = new THREE.Box3().setFromObject(outputRocker);
  assert.ok(frameBox.max.z < linkBox.max.z);
  assert.ok(linkBox.max.z < rockerBox.max.z);
  assert.equal(cameraEnvelope.material.colorWrite, false);
  assert.equal(cameraEnvelope.castShadow, false);
  assert.equal(cameraEnvelope.receiveShadow, false);

  const physicalBounds = new THREE.Box3();
  // Pass 71: sampled over the whole demonstration (the shaft angle at the
  // canonical gear settings changed when the lever began reversing it).
  for (const time of Array.from({ length: 49 }, (_, i) => geometry.selectorPeriod * i / 48)) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    for (const object of [
      fixedFrame,
      inputRotor,
      forwardStrap,
      backwardStrap,
      forwardEccentricRod,
      backwardEccentricRod,
      expansionLink,
      reversingHandle,
      reversingQuadrant,
      suspensionRod,
      outputRocker,
      dieBlock,
      valveLink,
      valveSlider,
      valveGuide,
    ]) physicalBounds.expandByObject(object);
  }
  const physicalSize = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(physicalSize.x > 10.75, 'notched quadrant plate and eccentric straps span the plate width');
  // Pass 72: Brown's notched quadrant is short.
  assert.ok(physicalSize.y > 4.8);
  // The fixed rockshaft and reversing axis stop just proud of their arms;
  // the common eccentric shaft sets the depth.
  assert.ok(physicalSize.z > 2.65);
  assert.ok(physicalBounds.min.z < -1.32);
  assert.ok(physicalBounds.max.z > 1.32);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 3.3);

  // Movements 186–189 are independently authored gab-release apparatus, and
  // 190 is now an authored screw clamp. Review stops before 191.
  const movement184 = createMovementModel(catalog.movements[183]);
  const movement186 = createMovementModel(catalog.movements[185]);
  const movement187 = createMovementModel(catalog.movements[186]);
  const movement188 = createMovementModel(catalog.movements[187]);
  const movement189 = createMovementModel(catalog.movements[188]);
  const movement190 = createMovementModel(catalog.movements[189]);
  assert.equal(movement184.root.userData.fidelity, 'authored');
  assert.equal(movement186.root.userData.fidelity, 'authored');
  assert.equal(movement187.root.userData.fidelity, 'authored');
  assert.equal(movement188.root.userData.fidelity, 'authored');
  assert.equal(movement189.root.userData.fidelity, 'authored');
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement184.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement186.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement187.root.userData.mechanism,
    movement186.root.userData.mechanism,
  );
  assert.notEqual(
    movement188.root.userData.mechanism,
    movement187.root.userData.mechanism,
  );
  assert.notEqual(
    movement189.root.userData.mechanism,
    movement188.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.mechanism,
    movement189.root.userData.mechanism,
  );

  disposeModel(movement184.root);
  disposeModel(movement186.root);
  disposeModel(movement187.root);
  disposeModel(movement188.root);
  disposeModel(movement189.root);
  disposeModel(movement190.root);
  disposeModel(model.root);
});

test('185 (pass 90): one solid wall block, flat eared straps turning with their rods, no loose rod-eye tori', () => {
  const model = createMovementModel(catalog.movements[184]);
  const {blocks: b} = model.root.userData;
  const wall = model.root.getObjectsByProperty('isMesh', true)
    .filter((o) => /sectioned-wall/.test(o.userData.role ?? ''));
  assert.equal(wall.length, 1);
  const size = new THREE.Box3().setFromObject(wall[0]).getSize(new THREE.Vector3());
  assert.ok(size.x > 2.5 && size.y > 2.6, `massive block ${size.toArray()}`);
  // Pass 93: mid stone, not a near-white ghost on the cream paper.
  const {r, g, b: blue} = wall[0].material.color;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  assert.ok(luminance > 0.15 && luminance < 0.4, `wall luminance ${luminance} (linear)`);
  for (const strap of [b.forwardStrap, b.backwardStrap]) {
    assert.equal(strap.userData.ring.geometry.type, 'ExtrudeGeometry');
  }
  for (const time of [0, 3, 7.5]) {
    model.update(time, 0.016);
    near(b.forwardStrap.rotation.z, b.forwardEccentricRod.rotation.z, 1e-15, 'forward strap turns with its rod');
    near(b.backwardStrap.rotation.z, b.backwardEccentricRod.rotation.z, 1e-15, 'backward strap turns with its rod');
  }
  for (const assembly of b.linkPinAssemblies) {
    assert.ok(assembly.children.every((c) => c.geometry.type === 'CylinderGeometry'));
  }
  disposeModel(model.root);
});

test('185 (pass 92): the reversing handle carries a round boss centred on its fulcrum axis', () => {
  const model = createMovementModel(catalog.movements[184]);
  const meshes = model.root.getObjectsByProperty('isMesh', true);
  const boss = meshes.find((o) => o.userData.role === 'reversing-handle-fulcrum-boss');
  const axis = meshes.find((o) => o.userData.role === 'fixed-reversing-handle-axis');
  assert.ok(boss && axis);
  assert.equal(boss.parent, axis.parent, 'boss turns with the handle, about the axis');
  assert.ok(Math.hypot(boss.position.x - axis.position.x, boss.position.y - axis.position.y) < 1e-12);
  const r = boss.geometry.parameters.radiusTop, pin = axis.geometry.parameters.radiusTop;
  assert.ok(r >= 1.5 * pin, `boss ${r} leaves a margin round the ${pin} axis`);
  disposeModel(model.root);
});

test('185 (pass 92): no white parts and no index marks are built (Brown draws none)', () => {
  const model = createMovementModel(catalog.movements[184]);
  model.root.traverse((object) => {
    assert.ok(!/index|white/i.test(object.userData.role ?? ''), `no index mark: ${object.userData.role}`);
    if (!object.isMesh) return;
    for (const material of [].concat(object.material)) {
      const c = material.color;
      assert.ok(!c || (c.r + c.g + c.b) / 3 < 0.85, `no white material on ${object.userData.role}`);
    }
  });
  disposeModel(model.root);
});

test('185 (pass 92): every bar that ends in a link ball has its end corners inside the ball', () => {
  const model = createMovementModel(catalog.movements[184]);
  const boxes = [];
  const balls = [];
  const pins = [];
  let checked = 0;
  for (const time of [0, 2.3, 5.9]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    boxes.length = 0;
    balls.length = 0;
    pins.length = 0;
    model.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (o.geometry.type === 'BoxGeometry') boxes.push(o);
      if (o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius > 0.01) balls.push(o);
      if (o.geometry.type === 'CylinderGeometry' && /pin/.test(o.userData.role ?? '')) {
        const axis = new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld);
        if (Math.abs(Math.abs(axis.z) - 1) > 1e-6) return;
        const c = o.getWorldPosition(new THREE.Vector3());
        const h = o.geometry.parameters.height / 2;
        pins.push({ axis: c.clone().setZ(0), z0: c.z - h, z1: c.z + h, r: o.geometry.parameters.radiusTop });
      }
    });
    for (const ball of balls) {
      const centre = ball.getWorldPosition(new THREE.Vector3());
      const r = ball.geometry.parameters.radius * ball.getWorldScale(new THREE.Vector3()).x;
      for (const box of boxes) {
        const p = box.geometry.parameters;
        const s = box.getWorldScale(new THREE.Vector3());
        const dims = [p.width * s.x, p.height * s.y, p.depth * s.z];
        const long = dims.indexOf(Math.max(...dims));
        const local = box.worldToLocal(centre.clone());
        const l = [local.x * s.x, local.y * s.y, local.z * s.z];
        const others = [0, 1, 2].filter((i) => i !== long);
        if (others.some((i) => Math.abs(l[i]) > 1e-3)) continue;
        const endOffset = dims[long] / 2 - Math.abs(l[long]);
        if (Math.abs(endOffset) > r || endOffset < -1e-6) continue;
        const corner = Math.hypot(dims[others[0]] / 2, dims[others[1]] / 2, endOffset);
        // A coaxial pin through the joint that covers the bar's depth also hides its corners.
        const pinR = pins.filter((pin) => pin.axis.distanceTo(centre.clone().setZ(0)) < 1e-3
          && pin.z0 <= centre.z - dims[2] / 2 + 1e-6 && pin.z1 >= centre.z + dims[2] / 2 - 1e-6)
          .reduce((m, pin) => Math.max(m, pin.r), 0);
        assert.ok(corner <= Math.max(r, pinR), `${box.parent?.userData.role} corner ${corner} outside ${ball.parent?.userData.role} ball ${r}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 9, `bar ends checked: ${checked}`);
  disposeModel(model.root);
});
