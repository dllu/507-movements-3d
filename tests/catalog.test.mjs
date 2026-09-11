import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('catalog contains every movement exactly once in numerical order', () => {
  assert.equal(catalog.movementCount, 507);
  assert.equal(catalog.movements.length, 507);
  assert.deepEqual(catalog.movements.map(({ id }) => id), Array.from({ length: 507 }, (_, index) => index + 1));
  assert.equal(new Set(catalog.movements.map(({ id }) => id)).size, 507);
});

test('every catalog record is complete and locally renderable', () => {
  for (const movement of catalog.movements) {
    assert.equal(movement.number, String(movement.id).padStart(3, '0'));
    assert.ok(movement.title.trim().length >= 2, `movement ${movement.id} has a title`);
    const prefixNumbers = (movement.description.match(/^[^.]+/)?.[0].match(/\d+/g) ?? []).map(Number);
    assert.ok(prefixNumbers.includes(movement.id), `movement ${movement.id} has its numbered description`);
    assert.ok(movement.description.length >= 3, `movement ${movement.id} has a description`);
    assert.ok(movement.category.length >= 3, `movement ${movement.id} has a category`);
    assert.ok(movement.archetype.length >= 3, `movement ${movement.id} has an archetype`);
    assert.match(movement.sourceUrl, /^https:\/\/507movements\.com\/mm_/);
    assert.ok(['authored', 'procedural'].includes(movement.fidelity));
  }
});

test('all movements are marked as individually authored', () => {
  const authored = catalog.movements.filter(({ fidelity }) => fidelity === 'authored');
  assert.deepEqual(authored.map(({ id }) => id), Array.from({ length: 507 }, (_, index) => index + 1));
  assert.equal(new Set(authored.map(({ archetype }) => archetype)).size, 496);
});

test('catalog contains no procedural fallback entries', () => {
  const encountered = new Set(catalog.movements.filter(({ fidelity }) => fidelity === 'procedural').map(({ archetype }) => archetype));
  assert.equal(encountered.size, 0);
});

test('production entry point uses relative portable assets', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="\/assets\//);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
});

test('all 507 source engravings are valid and copied into the portable build', async () => {
  const expectedFiles = Array.from(
    { length: 507 },
    (_, index) => `mm_${String(index + 1).padStart(3, '0')}.png`,
  );
  const publicDirectory = new URL('../public/engravings/', import.meta.url);
  const distributionDirectory = new URL('../dist/engravings/', import.meta.url);
  for (const directory of [publicDirectory, distributionDirectory]) {
    const files = (await readdir(directory))
      .filter((file) => file.endsWith('.png'))
      .sort();
    assert.deepEqual(files, expectedFiles);
  }

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const file of expectedFiles) {
    const publicImage = await readFile(new URL(file, publicDirectory));
    const distributionImage = await readFile(new URL(file, distributionDirectory));
    assert.equal(publicImage.subarray(0, 8).compare(pngSignature), 0,
      `${file} has a PNG signature`);
    assert.equal(publicImage.subarray(12, 16).toString('ascii'), 'IHDR',
      `${file} begins with an IHDR chunk`);
    assert.ok(publicImage.readUInt32BE(16) >= 100, `${file} has useful width`);
    assert.ok(publicImage.readUInt32BE(20) >= 100, `${file} has useful height`);
    assert.equal(distributionImage.compare(publicImage), 0,
      `${file} is copied byte-for-byte into dist`);
  }
});
