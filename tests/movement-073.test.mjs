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

// Plan outline (world XY) of the rendered flat band of a leaf spring, keeping
// only the rings whose [back, front] depth span passes `keep`. Neighbouring
// rings are kept too, because the quads between a kept and a dropped ring
// still carry part of the solid into the kept depth range.
const bandOutline = (spring, keep) => {
  const { mesh } = spring.userData;
  const position = mesh.geometry.attributes.position;
  const rings = (position.count - 8) / 8;
  const vertex = (index) => new THREE.Vector3()
    .fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
  // Ring corner 0 is (+w, front), 1 is (+w, back), 5 is (-w, front).
  const kept = (ring) => ring >= 0 && ring < rings
    && keep(vertex(ring * 8 + 1).z, vertex(ring * 8).z);
  const outer = [];
  const inner = [];
  for (let ring = 0; ring < rings; ring += 1) {
    if (!(kept(ring) || kept(ring - 1) || kept(ring + 1))) continue;
    const a = vertex(ring * 8);
    const b = vertex(ring * 8 + 5);
    outer.push(new THREE.Vector2(a.x, a.y));
    inner.push(new THREE.Vector2(b.x, b.y));
  }
  return [...outer, ...inner.reverse()];
};
const inside = (point, polygon) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
};
const edgeDistance = (point, polygon) => {
  let distance = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const edge = polygon[(index + 1) % polygon.length].clone().sub(a);
    const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
    distance = Math.min(distance, a.clone().addScaledVector(edge, t).distanceTo(point));
  }
  return distance;
};
// Negative when either outline has a vertex inside the other.
const signedGap = (first, second) => {
  let gap = Infinity;
  for (const [points, polygon] of [[first, second], [second, first]]) {
    for (const point of points) {
      const distance = edgeDistance(point, polygon);
      gap = Math.min(gap, inside(point, polygon) ? -distance : distance);
    }
  }
  return gap;
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

test('movement 73 layers D, A and both springs without axial overlap', () => {
  const model = build();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const [driverBack, driverFront] = zRange(blocks.driverBody);
  const [, sleeveFront] = zRange(blocks.driverSleeve);
  const [ratchetBack] = zRange(blocks.ratchetBody);
  const [clampBack, clampFront] = zRange(blocks.catchClamp);
  const [catchBack, catchFront] = zRange(blocks.catchSpring);
  const [strongBack] = zRange(blocks.strongSpring);
  const [padBack] = zRange(blocks.stopPad);
  const [blockBack] = zRange(blocks.strongSpringClamp);

  assert.ok(sleeveFront < ratchetBack - 0.005, 'D’s sleeve stops behind A and its hub');
  assert.ok(geometry.driverBoreRadius > blocks.ratchetShaft.userData.radius + 0.05,
    'D turns loose on A’s shaft');
  assert.ok(clampBack >= driverFront - 1e-6, 'B’s clamp stands on D’s face');
  assert.ok(catchBack >= driverFront - 1e-6, 'B lies on D’s face, not in it');
  assert.ok(blockBack > driverFront, 'C’s block stands in front of D');
  assert.ok(driverBack < driverFront);

  // B's clamp and all of B's leaf except the nib lie behind C and behind A,
  // so they pass under C; only the nib reaches forward.
  assert.ok(clampFront < strongBack, 'B’s clamp passes under C');
  assert.ok(geometry.catchLeafZ[1] < strongBack && geometry.catchLeafZ[1] < ratchetBack,
    'B’s leaf passes under C and behind A');
  const { mesh } = blocks.catchSpring.userData;
  const position = mesh.geometry.attributes.position;
  const tip = stateAtTime(0).catchCurveLocal.getPoint(1);
  const nibReach = geometry.nibLength + geometry.nibHalfWidth + 0.02;
  let forward = 0;
  for (let index = 0; index < position.count; index += 1) {
    if (position.getZ(index) <= geometry.catchLeafZ[1] + 1e-6) continue;
    forward += 1;
    assert.ok(Math.hypot(position.getX(index) - tip.x, position.getY(index) - tip.y) < nibReach,
      'only B’s nib reaches forward of the leaf plane');
  }
  assert.ok(forward > 0, 'B’s nib reaches forward into A and C’s web');
  assert.ok(catchFront > ratchetBack && catchFront > strongBack, 'the nib reaches A’s teeth and C’s web');

  // C's thin end and round tip work in A's front half, wholly in front of
  // B's nib, so they share a tooth space without meeting.
  assert.ok(catchFront < geometry.strongTipZ[0] && catchFront < padBack,
    'B’s nib and C’s end are axially clear');
  assert.ok(padBack < ratchetBack + geometry.ratchetDepth, 'C’s end reaches into A');
});

test('movement 73 keeps B’s nib off C while C presses it through a tooth', () => {
  const model = build();
  const { blocks, geometry } = model.root.userData;
  // The parts of B and C that share a depth: B's forward-reaching nib and
  // C's deep web.
  const gapAt = (time) => {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    return signedGap(
      bandOutline(blocks.catchSpring, (back, front) => front > geometry.strongWebZ[0] + 1e-9),
      bandOutline(blocks.strongSpring, (back) => back < geometry.catchNibZ[1] - 1e-9),
    );
  };
  const period = geometry.driverCyclePeriod;
  let minimum = Infinity;
  const indexGaps = [];
  let firstIndex = null;
  let lastIndex = null;
  for (let sample = 0; sample <= 240; sample += 1) {
    const time = period * sample / 240;
    const state = model.root.userData.stateAtTime(time);
    if (state.indexing) {
      firstIndex ??= time;
      lastIndex = time;
    }
    minimum = Math.min(minimum, gapAt(time));
  }
  // Densely through the one-tooth index itself.
  for (let sample = 0; sample <= 240; sample += 1) {
    const time = THREE.MathUtils.lerp(firstIndex, lastIndex, sample / 240);
    const state = model.root.userData.stateAtTime(time);
    const gap = gapAt(time);
    minimum = Math.min(minimum, gap);
    if (state.stage === 'catch-spring-index') indexGaps.push(gap);
  }
  assert.ok(minimum > 0, `B’s nib never enters C’s web (closest ${minimum})`);
  indexGaps.sort((a, b) => a - b);
  const median = indexGaps[Math.floor(indexGaps.length / 2)];
  assert.ok(Math.abs(median - geometry.pressGap) < 0.001,
    `C bears on the back of B’s nib while it carries the tooth (median gap ${median})`);

  // C's press is what makes B catch: the relaxed nib clears A's crests, and
  // the pressed nib spans the crest radius while it carries the tooth.
  assert.ok(geometry.relaxedNibRadius - geometry.nibHalfWidth > geometry.ratchetOuterRadius);
  for (let sample = 0; sample <= 60; sample += 1) {
    const state = model.root.userData.stateAtTime(THREE.MathUtils.lerp(firstIndex, lastIndex, sample / 60));
    if (state.stage !== 'catch-spring-index') continue;
    assert.ok(state.nibRadius - geometry.nibHalfWidth < geometry.ratchetOuterRadius
      && state.nibRadius + geometry.nibHalfWidth > geometry.ratchetOuterRadius, 'the nib spans the crest');
  }
});

test('movement 73 bends B and C as smooth cantilevers from their clamps', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  // Signed turn between successive chords of `samples` equal parameter steps.
  const turns = (curve, samples) => {
    const points = curve.getPoints(samples);
    const result = [];
    for (let index = 1; index < samples; index += 1) {
      const before = points[index].clone().sub(points[index - 1]);
      const after = points[index + 1].clone().sub(points[index]);
      result.push(Math.atan2(before.x * after.y - before.y * after.x, before.x * after.x + before.y * after.y));
    }
    return result;
  };
  const largest = (values) => Math.max(...values.map(Math.abs));
  const relaxed = stateAtTime(0);
  const clampDirection = (curve) => curve.getPoint(0.01).sub(curve.getPoint(0)).normalize();
  // C's deep web ends at webEndFraction; beyond it C is formed into a tight
  // hook that turns into its seat in A. That hook is a deliberate bend, so
  // it is judged by its radius and by the evenness of its turning rather
  // than by the leaf-wide limit. C is a polyline of evenly spaced vertices;
  // at that native spacing a smooth bend turns each vertex by close to the
  // mean of its neighbours' turns, whereas a kink either way is one vertex
  // departing from that mean by the kink's whole angle.
  const webVertices = Math.floor(geometry.webEndFraction * 96) - 1;
  let leaf = 0;
  let tightest = Infinity;
  let kink = 0;
  let clampSlip = 0;
  for (let sample = 0; sample <= 400; sample += 1) {
    const state = stateAtTime(geometry.driverCyclePeriod * sample / 400);
    leaf = Math.max(leaf, largest(turns(state.catchCurveLocal, 96)),
      largest(turns(state.strongCurve, 96).slice(0, webVertices)));
    const hook96 = turns(state.strongCurve, 96).slice(webVertices);
    const native = state.strongCurve.relaxedPoints.length - 1;
    const hookNative = turns(state.strongCurve, native)
      .slice(Math.floor(geometry.webEndFraction * native) - 2);
    const step = state.strongCurve.getLength() / 96;
    tightest = Math.min(tightest, step / largest(hook96));
    for (let index = 1; index < hookNative.length - 1; index += 1) {
      kink = Math.max(kink,
        Math.abs(hookNative[index] - (hookNative[index - 1] + hookNative[index + 1]) / 2));
    }
    clampSlip = Math.max(
      clampSlip,
      clampDirection(state.catchCurveLocal).angleTo(clampDirection(relaxed.catchCurveLocal)),
      clampDirection(state.strongCurve).angleTo(clampDirection(relaxed.strongCurve)),
    );
  }
  assert.ok(leaf < 0.06, `no kink: largest turn per 1/96 of B and of C’s web is ${leaf}`);
  // C's end is one arc that lifts radially over a crest, so its tightest
  // bend (about 2.8 half-widths at full lift) is short of the old J-hook's.
  assert.ok(tightest > 2.5 * geometry.strongHalfWidth,
    `C’s end bends with radius ${tightest}, well over its half-width, so the band never folds`);
  // A 0.02 rad (1.1°) corner anywhere in C's end would exceed the largest
  // departure where the long arc runs into the tip arc.
  assert.ok(kink < 0.02, `C’s hook is a smooth bend, not a corner (departure ${kink})`);
  assert.ok(clampSlip < 0.01, `each leaf leaves its clamp along its clamped direction (${clampSlip})`);
});

test('movement 73 draws C as one smooth leaf of two tangent arcs bending one way', () => {
  const { geometry } = build().root.userData;
  const points = geometry.relaxedStrongPoints.map((point) => new THREE.Vector2(point.x, point.y));
  const webCount = Math.floor(geometry.webEndFraction * (points.length - 1));
  // Every point lies on the long web arc up to the web's end and on the
  // tighter tip arc after it.
  points.forEach((point, index) => {
    const onWeb = Math.abs(point.distanceTo(geometry.webArcCenter) - geometry.webArcRadius);
    const onTip = Math.abs(point.distanceTo(geometry.tipArcCenter) - geometry.tipArcRadius);
    if (index < webCount - 1) assert.ok(onWeb < 2e-3, `point ${index} is off the web arc by ${onWeb}`);
    if (index > webCount + 1) assert.ok(onTip < 2e-3, `point ${index} is off the tip arc by ${onTip}`);
  });
  assert.ok(geometry.tipArcRadius > 4 * geometry.strongHalfWidth
    && geometry.tipArcRadius < geometry.webArcRadius);
  // No kink, J-hook or reversal: the leaf turns clockwise at every vertex.
  for (let index = 1; index + 1 < points.length; index += 1) {
    const before = points[index].clone().sub(points[index - 1]);
    const after = points[index + 1].clone().sub(points[index]);
    const turn = Math.atan2(cross2(before, after), before.dot(after));
    assert.ok(turn < 1e-9 && turn > -0.08, `vertex ${index} turns ${turn}`);
  }
  // It rises from the block's corner and ends in C's seat.
  assert.ok(points[0].distanceTo(new THREE.Vector2(geometry.strongSpringAnchor.x,
    geometry.strongSpringAnchor.y)) < 1e-9);
});
