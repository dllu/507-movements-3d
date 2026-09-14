import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {doubleRackStudySources} from './lib/double-rack-study-sources.mjs';
import {freezeStudySources, verifyStudySources, hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/114-integrated-final-review';
const read = name => JSON.parse(fs.readFileSync('/dev/shm/114-' + name + '.json'));
const files = doubleRackStudySources('scripts/freeze-double-rack-review.mjs').concat([
  'src/simulation/model-loader.js', 'src/simulation/engine.js', 'src/data/movements.json',
  'docs/mujoco-114-double-rack.md', 'docs/review-progress.md',
  'tests/mujoco-double-rack.test.mjs', 'tests/mujoco-runtime.test.mjs',
  'tests/engine.test.mjs', 'tests/e2e/mujoco.spec.mjs', 'tests/helpers/solid-surface.mjs',
  'scripts/lib/weighted-clutch-solid-audit.mjs', 'scripts/lib/source-circle-fit.mjs',
  ...fs.readdirSync('scripts').filter(n => n.includes('double-rack') && n.endsWith('.mjs')).map(n => 'scripts/' + n),
]);
assert(!fs.readFileSync('docs/mujoco-114-double-rack.md', 'utf8').includes('when that run finishes'), 'Review notes still contain a pending result');
const sources = freezeStudySources(files, prefix);
const names = ['source-a', 'source-b', 'fit-a', 'comparison-a', 'comparison-b',
  'baseline-a', 'baseline-a-inspection', 'candidate-h', 'candidate-h-inspection',
  ...Array.from({length: 26}, (_, i) => 'dynamics-' + String.fromCharCode(97 + i)),
  'clearances-b', 'clearances-c', 'integrated-a', 'integrated-a-inspection'];
const evidence = names.map(name => {
  const file = '/dev/shm/114-' + name + '.json', report = read(name), differences = [];
  for (const s of report.sources ?? []) {
    if (s.archive) assert.equal(hashStudyFile(s.archive), s.sha256, s.archive);
    if (hashStudyFile(s.file) !== s.sha256) differences.push(s.file);
  }
  return {file, sha256: hashStudyFile(file), historicalSourceDifferences: differences};
});
const capture = read('integrated-a'), inspection = read('integrated-a-inspection');
verifyStudySources(capture.sources);
assert.equal(capture.integrated, true); assert.equal(capture.views.length, 12);
assert.deepEqual(capture.errors, []);
for (const view of capture.views) {
  assert.equal(hashStudyFile(view.file), view.sha256);
  assert(inspection.views.some(v => v.file === view.file && v.sha256 === view.sha256 && v.inspected));
  evidence.push({file: view.file, sha256: view.sha256});
}
const audit = read('clearances-c'), dynamics = read('dynamics-t');
assert.equal(audit.rows.length, 28); assert(audit.rows.every(r => r.issues.length === 0));
assert.equal(audit.maximumUnintendedPenetrationPixels, 0);
assert.equal(dynamics.duration, 80); assert(dynamics.maximumInputErrorRadians < .01);
assert(dynamics.maximumPenetrationPixels < .1);
for (const name of ['tests-b-log.txt', 'integrated-build-a-log.txt', 'integrated-browser-log.txt']) {
  const file = '/dev/shm/114-' + name, text = fs.readFileSync(file, 'utf8');
  if (name.startsWith('tests')) assert(text.includes('# pass 13') && text.includes('# fail 0'));
  if (name.includes('build')) assert(text.includes('built in'));
  if (name.includes('browser')) assert(/30 passed/.test(text));
  evidence.push({file, sha256: hashStudyFile(file)});
}
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = dir + '/' + entry.name;
    return entry.isDirectory() ? walk(file) : [{file, bytes: fs.statSync(file).size, sha256: hashStudyFile(file)}];
  });
}
const build = walk('/dev/shm/114-integrated-build-a');
const report = {sources, evidence, build,
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  qualification: '114 is verified for the documented frictionless reconstruction. Nonzero tooth friction failed qualification. Historical sources remain archived and all differences are explicit. This does not complete the all-507 review.'};
verifyStudySources(sources);
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({sources: sources.length, evidence: evidence.length, buildFiles: build.length});
