import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import polygonClipping from 'polygon-clipping';
import { createMovementModel } from '../src/simulation/registry.js';
import {
  parsonsDesign, parsonsMeshRatios, parsonsPathPoint, parsonsPinionOutline, parsonsRackVoid,
} from '../src/simulation/authored-parsons-racks.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const g = parsonsDesign();
const area = (mp) => mp.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
  let a = 0;
  for (let j = 0; j < ring.length - 1; j += 1) a += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
  return total + (index ? -1 : 1) * Math.abs(a) / 2;
}, 0), 0);
const stadium = (L, R, n = 96) => {
  const p = [];
  for (let i = 0; i <= n; i += 1) { const a = -Math.PI / 2 + Math.PI * i / n; p.push([L + R * Math.cos(a), R * Math.sin(a)]); }
  for (let i = 0; i <= n; i += 1) { const a = Math.PI / 2 + Math.PI * i / n; p.push([-L + R * Math.cos(a), R * Math.sin(a)]); }
  return p;
};
const band = polygonClipping.difference([[stadium(g.halfStraight, g.bandOuterRadius)]], parsonsRackVoid(g));
const pinion = parsonsPinionOutline(g);
const posed = (s, grow = 0) => {
  const p = parsonsPathPoint(g, s), a = Math.PI / 2 + s / g.pinionPitchRadius;
  return pinion.map(([x, y]) => {
    const r = Math.hypot(x, y), k = (r + grow) / r;
    return [k * (x * Math.cos(a) - y * Math.sin(a)) + p.x, k * (x * Math.sin(a) + y * Math.cos(a)) + p.y];
  });
};

test('394 is an endless rack toothed all round inside, one ten-tooth involute pinion and two concentric flanges', () => {
  const model = createMovementModel(catalog.movements[393]);
  const d = model.root.userData;
  assert.equal(d.fidelity, 'authored');
  assert.equal(g.pinionTeeth, 10);
  assert.equal(g.rackToothCount, 2 * g.straightPitches + g.endTeeth);
  assert.ok(g.largeFlangeRadius > g.pinionPitchRadius + g.addendum, 'large flange overhangs the pinion teeth');
  assert.ok(g.smallFlangeRadius < g.largeFlangeRadius);
  for (const block of ['band', 'largeRebate', 'smallRebate', 'rod', 'collar', 'pinion', 'largeFlange', 'smallFlange'])
    assert.ok(d.blocks[block], block);
  // The common pitch closes round the whole pitch line and the pinion path.
  const pitchLine = 4 * g.halfStraight + 2 * Math.PI * g.endPitchRadius;
  assert.ok(Math.abs(pitchLine / g.pitch - g.rackToothCount) < 1e-12);
  assert.ok(Math.abs(g.pinionTurnsPerCycle * g.pinionTeeth - (2 * g.straightPitches + g.endTeeth - g.pinionTeeth)) < 1e-12);
});

const posedTurned = (s, turn) => {
  const p = parsonsPathPoint(g, s), a = Math.PI / 2 + s / g.pinionPitchRadius + turn;
  return pinion.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a) + p.x, x * Math.sin(a) + y * Math.cos(a) + p.y]);
};

test('394 pinion clears the finite rack band all round the path and stays in working contact', () => {
  let worst = 0, loose = 0;
  for (let i = 0; i < 1200; i += 1) {
    const s = g.pathLength * i / 1200;
    worst = Math.max(worst, area(polygonClipping.intersection([[posed(s)]], band)));
    if (i % 12 === 0) {
      // Turned 0.01 (arc at the pitch circle) either way the pinion must touch
      // the band: it is held in mesh in both senses everywhere.
      for (const sense of [1, -1])
        if (!(area(polygonClipping.intersection([[posedTurned(s, sense * 0.01 / g.pinionPitchRadius)]], band)) > 0)) loose += 1;
    }
  }
  assert.equal(worst, 0, `pinion/band overlap ${worst}`);
  assert.equal(loose, 0, 'pinion has under 0.01 of free play at its pitch circle everywhere');
});

test('394 every rack tooth meshes: the pinion runs both rows and both toothed ends once per cycle', () => {
  const model = createMovementModel(catalog.movements[393]);
  const d = model.root.userData, T = d.geometry.cycleDuration;
  const seen = new Set();
  let prev = d.stateAtTime(0);
  for (let i = 1; i <= 800; i += 1) {
    const s = d.stateAtTime(T * i / 800);
    seen.add(s.segment);
    assert.ok(s.outputAngle > prev.outputAngle, 'pinion never reverses');
    assert.ok(s.rackPosition.distanceTo(prev.rackPosition) < 0.1, 'rack moves continuously');
    if (s.segment === 'upper-row') assert.ok(s.rackVelocity.x < 0, 'rack runs left on the upper row (Brown\'s arrow)');
    if (s.segment === 'lower-row') assert.ok(s.rackVelocity.x > 0);
    prev = s;
  }
  assert.deepEqual([...seen].sort(), ['left-end', 'lower-row', 'right-end', 'upper-row']);
  const a = d.stateAtTime(1.3), b = d.stateAtTime(1.3 + T);
  assert.ok(a.rackPosition.distanceTo(b.rackPosition) < 1e-9, 'rack closes each cycle');
  assert.ok(Math.abs((b.outputAngle - a.outputAngle) * g.pinionTeeth / (2 * Math.PI) - 32) < 1e-9, 'pinion tooth phase closes');
});

test('394 flanges clear their rebates and the band while bounding the mesh depth', () => {
  const large = polygonClipping.difference([[stadium(g.halfStraight, g.bandOuterRadius)]], [[stadium(g.halfStraight, g.eccentricity + g.largeFlangeRadius + g.rebateClearance)]]);
  const small = polygonClipping.difference([[stadium(g.halfStraight, g.bandOuterRadius)]], [[stadium(g.halfStraight, g.eccentricity + g.smallFlangeRadius + g.rebateClearance)]]);
  const disc = (r, c) => Array.from({length: 256}, (_, i) => [c.x + r * Math.cos(i * Math.PI / 128), c.y + r * Math.sin(i * Math.PI / 128)]);
  for (let i = 0; i < 400; i += 1) {
    const c = parsonsPathPoint(g, g.pathLength * i / 400);
    assert.equal(area(polygonClipping.intersection([[disc(g.largeFlangeRadius, c)]], large)), 0);
    assert.equal(area(polygonClipping.intersection([[disc(g.smallFlangeRadius, c)]], small)), 0);
  }
});

test('394 rack teeth are Brown\'s boxes: half-pitch square teeth and notches, and every mesh keeps a contact ratio above one', () => {
  const r = parsonsMeshRatios(g);
  assert.equal(g.pressureAngle, 0, 'zero pressure angle: vertical rack walls');
  assert.ok(Math.abs(g.profileShift - g.addendum) < 1e-12, 'rack and ring tips lie on their pitch lines');
  assert.ok((g.profileShift + g.dedendum) / g.pitch >= 0.5, 'rack notches at least half a pitch deep (Brown about 0.5)');
  assert.ok(r.straightRows >= 1.1, `straight-row contact ratio ${r.straightRows}`);
  assert.ok(r.internalEnds >= 1.1, `internal-end contact ratio ${r.internalEnds}`);
  assert.ok(r.pinionTipThickness >= 0.6 * g.module, 'pinion tips stay square, not pointed');
  // Every upper-row notch away from the junctions is a rectangle: vertical
  // walls from the tip line to a flat root, and the teeth between are half a
  // pitch wide (less the backlash).
  const tipY = g.endPitchRadius, rootY = g.endPitchRadius + g.profileShift + g.dedendum;
  const walls = [];
  for (const polygon of parsonsRackVoid(g)) for (const ring of polygon) for (let i = 0; i + 1 < ring.length; i += 1) {
    const [a, b] = [ring[i], ring[i + 1]];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[0]) < g.halfStraight - 1.7 * g.pitch
      && Math.abs(Math.min(a[1], b[1]) - tipY) < 2e-4 && Math.abs(Math.max(a[1], b[1]) - rootY) < 1e-6) walls.push(a[0]);
  }
  walls.sort((a, b) => a - b);
  assert.ok(walls.length >= 2 * (g.straightPitches - 4), `square notch walls ${walls.length}`);
  for (let i = 1; i + 1 < walls.length; i += 2) {
    const tooth = walls[i + 1] - walls[i];
    assert.ok(Math.abs(tooth - (g.pitch / 2 - g.backlash)) < 1e-6, `tooth tip width ${tooth / g.pitch} pitch`);
  }
});

test('394 generated end relief matches the current pinion and path', async () => {
  const {parsonsEndCarveInputs} = await import('../scripts/export-parsons-geometry.mjs');
  const {default: ends} = await import('../src/simulation/generated-parsons-ends.js');
  assert.equal(ends.inputDigest, parsonsEndCarveInputs().digest,
    'regenerate: node scripts/export-parsons-geometry.mjs && python3 scripts/generate-parsons-ends.py');
});
