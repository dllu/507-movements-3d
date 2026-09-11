import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(directory + name + '.json', 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const [file, digest] of Object.entries(await json('068-verification-source-hashes'))) {
  if (hash(await readFile(file)) !== digest) throw new Error('Earlier production checkpoint changed: ' + file);
}
for (const name of ['lock-event-hardware', 'lock-event-locking', 'lock-event-contact-cones',
  'balanced-solids-retry1', 'focused-tests-retry1', 'all-readings-source-fit', 'lock-event-candidate-capture']) {
  const exit = await json('069-' + name + '-exit-status');
  if (exit.code !== 0 || exit.signal !== null) throw new Error('Incomplete check: ' + name);
}
const hardware = await json('069-lock-event-hardware'), locking = await json('069-lock-event-locking');
const forces = await json('069-lock-event-contact-cones'), solids = await json('069-balanced-solids-retry1');
const equivalence = await json('069-preintegration-equivalence');
if (hardware.inside || hardware.checks !== 38176776 || hardware.pairs.length !== 9
  || locking.poses !== 60 || locking.issues.length || locking.rows.some(r => r.allowed.inside || !r.blocked.inside)
  || forces.activePoses !== 124 || forces.missingDriveCount || forces.lockingPoses !== 60 || forces.missingLockCount
  || solids.rows.length !== 6 || solids.issues.length || !equivalence.exact
  || !equivalence.rows.every(row => row.priorTopologyGeometryEqual)) throw new Error('Mechanical acceptance failed');
const captures = await json('069-lock-event-candidate-captures');
if (captures.captures.length !== 10) throw new Error('Missing candidate/source views');
for (const frame of captures.captures) {
  if (!frame.inspected || hash(await readFile(frame.file)) !== frame.sha256) throw new Error('Uninspected/changed frame');
}
for (const archive of (await json('069-baseline-archives')).entries) {
  if (hash(await readFile(directory + archive.file)) !== archive.sha256) throw new Error('Archive changed');
}
let source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
let tests = await readFile('tests/models.test.mjs', 'utf8');
const oldFactory = (await readFile(directory + '069-original-factory.txt', 'utf8')).trim();
const oldTest = (await readFile(directory + '069-original-test.txt', 'utf8')).trim();
const previousImport = "import { makeSingleToothIndex } from './single-tooth-index.js';";
const previousCase = 'case 69: return oneToothTwoPitchSelfLockingIndex();';
for (const part of [oldFactory, previousImport, previousCase]) {
  if (source.split(part).length !== 2) throw new Error('Original implementation changed');
}
if (tests.split(oldTest).length !== 2) throw new Error('Original test changed');
source = source.replace(oldFactory, '').replace(previousImport,
  previousImport + "\nimport { makeSmallSingleToothIndex } from './small-single-tooth-index.js';")
  .replace(previousCase, 'case 69: return makeSmallSingleToothIndex();');
tests = tests.replace(oldTest, `test('movement 69 wires the source-shaped thirty-tooth locking drive', () => {
  const model = createMovementModel(catalog.movements[68]), data = model.root.userData;
  assert.equal(data.mechanism, 'small-single-tooth-locking-drive');
  assert.equal(data.geometry.teeth, 30);
  assert.equal(Object.keys(data.parts).length, 6);
  assert.equal(data.parts.driverPlate.parent, data.blocks.input);
  assert.equal(data.parts.wheelPlate.parent, data.blocks.output);
  assert.equal(data.hideGround, true);
  assert.ok(data.animationTiming.displayCycleDuration >= 3 - 1e-8);
  for (const time of [0, 2.66863, 3.1, 3.94335, 4.0232, 4.37113, 5]) {
    const a = data.motion.atTime(time), b = data.motion.atTime(time + data.geometry.period);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle + 2 * data.geometry.pitch) < 1e-11);
  }
  disposeModel(model.root);
});`);
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
catalog.movements[68].mechanicalNote = 'The single tooth advances two of the thirty wheel teeth per turn. The rim locks the wheel between steps. Motion assumes a resisting load and bearing resistance during a brief internal pause; engagement impacts are idealized.';
const record = await json('069-reconstruction');
for (const frame of record.baselineCaptures) {
  if (hash(await readFile(directory + frame.file)) !== frame.sha256) throw new Error('Baseline frame changed');
  await copyFile(directory + frame.file, directory + frame.file.replace('069-phase-', '069-original-phase-'), constants.COPYFILE_EXCL);
}
await writeFile(directory + '069-display-profiles-before.json', await readFile('src/data/display-profiles.json'), { flag: 'wx' });
for (const frame of record.baselineCaptures) {
  await unlink(directory + frame.file); frame.file = frame.file.replace('069-phase-', '069-original-phase-');
}
record.status = 'integrated-validation-in-progress'; record.productionChanged = true;
record.remaining = ['Run full numerical/build/browser verification and inspect integrated source, motion and desktop/mobile views.'];
await writeFile('src/simulation/authored-intermittent.js', source);
await writeFile('tests/models.test.mjs', tests);
await writeFile('src/data/movements.json', JSON.stringify(catalog, null, 2) + '\n');
await writeFile(directory + '069-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ integrated: true, baselineFramesPreserved: record.baselineCaptures.length, previousCheckpointVerified: true });
