// Pass 86 lane 7: joints the sliver screen flagged are now solid overlaps
// (a sunk shank, a bored or bedded seat, a pad under a stem), checked on the
// production models the browser loads.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import * as THREE from 'three';
import { loadMovementModel } from '../src/simulation/model-loader.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { makeWeightedBellCrankModel } from '../src/simulation/baked/weighted-bell-crank.js';
import { makeCordTreadleModel } from '../src/simulation/baked/cord-treadle.js';

// The baked loaders fetch their bundles, so the tests read the files directly.
const bundle = (id) => JSON.parse(gunzipSync(readFileSync(new URL(`../src/simulation/baked/assets/${id}.json.gz`, import.meta.url))));

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8')).movements;
const load = async (id) => {
  const model = await loadMovementModel(catalog[id - 1]);
  model.update?.(0, 0);
  model.root.updateMatrixWorld(true);
  return model;
};
const byRole = (root, role) => {
  let found = null;
  root.traverse((o) => { if (!found && o.isMesh && o.userData.role === role) found = o; });
  assert.ok(found, role);
  return found;
};
const localBox = (mesh) => {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
};

test('154: the weight eye stands on a tapered shank sunk into the ball', async () => {
  const model = makeWeightedBellCrankModel(bundle(154));
  try {
    const weight = model.root.getObjectByName('body:weight');
    const shank = weight.getObjectByName('weight-eye-shank');
    assert.ok(shank);
    const box = localBox(shank);
    assert.ok(box.min.y < 0.504 - 0.08, 'root sunk well inside the 0.504 ball');
    assert.ok(box.max.y > 0.504 + 0.03, 'top enters the eye rim above the ball');
  } finally { model.dispose(); }
});

test('159: the cord pin shank runs on through the treadle bar', async () => {
  const model = makeCordTreadleModel(bundle(159));
  try {
    const shank = model.root.getObjectByName('body:treadle').getObjectByName('cord-pin-shank-through-treadle');
    assert.ok(shank);
    const box = localBox(shank);
    assert.ok(box.min.z < 0.07 && box.max.z > 0.29, 'from near the rear face into the pin at the front face');
  } finally { model.dispose(); }
});

test('167: the stud seat runs into the rod up to its axis', async () => {
  const model = await load(167);
  try {
    const { parts, geometry: g } = model.root.userData;
    const seat = localBox(parts.studSeat), rod = localBox(parts.rod);
    assert.ok(Math.abs(seat.max.x - g.rodX) < 1e-9);
    assert.ok(seat.max.z <= rod.max.z && seat.min.z >= rod.min.z, 'seat corners stay inside the rod');
  } finally { disposeObject3D(model.root); }
});

test('276: the yoke is as deep and tall as the round rod it joins', async () => {
  const model = await load(276);
  try {
    const { blocks: b, geometry: g } = model.root.userData;
    const box = localBox(b.bar), size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(g.yokeDepth - 2 * g.barHalfHeight) < 1e-9);
    assert.ok(size.z >= 2 * g.barHalfHeight - 1e-6, 'yoke as deep as the rod');
    assert.ok(size.y >= 2 * g.barHalfHeight - 1e-6, 'yoke as tall as the rod');
  } finally { disposeObject3D(model.root); }
});

test('312: each pallet-face stem is set into a round pad on its arm', async () => {
  const model = await load(312);
  try {
    const plates = model.root.userData.sweptPlates;
    for (const side of ['left', 'right']) {
      const stem = plates.find((p) => p.key === `${side}-pallet-face-stem`);
      const arm = plates.find((p) => p.key === `${side}-arm`);
      assert.ok(stem.z0 === 0 || stem.z1 === 0, 'stem sunk to the arm mid-plane');
      const [cx, cy] = stem.primitives[0].center;
      assert.ok(arm.primitives.some((p) => p.kind === 'disc' && Math.hypot(p.center[0] - cx, p.center[1] - cy) < 1e-9
        && p.radius >= stem.primitives[0].radius + 0.015), `${side} arm pad under the whole stem`);
    }
  } finally { disposeObject3D(model.root); }
});

test('347: the output-shaft standard beds the bearing ring and clears the shaft', async () => {
  const model = await load(347);
  try {
    const bearing = new THREE.Box3().setFromObject(byRole(model.root, 'fixed-output-shaft-bearing-2'));
    const standard = new THREE.Box3().setFromObject(byRole(model.root, 'fixed-output-shaft-standard-2'));
    const shaft = new THREE.Box3().setFromObject(byRole(model.root, 'rotating-horizontal-output-shaft'));
    assert.ok(standard.max.y > bearing.min.y + 0.1, 'standard rises into the ring');
    assert.ok(standard.max.y < shaft.min.y - 0.05, 'standard stays clear of the shaft');
    assert.ok(standard.min.x > bearing.min.x && standard.max.x < bearing.max.x, 'no end face coplanar with the ring');
  } finally { disposeObject3D(model.root); }
});

test('361: the radial pin is set into the lower shaft down to its axis', async () => {
  const model = await load(361);
  try {
    const pin = byRole(model.root, 'single-radial-pin-fast-on-lower-shaft');
    const box = localBox(pin);
    assert.ok(box.min.y <= 1e-9, 'pin root reaches the shaft axis');
  } finally { disposeObject3D(model.root); }
});

test('385: the weight neck is centred on and sunk into the solid bulb', async () => {
  const model = await load(385);
  try {
    const body = byRole(model.root, 'pear-shaped-door-closing-weight');
    const neck = byRole(model.root, 'weight-neck');
    const bodyBox = localBox(body), neckBox = localBox(neck);
    assert.ok(neckBox.min.y < bodyBox.max.y - 0.08, 'neck sunk into the bulb top');
    const eye = byRole(model.root, 'weight-suspension-eye');
    for (const box of [bodyBox, neckBox]) {
      const c = box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(c.x - eye.position.x) < 1e-6 && Math.abs(c.z - eye.position.z) < 1e-6, 'bulb and neck centred under the eye');
    }
    const profile = body.geometry.parameters.points;
    assert.equal(profile[0].x, 0);
    assert.equal(profile.at(-1).x, 0, 'bulb closed on the axis');
  } finally { disposeObject3D(model.root); }
});

test('400: the cam-following pad and the feeder plate are set into feed bar B', async () => {
  // Pass 90 replaced the pad ball's stem with Brown's raked feeder plate; the
  // pad under the bar and the plate must both be joined to bar B.
  const model = await load(400);
  try {
    const beam = localBox(byRole(model.root, 'rigid-feed-bar-B'));
    const plate = localBox(byRole(model.root, 'raked-toothed-feeder-plate-with-upturned-toe'));
    const pad = localBox(byRole(model.root, 'underside-pad-resting-by-gravity-on-radial-cam-prominence'));
    for (const [name, part] of [['feeder plate', plate], ['pad', pad]]) {
      assert.ok(part.intersectsBox(beam), `${name} meets bar B`);
    }
  } finally { disposeObject3D(model.root); }
});
