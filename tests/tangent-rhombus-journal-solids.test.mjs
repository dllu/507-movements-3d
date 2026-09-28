import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredTangentRodDriveMovement } from '../src/simulation/authored-tangent-rod-drives.js';
import { createAuthoredRhombusLinkageMovement } from '../src/simulation/authored-rhombus-linkages.js';
import { createAuthoredSlidingJournalBoxMovement } from '../src/simulation/authored-sliding-journal-boxes.js';
import { polygonClipping as clip } from '../src/simulation/finite-plate-geometry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const bounds = object => new THREE.Box3().setFromObject(object);
const area = polygons => polygons.reduce((sum, [ring]) => sum + Math.abs(ring.reduce((a, p, i) => {
  const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - p[1] * q[0];
}, 0)) / 2, 0);
const polygon = mesh => [[mesh.geometry.parameters.shapes.getPoints(64).map(point => [point.x, point.y])]];

test('268: finite roller engages the whole rod depth and both working joints have real bores', () => {
  const { root, update } = createAuthoredTangentRodDriveMovement({ id: 268 });
  const b = root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (let sample = 0; sample <= 64; sample += 1) {
    update(6 * sample / 64); root.updateMatrixWorld(true);
    const roller = bounds(b.guideRoller), rod = bounds(b.rodBody);
    assert.ok(roller.min.z < rod.min.z && roller.max.z > rod.max.z);
    assert.ok(bounds(b.crankArm).max.z < bounds(b.rodBody).min.z);
    assert.ok(bounds(b.crankShaft).max.z < bounds(b.rodBody).min.z);
    for (const [pin, solids] of [[b.crankPin, [b.rodBody]],
      [b.guideAxle, [b.guideRoller]]]) {
      const center = pin.getWorldPosition(new THREE.Vector3());
      const radius = pin.geometry.parameters.radiusTop * root.scale.x;
      for (let i = 0; i < 16; i += 1) {
        ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 8),
          center.y + radius * Math.sin(i * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
        for (const solid of solids) assert.equal(ray.intersectObject(solid, false).length, 0);
      }
    }
  }
  disposeObject3D(root);
});

test('273: all four guides enclose the rod depth while clearing its largest moving index', () => {
  const { root, update } = createAuthoredRhombusLinkageMovement({ id: 273 });
  const b = root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (let sample = 0; sample <= 32; sample += 1) {
    update(8 * sample / 32); root.updateMatrixWorld(true);
    for (const [label, guide] of Object.entries(b.guides)) {
      assert.equal(guide.children.length, 4);
      const axis = guide.userData.axis;
      const transverse = new THREE.Vector3(-axis.y, axis.x, 0);
      const center = guide.getWorldPosition(new THREE.Vector3());
      for (let i = 0; i < 16; i += 1) {
        const origin = center.clone().addScaledVector(axis, -10)
          .addScaledVector(transverse, 0.124 * Math.cos(i * Math.PI / 8));
        origin.z += 0.124 * Math.sin(i * Math.PI / 8);
        ray.set(origin, axis);
        assert.equal(ray.intersectObject(guide, true).length, 0, `${label} guide clears index section`);
      }
    }
  }
  disposeObject3D(root);
});

test('279: the actual box stays within its slot and the output arms leave that slot open', () => {
  const { root, update } = createAuthoredSlidingJournalBoxMovement({ id: 279 });
  const b = root.userData.blocks, g = root.userData.geometry;
  const ray = new THREE.Raycaster();
  for (let sample = 0; sample <= 128; sample += 1) {
    update(4 * sample / 128); root.updateMatrixWorld(true);
    const box = bounds(b.journalBox);
    assert.ok(box.max.y < g.slotTopY && box.min.y > g.slotBottomY);
    const left = bounds(b.leftSlotFace), right = bounds(b.rightSlotFace);
    for (const [i, gib] of b.taperGibs.entries()) {
      const part = bounds(gib), face = i === 0 ? left : right;
      assert.ok(part.min.z > face.min.z && part.max.z < face.max.z);
      const gap = i === 0 ? part.min.x - left.max.x : right.min.x - part.max.x;
      assert.ok(Math.abs(gap - 0.018) < 1e-7, `finite guide gap ${gap}`);
    }
    ray.set(new THREE.Vector3(b.crosshead.position.x, g.crossheadRodY, 10), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(b.crossheadRod, true).length, 0);
    assert.ok(bounds(b.mainHub).max.z < bounds(b.crossheadBody).min.z);
    for (const block of b.guideBlocks) {
      const guide = bounds(block);
      for (const arm of b.crossheadRod.children) {
        const rod = bounds(arm);
        if (guide.min.x > rod.max.x || guide.max.x < rod.min.x) continue;
        assert.ok(guide.max.y < rod.min.y || guide.min.y > rod.max.y);
      }
    }
  }
  disposeObject3D(root);
});

test('279: split lining tapers meet the gibs without overlap and clear the real wrist', () => {
  const { root, update } = createAuthoredSlidingJournalBoxMovement({ id: 279 });
  const b = root.userData.blocks;
  root.updateMatrixWorld(true);
  for (let i = 0; i < 2; i += 1) {
    const lining = polygon(b.liningPieces[i]), gib = polygon(b.taperGibs[i]);
    assert.ok(area(clip.intersection(lining, gib)) < 1e-10);
    const outer = lining[0][0].filter(p => Math.abs(p[0]) > 0.60);
    assert.ok(outer.length >= 2);
    const g = root.userData.geometry;
    for (const [x, y] of outer) {
      const expected = g.gibInnerBottom + (g.gibInnerTop - g.gibInnerBottom)
        * (y - g.gibBottomY) / (g.gibTopY - g.gibBottomY);
      assert.ok(Math.abs(Math.abs(x) - expected) < 1e-10);
    }
  }
  const ray = new THREE.Raycaster();
  for (let sample = 0; sample <= 32; sample += 1) {
    update(4 * sample / 32); root.updateMatrixWorld(true);
    const center = b.crankWrist.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 32; i += 1) {
      ray.set(new THREE.Vector3(center.x + 0.456 * Math.cos(i * Math.PI / 16),
        center.y + 0.456 * Math.sin(i * Math.PI / 16), 10), new THREE.Vector3(0, 0, -1));
      for (const lining of b.liningPieces) assert.equal(ray.intersectObject(lining, false).length, 0);
    }
  }
  disposeObject3D(root);
});
