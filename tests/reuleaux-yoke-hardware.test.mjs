import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[134];
const box = o => new THREE.Box3().setFromObject(o, true);

test('135 bowed yoke uses connected bored shoes and full-width valve rods', () => {
  const model = createMovementModel(movement);
  const { geometry: d, blocks: b } = model.root.userData;
  try {
    assert.equal(b.upperRod.geometry.parameters.radiusTop, 27 * d.sourceScale);
    assert.equal(b.lowerRod.geometry.parameters.radiusTop, 27 * d.sourceScale);
    for (let i = 0; i <= 720; i++) {
      model.update(i * d.cyclePeriod / 720);
      model.root.updateMatrixWorld(true);
      for (let j = 0; j < 2; j++) {
        const shoe = b.guideShoes[j], rail = box(b.guideRails[j]), sb = box(shoe), arm = box(b.guideArms[j]);
        assert.equal(shoe.geometry.parameters.shapes.holes.length, 1);
        const local = new THREE.Vector3((rail.min.x + rail.max.x) / 2, (sb.min.y + sb.max.y) / 2, (rail.min.z + rail.max.z) / 2);
        shoe.worldToLocal(local);
        assert(Math.abs(local.x) < 1e-12 && Math.abs(local.z) < 1e-12);
        assert((rail.max.x - rail.min.x) / 2 < .075 - .0049);
        assert((rail.max.z - rail.min.z) / 2 < .105 - .0049);
        assert(rail.min.y < sb.min.y && rail.max.y > sb.max.y);
        assert(arm.intersectsBox(sb) && arm.intersectsBox(box(b.followerBody)));
        assert(!arm.intersectsBox(rail), 'connecting arm must not block the guide passage');
        assert(!arm.intersectsBox(box(b.carrierDisk)), 'guide arm must clear the rotating disk');
      }
      for (const rod of [b.upperRod, b.lowerRod]) {
        assert(box(rod).min.z > box(b.carrierDisk).max.z);
        assert(b.attachmentLugs.some(lug => box(lug).intersectsBox(box(rod))));
      }
    }
    const contour = b.followerBody.geometry.parameters.shapes.getPoints(128);
    assert(Math.max(...contour.map(p => p.x)) > d.outerHalfWidth + .29);
  } finally { disposeObject3D(model.root); }
});

test('135 shows no undrawn rod guides hanging round the rods (pass 93)', () => {
  const model = createMovementModel(movement);
  try {
    const names = [];
    model.root.traverse((o) => { if (o.isMesh) names.push(o.name); });
    assert(!names.some((n) => /RodGuide/.test(n)), names.filter((n) => /RodGuide/.test(n)).join());
  } finally { disposeObject3D(model.root); }
});
