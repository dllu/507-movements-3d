import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredGasometerMovement } from '../src/simulation/authored-gasometers.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

// Pass 74: selected solid interfaces of the rebuilt gasometers, sampled over
// a full cycle: bell against the pit and the pipes, pipes and tube b against
// the ground, sleeve a against tube b, weights and bands against the ground
// and the bell.
const make = (id) => createAuthoredGasometerMovement({ id, sourceUrl: `https://507movements.com/mm_${id}.html` });
for (const id of [479, 480]) {
  test(`${id}: bell, pit, pipe, guide and suspension interfaces stay clear over a full cycle`, () => {
    const model = make(id), d = model.root.userData, b = d.blocks;
    const ground = b.pit.ground;
    const pairs = [[b.bellShell, ground], ...b.gasPipes.map((pipe) => [pipe, ground]), ...b.gasPipes.map((pipe) => [b.bellShell, pipe])];
    if (id === 479) {
      for (let i = 0; i < 2; i += 1) {
        pairs.push([b.counterweights[i], ground], [b.counterweights[i], b.bellShell], [b.outerBands[i], b.bellShell], [b.pulleys[i].axle, b.pulleys[i].wheel]);
      }
    } else {
      pairs.push([b.tubeShell, ground], [b.sleeveA, b.tubeShell], [b.bellShell, b.tubeShell], [b.sleeveA, ground], ...b.gasPipes.map((pipe) => [b.sleeveA, pipe]));
    }
    const cache = new Map();
    const get = (o) => {if (!cache.has(o)) cache.set(o, {o, p: surfacePoints(o.geometry), s: solidSurface(o.geometry)});return cache.get(o);};
    const bad = {};
    for (let i = 0; i <= 32; i += 1) {
      model.update(d.geometry.cycleDuration * i / 32);
      model.root.updateMatrixWorld(true);
      for (const [x, y] of pairs) {
        const a = get(x), c = get(y);
        if (!new THREE.Box3().setFromObject(a.o).intersectsBox(new THREE.Box3().setFromObject(c.o))) continue;
        for (const [v, f] of [[a, c], [c, a]]) {
          const tr = f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);
          for (const p of v.p) {
            const q = p.clone().applyMatrix4(tr);
            if (f.s.box.distanceToPoint(q) > 0.001) continue;
            const gap = f.s.signedDistance(q, 0.02);
            if (gap < -2e-6) bad[`${v.o.userData.role} / ${f.o.userData.role}`] = gap;
          }
        }
      }
    }
    assert.deepEqual(bad, {});
  });
}
