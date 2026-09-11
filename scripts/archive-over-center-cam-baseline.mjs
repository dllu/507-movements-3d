import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
const tests = await readFile('tests/models.test.mjs', 'utf8');
const between = (text, start, end) => {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error(`Cannot find archive boundaries for ${start}`);
  return text.slice(first, last).trim() + '\n';
};
const archives = {
  factory: between(source, 'function wormDrivenOverCenterCam()', 'function tappetIndexedStudWheelWithAlternatingStop()'),
  makeOverCenterCam: between(source, 'function makeOverCenterCam(', 'function makeRollerFollower('),
  makeRollerFollower: between(source, 'function makeRollerFollower(', 'function makeNotchedTappetDisk('),
  test: between(tests, "test('movement 64 ", "test('movement 65 "),
};
const checks = [];
for (const [name, contents] of Object.entries(archives)) {
  const file = `artifacts/review/064-original-${name}.txt`;
  try {
    const existing = await readFile(file, 'utf8');
    if (existing !== contents) throw new Error(`Refusing to overwrite a different original archive: ${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(file, contents);
  }
  checks.push({ file, sha256: createHash('sha256').update(contents).digest('hex'), bytes: Buffer.byteLength(contents) });
}
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[63]);
const parameters = { mechanism: model.root.userData.mechanism,
  geometry: model.root.userData.geometry, animationTiming: model.root.userData.animationTiming,
  initialState: model.root.userData.stateAtTime(0), archiveChecks: checks };
await writeFile('artifacts/review/064-baseline-parameters.json', JSON.stringify(parameters, null, 2) + '\n');
console.log(checks);
