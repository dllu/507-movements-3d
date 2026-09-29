import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const build = () => createMovementModel(
  catalog.movements.find(({ id }) => id === 73),
);
const cross2 = (a, b) => a.x * b.y - a.y * b.x;
const zRange = (object) => {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  return [box.min.z, box.max.z];
};

test('movement 73 shows only D, A, springs B and C and C’s fixed block', () => {
  const model = build();
  const { blocks } = model.root.userData;
  // Every rendered solid belongs to one of Brown's lettered parts or C's
  // block; B's clamp is part of B and A's shaft part of A.
  const owners = new Map([
    [blocks.driver, 'D'],
    [blocks.catchSpring, 'B'],
    [blocks.catchClamp, 'B'],
    [blocks.ratchet, 'A'],
    [blocks.ratchetShaft, 'A'],
    [blocks.strongSpring, 'C'],
    [blocks.strongSpringClamp, 'C’s block'],
  ]);
  const counts = {};
  model.root.traverse((object) => {
    if (!object.isMesh) return;
    assert.notEqual(object.material.color.getHex(), 0xffffff);
    let owner = null;
    // B lies inside D's rotor, so the nearest listed ancestor decides.
    for (let node = object; node && !owner; node = node.parent) owner = owners.get(node) ?? null;
    assert.ok(owner, `unlisted solid ${object.userData.role ?? object.uuid}`);
    counts[owner] = (counts[owner] ?? 0) + 1;
  });
  assert.deepEqual(counts, { A: 3, B: 2, C: 2, 'C’s block': 1, D: 2 },
    'D (disc, sleeve), A (wheel, hub, shaft), B (leaf, clamp), C (leaf, round end), the plain block');
  // No rods at the spring tips: B ends in its own square nib, and C's only
  // extra solid is its half-round end of exactly C's width and depth.
  assert.equal(blocks.catchPad, undefined);
  assert.deepEqual(blocks.catchSpring.children, [blocks.catchSpring.userData.mesh]);
  assert.deepEqual(new Set(blocks.strongSpring.children),
    new Set([blocks.strongSpring.userData.mesh, blocks.stopPad]));
  for (const name of ['baseRail', 'centerPost', 'shaftBridge', 'springPost']) {
    assert.equal(blocks[name], undefined);
  }
  assert.equal(blocks.driverIndicator.isMesh, undefined);
  assert.equal(blocks.ratchetIndicator.isMesh, undefined);
  assert.ok(model.cameraDirection.z > Math.abs(model.cameraDirection.x) * 8);
});


test('movement 73 puts C, A and B’s nib in one plane, with B’s leaf under them', () => {
  const model = build();
  const { blocks, geometry } = model.root.userData;
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const [driverBack, driverFront] = zRange(blocks.driverBody);
  const [, sleeveFront] = zRange(blocks.driverSleeve);
  const [ratchetBack, ratchetFront] = zRange(blocks.ratchetBody);
  const [clampBack, clampFront] = zRange(blocks.catchClamp);
  const [catchBack, catchFront] = zRange(blocks.catchSpring);
  const [strongBack, strongFront] = zRange(blocks.strongSpring);
  const [blockBack] = zRange(blocks.strongSpringClamp);

  assert.ok(sleeveFront < ratchetBack - 0.005, 'D’s sleeve stops behind A and its hub');
  assert.ok(geometry.driverBoreRadius > blocks.ratchetShaft.userData.radius + 0.004, 'D turns loose on A’s shaft');
  assert.ok(clampBack >= driverFront - 1e-6 && catchBack >= driverFront - 1e-6, 'B and its clamp stand on D’s face');
  assert.ok(blockBack > driverFront, 'C’s block stands in front of D');
  assert.ok(driverBack < driverFront);

  // C is one flat leaf of constant section: every vertex of its band lies
  // on its back or front plane, and the band keeps one width.
  const position = blocks.strongSpring.userData.mesh.geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const z = position.getZ(index);
    assert.ok(Math.abs(z - geometry.strongZ[0]) < 1e-6 || Math.abs(z - geometry.strongZ[1]) < 1e-6, `C vertex at z ${z}`);
  }
  const rings = (position.count - 8) / 8;
  for (let ring = 0; ring < rings; ring += 1) {
    const outer = new THREE.Vector2(position.getX(ring * 8), position.getY(ring * 8));
    const inner = new THREE.Vector2(position.getX(ring * 8 + 5), position.getY(ring * 8 + 5));
    assert.ok(Math.abs(outer.distanceTo(inner) - 2 * geometry.strongHalfWidth) < 1e-5, `C’s width at ring ${ring}`);
  }
  assert.ok(Math.abs(strongBack - geometry.strongZ[0]) < 1e-6 && Math.abs(strongFront - geometry.strongZ[1]) < 1e-6);
  // C and the nib work within A's depth, and the nib spans all but a
  // sliver of C's depth, so C bears on it edge to edge.
  assert.ok(geometry.strongZ[0] >= ratchetBack && geometry.strongZ[1] <= ratchetFront, 'C works in A’s plane');
  assert.ok(geometry.catchNibZ[1] >= geometry.strongZ[1] - 0.011 && geometry.catchNibZ[1] < ratchetFront,
    'the nib reaches through C’s plane');
  // B's leaf and clamp pass under C and behind A ("B passes under the
  // strong spring C"); only the nib reaches forward.
  assert.ok(clampFront < strongBack && clampFront < ratchetBack, 'B’s clamp passes under C');
  assert.ok(geometry.catchLeafZ[1] < strongBack && geometry.catchLeafZ[1] < ratchetBack, 'B’s leaf passes under C and behind A');
  const catchPosition = blocks.catchSpring.userData.mesh.geometry.attributes.position;
  const tip = model.root.userData.stateAtTime(0).catchCurveLocal.getPoint(1);
  let forward = 0;
  for (let index = 0; index < catchPosition.count; index += 1) {
    if (catchPosition.getZ(index) <= geometry.catchLeafZ[1] + 1e-6) continue;
    forward += 1;
    assert.ok(Math.hypot(catchPosition.getX(index) - tip.x, catchPosition.getY(index) - tip.y)
      < geometry.nibLength + geometry.nibHalfWidth + 0.03, 'only B’s nib reaches forward of the leaf plane');
  }
  assert.ok(forward > 0 && Math.abs(catchFront - geometry.catchNibZ[1]) < 1e-6);
});

// Plan clearances between C (a round-ended band), the nib and A at one time.
const clearances = (model, time) => {
  const { geometry, simulation, stateAtTime } = model.root.userData;
  const leaf = simulation.model;
  const state = stateAtTime(time);
  const h = geometry.strongHalfWidth;
  leaf.deform(state.leafModes);
  const { px, py } = leaf.positions();
  const theta = state.drivenAngle;
  const c = Math.cos(theta), s = Math.sin(theta);
  const wheel = leaf.ratchetProfile.map(([x, y]) => [c * x - s * y, s * x + c * y]);
  let leafWheel = Infinity, leafNib = Infinity, nibWheel = Infinity;
  for (let i = 1; i <= leaf.N; i += 1) {
    const hit = leaf.wheelDistance(px[i], py[i], theta);
    if (hit) leafWheel = Math.min(leafWheel, hit.distance - h);
  }
  for (const [x, y] of wheel) leafWheel = Math.min(leafWheel, leaf.leafClosest(x, y, 1).distance - h);
  leaf.placeNib(state.driverAngle, state.nibRadius - geometry.relaxedNibRadius);
  for (const [x, y] of leaf.nibWorld) {
    const hit = leaf.wheelDistance(x, y, theta);
    if (hit) nibWheel = Math.min(nibWheel, hit.distance);
    leafNib = Math.min(leafNib, leaf.leafClosest(x, y, 1).distance - h);
  }
  for (const [x, y] of wheel) {
    const hit = leaf.nibDistance(x, y);
    if (hit) nibWheel = Math.min(nibWheel, hit.distance);
  }
  for (let i = 1; i <= leaf.N; i += 1) {
    const hit = leaf.nibDistance(px[i], py[i]);
    if (hit) leafNib = Math.min(leafNib, hit.distance - h);
  }
  return { leafNib, leafWheel, nibWheel, state };
};

test('movement 73: C presses the nib into A, bends out of its way and seats A, all in one plane', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  const period = geometry.driverCyclePeriod;
  // The nib's pass occupies travel [0, windowAngle) after psiStart.
  const passStart = (geometry.psiStart - THREE.MathUtils.degToRad(10) - geometry.fullTurn) / geometry.driverAngularSpeed + period;
  const passLength = geometry.windowAngle / geometry.driverAngularSpeed;
  let worst = { leafNib: Infinity, leafWheel: Infinity, nibWheel: Infinity };
  let pressed = 0, indexing = 0, settling = 0, highest = 0, deepest = Infinity, overshoot = 0;
  const seat = stateAtTime(passStart - 0.01);
  for (let sample = 0; sample <= 2400; sample += 1) {
    const { leafNib, leafWheel, nibWheel, state } = clearances(model, passStart + passLength * sample / 2400);
    worst = {
      leafNib: Math.min(worst.leafNib, leafNib),
      leafWheel: Math.min(worst.leafWheel, leafWheel),
      nibWheel: Math.min(worst.nibWheel, nibWheel),
    };
    if (state.strongSpringPressEngaged) pressed += 1;
    if (state.indexing) indexing += 1;
    if (state.stage === 'ratchet-settle') settling += 1;
    highest = Math.max(highest, state.stopContact.center.length() - seat.stopContact.center.length());
    deepest = Math.min(deepest, state.nibRadius);
    overshoot = Math.max(overshoot, seat.drivenAngle - geometry.toothPitch - state.drivenAngle);
  }
  // Nothing interpenetrates (tolerance: interpolation of the 4 ms replay).
  for (const [pair, value] of Object.entries(worst)) assert.ok(value > -3e-4, `${pair} overlaps by ${-value}`);
  assert.ok(pressed > 100 && indexing > 100 && settling > 10, `${pressed} ${indexing} ${settling}`);
  // C presses the nib below A's crests (the relaxed nib clears them) ...
  assert.ok(geometry.relaxedNibRadius - geometry.nibHalfWidth > geometry.ratchetOuterRadius + 0.02);
  assert.ok(deepest + geometry.nibHalfWidth < geometry.ratchetOuterRadius + 0.03
    && deepest - geometry.nibHalfWidth < geometry.ratchetOuterRadius - 0.08, `the nib reaches ${deepest}`);
  // ... and its end is lifted clear out of A's teeth to let the nib pass.
  assert.ok(highest > 0.15, `C’s end lifts ${highest}`);
  // A overshoots a little while B lets go, then C's preload seats it.
  assert.ok(overshoot > 0.02 && overshoot < 0.2, `A overshoots ${overshoot}`);
  const after = stateAtTime(passStart + passLength + 0.01);
  assert.ok(Math.abs(after.drivenAngle - seat.drivenAngle + geometry.toothPitch) < 1e-9, 'one tooth per turn of D');
  assert.ok(after.stopContact.center.distanceTo(seat.stopContact.center.clone()
    .rotateAround(new THREE.Vector2(), 0)) < 1e-6, 'C’s end returns to the same seat');
  assert.ok(Math.abs(after.nibRadius - geometry.relaxedNibRadius) < 1e-6, 'B springs back out');
  // At rest C's end sits in the corner of a tooth space, touching A.
  const rest = clearances(model, 0);
  assert.ok(Math.abs(rest.leafWheel) < 2e-4, `C rests on A (${rest.leafWheel})`);
});

test('movement 73 moves continuously, with no jump or teleport anywhere in the turn', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  const period = geometry.driverCyclePeriod;
  const samples = 20000;
  let previous = stateAtTime(0);
  let pad = 0, nib = 0, wheel = 0, leaf = 0;
  for (let sample = 1; sample <= samples; sample += 1) {
    const state = stateAtTime(period * sample / samples);
    pad = Math.max(pad, state.stopContact.center.distanceTo(previous.stopContact.center));
    nib = Math.max(nib, Math.abs(state.nibRadius - previous.nibRadius));
    wheel = Math.max(wheel, Math.abs(state.drivenAngle - previous.drivenAngle));
    leaf = Math.max(leaf, state.strongCurve.getPoint(0.5).distanceTo(previous.strongCurve.getPoint(0.5)));
    previous = state;
  }
  // Per 1/20000 turn (0.44 ms): C's end falls back at under 2.5 units/s,
  // A turns at about D's rate at most.
  const step = period / samples;
  assert.ok(pad / step < 2.5, `C’s end moves at ${pad / step}`);
  assert.ok(nib / step < 3, `the nib moves at ${nib / step}`);
  assert.ok(wheel / step < 1.3 * geometry.driverAngularSpeed, `A turns at ${wheel / step}`);
  assert.ok(leaf / step < 1, `C’s middle moves at ${leaf / step}`);
  // The turn closes on itself one tooth on.
  const start = stateAtTime(0), turn = stateAtTime(period);
  assert.ok(Math.abs(turn.drivenAngle - start.drivenAngle + geometry.toothPitch) < 1e-9);
  assert.ok(turn.stopContact.center.distanceTo(start.stopContact.center) < 1e-9);
  assert.ok(Math.abs(turn.nibRadius - start.nibRadius) < 1e-9);
});

test('movement 73 bends C as one elastic leaf, most at its clamp, and B as a smooth guided leaf', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  const turns = (points) => {
    const result = [];
    for (let index = 1; index < points.length - 1; index += 1) {
      const before = points[index].clone().sub(points[index - 1]);
      const after = points[index + 1].clone().sub(points[index]);
      result.push(Math.atan2(before.x * after.y - before.y * after.x, before.x * after.x + before.y * after.y));
    }
    return result;
  };
  const relaxed = turns(geometry.relaxedStrongPoints);
  const length = (points) => points.reduce((sum, point, index) => index ? sum + point.distanceTo(points[index - 1]) : sum, 0);
  const period = geometry.driverCyclePeriod;
  let lifted = null, liftedBy = 0, roughness = 0, stretch = 0, clampSlip = 0, catchTurn = 0;
  const clampDirection = (points) => points[1].clone().sub(points[0]).normalize();
  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(period * (0.55 + 0.2 * sample / 1200));
    const points = state.strongCurve.points;
    const change = turns(points).map((value, index) => value - relaxed[index]);
    for (let index = 1; index < change.length - 1; index += 1) {
      roughness = Math.max(roughness, Math.abs(change[index + 1] - 2 * change[index] + change[index - 1]));
    }
    stretch = Math.max(stretch, Math.abs(length(points) - length(geometry.relaxedStrongPoints)));
    clampSlip = Math.max(clampSlip, clampDirection(points).angleTo(clampDirection(geometry.relaxedStrongPoints)));
    const lift = points.at(-1).distanceTo(geometry.relaxedStrongPoints.at(-1));
    if (lift > liftedBy) { liftedBy = lift; lifted = change; }
    catchTurn = Math.max(catchTurn, ...turns(state.catchCurveLocal.getPoints(96)).map(Math.abs));
  }
  assert.ok(liftedBy > 0.15, `C bends out of the way (${liftedBy})`);
  // Bent furthest, C's curvature change is largest at its clamp and falls
  // steadily to nothing at its free end, as a leaf loaded near its end.
  const magnitude = lifted.map(Math.abs);
  assert.ok(magnitude[0] >= Math.max(...magnitude) - 1e-9, 'curvature changes most at the clamp');
  for (let index = 8; index < magnitude.length; index += 8) {
    assert.ok(magnitude[index] <= magnitude[index - 8] + 1e-7, `curvature change rises again at ${index}`);
  }
  assert.ok(magnitude.at(-1) < 0.05 * magnitude[0], 'no moment at the free end');
  assert.ok(roughness < 1e-5, `no kink: largest second difference ${roughness}`);
  assert.ok(stretch < 1e-5, `C keeps its length (${stretch})`);
  // (The first segment turns by the rotation at its midpoint.)
  assert.ok(clampSlip < 1e-3, `C leaves its block along its clamped direction (${clampSlip})`);
  assert.ok(catchTurn < 0.06, `B turns smoothly (${catchTurn})`);
});

test('movement 73 draws C as one circular arc fitted to Brown’s leaf, bending one way', async () => {
  const { geometry } = build().root.userData;
  const points = geometry.relaxedStrongPoints.map((point) => new THREE.Vector2(point.x, point.y));
  for (const point of points) {
    assert.ok(Math.abs(point.distanceTo(geometry.strongArcCenter) - geometry.strongArcRadius) < 1e-9);
  }
  assert.ok(geometry.strongArcFit < 0.03, `fits the plate within ${geometry.strongArcFit}`);
  for (let index = 1; index + 1 < points.length; index += 1) {
    const before = points[index].clone().sub(points[index - 1]);
    const after = points[index + 1].clone().sub(points[index]);
    assert.ok(Math.atan2(cross2(before, after), before.dot(after)) < 0, 'turns clockwise throughout');
  }
  assert.ok(points[0].distanceTo(new THREE.Vector2(geometry.strongSpringAnchor.x, geometry.strongSpringAnchor.y)) < 1e-9);
  assert.ok(points.at(-1).distanceTo(geometry.seat) < 1e-9, 'it ends in C’s seat');
  assert.ok(Math.abs(Math.atan2(geometry.seat.y, geometry.seat.x) - geometry.seatWorldAngle) < 1e-9);
});

test('movement 73 replays a bake that matches the live simulation', async () => {
  const { simulateSpringIndex073, springIndex073Fingerprint } = await import('../src/simulation/spring-index-073-leaf.js');
  const { default: baked } = await import('../src/simulation/baked/spring-index-073-leaf.js');
  const { simulation, simulationConfig } = build().root.userData;
  assert.equal(simulation.baked, true, 'production replays the bake');
  assert.equal(baked.fingerprint, springIndex073Fingerprint(simulationConfig));
  const live = simulateSpringIndex073(simulationConfig);
  assert.equal(live.samples, baked.samples);
  let error = 0;
  for (let index = 0; index < live.states.length; index += 1) error = Math.max(error, Math.abs(live.states[index] - baked.states[index]));
  assert.ok(error < 1e-6, `bake differs from live by ${error}`);
  assert.ok(Math.max(...live.residual.map(Math.abs)) < 1e-5, 'the pass ends settled');
});
