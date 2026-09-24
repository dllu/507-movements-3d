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

test('183/184: solved handles clear the tappet and each other in plate coordinates', () => {
  const { upper, lower } = quadrantCatchParts();
  let worst = 0;
  for (let i = 0; i < motion.rows.length; i += 3) {
    const [T, u, l] = motion.rows[i];
    // The upper total covers every handle-to-handle pair and the upper's
    // tappet contact; the lower adds only its own tappet contact, so no two
    // seated contacts are summed into one figure.
    const tappetOnly = { pivot: lower.pivot, parts: {} };
    worst = Math.max(worst, handleOverlap(upper, u, lower, l, T), handleOverlap(lower, l, tappetOnly, 0, T));
  }
  // Seated contacts are resolved to below 0.05 px^2 of polygon overlap.
  assert.ok(worst < 0.06, `worst overlap ${worst} px^2`);
});

test('183/184: the tappet lifts the lower handle, each quadrant holds and releases the other handle', () => {
  const rows = motion.rows;
  const at = (pred) => rows.findIndex(pred);
  // Up stroke: upper stays latched until the lower handle's rear lip (kept
  // within the drawn band end) has carried past its stud.
  const upperRelease = at(([, u]) => u > 2);
  assert.ok(rows[upperRelease][2] > 10 && rows[upperRelease][2] < 20, `upper released at lower lift ${rows[upperRelease][2]}`);
  assert.ok(rows.slice(0, upperRelease).every(([, u]) => u < 2.7), 'upper held until release');
  // At the top the upper handle is at its stop, the lower handle latched raised,
  // and the tappet is above the upper handle's working arm.
  const top = rows[motion.samples / 2];
  assert.equal(top[1], upperFreeStop);
  assert.ok(top[2] > 52 && top[2] < 54, `lower rests on the wing's catch boss at ${top[2]}`);
  const { upper } = quadrantCatchParts();
  const arm = transformPolygon(upper.parts.arm.poly, upper.pivot, top[1] * deg)[0][0]
    .filter(([x]) => x >= tappetSource.x0 && x <= tappetSource.x1);
  assert.ok(Math.min(...arm.map(([, y]) => y)) > top[0] + tappetSource.h, 'tappet passed above the upper arm');
  // Down stroke: the tappet takes the lower handle off the boss while the
  // upper is being pushed back, and lets it down.
  const takeOff = rows.findIndex(([, , l], i) => i > motion.samples / 2 && l > 54);
  assert.ok(rows[takeOff][1] > 30 && rows[takeOff][1] < upperFreeStop);
  const lowerRelease = rows.findIndex(([, u, l], i) => i > motion.samples / 2 && l < 50);
  assert.ok(rows[lowerRelease][1] > 15 && rows[lowerRelease][1] < 30);
  // Bottom: lower at rest and upper re-latched.
  assert.ok(rows[0][2] === 0 && rows[0][1] < 1);
});

for (const id of [183, 184]) {
  test(`${id}: rendered solids of the two handles never interpenetrate`, () => {
    const m = create({ id }), b = m.root.userData.blocks;
    const upperParts = ['upperArm', 'upperStud', 'upperQuadrant', 'upperCatchBoss', 'upperHub'].map((k) => b[k]);
    const lowerParts = ['lowerArm', 'lowerKnob', 'lowerStud', 'lowerQuadrant', 'lowerLip', 'lowerHub', 'lowerWeightArm'].map((k) => b[k]);
    assert.ok([...upperParts, ...lowerParts].every(Boolean));
    const pairs = [];
    for (const a of upperParts) for (const c of [...lowerParts, b.tappet]) pairs.push([a, c]);
    for (const c of lowerParts) pairs.push([c, b.tappet]);
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
        if (a) for (let j = 0; j < a.count; j += 7) assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld)));
      });
    }
  });
}
