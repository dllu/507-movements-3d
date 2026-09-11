import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const json = async name => JSON.parse(await readFile(`artifacts/review/${name}.json`, 'utf8'));
for (const name of ['candidate-worm', 'candidate-hardware', 'candidate-solids', 'finite-pin-contact',
  'event-resolved-dynamics', 'worm-envelope-convergence']) {
  const exit = await json(`067-${name}-exit-status`);
  if (exit.code !== 0 || exit.signal !== null) throw new Error('Incomplete check: ' + name);
}
const worm = await json('067-candidate-worm'), hardware = await json('067-candidate-hardware');
if (worm.summary.poses !== 65 || worm.summary.inside || worm.summary.minimumGap <= 1e-6
  || worm.summary.maximumPowerResidual >= 0.02 || worm.summary.minimumOutputTorque <= 0
  || hardware.poses !== 140 || hardware.inside || !(await json('067-preintegration-candidate-equivalence')).exact
  || !(await json('067-finite-pin-contact')).passed || !(await json('067-worm-envelope-convergence')).passed
  || (await json('067-candidate-solids')).issues.length) throw new Error('Mechanics acceptance failed');
for (const [file, hash] of Object.entries(await json('067-candidate-source-hashes'))) {
  if (createHash('sha256').update(await readFile(file)).digest('hex') !== hash) throw new Error('Candidate changed: ' + file);
}
let source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
for (const archive of ['067-original-factory', '067-original-tumbler-helper']) {
  const old = (await readFile(`artifacts/review/${archive}.txt`, 'utf8')).trim();
  if (source.split(old).length !== 2) throw new Error('Original factory/helper changed: ' + archive);
  source = source.replace(old, '');
}
source = source.replace("import { makeGravityJumpWeight } from './gravity-jump-weight.js';",
  "import { makeGravityJumpWeight } from './gravity-jump-weight.js';\nimport { makeGravityTumbler } from './gravity-tumbler.js';")
  .replace('case 67: return wormDrivenGravityTumbler();', 'case 67: return makeGravityTumbler();');
let tests = await readFile('tests/models.test.mjs', 'utf8');
const oldTest = (await readFile('artifacts/review/067-original-test.txt', 'utf8')).trim();
if (tests.split(oldTest).length !== 2) throw new Error('Original test changed');
tests = tests.replace(oldTest, `test('movement 67 wires a source-shaped scalloped gravity tumbler', () => {
  const model = createMovementModel(catalog.movements[66]), data = model.root.userData;
  assert.equal(data.mechanism, 'worm-driven-scalloped-gravity-tumbler');
  assert.equal(data.geometry.wheelTeeth, 24);
  assert.equal(Object.keys(data.parts).length, 10);
  assert.equal(data.parts.tumblerPlate.parent, data.blocks.weight);
  assert.equal(data.parts.drivingPin.parent, data.blocks.input);
  assert.equal(data.hideGround, true);
  assert.ok(data.animationTiming.displayCycleDuration >= 24 - 1e-8);
  for (const time of [0, 0.847, 2.9, 4.9, 8.54, 12]) {
    const a = data.motion.atTime(time), b = data.motion.atTime(time + data.geometry.cycleDuration);
    assert.ok(Math.abs(b.weightAngle - a.weightAngle - 2 * Math.PI) < 1e-11);
    assert.ok(Math.abs(b.weightAngularSpeed - a.weightAngularSpeed) < 1e-11);
    assert.ok(a.lead >= -1e-12 && a.lead < data.geometry.availableLead);
  }
  disposeModel(model.root);
});`);
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
catalog.movements[66].mechanicalNote = 'The worm lifts the scalloped plate through a pin and half-cut sleeve. Gravity lets the plate run ahead and swing before the pin catches it. Bearing resistance and an inelastic catch are idealized.';
const record = await json('067-reconstruction');
for (const frame of record.baselineCaptures) {
  const original = frame.file.replace('067-phase-', '067-original-phase-');
  await rename('artifacts/review/' + frame.file, 'artifacts/review/' + original); frame.file = original;
}
record.status = 'integrated-validation-in-progress'; record.productionChanged = true;
record.remaining = ['Run focused and full regression checks, inspect integrated and desktop/mobile captures, and record final acceptance.'];
await writeFile('src/simulation/authored-intermittent.js', source);
await writeFile('tests/models.test.mjs', tests);
await writeFile('src/data/movements.json', JSON.stringify(catalog, null, 2) + '\n');
await writeFile('artifacts/review/067-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ integrated: true, baselineFramesPreserved: record.baselineCaptures.length });
