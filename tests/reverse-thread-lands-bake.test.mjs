import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {REVERSE_THREAD_LANDS_ASSET, REVERSE_THREAD_LANDS_SOURCES, decodeReverseThreadLands, loadReverseThreadLands} from '../src/simulation/baked/reverse-thread-lands.js';
import {landsFingerprint} from '../scripts/bake-reverse-thread-lands.mjs';
import {makeReverseThreadProfile} from '../src/simulation/mujoco-reverse-thread/profile.js';
import {reverseThreadLands} from '../src/simulation/mujoco-reverse-thread/groove.js';
import {makeReverseThreadGeometry} from '../src/simulation/mujoco-reverse-thread/geometry.js';
import {bakedMujocoRoutes} from '../src/simulation/baked/mujoco-baked-routes.js';

const repository = new URL('../', import.meta.url);
const bundle = JSON.parse(gunzipSync(fs.readFileSync(REVERSE_THREAD_LANDS_ASSET)));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('108 baked groove lands were baked from the current sources', () => {
  assert.deepEqual(Object.keys(bundle.sources).sort(), [...REVERSE_THREAD_LANDS_SOURCES].sort());
  for (const file of REVERSE_THREAD_LANDS_SOURCES) {
    assert.equal(bundle.sources[file], sha256(fs.readFileSync(new URL(file, repository))),
      `${file} changed: rebake with node scripts/bake-reverse-thread-lands.mjs`);
  }
});

test('108 baked groove lands are exactly the live construction', () => {
  const baked = decodeReverseThreadLands(bundle);
  const live = reverseThreadLands(makeReverseThreadProfile());
  assert.equal(baked.index.count, live.geometry.attributes.position.count);
  const fingerprint = landsFingerprint(live.geometry);
  assert.equal(bundle.fingerprint, fingerprint);
  assert.equal(landsFingerprint(baked), fingerprint);
});

test('108 baked route uses the baked lands; the live geometry still builds them with collision cells', async () => {
  const lands = await loadReverseThreadLands();
  assert.ok(lands.userData.bakedReverseThreadLands);
  const started = Date.now();
  const visual = await bakedMujocoRoutes[108].geometry();
  const elapsed = Date.now() - started;
  assert.ok(visual.root.userData.parts.lands.geometry.userData.bakedReverseThreadLands, 'baked lands in playback');
  assert.equal(visual.root.userData.collision.lands, null);
  assert.ok(elapsed < 2000, `baked geometry built in ${elapsed} ms`);
  const live = makeReverseThreadGeometry();
  assert.ok(live.root.userData.collision.lands.length > 100, 'live lands keep their collision cells');
});
