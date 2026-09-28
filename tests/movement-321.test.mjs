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

function planarNear(actual, expected, tolerance, message) {
  near(
    Math.hypot(actual.x - expected.x, actual.y - expected.y),
    0,
    tolerance,
    message,
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

test('movement 321 is Harrison’s complete spring maintaining-power barrel', () => {
  const movement = catalog.movements[320];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 321);
  assert.equal(movement.number, '321');
  assert.match(movement.title, /^Harrison’s “going-barrel/);
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'harrison-spring-maintaining-power-going-barrel');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /barrel B and its small ratchet/);
  assert.match(mechanism, /carried click R/);
  assert.match(mechanism, /fixed click T holds/);
  assert.match(mechanism, /spring alone keeps G advancing/);
  assert.match(transmission.goingPath,
    /barrel B.*small ratchet.*R.*larger ratchet.*spring.*G/);
  assert.match(transmission.windingPath,
    /R overruns, T holds/);
  assert.match(transmission.outputContinuity,
    /strictly positive constant angular velocity/);

  assert.ok(blocks.fixedFrame.parent === null, 'source presentation removes the undrawn frame beam');
  assert.equal(blocks.greatWheel.parent, model.root);
  assert.equal(blocks.largeRatchet.parent, model.root);
  assert.equal(blocks.barrel.parent, model.root);
  assert.equal(blocks.clickT.parent, model.root);
  assert.equal(blocks.clickR.parent,
    blocks.largeRatchet.userData.rotor);
  assert.equal(blocks.springOuterAnchor.parent,
    blocks.greatWheel.userData.rotor);
  assert.equal(blocks.springInnerAnchor.parent,
    blocks.largeRatchet.userData.rotor);
  assert.equal(blocks.barrelRatchet.parent,
    blocks.barrel.userData.rotor);
  assert.equal(blocks.rope.parent, model.root);
  assert.equal(blocks.weight.parent, model.root);
  // One continuous round wire drawn along the spiral.
  assert.equal(blocks.springSegments.length, 1);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role === 'great-going-wheel-G').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'larger-ratchet-wheel-held-by-T').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'small-ratchet-fixed-to-barrel-B').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'click-R-carried-by-larger-ratchet').length, 1);
  assert.equal(roles.filter((role) => role === 'fixed-frame-click-T').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'maintaining-spring-S-S-prime-curved-wire').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 321 preserves Brown’s G, B, R, T, S, and S-prime landmarks', () => {
  const movement = catalog.movements[320];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToReferenceFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate321;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /coaxial barrel B/);
  assert.match(sourceAnimation.referenceScope, /carried click R/);
  assert.match(sourceAnimation.referenceScope, /fixed-frame click T/);
  assert.match(sourceAnimation.referenceScope, /spring S–S′/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_321.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 11);
  assert.deepEqual(plate.rasterBarrelCenterB,
    new THREE.Vector2(239, 242));
  assert.deepEqual(plate.rasterFrameClickPivotT,
    new THREE.Vector2(479, 47));
  assert.deepEqual(plate.rasterFrameClickContactT,
    new THREE.Vector2(181, 80));
  assert.deepEqual(plate.rasterCarriedClickPivotR,
    new THREE.Vector2(369, 269));
  assert.deepEqual(plate.rasterCarriedClickContactR,
    new THREE.Vector2(293, 320));
  assert.deepEqual(plate.rasterOuterSpringAnchorSPrime,
    new THREE.Vector2(65, 208));
  assert.deepEqual(plate.rasterInnerSpringAnchorS,
    new THREE.Vector2(162, 132));
  assert.deepEqual(plate.rasterWeightCenter,
    new THREE.Vector2(173, 487));
  assert.match(plate.inferredTopology, /coaxial outer great wheel G/);
  assert.match(plate.inferredTopology, /small ratchet fixed to barrel B/);

  const reference = stateAtTime(0);
  const tolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  planarNear(sourcePointToReferenceFront(plate.rasterBarrelCenterB),
    new THREE.Vector3(), 0, 'source B/G center');
  planarNear(sourcePointToReferenceFront(plate.rasterFrameClickContactT),
    reference.contacts.T.point, tolerance, 'source fixed-click T contact');
  planarNear(sourcePointToReferenceFront(plate.rasterCarriedClickContactR),
    reference.contacts.R.point, tolerance, 'source carried-click R contact');
  planarNear(sourcePointToReferenceFront(plate.rasterOuterSpringAnchorSPrime),
    reference.springGeometry.pointAtMaterialFraction(0),
    tolerance, 'source outer spring anchor S-prime');
  planarNear(sourcePointToReferenceFront(plate.rasterInnerSpringAnchorS),
    reference.springGeometry.pointAtMaterialFraction(1),
    tolerance, 'source inner spring anchor S');
  // Brown's weight hangs just under G. The plate pose follows winding
  // closely, so the wound weight rises only 5/24 of a drum turn above
  // it: the plate-pose weight sits within that lift (plus the measuring
  // tolerance) of Brown's station, and its top never reaches G's tips.
  const sourceWeightY = sourcePointToReferenceFront(plate.rasterWeightCenter).y;
  assert.ok(Math.abs(sourceWeightY - reference.weightPosition.y)
    < geometry.ropeDrumPitchRadius * FULL_TURN
      * (1 - geometry.windingStartPhase) + tolerance,
    'source weight vertical station');
  const greatWheelTip = new THREE.Box3()
    .setFromObject(model.root.userData.blocks.greatWheel, true).min.y;
  for (let sample = 0; sample <= 512; sample += 1) {
    model.update(8 * sample / 512);
    model.root.updateMatrixWorld(true);
    const weightTop = new THREE.Box3()
      .setFromObject(model.root.userData.blocks.weight, true).max.y;
    assert.ok(weightTop < greatWheelTip - 0.08,
      `wound weight reaches G's teeth at sample ${sample}`);
  }
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 321 has the source three-member coaxial stack and two distinct clicks', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { blocks, geometry } = model.root.userData;

  assert.deepEqual(blocks.greatWheel.userData.axis,
    new THREE.Vector3(0, 0, 1));
  assert.deepEqual(blocks.largeRatchet.userData.axis,
    new THREE.Vector3(0, 0, 1));
  assert.deepEqual(blocks.barrel.userData.axis,
    new THREE.Vector3(0, 0, 1));
  near(blocks.greatWheel.position.x, 0, 0, 'G coaxial x');
  near(blocks.greatWheel.position.y, 0, 0, 'G coaxial y');
  near(blocks.largeRatchet.position.x, 0, 0, 'large ratchet coaxial x');
  near(blocks.largeRatchet.position.y, 0, 0, 'large ratchet coaxial y');
  near(blocks.barrel.position.x, 0, 0, 'B coaxial x');
  near(blocks.barrel.position.y, 0, 0, 'B coaxial y');
  assert.ok(blocks.greatWheel.position.z < blocks.largeRatchet.position.z);
  assert.ok(blocks.largeRatchet.position.z < blocks.barrel.position.z);
  assert.equal(blocks.greatWheel.userData.teeth, geometry.greatWheelToothCount);
  assert.equal(blocks.largeRatchetMesh.userData.toothCount,
    geometry.largeRatchetToothCount);
  assert.equal(blocks.barrelRatchet.userData.toothCount,
    geometry.barrelRatchetToothCount);
  assert.notEqual(blocks.clickR, blocks.clickT);
  assert.notEqual(blocks.clickR.parent, blocks.clickT.parent);
  assert.ok(geometry.largeRatchetInnerRadius
    > geometry.barrelRatchetPitchRadius,
  'annular large ratchet clears the small barrel ratchet');
  disposeModel(model.root);
});

test('movement 321 transmits weight torque through R and a constant-preload spring while going', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousWeightY = Infinity;

  for (let sample = 0; sample <= 256; sample += 1) {
    const phase = geometry.windingStartPhase * sample / 256;
    const state = stateAtTime(geometry.demonstrationPeriod * phase);
    assert.equal(state.isWinding, false);
    assert.match(state.mode, /weight-drives-B-through-R/);
    assert.equal(state.clickRMode, 'engaged-transmitting-weight-torque');
    assert.equal(state.clickTMode,
      'ratcheting-forward-over-large-ratchet');
    near(state.barrelAngle, state.largeRatchetAngle, 3e-15,
      `B and larger ratchet locked by R at ${sample}`);
    near(state.largeRatchetAngle, state.greatWheelAngle, 3e-15,
      `spring preload constant at ${sample}`);
    near(state.barrelAngularVelocity,
      geometry.greatWheelAngularVelocity, 0,
    `B going speed at ${sample}`);
    near(state.largeRatchetAngularVelocity,
      geometry.greatWheelAngularVelocity, 0,
    `larger-ratchet going speed at ${sample}`);
    near(state.springDeflection, geometry.springPreload, 3e-15,
      `constant going preload at ${sample}`);
    near(state.rope.slipError, 0, 8e-16,
      `rope no-slip constraint at ${sample}`);
    near(state.contacts.R.clearance, 0, 5e-15,
      `R engaged on B at ${sample}`);
    assert.ok(state.weightPosition.y <= previousWeightY + 2e-14,
      `weight descends at ${sample}`);
    previousWeightY = state.weightPosition.y;
  }
  disposeModel(model.root);
});

test('movement 321 holds the larger ratchet with T while B winds and the spring alone drives G', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousEnergy = Infinity;
  let previousGreatAngle = -Infinity;
  let previousWeightY = -Infinity;
  let maximumRClearance = 0;

  for (let sample = 1; sample <= 255; sample += 1) {
    const phase = geometry.windingStartPhase
      + (geometry.windingEndPhase - geometry.windingStartPhase)
        * sample / 256;
    const state = stateAtTime(geometry.demonstrationPeriod * phase);
    assert.equal(state.isWinding, true);
    assert.match(state.mode, /R-ratcheting-T-holds-spring-drives-G/);
    assert.equal(state.powerSource,
      'stored-maintaining-spring-S-S-prime');
    assert.equal(state.clickRMode,
      'ratcheting-over-reversing-barrel-teeth');
    assert.equal(state.clickTMode,
      'engaged-holding-large-ratchet-against-fallback');
    // Backlash: the larger ratchet slips back onto T early in winding, then
    // T holds it there.
    const progress = sample / 256;
    const heldAngle = FULL_TURN * geometry.windingStartPhase
      - geometry.clickTBacklash;
    if (progress >= geometry.clickTRecoilWindow) {
      near(state.largeRatchetAngle, heldAngle, 3e-15,
        `T holds larger ratchet at ${sample}`);
      near(state.largeRatchetAngularVelocity, 0, 0,
        `held ratchet speed at ${sample}`);
    } else {
      assert.ok(state.largeRatchetAngle >= heldAngle - 3e-15
        && state.largeRatchetAngle <= FULL_TURN * geometry.windingStartPhase,
      `recoil stays within the backlash at ${sample}`);
      assert.ok(state.largeRatchetAngularVelocity <= 0,
        `the ratchet only slips back onto T at ${sample}`);
    }
    near(state.contacts.T.clearance, 0, 5e-15,
      `T remains seated at ${sample}`);
    near(state.rope.slipError, 0, 8e-16,
      `winding rope no-slip at ${sample}`);
    assert.ok(state.springEnergy <= previousEnergy + 3e-12,
      `spring supplies energy at ${sample}`);
    assert.ok(state.greatWheelAngle > previousGreatAngle,
      `G continues forward at ${sample}`);
    // Winding lifts the weight; once R has dropped behind its last tooth
    // the released barrel settles forward by R's backlash only.
    if (progress <= geometry.clickRSettleStart) {
      assert.ok(state.weightPosition.y >= previousWeightY - 3e-12,
        `winding lifts the weight at ${sample}`);
    } else {
      assert.ok(state.weightPosition.y <= previousWeightY + 3e-12,
        `released barrel settles onto R at ${sample}`);
    }
    assert.ok(state.springTorque > geometry.goingLoadTorque,
      `positive reserve torque at ${sample}`);
    maximumRClearance = Math.max(maximumRClearance,
      state.contacts.R.clearance);
    previousEnergy = state.springEnergy;
    previousGreatAngle = state.greatWheelAngle;
    previousWeightY = state.weightPosition.y;
  }
  assert.ok(maximumRClearance > 0.02,
    'carried click R visibly rides over the barrel teeth');
  disposeModel(model.root);
});

test('movement 321 clicks seat fully in the tooth roots after each backlash', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const [clickR, clickT] = blocks.finiteClicks;
  assert.equal(clickR.name, 'R');
  assert.equal(clickT.name, 'T');
  const period = geometry.demonstrationPeriod;
  const span = geometry.windingEndPhase - geometry.windingStartPhase;
  const at = (phase) => stateAtTime(period * phase);
  const liftR = (state) => clickR.angleAt(state.barrelAngle - state.largeRatchetAngle);
  const liftT = (state) => clickT.angleAt(state.largeRatchetAngle);
  // Going: R stays seated in its root, driving.
  for (let sample = 0; sample <= 32; sample += 1) {
    near(liftR(at(geometry.windingStartPhase * sample / 32)), 0, 1e-12,
      `R seated while going at ${sample}`);
  }
  // Winding begins with T just past a drop, up the flank by the backlash;
  // the recoil then seats it, and it stays seated.
  assert.ok(Math.abs(liftT(at(geometry.windingStartPhase))) > 5e-3,
    'T rests on the flank before the recoil');
  for (let sample = 0; sample <= 32; sample += 1) {
    const phase = geometry.windingStartPhase
      + span * (geometry.clickTRecoilWindow + (1 - geometry.clickTRecoilWindow) * sample / 32);
    near(liftT(at(phase)), 0, 1e-12, `T seated while holding at ${sample}`);
  }
  // B overruns R's last tooth, then the weight draws it back onto R.
  const overrun = at(geometry.windingStartPhase + span * geometry.clickRSettleStart);
  assert.ok(Math.abs(liftR(overrun)) > 2e-3, 'R has dropped past its tooth');
  near(liftR(at(geometry.windingEndPhase)), 0, 1e-12, 'R seated after the settle');
  // Seated noses sit in the roots, clear of the teeth by a hair.
  for (const click of [clickR, clickT]) {
    const { nose } = click.clickOutline;
    const profile = click.wheel.userData.ratchetProfile;
    near(Math.hypot(...nose), profile.rootRadius, 0.006, `${click.name} nose in the root`);
  }
  disposeModel(model.root);
});

test('movement 321 reengages R and restores spring preload without interrupting G', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousDeflection = -Infinity;
  let previousGreatAngle = -Infinity;

  for (let sample = 1; sample < 256; sample += 1) {
    const phase = geometry.windingEndPhase
      + (1 - geometry.windingEndPhase) * sample / 256;
    const state = stateAtTime(geometry.demonstrationPeriod * phase);
    assert.equal(state.isWinding, false);
    assert.match(state.mode, /R-reengaged-weight-recharges-spring/);
    assert.equal(state.clickRMode, 'engaged-transmitting-weight-torque');
    assert.equal(state.clickTMode,
      'ratcheting-forward-over-large-ratchet');
    near(state.largeRatchetAngle - state.barrelAngle,
      FULL_TURN, 4e-15,
    `R engages the equivalent B tooth at ${sample}`);
    near(state.largeRatchetAngularVelocity,
      state.barrelAngularVelocity, 2e-15,
    `B follows carried R at ${sample}`);
    near(state.contacts.R.clearance, 0, 5e-15,
      `R seated during recovery at ${sample}`);
    assert.ok(state.springDeflection >= previousDeflection - 2e-13,
      `spring preload recovers at ${sample}`);
    assert.ok(state.greatWheelAngle > previousGreatAngle,
      `G remains forward at ${sample}`);
    previousDeflection = state.springDeflection;
    previousGreatAngle = state.greatWheelAngle;
  }
  const closure = stateAtTime(geometry.demonstrationPeriod);
  near(closure.springDeflection, geometry.springPreload, 2e-15,
    'spring preload restored');
  disposeModel(model.root);
});

test('movement 321 flexes one constant-material-length spring between live G and ratchet anchors', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumLengthError = 0;
  let minimumSegmentLength = Infinity;
  let maximumSegmentLength = 0;

  for (let sample = 0; sample <= 512; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod * sample / 512);
    const spring = state.springGeometry;
    maximumLengthError = Math.max(maximumLengthError,
      Math.abs(spring.measuredLength - geometry.springMaterialLength));
    const expectedOuter = new THREE.Vector3(
      Math.cos(state.greatWheelAngle
        + Math.atan2(0.50, -2.55)) * geometry.springOuterAnchorRadius,
      Math.sin(state.greatWheelAngle
        + Math.atan2(0.50, -2.55)) * geometry.springOuterAnchorRadius,
      geometry.springPlaneZ,
    );
    const expectedInner = new THREE.Vector3(
      Math.cos(state.largeRatchetAngle
        + Math.atan2(1.65, -1.10)) * geometry.springInnerAnchorRadius,
      Math.sin(state.largeRatchetAngle
        + Math.atan2(1.65, -1.10)) * geometry.springInnerAnchorRadius,
      geometry.springPlaneZ,
    );
    vectorNear(spring.pointAtMaterialFraction(0), expectedOuter, 1e-14,
      `outer S-prime anchor at ${sample}`);
    vectorNear(spring.pointAtMaterialFraction(1), expectedInner, 1e-14,
      `inner S anchor at ${sample}`);
    near(state.springTorque,
      geometry.springStiffness * state.springDeflection,
      2e-15, `linear torsion law at ${sample}`);
    if (sample % 64 === 0) {
      for (let segment = 0; segment < geometry.springSegmentCount;
        segment += 1) {
        const length = spring.pointAtMaterialFraction(
          (segment + 1) / geometry.springSegmentCount,
        ).distanceTo(spring.pointAtMaterialFraction(
          segment / geometry.springSegmentCount,
        ));
        minimumSegmentLength = Math.min(minimumSegmentLength, length);
        maximumSegmentLength = Math.max(maximumSegmentLength, length);
      }
    }
  }
  assert.ok(maximumLengthError < 4e-13,
    `maintaining spring material-length error ${maximumLengthError}`);
  const nominalSegmentArcLength = geometry.springMaterialLength
    / geometry.springSegmentCount;
  assert.ok(maximumSegmentLength <= nominalSegmentArcLength * 1.003,
    'no spring chord exceeds its assigned material arc length');
  assert.ok(minimumSegmentLength >= nominalSegmentArcLength * 0.85,
    'spring sampling remains fine enough through the tightest bend');
  disposeModel(model.root);
});

test('movement 321 draws S-S-prime as Brown’s single hairpin wire that opens and closes without crossing or reaching the arbor', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumOpening = Infinity;
  let maximumOpening = -Infinity;
  let minimumSweep = Infinity;
  let maximumSweep = -Infinity;
  let minimumRadius = Infinity;
  let maximumOpeningStep = 0;
  let previousOpening = null;
  const segmentsCross = (a, b, c, d) => {
    const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y)
      - (q.y - p.y) * (r.x - p.x);
    return orient(a, b, c) * orient(a, b, d) < 0
      && orient(c, d, a) * orient(c, d, b) < 0;
  };
  let crossings = 0;
  for (let sample = 0; sample <= 512; sample += 1) {
    const spring = stateAtTime(geometry.demonstrationPeriod * sample / 512).springGeometry;
    minimumOpening = Math.min(minimumOpening, spring.opening);
    maximumOpening = Math.max(maximumOpening, spring.opening);
    minimumSweep = Math.min(minimumSweep, spring.sweep);
    maximumSweep = Math.max(maximumSweep, spring.sweep);
    minimumRadius = Math.min(minimumRadius, spring.minimumRadius);
    if (previousOpening !== null) {
      maximumOpeningStep = Math.max(maximumOpeningStep,
        Math.abs(spring.opening - previousOpening));
    }
    previousOpening = spring.opening;
    if (sample % 32 === 0) {
      const points = Array.from({ length: 97 }, (_, index) =>
        spring.pointAtMaterialFraction(index / 96));
      for (let i = 0; i < 96; i += 1) {
        for (let j = i + 2; j < 96; j += 1) {
          if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) crossings += 1;
        }
      }
    }
  }
  // Also sample the exact end of winding, where the lag peaks.
  {
    const spring = stateAtTime(geometry.demonstrationPeriod
      * geometry.windingEndPhase).springGeometry;
    maximumOpening = Math.max(maximumOpening, spring.opening);
    maximumSweep = Math.max(maximumSweep, spring.sweep);
    minimumSweep = Math.min(minimumSweep, spring.sweep);
  }
  // Brown's hairpin while going; it opens toward the chord while T holds
  // the larger ratchet and G runs 45 degrees ahead, then closes again.
  assert.ok(minimumOpening < 1e-9, `hairpin at the going preload ${minimumOpening}`);
  assert.ok(maximumOpening > 0.3 && maximumOpening < 0.6, `opening ${maximumOpening}`);
  // The lag includes the larger ratchet's backlash recoil onto T.
  near(maximumSweep - minimumSweep,
    geometry.largeRatchetLagMaximum + geometry.clickTBacklash, 1e-9,
    'the wire takes up the whole ratchet lag');
  // The recovery takes up the lag plus T's backlash in the same time, so the
  // step bound scales with that lag.
  const lagScale = (geometry.largeRatchetLagMaximum + geometry.clickTBacklash)
    / geometry.largeRatchetLagMaximum;
  assert.ok(maximumOpeningStep < 0.02 * lagScale,
    `the wire flexes smoothly ${maximumOpeningStep}`);
  assert.equal(crossings, 0, 'the wire never crosses itself');
  assert.ok(minimumRadius > 0.6, `the hairpin stays clear of the arbor ${minimumRadius}`);
  disposeModel(model.root);
});

test('movement 321 closes all asymmetric members and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[320]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.greatWheelAngle - start.greatWheelAngle,
    FULL_TURN, 0, 'G makes one full uninterrupted turn');
  near(closure.largeRatchetAngle - start.largeRatchetAngle,
    FULL_TURN, 0, 'larger ratchet closes one turn');
  near(closure.barrelAngle, start.barrelAngle, 0,
    'barrel B and weight close after winding');
  vectorNear(closure.weightPosition, start.weightPosition, 0,
    'weight position closure');
  for (let index = 0; index <= 8; index += 1) {
    vectorNear(closure.springGeometry.pointAtMaterialFraction(index / 8),
      start.springGeometry.pointAtMaterialFraction(index / 8), 2e-12,
    `spring point ${index} closure`);
  }
  assert.equal(animationTiming.authoredCyclePeriod, geometry.demonstrationPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.schedule.length, 6);

  for (const time of [0, 2, 4, 4.7, 5.3, 6, 6.7, 7.4, 8]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.greatWheel.userData.rotor.rotation.z,
      state.greatWheelAngle, 0, `rendered G at ${time}`);
    near(blocks.largeRatchet.userData.rotor.rotation.z,
      state.largeRatchetAngle, 0, `rendered larger ratchet at ${time}`);
    near(blocks.barrel.userData.rotor.rotation.z,
      state.barrelAngle, 0, `rendered B at ${time}`);
    vectorNear(blocks.weight.position, state.weightPosition, 0,
      `rendered weight at ${time}`);
    model.root.traverse((object) => {
      for (const value of object.position.toArray()) {
        assert.ok(Number.isFinite(value), `finite render position at ${time}`);
      }
      for (const value of object.quaternion.toArray()) {
        assert.ok(Number.isFinite(value), `finite render quaternion at ${time}`);
      }
    });
  }

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 321 lays spring S-S-prime on the larger ratchet on short studs, casting a shadow', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { blocks, geometry } = model.root.userData;
  model.root.updateMatrixWorld(true);
  const box = (object) => new THREE.Box3().setFromObject(object);
  const ratchet = box(blocks.largeRatchetMesh);
  const wire = box(blocks.springSegments[0]);
  const small = box(blocks.barrelRatchet);
  const face = box(blocks.barrelBody);
  assert.ok(small.min.z > ratchet.max.z + 0.015, 'B sits just in front of the larger ratchet');
  assert.ok(small.min.z < ratchet.max.z + 0.03);
  assert.ok(wire.min.z > Math.max(small.max.z, face.max.z) + 0.01, 'wire crosses over B');
  assert.ok(wire.max.z < ratchet.max.z + 0.35, 'wire lies close to the wheels');
  assert.ok(blocks.springSegments[0].castShadow);
  for (const part of [blocks.springInnerAnchor, blocks.springOuterAnchor,
    blocks.springOuterPost, blocks.springOuterArm]) {
    assert.ok(box(part).max.z < 0.56, `${part.userData.role} is short`);
  }
  assert.equal(blocks.springInnerPost, undefined);
  // The arbor ends inside a winding square just proud of B's face.
  assert.ok(box(blocks.barrelHub).max.z < box(blocks.barrelBody).max.z + 0.06);
});

test('movement 321 p94: the wire turns in a round U, never a tight bend, at every phase', () => {
  const model = createMovementModel(catalog.movements[320]);
  const { geometry, stateAtTime } = model.root.userData;
  let tightest = Infinity;
  for (let sample = 0; sample <= 64; sample += 1) {
    const spring = stateAtTime(geometry.demonstrationPeriod * sample / 64).springGeometry;
    const step = 1 / 400;
    for (let f = 2 * step; f <= 1 - 2 * step; f += step) {
      const a = spring.pointAtMaterialFraction(f - 2 * step);
      const b = spring.pointAtMaterialFraction(f);
      const c = spring.pointAtMaterialFraction(f + 2 * step);
      // Circumradius of three points along the wire.
      const ab = a.distanceTo(b); const bc = b.distanceTo(c); const ca = c.distanceTo(a);
      const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
      if (area > 1e-12) tightest = Math.min(tightest, ab * bc * ca / (4 * area));
    }
  }
  assert.ok(tightest > 0.15, `tightest wire bend radius ${tightest}`);
  disposeModel(model.root);
});
