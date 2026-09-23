import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import loadMujoco from '@mujoco/mujoco';
import sourcePresentation from '../src/data/source-presentation.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { loadMovementModel, physicsFactories } from '../src/simulation/model-loader.js';
import { applySourcePresentation } from '../src/simulation/source-presentation.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const roleOf = (object) => object.userData.role || object.name || '';

// Baked bundles are fetched beside their modules in the browser.
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (resource, ...rest) => {
  const url = new URL(resource);
  return url.protocol === 'file:' ? new Response(await readFile(url)) : nativeFetch(resource, ...rest);
};

// The production route (live MuJoCo, baked or special factory) is what the
// browser shows; the synchronous registry model serves offline reviews. A
// removal pattern may name a part of either, but no route may keep a part it
// names, and the production route must be presented.
async function presentedRoutes(movement) {
  let production;
  if (physicsFactories[movement.id]) {
    const factory = await physicsFactories[movement.id]();
    production = factory(await loadMujoco());
    applySourcePresentation(production, movement);
  } else {
    production = await loadMovementModel(movement);
  }
  return { production, routes: [production, createMovementModel(movement)] };
}

test('source presentation entries are valid and every removal pattern matches a part', async () => {
  for (const [key, entry] of Object.entries(sourcePresentation)) {
    const id = Number(key);
    assert.ok(Number.isInteger(id) && id >= 1 && id <= 507, `${key} is a movement number`);
    assert.ok(entry.note?.trim(), `${id} records what the engraving shows`);
    for (const vector of [entry.rotate, entry.scale, entry.camera].filter(Boolean)) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite));
    }
    const { production, routes } = await presentedRoutes(catalog.movements[id - 1]);
    try {
      assert.ok(production.root.userData.sourcePresentation, `${id}: production route is presented`);
      if (entry.remove?.length) {
        assert.ok(production.root.userData.sourcePresentation.removedRoles.length > 0, `${id}: production route removes parts`);
      }
      for (const pattern of entry.remove ?? []) {
        const regex = new RegExp(`^(?:${pattern})$`);
        assert.ok(routes.some((model) => model.root.userData.sourcePresentation.removedRoles.some((role) => regex.test(role))),
          `${id}: ${pattern} removes a part`);
        for (const model of routes) {
          model.root.traverse((object) => {
            if (regex.test(roleOf(object))) assert.fail(`${id}: ${roleOf(object)} was removed`);
          });
        }
      }
      for (const model of routes) {
        if (entry.camera) assert.deepEqual(model.cameraDirection.toArray(), entry.camera);
        model.root.traverse((object) => {
          if (object.isMesh && !(object.geometry.attributes.position.count > 0)) assert.fail(`${id}: kept geometry intact`);
        });
      }
    } finally {
      for (const model of routes) model.dispose?.();
    }
  }
});
