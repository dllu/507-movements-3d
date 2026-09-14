import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import clip from 'polygon-clipping';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import profiles from '../src/data/sector-press-teeth.js';

const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];
const area = multi => multi.reduce((sum, polygon) => sum + polygon.reduce((s, ring, i) =>
  s + (i ? -1 : 1) * Math.abs(ring.reduce((a, p, j) => {
    const q = ring[(j + 1) % ring.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2), 0), 0);
const rotate = (ring, a, x = 0, y = 0) => ring.map(([u, v]) => [
  u * Math.cos(a) - v * Math.sin(a) + x,
  u * Math.sin(a) + v * Math.cos(a) + y,
]);

test('133 continuous two-opening web seats its pin and clears the pinion', () => {
  const model = createMovementModel(movement);
  const { geometry: d, blocks: b, toothProfiles } = model.root.userData;
  try {
    const shape = b.sectorRim.geometry.parameters.shapes;
    assert.equal(shape.holes.length, 2);
    const extracted = shape.extractPoints(32);
    const web = [extracted.shape, ...extracted.holes].map(r => r.map(p => [p.x, p.y]));
    const seat = Array.from({ length: 129 }, (_, i) => [
      d.sectorPinRadius + .14 * Math.cos(i * Math.PI / 64),
      .14 * Math.sin(i * Math.PI / 64),
    ]);
    assert(area(clip.difference([seat], web)) < 1e-10, 'pin needs material around its whole circumference');
    for (let i = 0; i <= 720; i++) {
      const angle = i * d.sectorAngularTravel / 720;
      const pinion = rotate(profiles.pinion, toothProfiles.pinionMountPhase - 6 * angle,
        d.pinionCenter.x, d.pinionCenter.y);
      assert(area(clip.intersection(web.map(r => rotate(r, angle)), [pinion])) < 1e-10);
    }
    for (let i = 0; i < d.installedSectorTeeth; i++) {
      assert(area(clip.intersection(web, [rotate(profiles.sectorTooth, i * d.sectorAngularPitch)])) > 1e-6,
        'each tooth must join the continuous web');
    }
  } finally {
    disposeObject3D(model.root);
  }
});
