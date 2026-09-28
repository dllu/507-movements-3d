import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import {bakedMujocoRoutes} from '../src/simulation/baked/mujoco-baked-routes.js';
import {makeBakedMujocoModel} from '../src/simulation/baked/mujoco-playback.js';
import {physicsFactories, preferLiveMujoco} from '../src/simulation/model-loader.js';
import {applySourcePresentation} from '../src/simulation/source-presentation.js';
import {bakeConfigs} from '../scripts/lib/mujoco-bake-configs.mjs';
import {BAKE_DEFAULTS, hashFiles, motionSources, physicsFingerprint, repository, seamContinuity, sha256} from '../scripts/lib/mujoco-bake.mjs';

const mujoco = await loadMujoco();
const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url))).movements;
const read = id => {
  const asset = `src/simulation/baked/assets/mujoco-${String(id).padStart(3, '0')}`;
  const bytes = fs.readFileSync(`${repository}/${asset}.json.gz`);
  return {bytes, bundle: JSON.parse(gunzipSync(bytes)), provenance: JSON.parse(fs.readFileSync(`${repository}/${asset}.provenance.json`))};
};

test('smooth baked tracks round-trip within half a quantum and fall back to float32', async () => {
  const {encodeSmoothArray, decodeArray} = await import('../src/simulation/baked/mujoco-bake-format.js');
  const values = Float64Array.from({length: 4 * 500}, (_, i) => Math.sin(.013 * i + i % 4) * .9);
  const encoded = JSON.parse(JSON.stringify(encodeSmoothArray(values, 4, 1e-5)));
  assert.equal(encoded.type, 'd2');
  const decoded = decodeArray(encoded);
  assert.equal(decoded.length, values.length);
  assert(values.every((v, i) => Math.abs(v - decoded[i]) <= 5e-6 + 1e-7));
  // A jump too large for an int16 second difference is stored as float32.
  assert.equal(encodeSmoothArray([0, 0, 0, 0, 0, 0, 5, 5, 5], 3, 1e-5).type, 'f32');
});

test('live MuJoCo stays available behind ?live', () => {
  const saved = globalThis.location;
  try {
    for (const [url, live] of [['http://x/#/movement/99', false], ['http://x/?live#/movement/99', true], ['http://x/#/movement/99?live=1', true],
      ['http://x/#/movement/99?mujoco=live', true], ['http://x/#/movement/99?live=0', false]]) {
      globalThis.location = new URL(url);
      assert.equal(preferLiveMujoco(), live, url);
    }
  } finally {
    if (saved === undefined) delete globalThis.location;else globalThis.location = saved;
  }
  for (const id of Object.keys(bakedMujocoRoutes)) assert(physicsFactories[id], `live factory kept for ${id}`);
});

for (const id of Object.keys(bakedMujocoRoutes).map(Number)) {
  test(`${id} baked loop provenance matches the live simulation sources`, () => {
    const {bytes, bundle, provenance} = read(id), config = {...BAKE_DEFAULTS, ...bakeConfigs[id]};
    assert.equal(provenance.assetSha256, sha256(bytes));
    assert.equal(bundle.format, 'mujoco-loop');assert.equal(bundle.id, id);
    // Motion is stale when the drive, physics or playback stepping change.
    // Visual-only geometry.js edits (supports, brackets) do not invalidate it
    // unless they change the compiled model (checked below).
    assert.deepEqual(provenance.motionSources, hashFiles(motionSources(config.directory)), 'rebake: node scripts/bake-mujoco-movement.mjs ' + id);
    for (const [name, variant] of Object.entries(bundle.variants)) {
      assert(variant.closure.rawSeamPixels <= config.tolerancePixels, `${id} ${name} seam`);
      assert.equal(variant.loop.samples * variant.loop.dt, variant.loop.duration);
      assert(Math.abs(variant.loop.duration / variant.loop.drivePeriod - variant.loop.periods) < 1e-9, 'whole drive periods');
      assert(provenance.variants[name].roundTripPixels <= variant.closure.rawSeamPixels + .1);
    }
  });

  test(`${id} compiled physics is the one that was baked`, () => {
    const {provenance} = read(id), config = bakeConfigs[id];
    return physicsFactories[id]().then(factory => {
      for (const name of Object.keys(provenance.physicsXmlSha256)) {
        const live = factory(mujoco, {...config.options, ...(config.variants?.[name]?.options ?? {})});
        try {assert.equal(physicsFingerprint(live.physics.description.xml), provenance.physicsXmlSha256[name], `rebake ${id}: the compiled joints, contacts or drive changed`);}
        finally {live.dispose();}
      }
    });
  });

  test(`${id} baked loop plays seamlessly on the current geometry and presents like the live model`, async () => {
    const {bundle} = read(id), config = bakeConfigs[id];
    const baked = makeBakedMujocoModel(bundle, await bakedMujocoRoutes[id].geometry(), bakedMujocoRoutes[id]);
    const factory = await physicsFactories[id](), live = factory(mujoco, {...config.options, ...(config.variants?.[config.defaultVariant]?.options ?? {})});
    try {
      const u = baked.root.userData;
      assert.equal(u.simulationBackend, 'baked-mujoco');assert.equal(u.supportsRestart, false);
      for (const name of Object.keys(bundle.variants)) {
        if (u.setConfiguration) u.setConfiguration(name);
        const {duration, samples} = bundle.variants[name].loop;
        // Many loops later the pose is still finite and continuous.
        for (const time of [0, duration / 3, 7 * duration + duration / 5, 1000 * duration]) {
          baked.update(time);baked.root.traverse(o => assert(o.matrixWorld.elements.every(Number.isFinite)));
        }
        const seam = seamContinuity(baked, duration, samples, bakeConfigs[id].seamExclude);
        assert(seam.seamStepPixels <= seam.interiorStepPixels + .05, JSON.stringify(seam));
        assert(seam.seamSecondPixels <= seam.interiorSecondPixels + .05, JSON.stringify(seam));
      }
      if (u.setConfiguration) u.setConfiguration(bundle.defaultVariant);
      const movement = catalog[id - 1];
      applySourcePresentation(baked, movement);applySourcePresentation(live, movement);
      assert.deepEqual(u.sourcePresentation?.removedRoles ?? [], live.root.userData.sourcePresentation?.removedRoles ?? []);
      for (const key of ['cameraFitBounds', 'hideGround', 'reconstructionNote', 'cameraFov']) assert.deepEqual(u[key], live.root.userData[key], key);
      assert.deepEqual(baked.cameraDirection.toArray(), live.cameraDirection.toArray());
      let meshes = [0, 0];
      baked.root.traverse(o => {if (o.isMesh) meshes[0]++;});live.root.traverse(o => {if (o.isMesh) meshes[1]++;});
      assert.equal(meshes[0], meshes[1]);
    } finally {baked.dispose();live.dispose();}
  });
}
