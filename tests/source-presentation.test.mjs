import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import loadMujoco from '@mujoco/mujoco';
import sourcePresentation from '../src/data/source-presentation.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { physicsFactories } from '../src/simulation/model-loader.js';
import { applySourcePresentation } from '../src/simulation/source-presentation.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const roleOf = (object) => object.userData.role || object.name || '';

// Movements with a live MuJoCo route are presented on both the production
// physics model and the synchronous registry model; a removal pattern may name
// a part of either, but no route may keep a part it names.
async function presentedRoutes(movement) {
  const routes = [createMovementModel(movement)];
  if (physicsFactories[movement.id]) {
    const factory = await physicsFactories[movement.id]();
    const model = factory(await loadMujoco());
    applySourcePresentation(model, movement);
    routes.push(model);
  }
  return routes;
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
    const routes = await presentedRoutes(catalog.movements[id - 1]);
    try {
      for (const pattern of entry.remove ?? []) {
        const regex = new RegExp(`^(?:${pattern})$`);
        assert.ok(routes.some((model) => model.root.userData.sourcePresentation.removedRoles.some((role) => regex.test(role))),
          `${id}: ${pattern} removes a part`);
        for (const model of routes) {
          model.root.traverse((object) => {
            assert.ok(!regex.test(roleOf(object)), `${id}: ${roleOf(object)} was removed`);
          });
        }
      }
      for (const model of routes) {
        if (entry.camera) assert.deepEqual(model.cameraDirection.toArray(), entry.camera);
        model.root.traverse((object) => {
          if (object.isMesh) assert.ok(object.geometry.attributes.position.count > 0, `${id}: kept geometry intact`);
        });
      }
    } finally {
      for (const model of routes) model.dispose?.();
    }
  }
});
