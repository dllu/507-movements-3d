import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

test('movement 390 is one rocking sector, exactly two distinct bands, two loose pawl pulleys, and two fast ratchets', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 390);
  assert.equal(movement.number, '390');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'rocking-semicircular-sector-open-and-crossed-anchored-bands-dual-loose-pulley-ratchet-flywheel-rectifier',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-fulcrumed-semicircular-piece-A/);
  assert.match(data.mechanism, /C-open-and-D-crossed/);
  assert.match(data.mechanism, /two-coaxial-loose-pulley-pawl-carriers/);
  assert.match(data.mechanism, /two-ratchets-fast/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /semicircular piece A/);
  assert.match(degreesOfFreedom.note, /equal and opposite/);

  for (const component of [
    blocks.crossedBand,
    blocks.crossedCarrier,
    blocks.flywheelRotor,
    blocks.openBand,
    blocks.openCarrier,
    blocks.pivotPin,
    blocks.rockingSector,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  // Brown draws no frame, upright or foot: the fulcrum pin and the flywheel
  // shaft end as plain stubs.
  assert.ok(blocks.frame.parent === null, 'no undrawn frame is presented');
  assert.ok(blocks.crossedRatchet.parent === blocks.flywheelRotor, 'blocks.crossedRatchet parent');
  assert.ok(blocks.openRatchet.parent === blocks.flywheelRotor, 'blocks.openRatchet parent');
  assert.ok(blocks.flywheelRim.parent === blocks.flywheelRotor, 'blocks.flywheelRim parent');
  // Brown draws no white indices or band markers; the presentation detaches them.
  assert.ok(blocks.flywheelIndex.parent === null, 'flywheel index removed');
  assert.ok(blocks.crossedPawl.parent === blocks.crossedCarrier, 'blocks.crossedPawl parent');
  assert.ok(blocks.openPawl.parent === blocks.openCarrier, 'blocks.openPawl parent');
  assert.ok(blocks.sectorArc.parent === blocks.rockingSector, 'blocks.sectorArc parent');
  assert.ok(blocks.topLever.parent === blocks.rockingSector, 'blocks.topLever parent');
  assert.equal(blocks.bandAnchorsLocal.length, 4, 'two fastened ends per band');
  assert.equal(blocks.openBandMarkers.length, 6);
  assert.equal(blocks.crossedBandMarkers.length, 6);
  for (const marker of [...blocks.openBandMarkers, ...blocks.crossedBandMarkers]) {
    assert.ok(marker.parent === null, 'band marker removed');
  }

  const belts = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, [blocks.openBand, blocks.crossedBand]);
  assert.equal(blocks.openBand.userData.closed, false);
  assert.equal(blocks.crossedBand.userData.closed, false);
  assert.notEqual(
    data.geometry.openPlaneZ,
    data.geometry.crossedPlaneZ,
  );
  for (const role of [
    'fulcrumed-semicircular-piece-A-and-lever',
    'one-open-uncrossed-band-C',
    'one-crossed-band-D-with-axial-crossover',
    'open-band-C-loose-pulley-carrier',
    'crossed-band-D-loose-pulley-carrier',
    'open-band-ratchet-wheel-fast-on-flywheel-shaft',
    'crossed-band-ratchet-wheel-fast-on-flywheel-shaft',
    'continuous-one-direction-flywheel-B-shaft',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => /^white-/.test(role)), 'no white indices remain');
  disposeModel(model.root);
});

test('movement 390 preserves Brown topology while explicitly recording unavailable source animation', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate390;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_390.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /oscillating into rotary motion/);
  assert.match(movement.description, /Band, C, is open/);
  assert.match(movement.description, /band, D, crossed/i);
  assert.match(movement.description, /pulleys, loose on the shaft/);
  assert.match(movement.description, /continuous rotary motion/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /no canvas animation/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.fulcrumAPixels, [253, 94]);
  assert.deepEqual(plate.flywheelCenterPixels, [260, 329]);
  assert.equal(plate.flywheelOuterRadiusPixels, 132);
  assert.deepEqual(plate.openBandLabelPixels, [346, 294]);
  assert.deepEqual(plate.crossedBandLabelPixels, [231, 258]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /two superposed band paths/);
  assert.match(evidence.reconstructionDisclosure, /no official animation/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 390 keeps both compensated anchored bands exactly constant length with smooth pulley tangencies', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline,
    transmission } = data;

  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 4e-16, name);
  }
  assert.match(transmission.bandLengthLaw, /base\+alpha/);
  assert.match(transmission.bandLengthLaw, /sum is constant/);
  for (let sample = -3600; sample <= 7200; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 3600);
    near(state.openCurve.getLength(), geometry.openBandLength, 2e-15,
      'open band constant length');
    near(state.crossedCurve.getLength(), geometry.crossedBandLength,
      2e-15, 'crossed band constant length');
    near(
      state.openCurve.userData.firstWrapAngle
        + state.openCurve.userData.secondWrapAngle,
      2 * geometry.openUpperBaseWrap,
      1e-15,
      'open compensated upper wraps',
    );
    near(
      state.crossedCurve.userData.firstWrapAngle
        + state.crossedCurve.userData.secondWrapAngle,
      2 * geometry.crossedUpperBaseWrap,
      1e-15,
      'crossed compensated upper wraps',
    );
    // Both ends of both bands always keep a real wrap on A's rim.
    for (const curve of [state.openCurve, state.crossedCurve]) {
      assert.ok(curve.userData.firstWrapAngle > 0.13);
      assert.ok(curve.userData.secondWrapAngle > 0.13);
    }
    for (const dot of [
      ...state.openCurve.userData.joinTangentDots,
      ...state.crossedCurve.userData.joinTangentDots,
    ]) near(dot, 1, 3e-15, 'band segment tangent continuity');
  }
  disposeModel(model.root);
});

test('movement 390 bands are taut: straight spans, wraps on the groove radii, crossed spans pass at D in parallel planes', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const sector = new THREE.Vector3(geometry.sectorCenter.x, geometry.sectorCenter.y, 0);
  const radial = (point, center) => Math.hypot(point.x - center.x, point.y - center.y);

  for (let sample = 0; sample <= 64; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 64);
    for (const [curve, shift, plane] of [
      [state.openCurve, 0, geometry.openPlaneZ],
      [state.crossedCurve, geometry.crossShift, geometry.crossedPlaneZ],
    ]) {
      const [upperRight, spanRight, lower, spanLeft, upperLeft] = curve.curves;
      // Taut: both free spans are straight lines, in one plane each.
      for (const span of [spanRight, spanLeft]) {
        assert.ok(span.isLineCurve3, 'free span is a straight line');
        near(span.v1.z, span.v2.z, 0, 'span lies in one plane');
      }
      near(spanRight.v1.z, plane - shift, 1e-15, 'right-hand span plane');
      near(spanLeft.v1.z, plane + shift, 1e-15, 'left-hand span plane');
      for (let t = 0; t <= 1; t += 1 / 16) {
        near(radial(upperRight.getPoint(t), sector), geometry.sectorRadius, 1e-14, 'right wrap on A groove radius');
        near(radial(upperLeft.getPoint(t), sector), geometry.sectorRadius, 1e-14, 'left wrap on A groove radius');
        near(radial(lower.getPoint(t), geometry.lowerCenter), geometry.loosePulleyRadius, 1e-14, 'lower wrap on pulley groove radius');
      }
    }
    // The crossed spans cross at D, above the pulley, in planes 2 * shift apart.
    const a = state.crossedCurve.curves[1], b = state.crossedCurve.curves[3];
    const d1 = a.v2.clone().sub(a.v1), d2 = b.v2.clone().sub(b.v1);
    const denominator = d1.x * d2.y - d1.y * d2.x;
    const t = ((b.v1.x - a.v1.x) * d2.y - (b.v1.y - a.v1.y) * d2.x) / denominator;
    const crossing = a.getPoint(t);
    assert.ok(t > 0 && t < 1 && crossing.y > geometry.loosePulleyRadius, 'crossing D above the pulley');
    assert.ok(2 * geometry.crossShift - geometry.bandWidth >= 0.02 - 1e-12, 'crossed spans clear at D');
  }
  disposeModel(model.root);
});

test('movement 390 band ends are fastened where A meets its bar, and every band lies in its grooves', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const section = blocks.sectorArc.userData.section;
  const floor = section[3][0], outer = section[2][0];
  const grooves = [[section[2][1], section[4][1]], [section[6][1], section[8][1]]];
  const halfWidth = geometry.bandWidth / 2, halfThickness = geometry.bandThickness / 2;
  for (let sample = 0; sample <= 32; sample += 1) {
    const time = timeline.cycleDuration * sample / 32;
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    for (const [index, curve] of [state.openCurve, state.crossedCurve].entries()) {
      for (const [end, parameter] of [[0, 0], [1, 1]]) {
        const anchor = blocks.bandAnchorsLocal.find((a) => a.bandName.startsWith(index ? 'crossed' : 'open') && a.anchorNumber === end);
        const world = blocks.rockingSector.localToWorld(anchor.local.clone());
        vectorNear(curve.getPoint(parameter), world, 2e-15, 'band end turns with A');
        // The end stands just up inside the bar's underside (y -0.08 in A's frame).
        const lift = Math.abs(anchor.local.y);
        assert.ok(lift < 0.08 && lift > 0.065, `end ${lift} under the bar`);
      }
      // Band section inside its groove on A: floor below, walls either side.
      for (const wrap of [curve.curves[0], curve.curves[4]]) {
        const z = wrap.getPoint(0.5).z;
        const [low, high] = grooves[index];
        assert.ok(z - halfWidth > low + 0.009 && z + halfWidth < high - 0.009, 'band between groove walls');
        assert.ok(geometry.sectorRadius - halfThickness > floor + 0.004, 'band clear of groove floor');
        assert.ok(geometry.sectorRadius + halfThickness < outer, 'band sunk below the rim');
      }
      for (const t of [0, 0.5, 1]) {
        const z = curve.curves[2].getPoint(t).z - (index ? geometry.crossedPlaneZ : geometry.openPlaneZ);
        const pulley = blocks.openCarrier.userData.pulley.userData;
        assert.ok(Math.abs(z) + halfWidth <= pulley.grooveHalfWidth - 0.01 + 1e-12, 'band inside the pulley groove');
      }
    }
  }
  disposeModel(model.root);
});

test('movement 390 open and crossed loose pulleys obey exact equal-magnitude opposite direction ratios', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;

  assert.match(transmission.beltDirectionLaw, /theta_C/);
  assert.match(transmission.beltDirectionLaw, /theta_D/);
  for (let sample = -7200; sample <= 14400; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 7200);
    near(state.openPulleyAngle,
      geometry.pulleyRatio * state.rockerAngle, 0,
      'open pulley angle ratio');
    near(state.crossedPulleyAngle,
      -geometry.pulleyRatio * state.rockerAngle, 0,
      'crossed pulley angle ratio');
    near(state.openPulleyAngle + state.crossedPulleyAngle, 0, 0,
      'opposed loose-pulley angles');
    near(state.openPulleyAngularSpeed,
      geometry.pulleyRatio * state.rockerAngularSpeed, 0,
      'open pulley speed ratio');
    near(state.crossedPulleyAngularSpeed,
      -geometry.pulleyRatio * state.rockerAngularSpeed, 0,
      'crossed pulley speed ratio');
    near(state.openBandMaterialTravel,
      geometry.sectorRadius * state.rockerAngle, 0,
      'open material payout');
    near(state.crossedBandMaterialTravel,
      -geometry.sectorRadius * state.rockerAngle, 0,
      'crossed material payout');
  }
  disposeModel(model.root);
});

test('movement 390 takes up finite pawl overtravel and rectifies one oscillation into a positive half turn', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.outputLaw, /abs/);
  assert.match(transmission.pawlLaw, /positive angular speed/);
  near(geometry.outputAdvancePerCycle, Math.PI, 0,
    'half-turn output closure (two quarter-turn strokes)');

  let previousAngle = -Infinity;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 20000);
    assert.ok(state.flywheelAngle >= previousAngle - 2e-15);
    assert.ok(state.flywheelAngularSpeed >= 0);
    near(state.flywheelAngularSpeed,
      state.openPawl.active || state.crossedPawl.active
        ? geometry.pulleyRatio * Math.abs(state.rockerAngularSpeed) : 0, 2e-15,
      'engaged speed or finite take-up dwell');
    if (state.openPawl.active) {
      near(state.openPawl.contactError, 0, 2e-15,
        'open driving pawl tooth closure');
    }
    if (state.crossedPawl.active) {
      near(state.crossedPawl.contactError, 0, 2e-15,
        'crossed driving pawl tooth closure');
    }
    previousAngle = state.flywheelAngle;
  }

  for (const [event, active] of [
    [timeline.events.crossedPawlTakesDrive, 'crossedPawl'],
    [timeline.events.openPawlRetakesDrive, 'openPawl'],
  ]) {
    const before = stateAtTime(event - 1e-7);
    const after = stateAtTime(event + 1e-7);
    assert.equal(before.flywheelAngularSpeed, 0, 'output waits for physical take-up');
    assert.equal(after[active].active, true);
    near(after[active].contactError, 0, 2e-15, 'new pawl locks at its tooth phase');
    near(before.flywheelAngle, after.flywheelAngle, 1e-6, 'pickup position is continuous');
  }
  assert.ok(timeline.events.crossedPawlTakesDrive > timeline.events.crossedCarrierReverses);
  assert.ok(timeline.events.openPawlRetakesDrive > timeline.events.openCarrierReverses);
  disposeModel(model.root);
});

test('movement 390 renderer binds both belt curves and markers, both carriers, both pawls, and flywheel exactly', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;
  const times = [
    0,
    timeline.cycleDuration * 0.11,
    timeline.cycleDuration * 0.25,
    timeline.cycleDuration * 0.42,
    timeline.cycleDuration * 0.68,
    timeline.cycleDuration * 0.75,
    timeline.cycleDuration * 0.91,
    timeline.cycleDuration,
  ];

  for (const time of times) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.rockingSector.rotation.z, state.rockerAngle, 0,
      'rendered sector angle');
    near(blocks.openCarrier.rotation.z, state.openPulleyAngle, 0,
      'rendered open carrier angle');
    near(blocks.crossedCarrier.rotation.z, state.crossedPulleyAngle, 0,
      'rendered crossed carrier angle');
    near(blocks.flywheelRotor.rotation.z, state.flywheelAngle, 0,
      'rendered flywheel angle');
    assert.equal(blocks.openPawlContactIndex.visible,
      state.openPawl.active);
    assert.equal(blocks.crossedPawlContactIndex.visible,
      state.crossedPawl.active);
    assert.equal(data.contacts.openPawlToFastRatchet.active,
      state.openPawl.active);
    assert.equal(data.contacts.crossedPawlToFastRatchet.active,
      state.crossedPawl.active);
    near(blocks.openBand.userData.length,
      state.openCurve.getLength(), 0,
      'rendered open curve length');
    near(blocks.crossedBand.userData.length,
      state.crossedCurve.getLength(), 0,
      'rendered crossed curve length');

    for (const [curve, band] of [[state.openCurve, 'open'], [state.crossedCurve, 'crossed']]) {
      for (const [end, parameter] of [[0, 0], [1, 1]]) {
        const anchor = blocks.bandAnchorsLocal.find((a) => a.bandName.startsWith(band) && a.anchorNumber === end);
        vectorNear(curve.getPointAt(parameter), blocks.rockingSector.localToWorld(anchor.local.clone()), 2e-15,
          `${band} band fixed end ${end}`);
      }
    }

    for (let index = 0; index < blocks.openBandMarkers.length;
      index += 1) {
      const basePhase = (index + 1)
        / (blocks.openBandMarkers.length + 1);
      const phase = THREE.MathUtils.clamp(
        state.openBandMaterialTravel / state.openCurve.getLength()
          + basePhase,
        0,
        1,
      );
      vectorNear(blocks.openBandMarkers[index].position,
        state.openCurve.getPointAt(phase), 4e-15,
        `open band material marker ${index}`);
    }
  }
  disposeModel(model.root);
});

test('movement 390 closes one full oscillation and positive output turn before movement 507 remains authored', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);

  near(end.rockerAngle, start.rockerAngle, 0,
    'cycle rocker angle');
  near(end.openPulleyAngle, start.openPulleyAngle, 0,
    'cycle open carrier angle');
  near(end.crossedPulleyAngle, start.crossedPulleyAngle, 0,
    'cycle crossed carrier angle');
  near(end.flywheelAngle, start.flywheelAngle, 0,
    'represented flywheel orientation');
  near(end.openCurve.getLength(), start.openCurve.getLength(), 0,
    'cycle open band geometry');
  near(end.crossedCurve.getLength(), start.crossedCurve.getLength(), 0,
    'cycle crossed band geometry');

  model.update(0);
  const startFlywheel = data.blocks.flywheelRotor.rotation.z;
  model.update(timeline.cycleDuration);
  near(data.blocks.flywheelRotor.rotation.z, startFlywheel, 0,
    'rendered flywheel cycle closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, movement.archetype);
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 390 bands pass through no part: only the fastened ends stand up into the lever bar', async () => {
  const { solidSurface } = await import('./helpers/solid-surface.mjs');
  const model = createMovementModel(catalog.movements[389]);
  const { blocks, timeline } = model.root.userData;
  const targets = [];
  const add = (mesh, minimum) => targets.push({ mesh, minimum, field: solidSurface(mesh.geometry), gap: Infinity });
  add(blocks.sectorArc, 0.003);
  add(blocks.topLever, -0.009);
  add(blocks.pivotPin, 0.003);
  add(blocks.flywheelRim, 0.003);
  for (const spoke of blocks.flywheelSpokes) add(spoke, 0.003);
  add(blocks.shaft, 0.003);
  add(blocks.openRatchet, 0.003);
  add(blocks.crossedRatchet, 0.003);
  for (const carrier of [blocks.openCarrier, blocks.crossedCarrier]) {
    add(carrier.userData.pulley, 0.003);
    add(carrier.userData.hub, 0.003);
    for (const body of carrier.userData.pawlBodies) add(body, 0.003);
    for (const pin of carrier.userData.pawlPins) add(pin, 0.003);
  }
  for (let sample = 0; sample < 24; sample += 1) {
    model.update(timeline.cycleDuration * sample / 24);
    model.root.updateMatrixWorld(true);
    for (const band of [blocks.openBand, blocks.crossedBand]) {
      const mesh = band.userData.mesh, position = mesh.geometry.attributes.position;
      const points = [];
      for (let i = 0; i < position.count; i += 1) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
      for (const target of targets) {
        const inverse = target.mesh.matrixWorld.clone().invert();
        for (const point of points) {
          const local = point.clone().applyMatrix4(inverse);
          if (target.field.box.distanceToPoint(local) > target.gap) continue;
          target.gap = Math.min(target.gap, target.field.signedDistance(local));
        }
      }
    }
  }
  for (const target of targets) {
    assert.ok(target.gap > target.minimum, `${target.mesh.userData.role}: band gap ${target.gap}`);
  }
  disposeModel(model.root);
});
