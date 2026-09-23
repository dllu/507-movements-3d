// Offline anchor for Movement 303. Each side is a source-proportioned blank
// (arm from C to an outer corner, joined to a pallet that carries the solved
// concentric lock and impulse faces), minus the envelope swept by every
// nearby tooth in the anchor frame over one full pendulum period. All teeth
// are identical and the wheel advances exactly one pitch per period, so one
// period covers every tooth/anchor configuration. Consecutive poses are
// joined by convex hulls and grown by a clearance ring that also covers both
// extrusion bevels. The browser only extrudes the baked outlines.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import polygonClipping from 'polygon-clipping';
import * as THREE from 'three';
import { grahamToothOutline } from '../src/simulation/authored-deadbeat-escapements.js';
import { createMovementModel } from '../src/simulation/registry.js';

const SAMPLES = 4000;
const WHEEL_BEVEL = 0.003;
const ANCHOR_BEVEL = 0.003;
const RUNNING_CLEARANCE = 0.003;
// Extrusion bevels grow sharp corners by their mitre, up to about 2.5 times
// the bevel size at these tooth and pallet angles.
const CLEARANCE = 2.5 * (WHEEL_BEVEL + ANCHOR_BEVEL) + RUNNING_CLEARANCE;
const PALLET_THICKNESS = 0.34;
const ARM_WIDTH = 0.36;
const CORNER_OFFSET = 0.5;

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const model = createMovementModel(catalog.movements[302]);
const data = model.root.userData;
const g = data.geometry;
const pivot = new THREE.Vector2(g.anchorPivot.x, g.anchorPivot.y);
const outline = grahamToothOutline(g);
const rotate = (p, a) => new THREE.Vector2(Math.cos(a) * p.x - Math.sin(a) * p.y, Math.sin(a) * p.x + Math.cos(a) * p.y);
const toAnchor = (world, anchorAngle) => rotate(world.clone().sub(pivot), -anchorAngle);

// polygon-clipping is not robust to nearly coincident segments; snapping every
// clip vertex to a 1e-5 grid avoids its sweep-line failures.
const snap = (v) => Math.round(v * 1e5) / 1e5;
function hull(points) {
  const unique = new Map(points.map((q) => [snap(q.x), snap(q.y)]).map((q) => [q.join(','), q]));
  const p = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  const ring = lower.slice(0, -1).concat(upper.slice(0, -1));
  return [[...ring, ring[0]]];
}
const grown = (points, radius) => points.flatMap((p) => Array.from({ length: 8 }, (_, i) => new THREE.Vector2(
  p.x + radius * Math.cos(i * Math.PI / 4), p.y + radius * Math.sin(i * Math.PI / 4))));
const ringOf = (points) => [[...points.map((p) => [p.x, p.y]), [points[0].x, points[0].y]]];

// Blank for one side, in anchor-local coordinates at anchor angle zero.
function blank(profile, bodySide) {
  const working = [...profile.lockPoints.slice().reverse(), ...profile.impulsePoints.slice(1)];
  const backing = working.map((p) => p.clone().addScaledVector(p.clone().normalize(), bodySide * PALLET_THICKNESS));
  const pallet = [...working, ...backing.reverse()];
  const centroid = pallet.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(pallet.length);
  const wheelCenter = toAnchor(new THREE.Vector2(0, 0), 0);
  const corner = centroid.clone().add(centroid.clone().sub(wheelCenter).normalize().multiplyScalar(CORNER_OFFSET));
  const band = (a, b, width) => {
    const n = new THREE.Vector2(-(b.y - a.y), b.x - a.x).normalize().multiplyScalar(width / 2);
    return ringOf([a.clone().add(n), b.clone().add(n), b.clone().sub(n), a.clone().sub(n)]);
  };
  const hub = ringOf(Array.from({ length: 40 }, (_, i) => new THREE.Vector2(0.45 * Math.cos(i * Math.PI / 20), 0.45 * Math.sin(i * Math.PI / 20))));
  return { corner, shape: polygonClipping.union(ringOf(pallet), hull([...pallet, ...grown([corner], ARM_WIDTH / 2)]),
    band(new THREE.Vector2(), corner, ARM_WIDTH), hub) };
}

const left = blank(data.palletProfiles.left, -1);
const right = blank(data.palletProfiles.right, 1);
const bbox = (multi) => {
  const box = new THREE.Box2();
  for (const poly of multi) for (const ring of poly) for (const [x, y] of ring) box.expandByPoint(new THREE.Vector2(x, y));
  return box.expandByScalar(0.3);
};
const reach = [bbox(left.shape), bbox(right.shape)];

const teethAt = (time) => {
  const state = data.stateAtTime(time);
  return Array.from({ length: g.toothCount }, (_, k) => outline.map((p) => toAnchor(rotate(p, state.wheelAngle + k * g.toothPitch), state.anchorAngle)));
};
const rootDisk = Array.from({ length: 120 }, (_, i) => new THREE.Vector2(
  (g.wheelRootRadius + WHEEL_BEVEL) * Math.cos(i * Math.PI / 60), (g.wheelRootRadius + WHEEL_BEVEL) * Math.sin(i * Math.PI / 60)));
const clips = [];
let previous = teethAt(0), previousDisk = rootDisk.map((p) => toAnchor(p, data.stateAtTime(0).anchorAngle));
for (let i = 1; i <= SAMPLES; i += 1) {
  const time = g.pendulumPeriod * i / SAMPLES;
  const current = teethAt(time);
  for (let k = 0; k < g.toothCount; k += 1) {
    const points = [...previous[k], ...current[k]];
    const box = new THREE.Box2().setFromPoints(points);
    if (!reach.some((r) => r.intersectsBox(box))) continue;
    clips.push(hull(grown(points, CLEARANCE)));
  }
  if (i % 40 === 0) {
    const disk = rootDisk.map((p) => toAnchor(p, data.stateAtTime(time).anchorAngle));
    clips.push(hull(grown([...previousDisk, ...disk], CLEARANCE)));
    previousDisk = disk;
  }
  previous = current;
}
const snapMulti = (multi) => multi.map((poly) => poly.map((ring) => {
  const out = [];
  for (const [x, y] of ring) {
    const q = [snap(x), snap(y)];
    if (!out.length || out.at(-1)[0] !== q[0] || out.at(-1)[1] !== q[1]) out.push(q);
  }
  return out;
})).map((poly) => (poly[0]?.length >= 4 ? poly.filter((ring) => ring.length >= 4) : [])).filter((poly) => poly.length);
const area = (ring) => Math.abs(ring.reduce((s, [x, y], i) => { const [u, v] = ring[(i + 1) % ring.length]; return s + x * v - u * y; }, 0) / 2);
const clipBoxes = clips.map((clip) => bbox([clip]).expandByScalar(-0.3));
const cut = (blankShape) => {
  let shape = snapMulti(blankShape);
  let box = bbox(shape);
  const relevant = clips.filter((_, i) => box.intersectsBox(clipBoxes[i]));
  for (let i = 0; i < relevant.length; i += 16) {
    const batch = relevant.slice(i, i + 16);
    try {
      shape = snapMulti(polygonClipping.difference(shape, ...batch));
    } catch {
      for (const clip of batch) shape = snapMulti(polygonClipping.difference(shape, clip));
    }
  }
  const pieces = shape;
  const kept = pieces.sort((a, b) => area(b[0]) - area(a[0]))[0];
  const round = (ring) => ring.slice(0, -1).map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);
  return { outer: round(kept[0]), holes: kept.slice(1).map(round), discardedPieces: pieces.length - 1 };
};
const result = { left: cut(left.shape), right: cut(right.shape) };
// Production must match these values for the baked outlines to be current.
const fingerprint = Object.fromEntries(['anchorAmplitude', 'impulseAdvance', 'leftLockReferenceAngle', 'lockingAmplitudeFraction',
  'pendulumPeriod', 'releaseAmplitudeFraction', 'rightLockReferenceAngle', 'toothCount', 'toothLeanAngle', 'toothTipRadius',
  'wheelRootRadius'].map((key) => [key, g[key]]).concat([['anchorPivot', [pivot.x, pivot.y]]]));
const inputs = JSON.stringify({ SAMPLES, CLEARANCE, PALLET_THICKNESS, ARM_WIDTH, CORNER_OFFSET, g: { ...g, anchorPivot: [pivot.x, pivot.y] } });
const hash = createHash('sha256').update(inputs).digest('hex').slice(0, 16);
const file = `// Generated by scripts/generate-graham-303-anchor.mjs; do not edit.
export const GRAHAM_303_ANCHOR = Object.freeze(${JSON.stringify({
  inputHash: hash, geometryFingerprint: fingerprint, samples: SAMPLES, clearance: CLEARANCE, wheelBevel: WHEEL_BEVEL, anchorBevel: ANCHOR_BEVEL,
  runningClearance: RUNNING_CLEARANCE, left: result.left, right: result.right,
})});
`;
await writeFile(new URL('../src/simulation/baked/graham-303-anchor.js', import.meta.url), file);
console.log(JSON.stringify({ hash, clips: clips.length, left: { vertices: result.left.outer.length, discarded: result.left.discardedPieces },
  right: { vertices: result.right.outer.length, discarded: result.right.discardedPieces } }));
