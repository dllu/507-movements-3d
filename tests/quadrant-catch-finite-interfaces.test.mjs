import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredQuadrantCatchMovement as create } from '../src/simulation/authored-quadrant-catches.js';
import { quadrantCatchMotion as motion } from '../src/simulation/baked/quadrant-catch-motion.js';
import {
  handleOverlap, quadrantCatchParts, tappetSource, transformPolygon, deg, upperFreeStop,
} from '../src/simulation/quadrant-catch-finite-parts.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

test('183/184: baked transfer table matches the current parts source and is periodic', () => {
  const sha = createHash('sha256').update(readFileSync(new URL('../src/simulation/quadrant-catch-finite-parts.js', import.meta.url))).digest('hex');
  assert.equal(motion.sourceSha256, sha, 'rebake with scripts/bake-quadrant-catch.mjs');
  const rows = motion.rows;
  assert.equal(rows.length, motion.samples + 1);
  rows[0].forEach((v, k) => assert.ok(Math.abs(v - rows.at(-1)[k]) < 1e-3, `column ${k} not periodic`));
});

test('183/184: handles clear the tappet and each other in plate coordinates', () => {
  const { upper, lower } = quadrantCatchParts();
  const tappetOnly = { pivot: lower.pivot, parts: {} };
  let worst = 0;
  for (const [T, u, l] of motion.rows) {
    worst = Math.max(worst, handleOverlap(upper, u, lower, l, T), handleOverlap(lower, l, tappetOnly, 0, T));
  }
  // Seated contacts are resolved to below 0.01 px^2 of polygon overlap.
  assert.ok(worst < 0.01, `worst overlap ${worst} px^2`);
});

test('183/184: the quadrants latch each other only through drawn parts in shared planes', () => {
  const { upper, lower } = quadrantCatchParts();
  // One flat outline per plane; no studs, lips or bosses.
  assert.deepEqual(Object.keys(upper.parts).sort(), ['arm', 'hub', 'weightArm', 'wing']);
  assert.deepEqual(Object.keys(lower.parts).sort(), ['hub', 'lever', 'quadrant', 'weightArm']);
  for (const body of [upper, lower]) for (const [name, part] of Object.entries(body.parts)) {
    if (name !== 'hub') assert.equal(part.planes.length, 1, name);
  }
  // The only cross-handle plane shared away from the shafts is the latch plane F.
  const shared = new Set();
  for (const a of Object.values(upper.parts)) for (const b of Object.values(lower.parts)) {
    if (a === upper.parts.hub || b === lower.parts.hub) continue;
    for (const c of a.planes) if (b.planes.includes(c)) shared.add(c);
  }
  assert.deepEqual([...shared], ['F']);
});

test('183/184: the tappet lifts the lower handle, the quadrants hold and release each other', () => {
  const rows = motion.rows, n = motion.samples;
  // Up stroke: the upper wing rests on the band's rim until the thrown lower
  // band's end has passed its toe; then the upper drops onto its stop.
  const drop = rows.findIndex(([, u]) => u > 1e-3);
  assert.ok(drop > 0 && drop < n / 2);
  assert.ok(rows[drop][2] > 74, `upper released at lower ${rows[drop][2]}`);
  assert.ok(rows.slice(0, drop).every(([, u]) => u === 0), 'upper held until release');
  // At the top the lower handle is held raised against the wing, clear of
  // the tappet's path, and the upper rests on its stop.
  const top = rows[n / 2];
  assert.equal(top[1], upperFreeStop);
  assert.ok(top[2] > 70, `lower held at ${top[2]}`);
  // Down stroke: the tappet strikes the upper C-arm and turns it back; only
  // then does the lower handle fall.
  const struck = rows.findIndex(([, u], i) => i > n / 2 && u < upperFreeStop - 0.5);
  const fall = rows.findIndex(([, , l], i) => i > n / 2 && l < top[2] - 1);
  assert.ok(struck > n / 2 && fall > struck, `struck ${struck} fall ${fall}`);
  const { upper } = quadrantCatchParts();
  const [T, u] = rows[struck];
  const arm = transformPolygon(upper.parts.arm.poly, upper.pivot, u * deg)[0][0]
    .filter(([x]) => x >= tappetSource.x0 && x <= tappetSource.x1);
  assert.ok(arm.length && Math.abs(Math.min(...arm.map(([, y]) => y)) - (T + tappetSource.h)) < 1.5, 'tappet bears on the C-arm');
  // Bottom: lower at rest and upper re-latched.
  assert.ok(rows[0][2] === 0 && rows[0][1] === 0);
});

for (const id of [183, 184]) {
  test(`${id}: rendered solids of the two handles and the tappet never interpenetrate`, () => {
    const m = create({ id }), b = m.root.userData.blocks;
    const upperParts = ['upperArm', 'upperWing', 'upperWeightArm', 'upperHub'].map((k) => b[k]);
    const lowerParts = ['lowerQuadrant', 'lowerLever', 'lowerWeightArm', 'lowerHub'].map((k) => b[k]);
    assert.ok([...upperParts, ...lowerParts].every(Boolean));
    const pairs = [];
    for (const a of upperParts) for (const c of [...lowerParts, b.tappet, b.pistonRod]) pairs.push([a, c]);
    for (const c of lowerParts) if (c !== b.lowerHub) pairs.push([c, b.tappet]);
    const fields = new Map(), points = new Map();
    for (const o of new Set(pairs.flat())) { fields.set(o, solidSurface(o.geometry)); points.set(o, surfacePoints(o.geometry)); }
    let minimum = 0.02;
    for (let i = 0; i < 48; i++) {
      m.update(18 * i / 48); m.root.updateMatrixWorld(true);
      for (const [a, c] of pairs) for (const [from, to] of [[a, c], [c, a]]) {
        const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
        for (const q of points.get(from)) minimum = Math.min(minimum, fields.get(to).signedDistance(q.clone().applyMatrix4(matrix), 0.02));
      }
    }
    assert.ok(minimum > -0.001, `${id} worst penetration ${minimum}`);
  });

  test(`${id}: front source view, no ground, full-cycle framing`, () => {
    const m = create({ id }), d = m.root.userData, point = new THREE.Vector3();
    assert.equal(d.hideGround, true);
    assert.equal(d.cameraDirection.x, 0); assert.equal(d.cameraDirection.y, 0);
    for (let i = 0; i <= 24; i++) {
      m.update(18 * i / 24); m.root.updateMatrixWorld(true);
      m.root.traverseVisible((o) => {
        const a = o.geometry?.attributes.position;
        if (a && !o.userData.runsPastCrop) for (let j = 0; j < a.count; j += 7) assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld)));
      });
    }
  });
}
