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

test('movement 320 is Brown’s one-chain maintaining-power train', () => {
  const movement = catalog.movements[319];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 320);
  assert.equal(movement.number, '320');
  assert.match(movement.title, /^Endless chain, maintaining power/);
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'single-endless-chain-going-barrel-maintaining-power');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one endless chain/);
  assert.match(mechanism, /p around small weight w/);
  assert.match(mechanism, /roughened going pulley P/);
  assert.match(mechanism, /click locks p/);
  assert.match(mechanism, /raises W while P continues driving/);
  assert.equal(transmission.chainCount, 1);
  assert.deepEqual(transmission.chainOrder,
    ['p', 'b', 'w', 'a', 'P', 'd', 'W', 'c', 'p']);
  assert.match(transmission.noSlipLaw, /material-coordinate travel/);

  assert.ok(blocks.fixedFrame.parent === null, 'source presentation removes the undrawn clock frame');
  for (const [child, parent, name] of [
    [blocks.chain, model.root, 'chain'],
    [blocks.ratchetPulley, model.root, 'ratchet pulley'],
    [blocks.goingPulley, model.root, 'going pulley'],
    [blocks.smallCarrier, model.root, 'small carrier'],
    [blocks.largeCarrier, model.root, 'large carrier'],
    [blocks.smallPulley, blocks.smallCarrier, 'small pulley'],
    [blocks.largePulley, blocks.largeCarrier, 'large pulley'],
    [blocks.smallWeight, blocks.smallCarrier, 'small weight'],
    [blocks.largeWeight, blocks.largeCarrier, 'large weight'],
  ]) assert.ok(child.parent === parent, `${name} parent`);
  // The cord is the shared laid rope; its lay, not markers, shows travel.
  assert.equal(blocks.chainMarkers.length, 0);
  assert.equal(blocks.chain.userData.crossSection, 'laid-rope');

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'single-endless-maintaining-power-chain').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'single-endless-chain-body').length, 1);
  // Source presentation drops the undrawn white chain markers and indices.
  assert.equal(roles.filter((role) =>
    role === 'chain-link-index-marker').length, 0);
  assert.equal(roles.filter((role) =>
    /-symmetric-rotation-index$/.test(role)).length, 0);
  assert.equal(roles.filter((role) =>
    role === 'ratchet-wheel-riding-on-arbor-p').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'fixed-click-engaging-ratchet-pulley-p').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 320 records the source landmarks and unavailable official animation', () => {
  const movement = catalog.movements[319];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    sourceAnimation,
    sourcePointToReferenceFront,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.brownPlate320;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /one continuous chain/);
  assert.match(sourceAnimation.referenceScope, /b–a–d–c/);
  assert.match(sourceAnimation.referenceScope, /small tension weight w/);
  assert.match(sourceAnimation.referenceScope, /large main weight W/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_320.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.rasterRatchetPulleyP,
    new THREE.Vector2(193, 102));
  assert.deepEqual(plate.rasterGoingPulleyP,
    new THREE.Vector2(363, 103));
  assert.deepEqual(plate.rasterSmallPulley,
    new THREE.Vector2(203, 286));
  assert.deepEqual(plate.rasterLargePulley,
    new THREE.Vector2(340, 362));
  assert.deepEqual(plate.rasterSmallWeightCenter,
    new THREE.Vector2(203, 376));
  assert.deepEqual(plate.rasterLargeWeightCenter,
    new THREE.Vector2(340, 468));
  assert.match(plate.inferredTopology, /p–b–w–a–P–d–W–c–p/);
  assert.match(plate.inferredTopology, /cross without joining/);

  const state = model.root.userData.rawStateAtTime(0);
  const tolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  planarNear(sourcePointToReferenceFront(plate.rasterRatchetPulleyP),
    state.path.centers.A, tolerance, 'source ratchet pulley p');
  planarNear(sourcePointToReferenceFront(plate.rasterGoingPulleyP),
    state.path.centers.B, tolerance, 'source going pulley P');
  planarNear(sourcePointToReferenceFront(plate.rasterSmallPulley),
    state.path.centers.S, tolerance, 'source small pulley w');
  planarNear(sourcePointToReferenceFront(plate.rasterLargePulley),
    state.path.centers.L, tolerance, 'source large pulley W');
  model.root.updateMatrixWorld(true);
  planarNear(sourcePointToReferenceFront(plate.rasterSmallWeightCenter),
    blocks.smallWeight.getWorldPosition(new THREE.Vector3()),
    tolerance, 'source small weight w');
  planarNear(sourcePointToReferenceFront(plate.rasterLargeWeightCenter),
    blocks.largeWeight.getWorldPosition(new THREE.Vector3()),
    tolerance, 'source large weight W');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 320 has four exact tangent spans and smooth pulley arcs in one loop', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { geometry, referencePath } = model.root.userData;
  const { contacts, curve, edges, segmentRecords } = referencePath;

  assert.equal(edges.length, 4);
  assert.deepEqual(edges.map(({ label }) => label), ['b', 'a', 'd', 'c']);
  assert.deepEqual(edges.map(({ from, to }) => `${from}-${to}`),
    ['A-S', 'S-B', 'B-L', 'L-A']);
  assert.deepEqual(edges.map(({ sigma }) => sigma), [1, -1, 1, -1]);
  assert.equal(segmentRecords.length, 8);
  assert.deepEqual(segmentRecords.map(({ kind }) => kind), [
    'free-span', 'pulley-contact-arc',
    'free-span', 'pulley-contact-arc',
    'free-span', 'pulley-contact-arc',
    'free-span', 'pulley-contact-arc',
  ]);
  near(curve.getLength(), geometry.targetChainLength, 1e-12,
    'reference chain length');
  vectorNear(curve.getPoint(0), curve.getPoint(1), 1e-12,
    'closed chain endpoints');

  for (const edge of edges) {
    const startRadial = edge.start.clone()
      .sub(referencePath.centers[edge.from]);
    const endRadial = edge.end.clone()
      .sub(referencePath.centers[edge.to]);
    near(startRadial.length(), geometry.radii[edge.from], 2e-14,
      `${edge.label} start pitch radius`);
    near(endRadial.length(), geometry.radii[edge.to], 2e-14,
      `${edge.label} end pitch radius`);
    near(startRadial.dot(edge.direction), 0, 2e-14,
      `${edge.label} start tangency`);
    near(endRadial.dot(edge.direction), 0, 2e-14,
      `${edge.label} end tangency`);
    assert.ok(edge.curve.getTangent(0).dot(edge.direction) > 0.999999999,
      `${edge.label} begins with its exact planar tangent`);
    assert.ok(edge.curve.getTangent(1).dot(edge.direction) > 0.999999999,
      `${edge.label} ends with its exact planar tangent`);
  }
  for (const key of ['A', 'B', 'S', 'L']) {
    const contact = contacts[key];
    const radialEntry = contact.entryPoint.clone()
      .sub(referencePath.centers[key]).normalize();
    const radialExit = contact.exitPoint.clone()
      .sub(referencePath.centers[key]).normalize();
    near(radialEntry.dot(contact.entryTangent), 0, 2e-14,
      `${key} entry tangent`);
    near(radialExit.dot(contact.exitTangent), 0, 2e-14,
      `${key} exit tangent`);
    assert.ok(Math.abs(contact.sweep) > Math.PI * 0.70,
      `${key} has substantial chain wrap`);
  }

  for (let boundary = 1; boundary < curve.cumulativeLengths.length;
    boundary += 1) {
    const fraction = curve.cumulativeLengths[boundary] / curve.totalLength;
    const before = curve.getTangentAt(
      THREE.MathUtils.euclideanModulo(fraction - 1e-8, 1),
    );
    const after = curve.getTangentAt(
      THREE.MathUtils.euclideanModulo(fraction + 1e-8, 1),
    );
    assert.ok(before.dot(after) > 0.999999,
      `chain tangent is continuous at segment boundary ${boundary}`);
    const center = curve.getPointAt(
      THREE.MathUtils.euclideanModulo(fraction, 1),
    );
    const backDistance = center.distanceTo(curve.getPointAt(
      THREE.MathUtils.euclideanModulo(fraction - 1e-5, 1),
    ));
    const forwardDistance = center.distanceTo(curve.getPointAt(
      THREE.MathUtils.euclideanModulo(fraction + 1e-5, 1),
    ));
    near(forwardDistance / backDistance, 1, 5e-4,
      `constant marker speed through boundary ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 320 preserves one closed chain length while both weighted pulleys move', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { geometry, rawStateAtTime } = model.root.userData;
  let minimumClearance = Infinity;
  let maximumLengthError = 0;
  let maximumSmallY = -Infinity;
  let minimumLargeY = Infinity;

  for (let sample = 0; sample <= 512; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 512;
    const state = rawStateAtTime(time);
    maximumLengthError = Math.max(
      maximumLengthError,
      Math.abs(state.path.totalLength - geometry.targetChainLength),
    );
    minimumClearance = Math.min(
      minimumClearance,
      state.path.crossover.axialClearance,
    );
    maximumSmallY = Math.max(maximumSmallY, state.smallPulleyY);
    minimumLargeY = Math.min(minimumLargeY, state.largePulleyY);
    assert.ok(state.path.crossover.firstParameter > 0
      && state.path.crossover.firstParameter < 1);
    assert.ok(state.path.crossover.secondParameter > 0
      && state.path.crossover.secondParameter < 1);
  }
  assert.ok(maximumLengthError < 1e-12,
    `closed-chain length error ${maximumLengthError}`);
  assert.ok(minimumClearance > 0.055,
    `a/c crossover body clearance ${minimumClearance}`);
  near(maximumSmallY, geometry.halfSmallY, 1e-13,
    'small tension pulley rises to preserve length');
  near(minimumLargeY, geometry.halfLargeY, 1e-13,
    'large weight reaches its lower turning point');
  disposeModel(model.root);
});

test('movement 320 derives every pulley angle from the same no-slip chain coordinate', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { geometry, rawStateAtTime } = model.root.userData;
  let maximumSlipError = 0;

  for (let sample = 0; sample <= 512; sample += 1) {
    const state = rawStateAtTime(
      geometry.demonstrationPeriod * sample / 512,
    );
    for (const key of ['A', 'B', 'S', 'L']) {
      maximumSlipError = Math.max(
        maximumSlipError,
        Math.abs(state.pulleys[key].entrySlipError),
        Math.abs(state.pulleys[key].exitSlipError),
      );
    }
  }
  assert.ok(maximumSlipError < 7e-15,
    `all eight tangent contacts share one material coordinate: ${maximumSlipError}`);
  disposeModel(model.root);
});

test('movement 320 locks p during going and lets it advance only while winding', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { geometry, rawStateAtTime } = model.root.userData;
  let previousGoingAngle = Infinity;
  let previousRatchetAngle = -Infinity;
  let previousLargeY = Infinity;

  for (let sample = 0; sample <= 512; sample += 1) {
    const state = rawStateAtTime(
      geometry.demonstrationPeriod * sample / 512,
    );
    assert.ok(state.pulleys.B.angle <= previousGoingAngle + 2e-13,
      `going wheel never reverses at sample ${sample}`);
    assert.ok(state.pulleys.A.angle >= previousRatchetAngle - 2e-13,
      `ratchet pulley never runs backward at sample ${sample}`);
    if (sample <= 256 || sample === 512) {
      near(state.pulleys.A.angle, state.ratchetLockedAngle, 3e-14,
        `click holds p at sample ${sample}`);
      assert.equal(state.isWinding, false);
      if (sample !== 512) {
        assert.ok(state.largePulleyY <= previousLargeY + 2e-13,
          `main weight descends during going at sample ${sample}`);
      }
    } else {
      assert.equal(state.isWinding, true);
      assert.ok(state.freewheelAngle >= -2e-13,
        `p advances under click at sample ${sample}`);
      assert.ok(state.largePulleyY >= previousLargeY - 2e-13,
        `main weight rises during winding at sample ${sample}`);
    }
    previousGoingAngle = state.pulleys.B.angle;
    previousRatchetAngle = state.pulleys.A.angle;
    previousLargeY = state.largePulleyY;
  }
  const midpoint = rawStateAtTime(geometry.demonstrationPeriod / 2);
  const closure = rawStateAtTime(geometry.demonstrationPeriod);
  assert.match(midpoint.mode, /ratchet-locked/);
  assert.match(rawStateAtTime(geometry.demonstrationPeriod * 0.75).mode,
    /part-b-down-ratchet-freewheeling/);
  assert.ok(closure.pulleys.B.angle < midpoint.pulleys.B.angle);
  near(closure.chainTravel, geometry.cycleAdvance, 2e-14,
    'one-cycle chain advance');
  disposeModel(model.root);
});

test('movement 320 closes continuously through pulley symmetries and one chain pitch', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { blocks, geometry, rawStateAtTime } = model.root.userData;
  const start = rawStateAtTime(0);
  const closure = rawStateAtTime(geometry.demonstrationPeriod);

  near(closure.largePulleyY, start.largePulleyY, 0,
    'large pulley closure');
  near(closure.smallPulleyY, start.smallPulleyY, 0,
    'small pulley closure');
  near(closure.path.totalLength, start.path.totalLength, 0,
    'chain path closure');
  for (const [key, symmetryOrder] of [
    ['A', 5], ['B', 5], ['S', 5], ['L', 6],
  ]) {
    near(
      (closure.pulleys[key].angle - start.pulleys[key].angle)
        * symmetryOrder / FULL_TURN,
      Math.round((closure.pulleys[key].angle - start.pulleys[key].angle)
        * symmetryOrder / FULL_TURN),
      3e-15,
      `${key} closes through visible rotational symmetry`,
    );
  }

  model.update(0);
  model.root.updateMatrixWorld(true);
  const chainGeometry = blocks.chainMesh.geometry;
  model.update(geometry.demonstrationPeriod);
  model.root.updateMatrixWorld(true);
  assert.equal(blocks.chainMesh.geometry, chainGeometry,
    'dynamic chain reuses its buffer geometry');
  near(chainGeometry.userData.travel, closure.chainTravel, 0,
    'the laid rope lay moves with the chain travel');
  assert.equal(blocks.windingHandle.visible, false);
  disposeModel(model.root);
});

test('movement 320 exposes finite smooth rates at all phase boundaries', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { geometry, stateAtTime } = model.root.userData;
  for (const time of [
    0,
    geometry.demonstrationPeriod * 0.25,
    geometry.demonstrationPeriod * 0.50,
    geometry.demonstrationPeriod * 0.75,
    geometry.demonstrationPeriod,
  ]) {
    const state = stateAtTime(time);
    for (const value of [
      state.chainSpeed,
      state.chainAcceleration,
      state.largePulleyVelocity,
      state.largePulleyAcceleration,
      state.smallPulleyVelocity,
      state.smallPulleyAcceleration,
      ...Object.values(state.pulleys).flatMap((pulley) => [
        pulley.angularVelocity,
        pulley.angularAcceleration,
      ]),
    ]) assert.ok(Number.isFinite(value));
  }
  const start = stateAtTime(0);
  const midpoint = stateAtTime(geometry.demonstrationPeriod / 2);
  near(start.largePulleyVelocity, 0, 2e-7,
    'large weight starts smoothly');
  near(start.smallPulleyVelocity, 0, 2e-7,
    'small weight starts smoothly');
  near(midpoint.largePulleyVelocity, 0, 2e-7,
    'large weight reverses smoothly');
  near(midpoint.pulleys.A.angularVelocity, 0, 2e-6,
    'ratchet begins freewheeling smoothly');
  disposeModel(model.root);
});

test('movement 320 click is seated in a root against a tooth face whenever it holds p', () => {
  const model = createMovementModel(catalog.movements[319]);
  const { blocks, geometry } = model.root.userData;
  const click = blocks.finiteClicks[0];
  const pitch = geometry.ratchetToothPitch;
  // One flat plate: the old pin-and-cone click is gone.
  assert.equal(click.group.children.filter((o) => o.isMesh && o.visible).length, 1);
  assert.equal(click.body.geometry.userData.plate.polygons.length, 1);
  const noseWorld = () => {
    model.root.updateMatrixWorld(true);
    return new THREE.Vector3(geometry.clickLength, 0, 0).applyMatrix4(click.group.matrixWorld);
  };
  const center = blocks.ratchetPulley.position;
  let previous = -Infinity;
  for (let sample = 0; sample <= 400; sample += 1) {
    const phase = sample / 400;
    model.update(geometry.demonstrationPeriod * phase);
    const state = model.root.userData.renderState;
    const wheel = state.renderedRatchetAngle;
    if (phase >= 0.05 && phase <= 0.5) {
      // Going: p is held with a tooth face on the click and the nose in its root.
      near(((wheel / pitch) % 1 + 1) % 1 < 0.5 ? (wheel / pitch) % 1 : 0, 0, 1e-9, `locked on a seat at ${phase}`);
      near(click.group.rotation.z, geometry.clickSeatRotation, 2e-6, `click seated at ${phase}`);
      const nose = noseWorld();
      near(Math.hypot(nose.x - center.x, nose.y - center.y), geometry.ratchetRootRadius, 1e-9, `nose in the root at ${phase}`);
    }
    if (phase > 0.5 && phase < 1) assert.ok(wheel >= previous - 1e-12, `p only advances while winding (${phase})`);
    previous = wheel;
  }
  // The winding carries p just past the seat, so the click drops fully into
  // the root before the load turns p back onto it.
  model.update(geometry.demonstrationPeriod * 0.9999);
  const end = model.root.userData.renderState;
  near(end.renderedRatchetAngle - end.pulleys.A.angle, geometry.ratchetOvershoot, 1e-4, 'overshoot before the settle');
  const nose = noseWorld();
  assert.ok(Math.hypot(nose.x - center.x, nose.y - center.y) < geometry.ratchetRootRadius + 0.02, 'click has dropped into the root');
  disposeModel(model.root);
});
