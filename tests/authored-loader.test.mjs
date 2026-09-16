import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {authoredRoutes} from '../src/simulation/authored-routes.js';
import {loadAuthoredMovement} from '../src/simulation/authored-loader.js';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;

function fingerprint(model) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({timing: model.root.userData.animationTiming, archetype: model.root.userData.archetype, mechanism: model.root.userData.mechanism, camera: model.cameraDirection?.toArray()}));
  for (const fraction of [0, .37]) {
    model.update?.(fraction * model.root.userData.animationTiming.authoredCyclePeriod, 0);
    model.root.updateMatrixWorld(true);
    model.root.traverse(object => {
      hash.update(JSON.stringify({type: object.type, role: object.userData.role, visible: object.visible, matrix: object.matrixWorld.elements}));
      for (const attribute of Object.values(object.geometry?.attributes ?? {})) {
        if (attribute.array) hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
      const index = object.geometry?.index?.array;
      if (index) hash.update(Buffer.from(index.buffer, index.byteOffset, index.byteLength));
    });
  }
  return hash.digest('hex');
}

test('lazy authored routes cover all 507 movements exactly once', () => {
  const ids = authoredRoutes.flatMap(route => route.ids).sort((a, b) => a - b);
  assert.deepEqual(ids, catalog.map(movement => movement.id));
});

test('all lazy routes preserve legacy geometry, sampled transforms and timing', async () => {
  for (const movement of catalog) {
    const reference = createMovementModel(movement);
    let loaded;
    try {
      loaded = await loadAuthoredMovement(movement);
      assert.equal(fingerprint(loaded), fingerprint(reference), `movement ${movement.id}`);
    } finally {
      disposeMovementModel(reference);
      if (loaded) disposeMovementModel(loaded);
    }
  }
});

test('lazy loader rejects out-of-catalog movement IDs', async () => {
  await assert.rejects(loadAuthoredMovement({id: 508}), RangeError);
});
