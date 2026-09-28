import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createMovementModel, applyDisplayTiming } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[134];
const box = o => new THREE.Box3().setFromObject(o);
test('135 working cam mesh clears the yoke and its shaft stays behind the carrier', () => {
  const model = createMovementModel(movement);
  const { geometry: d, blocks: b } = model.root.userData;
  const positions = b.camBody.geometry.attributes.position;
  let maxGap = 0;
  try {
    assert.equal(b.camBody.geometry.parameters.options.bevelEnabled, false);
    for (let i = 0; i <= 720; i++) {
      model.update(i * d.cyclePeriod / 720);
      model.root.updateMatrixWorld(true);
      let minY = Infinity, maxY = -Infinity;
      for (let j = 0; j < positions.count; j++) {
        const p = new THREE.Vector3().fromBufferAttribute(positions, j).applyMatrix4(b.camBody.matrixWorld);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const lowerGap = minY - box(b.lowerRailLiner).max.y;
      const upperGap = box(b.upperRailLiner).min.y - maxY;
      assert(lowerGap > .00099 && upperGap > .00099, 'rendered cam must not intersect either liner');
      maxGap = Math.max(maxGap, lowerGap, upperGap);
      assert(box(b.inputShaft).max.z < box(b.lowerRailLiner).min.z);
      assert(box(b.inputShaft).max.z < box(b.upperRailLiner).min.z);
      assert(box(b.fastenerBoss).min.z < box(b.carrierDisk).max.z, 'fastener must reach carrier');
      assert(box(b.fastenerBoss).intersectsBox(box(b.camBody)));
    }
    console.log({ maximumMeshRailGap: maxGap });
    assert(maxGap < .0011);
    assert(2.05 / 2 > box(b.lowerRailLiner).min.z, 'former shaft entered the working plane');
    applyDisplayTiming(model, movement);
    assert.equal(model.root.userData.animationTiming.displayCycleDuration, 4);
    assert(model.root.userData.hideGround && model.root.userData.supportsRestart);
  } finally { disposeObject3D(model.root); }
});
test('135 yoke and tappet are as deep as the rod nuts and centred on the rod axis (pass 97)', () => {
  const model = createMovementModel(movement);
  try {
    model.root.updateMatrixWorld(true);
    const { blocks: b } = model.root.userData;
    const find = role => { let hit; model.root.traverse(o => { if (!hit && o.isMesh && o.userData.role === role) hit = o; }); return hit; };
    const yoke = box(find('one-piece-positive-return-valve-frame'));
    const nut = box(find('hex-nut-valve-rod-yoke-attachment'));
    const rod = box(find('upper-valve-rod-rigid-with-yoke'));
    const cam = box(b.camBody);
    const mid = bx => (bx.min.z + bx.max.z) / 2;
    assert(Math.abs(mid(yoke) - mid(nut)) < 1e-6 && Math.abs(mid(rod) - mid(nut)) < 1e-6, `yoke, nut and rod share one axis: ${[mid(yoke), mid(nut), mid(rod)]}`);
    const proud = [nut.min.z - yoke.min.z, yoke.max.z - nut.max.z];
    assert(proud.every(d => d > .005 && d < .03), `yoke faces sit just proud of the nut flats: ${proud}`);
    assert(cam.max.z - cam.min.z > .9 * (nut.max.z - nut.min.z), 'tappet is about as deep as the nuts');
    assert(cam.max.z < yoke.max.z && cam.min.z > box(b.carrierDisk).max.z);
    assert(box(b.fastenerBoss).max.z > cam.max.z, 'fastener boss stands proud of the tappet face');
  } finally { disposeObject3D(model.root); }
});
