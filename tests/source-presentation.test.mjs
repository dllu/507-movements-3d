import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sourcePresentation from '../src/data/source-presentation.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('source presentation entries are valid and every removal pattern matches a part', () => {
  for (const [key, entry] of Object.entries(sourcePresentation)) {
    const id = Number(key);
    assert.ok(Number.isInteger(id) && id >= 1 && id <= 507, `${key} is a movement number`);
    assert.ok(entry.note?.trim(), `${id} records what the engraving shows`);
    for (const vector of [entry.rotate, entry.scale, entry.camera].filter(Boolean)) {
      assert.equal(vector.length, 3);
      assert.ok(vector.every(Number.isFinite));
    }
    const model = createMovementModel(catalog.movements[id - 1]);
    const applied = model.root.userData.sourcePresentation;
    for (const pattern of entry.remove ?? []) {
      const regex = new RegExp(`^(?:${pattern})$`);
      assert.ok(applied.removedRoles.some((role) => regex.test(role)), `${id}: ${pattern} removes a part`);
      model.root.traverse((object) => {
        assert.ok(!regex.test(object.userData.role ?? ''), `${id}: ${object.userData.role} was removed`);
      });
    }
    if (entry.camera) assert.deepEqual(model.cameraDirection.toArray(), entry.camera);
    model.root.traverse((object) => {
      if (object.isMesh) assert.ok(object.geometry.attributes.position.count > 0, `${id}: kept geometry intact`);
    });
  }
});
