import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(base + name + '.json', 'utf8'));
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const initial = await json('075-source-initial-review'), hardware = await json('075-working-surface-baseline');
const source = await json('075-reviewed-source-tips'), captures = await json('075-baseline-captures');
const sourceText = await readFile('src/simulation/authored-intermittent.js', 'utf8');
const testText = await readFile('tests/models.test.mjs', 'utf8');
const factory = sourceText.slice(sourceText.indexOf('function reciprocatingRodPawlRatchetIndex()'),
  sourceText.indexOf('function studStruckJointedTappetCounter()')).trim();
const testStart = testText.indexOf("test('movement 75 ");
const oldTest = testText.slice(testStart, testText.indexOf('\ntest(', testStart + 1)).trim();
if (factory !== (await readFile(base + '075-original-factory.txt', 'utf8')).trim()
  || oldTest !== (await readFile(base + '075-original-test.txt', 'utf8')).trim()) throw new Error('Baseline changed');
const views = [...initial.views, ...captures.captures];
for (const file of ['075-source-readings-linked.png', '075-refined-source-tips.png', '075-reviewed-source-tips.png']) {
  views.push({ file: base + file, sha256: await hash(base + file), inspected: true });
}
for (const frame of views) {
  if (!frame.inspected || await hash(frame.file) !== frame.sha256) throw new Error('Uninspected source or baseline frame');
}
const reports = {};
for (const name of ['source-initial-review', 'working-surface-baseline', 'central-bore-diagnostic',
  'source-geometry-study', 'refined-source-tips', 'reviewed-source-tips', 'source-gravity-diagnostic', 'baseline-captures']) {
  const file = base + '075-' + name + '.json'; reports[file] = await hash(file);
}
const exits = {};
for (const name of ['working-surface-baseline', 'source-geometry-study', 'baseline-capture']) {
  const r = await json('075-' + name + '-exit-status');
  if (r.code !== 0 || r.signal !== null) throw new Error('Baseline diagnostic did not finish: ' + name);
  exits[name] = r;
}
const archives = [];
for (const file of ['scripts/probe-reciprocating-pawl-baseline.mjs', 'scripts/study-reciprocating-pawl-source.mjs',
  'scripts/capture-reciprocating-pawl-baseline.mjs', 'scripts/record-reciprocating-pawl-baseline.mjs']) {
  const archive = base + '075-baseline-source-' + archives.length + '.txt';
  await writeFile(archive, await readFile(file), { flag: 'wx' });
  archives.push({ file, archive, sha256: await hash(file) });
}
const report = { movement: 75, status: 'reconstruction-required', productionChanged: false,
  source: initial.source, baseline: initial.baseline, views, reports, archives, exits,
  hardware: { poses: hardware.poses, checks: hardware.checks, inside: hardware.inside,
    independentChecks: hardware.independentChecks, independentInside: hardware.independentInside,
    failingPairs: hardware.pairs.filter(pair => pair.inside) },
  sourceMeasurements: { wheelFace: { center: source.wheelFace.center, radius: source.wheelFace.radius,
    rms: source.wheelFace.rmsResidual }, hub: { center: source.hub.center, radius: source.hub.radius,
    rms: source.hub.rmsResidual }, toothCount: source.toothCount },
  diagnosis: [
    'The upper-right fixed holding pawl is absent; the existing test incorrectly forbids it.',
    'The rod pin passes through the solid bar beneath a painted slot.',
    'The ratchet circular bore degenerates to two XY points, leaving the axle inside wheel material.',
    'The carrier-hub bevel shrinks its bore below the axle radius.',
    'The large counterweight and support frame do not match the enlarged source.',
  ],
  preservedFailures: [
    { report: '075-source-readings.png', reason: 'The SVG renderer omitted an image using href; explicit XLink embeds the source correctly.' },
    { report: '075-source-geometry-study.json', reason: 'One tip mark was hidden by C and several marks missed the ink. Those readings are not accepted geometry.' },
    { report: '075-refined-source-tips.json', reason: 'Automatic radial refinement selected adjacent pawl ink at three locations; the inspected manual correction is preserved separately.' },
  ],
  remaining: ['Fit a source-like ratchet, bar and two pawls, retaining uncertainty in the full tooth count.',
    'Design an actual sliding rod/bar joint and clear, finite central and pawl bearings.',
    'Solve drive, return and holding contact with justified closing forces; verify complete 3D hardware.',
    'Integrate only after source comparison, contact checks and rendered review; then run regression.'] };
await writeFile(base + '075-reconstruction.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ status: report.status, frames: views.length, poses: hardware.poses, checks: hardware.checks, inside: hardware.inside });
