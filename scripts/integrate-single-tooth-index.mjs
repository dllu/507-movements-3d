import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(`${directory}${name}.json`, 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const name of ['event-hardware', 'event-locking', 'event-drive-and-lock-cones', 'trimmed-solids', 'focused-tests']) {
  const result = await json(`068-${name}-exit-status`);
  if (result.code !== 0 || result.signal !== null) throw new Error('Incomplete check: ' + name);
}
const hardware = await json('068-event-hardware'), locking = await json('068-event-locking');
const forces = await json('068-event-drive-and-lock-cones'), solids = await json('068-trimmed-solids');
if (hardware.poses !== 83 || hardware.pairs.length !== 9 || hardware.inside || hardware.checks !== 42701508
  || locking.rows.length !== 20 || locking.issues.length || locking.rows.some(row => row.allowed.inside || !row.blocked.inside)
  || forces.activePoses !== 136 || forces.missingDriveCount || forces.lockingPoses !== 20 || forces.missingLockCount
  || solids.rows.length !== 6 || solids.issues.length || !(await json('068-preintegration-equivalence')).exact) {
  throw new Error('Mechanics acceptance failed');
}
for (const entry of (await json('068-baseline-archives')).entries) {
  if (hash(await readFile(directory + entry.file)) !== entry.sha256) throw new Error('Archive changed: ' + entry.file);
}
let source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
const oldFactory = (await readFile(directory + '068-original-factory.txt', 'utf8')).trim();
const oldTest = (await readFile(directory + '068-original-test.txt', 'utf8')).trim();
let tests = await readFile('tests/models.test.mjs', 'utf8');
if (source.split(oldFactory).length !== 2 || tests.split(oldTest).length !== 2) throw new Error('Original implementation changed');
for (const name of ['driver', 'wheel']) {
  const helper = (await readFile(`${directory}068-original-${name}-helper.txt`, 'utf8')).trim();
  if (!source.includes(helper)) throw new Error('Shared helper changed: ' + name);
}
const previousImport = "import { makeGravityTumbler } from './gravity-tumbler.js';";
const previousCase = 'case 68: return singleToothSelfLockingIndex();';
if (source.split(previousImport).length !== 2 || source.split(previousCase).length !== 2) throw new Error('Unexpected wiring');
source = source.replace(oldFactory, '').replace(previousImport,
  previousImport + "\nimport { makeSingleToothIndex } from './single-tooth-index.js';")
  .replace(previousCase, 'case 68: return makeSingleToothIndex();');
tests = tests.replace(oldTest, `test('movement 68 wires the source-shaped ten-notch locking index', () => {
  const model = createMovementModel(catalog.movements[67]), data = model.root.userData;
  assert.equal(data.mechanism, 'single-tooth-self-locking-index');
  assert.equal(data.geometry.notches, 10);
  assert.equal(Object.keys(data.parts).length, 6);
  assert.equal(data.parts.driverPlate.parent, data.blocks.input);
  assert.equal(data.parts.notchedPlate.parent, data.blocks.output);
  assert.equal(data.hideGround, true);
  assert.ok(data.animationTiming.displayCycleDuration >= 4 - 1e-8);
  for (const time of [0, 0.5241, 0.5347889326, 0.9983981634, 1.0593474076, 1.5]) {
    const a = data.motion.atTime(time), b = data.motion.atTime(time + data.geometry.period);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle - data.geometry.pitch) < 1e-11);
    assert.ok(Math.abs(b.outputSpeed - a.outputSpeed) < 1e-10);
  }
  disposeModel(model.root);
});`);
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
catalog.movements[67].mechanicalNote = 'A shaped tooth advances the ten-notch wheel. The circular rim locks it between steps. The motion assumes a resisting load; engagement impacts are idealized.';
const record = await json('068-reconstruction');
for (const frame of record.baselineCaptures) {
  if (hash(await readFile(directory + frame.file)) !== frame.sha256) throw new Error('Baseline changed: ' + frame.file);
  const original = frame.file.replace('068-phase-', '068-original-phase-');
  await copyFile(directory + frame.file, directory + original, constants.COPYFILE_EXCL);
}
await writeFile(directory + '068-display-profiles-before.json', await readFile('src/data/display-profiles.json'), { flag: 'wx' });
for (const frame of record.baselineCaptures) {
  await unlink(directory + frame.file);
  frame.file = frame.file.replace('068-phase-', '068-original-phase-');
}
record.status = 'integrated-validation-in-progress'; record.productionChanged = true;
record.remaining = ['Run full regression checks, inspect integrated desktop/mobile captures, and record final acceptance.'];
await writeFile('src/simulation/authored-intermittent.js', source);
await writeFile('tests/models.test.mjs', tests);
await writeFile('src/data/movements.json', JSON.stringify(catalog, null, 2) + '\n');
await writeFile(directory + '068-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ integrated: true, baselineFramesPreserved: record.baselineCaptures.length, sharedHelpersPreserved: true });
