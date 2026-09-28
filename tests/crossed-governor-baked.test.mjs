import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {makeCrossedGovernorModel} from '../src/simulation/baked/crossed-governor.js';

const bundle = JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/170.json.gz', import.meta.url))));
test('baked governor stays finite, framed and connected between native keys', () => {
  const model = makeCrossedGovernorModel(bundle), g = bundle.geometry;
  try {
    for (let i = 0; i <= 128; i++) {
      model.update(bundle.period * i / 128);
      const s = model.root.userData.state;
      for (const mesh of Object.values(model.root.userData.parts)) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
      assert.ok(model.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(model.root, true)));
      for (const sign of [-1, 1]) {
        const name = sign < 0 ? 'left' : 'right', mesh = model.root.userData.parts[name + 'Link'];
        const end = new THREE.Vector3(0, g.linkLength, 0).applyMatrix4(mesh.matrixWorld);
        const target = new THREE.Vector3(0, s.outputY, sign * .275).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.spindle);
        assert.ok(end.distanceTo(target) < 5e-5);
      }
    }
  } finally { model.dispose(); }
});

test('baked loop advances three turns and restarts exactly', () => {
  const model = makeCrossedGovernorModel(bundle);
  try {
    const matrices = () => Object.values(model.root.userData.parts).flatMap(o => o.matrixWorld.toArray());
    model.update(0); const initial = matrices(); model.update(bundle.period);
    assert.ok(Math.abs(model.root.userData.state.spindle - 6 * Math.PI) < 1e-12);
    assert.ok(Math.max(...matrices().map((x, i) => Math.abs(x - initial[i]))) < 1e-12);
    model.update(bundle.period * 2.35); model.reset(); assert.deepEqual(matrices(), initial);
  } finally { model.dispose(); }
});

test('baked initial ball centers agree with the source within three pixels', () => {
  const model = makeCrossedGovernorModel(bundle);
  try {
    for (const [name, p] of [['leftBall', [176, 319]], ['rightBall', [355, 319]]]) {
      const point = model.root.userData.parts[name].getWorldPosition(new THREE.Vector3());
      assert.ok(Math.hypot(264 + point.x / bundle.geometry.scale - p[0], 160 - point.y / bundle.geometry.scale - p[1]) < 3);
    }
  } finally { model.dispose(); }
});

test('baked fork bridge spans only between the fork plates (no coplanar faces)', () => {
  const model = makeCrossedGovernorModel(bundle);
  try {
    const {pivotForkBridge, pivotForkFront, pivotForkRear} = model.root.userData.parts;
    const box = mesh => new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).translate(mesh.position);
    const [bridge, front, rear] = [pivotForkBridge, pivotForkFront, pivotForkRear].map(box);
    assert.ok(Math.abs(bridge.max.z - front.min.z) < 1e-6 && Math.abs(bridge.min.z - rear.max.z) < 1e-6);
  } finally { model.dispose(); }
});
