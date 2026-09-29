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
  'lever-driven-flexible-diaphragm-force-pump-with-two-hinged-checks-suction-upstroke-and-delivery-downstroke';
const FULL_TURN = Math.PI * 2;

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

test('movement 454 is one clamped flexible diaphragm with one lever link and exactly two hinged checks', () => {
  const movement = catalog.movements[453];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 454);
  assert.equal(movement.number, '454');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.diaphragm.parent, model.root);
  assert.equal(blocks.chamberRim.parent, model.root);
  assert.equal(blocks.centerClamp.parent, model.root);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.suctionValve.parent, model.root);
  assert.equal(blocks.deliveryValve.parent, model.root);
  assert.equal(blocks.suctionPipe.shell.parent, model.root);
  assert.equal(blocks.deliveryRiser.shell.parent, model.root);
  vectorNear(
    blocks.suctionValve.position.clone().add(
      new THREE.Vector3(0.25, 0, 0),
    ),
    geometry.suctionValveSeat,
    0,
    'suction flap hinge offset from seat',
  );
  vectorNear(
    blocks.deliveryValve.position.clone().add(
      new THREE.Vector3(0.25, 0, 0),
    ),
    geometry.deliveryValveSeat,
    0,
    'delivery flap hinge offset from seat',
  );
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.diaphragmCenterIndependent, false);
  assert.equal(degreesOfFreedom.suctionCheckIndependent, false);
  assert.equal(degreesOfFreedom.deliveryCheckIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'single-flexible-diaphragm-clamped-at-rim-and-driven-at-center',
    'constant-length-link-from-lever-pin-to-diaphragm-center',
    'lower-hinged-suction-check-opening-only-on-diaphragm-rise',
    'right-hinged-delivery-check-opening-only-on-diaphragm-descent',
    'single-upright-delivery-pipe-above-right-check',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 454 source record captures the diaphragm substitution and preceding valve arrangement without inventing timing', () => {
  const movement = catalog.movements[453];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate454;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_454.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.precedingMovement,
    'https://507movements.com/mm_453.html');
  assert.match(movement.description, /Diaphragm forcing pump/);
  assert.match(movement.description, /flexible diaphragm.*instead of bellows/);
  assert.match(movement.description, /valves are arranged same as in preceding/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(
    dynamics.fullPressureWaveValveImpactLeakageDiaphragmElasticityCavitationAndAppliedLeverForceModeled,
    false,
  );
  assert.match(dynamics.diaphragmVolumeModel,
    /clamped membrane is flat under the centre clamp plate.*Integrating.*effective area pi\*a\^2\+2\*pi\*\(R-a\)/);
  assert.match(dynamics.flowModel,
    /Center rise.*lower suction check.*center descent.*right delivery check/);
  assert.match(dynamics.valveModel,
    /source-like hinged flaps.*C2 cubic stroke lobes/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateLeverPivotPixels, [144, 151]);
  assert.deepEqual(plate.approximateLeverRodPinPixels, [251, 141]);
  assert.deepEqual(plate.approximateDiaphragmCenterPixels, [252, 339]);
  assert.deepEqual(plate.approximateSuctionCheckPixels, [252, 377]);
  assert.deepEqual(plate.approximateDeliveryCheckPixels, [411, 272]);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence,
    /flexible diaphragm clamped.*depressed at its linked center.*suction stem.*delivery flap/);
  assert.match(evidence.reconstructionDisclosure,
    /no diaphragm diameter, elastic profile.*independently engineered/);
  disposeModel(model.root);
});

test('movement 454 source pose is the engraved depressed diaphragm endpoint with both checks seated', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const high = stateAtInputAngle(Math.PI);

  assert.equal(sourcePose.mode,
    'diaphragm-low-dead-center-both-checks-seated');
  assert.ok(sourcePose.leverAngle < 0);
  assert.ok(sourcePose.diaphragmCenterY < geometry.diaphragmRimY);
  assert.ok(high.diaphragmCenterY > geometry.diaphragmRimY);
  near(source.diaphragmCenterVelocity, 0, 0,
    'source diaphragm stopped');
  near(source.suctionValveOpen, 0, 0, 'source suction seated');
  near(source.deliveryValveOpen, 0, 0, 'source delivery seated');
  near(high.diaphragmCenterVelocity, 0, 0,
    'high diaphragm stopped');
  near(high.suctionValveOpen, 0, 0, 'high suction seated');
  near(high.deliveryValveOpen, 0, 0, 'high delivery seated');
  disposeModel(model.root);
});

test('movement 454 opens suction only on diaphragm rise and delivery only on descent', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { stateAtInputAngle } = model.root.userData;
  const rising = stateAtInputAngle(Math.PI / 2);
  const descending = stateAtInputAngle(3 * Math.PI / 2);

  assert.equal(rising.mode,
    'diaphragm-rising-suction-check-open-chamber-filling');
  assert.ok(rising.diaphragmCenterVelocity > 0);
  near(rising.suctionValveOpen, 1, 0, 'suction fully open');
  near(rising.deliveryValveOpen, 0, 0, 'delivery shut');
  assert.ok(rising.suctionFlowRate > 0);
  near(rising.deliveryFlowRate, 0, 0, 'no rising delivery');

  assert.equal(descending.mode,
    'diaphragm-descending-delivery-check-open-water-forced-up-riser');
  assert.ok(descending.diaphragmCenterVelocity < 0);
  near(descending.suctionValveOpen, 0, 0, 'suction shut');
  near(descending.deliveryValveOpen, 1, 0, 'delivery fully open');
  near(descending.suctionFlowRate, 0, 0, 'no descending suction');
  assert.ok(descending.deliveryFlowRate > 0);
  disposeModel(model.root);
});

test('movement 454 two checks are mutually exclusive and C2 at both diaphragm reversals', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { stateAtInputAngle } = model.root.userData;
  for (let sample = -20000; sample <= 40000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.suctionValveOpen * state.deliveryValveOpen, 0, 0,
      `checks interlocked at ${sample}`);
    assert.ok(state.suctionValveOpen >= 0 && state.suctionValveOpen <= 1);
    assert.ok(state.deliveryValveOpen >= 0
      && state.deliveryValveOpen <= 1);
  }
  const step = 1e-5;
  for (const boundary of [0, Math.PI]) {
    for (const key of ['suctionValveOpen', 'deliveryValveOpen']) {
      const before = stateAtInputAngle(boundary - step)[key];
      const center = stateAtInputAngle(boundary)[key];
      const after = stateAtInputAngle(boundary + step)[key];
      near((after - before) / (2 * step), 0, 6e-11,
        `${key} zero closure velocity at ${boundary}`);
      near((after - 2 * center + before) / step ** 2, 0, 1.1e-5,
        `${key} zero closure acceleration at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 454 lever-link closure keeps a fixed lever radius and exact constant rod length', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 20000);
    near(state.leverPin.distanceTo(geometry.leverPivot),
      geometry.leverPinRadius, 4e-16,
    `lever pin radius at ${sample}`);
    near(state.leverPin.distanceTo(state.connectingRodBottom),
      geometry.connectingRodLength, 4e-16,
    `connecting rod length at ${sample}`);
    near(state.connectingRodBottom.x, geometry.diaphragmCenterX, 0,
      `diaphragm center guide at ${sample}`);
    assert.ok(Math.abs(state.horizontalOffset)
      < geometry.connectingRodLength);
  }
  disposeModel(model.root);
});

test('movement 454 clamped diaphragm profile is flat under the clamp plate, clamped at the rim and integrates to the modeled effective area', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;
  const a = geometry.clampRadius, R = geometry.diaphragmRadius;
  near(geometry.diaphragmEffectiveArea,
    Math.PI * a ** 2 + 2 * Math.PI * (R - a) * (8 * a / 15 + (R - a) / 6), 1e-15,
  'integrated clamped-quartic effective area');
  // Numerical check of the closed form.
  let area = 0;
  const steps = 20000;
  for (let i = 0; i < steps; i += 1) {
    const r = (i + 0.5) * R / steps;
    area += 2 * Math.PI * r * model.root.userData.membraneProfile(r) * R / steps;
  }
  near(area, geometry.diaphragmEffectiveArea, 1e-6, 'numerical membrane area');
  const profile = (r) => (r <= a ? 1 : (1 - ((r - a) / (R - a)) ** 2) ** 2);

  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    update(geometry.cycleDuration * phase);
    const positions = blocks.diaphragm.geometry.getAttribute('position');
    const fractions = blocks.diaphragm.geometry.userData.radialFractions;
    near(positions.getY(0), state.diaphragmCenterY, 1.2e-7,
      `membrane center at ${phase}`);
    for (let index = 0; index < positions.count; index += 73) {
      const fraction = fractions[index];
      const expectedY = geometry.diaphragmRimY
        + (state.diaphragmCenterY - geometry.diaphragmRimY)
          * profile(fraction * R);
      near(positions.getY(index), expectedY, 1.2e-7,
        `membrane vertex ${index} at ${phase}`);
      if (Math.abs(fraction - 1) < 1e-12) {
        near(positions.getY(index), geometry.diaphragmRimY, 1e-7,
          `clamped rim vertex ${index} at ${phase}`);
      }
    }
    near(state.averageWaterTopY,
      geometry.diaphragmRimY
        + (state.diaphragmCenterY - geometry.diaphragmRimY)
          * geometry.diaphragmEffectiveArea / geometry.chamberArea,
    1e-15, `volume-equivalent water height at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 454 chamber volume obeys exact suction-minus-delivery balance and closes without drift', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = -16000; sample <= 32000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    near(state.chamberWaterVolumeRate,
      state.suctionFlowRate - state.deliveryFlowRate,
    0, `chamber balance at ${sample}`);
    near(state.chamberWaterVolumeRate,
      geometry.diaphragmEffectiveArea * state.diaphragmCenterVelocity,
    0, `profile flow at ${sample}`);
  }
  const source = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.chamberWaterVolume, source.chamberWaterVolume, 0,
    'water volume closure');
  near(closure.diaphragmCenterY, source.diaphragmCenterY, 0,
    'diaphragm closure');
  near(closure.diaphragmCenterVelocity,
    source.diaphragmCenterVelocity, 0, 'velocity closure');
  disposeModel(model.root);
});

test('movement 454 analytic center velocity and acceleration match finite differences', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.31, 1.17, 2.64, 4.22, 5.71]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const numericVelocity = (
      after.diaphragmCenterY - before.diaphragmCenterY
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.diaphragmCenterVelocity, numericVelocity, 8e-10,
      `center velocity at ${angle}`);
    const numericAcceleration = (
      after.diaphragmCenterVelocity - before.diaphragmCenterVelocity
    ) / (2 * step) * geometry.inputAngularSpeed;
    near(state.diaphragmCenterAcceleration, numericAcceleration, 2e-9,
      `center acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 454 renderer maps the lever, link, membrane, water, and flap angles while fixed plumbing remains fixed', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.chamberBottom,
    blocks.chamberRim, blocks.chamberShell, blocks.chamberRails,
    blocks.pivotAxle, blocks.pivotStandard,
    blocks.suctionValve, blocks.deliveryValve];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.125, 0.25, 0.375, 0.5,
    0.625, 0.75, 0.875, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.lever.rotation.z, state.leverAngle, 0,
      `lever angle at ${phase}`);
    near(blocks.centerClamp.position.y, state.diaphragmCenterY, 0,
      `center clamp at ${phase}`);
    near(blocks.connectingRod.scale.y,
      geometry.connectingRodLength, 4e-16,
    `rendered rod length at ${phase}`);
    near(blocks.suctionValve.rotation.z, state.suctionValveAngle, 0,
      `suction flap at ${phase}`);
    near(blocks.deliveryValve.rotation.z, state.deliveryValveAngle, 0,
      `delivery flap at ${phase}`);
    const top = blocks.chamberWaterTop.geometry.getAttribute('position');
    let highest = -Infinity;
    for (let i = 0; i < top.count; i += 1) highest = Math.max(highest, top.getY(i));
    near(highest, Math.max(state.diaphragmCenterY,
      geometry.diaphragmRimY) - 0.008, 2e-3, `water top follows membrane at ${phase}`);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed pump part at ${phase}`,
    ));
  }
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.1);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 454 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement454 = catalog.movements[453];
  const movement507 = catalog.movements[506];
  const model454 = createMovementModel(movement454);
  const model507 = createMovementModel(movement507);
  model454.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model454.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement454.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model454.root);
  disposeModel(model507.root);
});

test('movement 454 pass 110: the link lug stands wholly on the upper clamp plate', () => {
  const model = createMovementModel(catalog.movements[453]);
  const { blocks, geometry } = model.root.userData;
  let lug = null;
  blocks.centerClamp.traverse((o) => { if (o.userData.role === 'moving-plate-link-clevis') lug = o; });
  assert.ok(lug, 'lug present');
  const p = lug.geometry.getAttribute('position');
  // The lug's foot (its outline up to just over the plate's 0.103 top)
  // lies within the plate's plan; its eye starts above the plate.
  let worst = 0, lowest = Infinity;
  for (let i = 0; i < p.count; i += 1) {
    lowest = Math.min(lowest, p.getY(i));
    if (p.getY(i) < 0.11) worst = Math.max(worst, Math.hypot(p.getX(i), p.getZ(i)));
  }
  assert.ok(worst < geometry.clampRadius * Math.cos(Math.PI / 64), `lug foot reaches r ${worst}`);
  assert.ok(lowest >= 0.006 - 1e-9, `lug dips to ${lowest}`);
  disposeModel(model.root);
});

test('movement 454 pass 110: the water is one continuous body open only at the suction mouth and riser top', () => {
  const model = createMovementModel(catalog.movements[453]);
  const data = model.root.userData;
  for (const phase of [0, 0.2, 0.45, 0.7, 0.95]) {
    data.update(data.geometry.cycleDuration * phase);
    model.root.updateMatrixWorld(true);
    const count = new Map();
    const key = (v) => v.toArray().map((x) => Math.round(x * 2e3)).join(',');
    model.root.traverse((o) => {
      if (!o.isMesh || !/^water-/.test(o.userData.role)) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const p = g.attributes.position;
      for (let t = 0; t < p.count; t += 3) {
        const vs = [0, 1, 2].map((k) => key(new THREE.Vector3().fromBufferAttribute(p, t + k).applyMatrix4(o.matrixWorld)));
        if (new Set(vs).size < 3) continue;
        for (let k = 0; k < 3; k += 1) {
          const e = [vs[k], vs[(k + 1) % 3]].sort().join('|');
          count.set(e, (count.get(e) ?? 0) + 1);
        }
      }
    });
    for (const [edge, n] of count) {
      if (n !== 1) continue;
      for (const v of edge.split('|')) {
        const [x, y, z] = v.split(',').map((c) => Number(c) / 2e3);
        const mouth = y < -2.04 || y > 3.33;
        const port = x > 0.8 && Math.abs(Math.hypot(y - 0.34, z - 0.38) - 0.217) < 2e-3;
        assert.ok(mouth || port, `open water edge at ${[x, y, z]} (phase ${phase})`);
      }
    }
  }
  disposeModel(model.root);
});
