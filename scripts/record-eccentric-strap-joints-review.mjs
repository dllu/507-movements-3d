import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources, verifyStudySources, hashStudyFile, readStudyReport} from './lib/study-report-io.mjs';

const prefix = 'artifacts/review/089-joints-review';
const captures = readStudyReport('artifacts/review/089-joints-corrected.json');
const display = readStudyReport('artifacts/review/089-joints-final-display.json');
verifyStudySources(captures.sources); verifyStudySources(display.sources);
verifyStudySources(readStudyReport('artifacts/review/089-joints-source-measurements.json').sources);
assert(captures.passed && display.passed && captures.runtime.fog === null && captures.runtime.hideGround);
assert(Math.abs(captures.runtime.timing.displayCycleDuration - 4) < 1e-12);
assert(captures.runtime.frames.at(-1).time >= 8);
const assessments = {
  front: 'Full eccentric assembly with connected flange plates and crosshead in its channels; source proportions still differ.',
  'lower-quarter': 'The strap and rod swing as the eccentric moves below the shaft; both wrist and flange stay joined.',
  return: 'Opposite dead center keeps the crosshead within its guides.',
  'upper-quarter': 'The opposite strap swing retains wrist alignment and guide clearance.',
  oblique: 'The flange bolt axis, fork depth and guide channels are visible.',
  rear: 'Rear view shows the second fork cheek and retaining side of the guides.',
  wrist: 'The front cheek, retaining pin head, stem and close-fitting channels are visible. The cheek obscures the inner eye; native-geometry tests check its bore and axial clearance.',
  flange: 'Both plates meet, with two common through-bolts and side-visible heads and nuts.',
  desktop: 'The complete model, engraving and controls are visible in the desktop application.',
  mobile: 'The narrow application layout contains the full model and usable controls.',
};
const inspections = captures.views.map(v => {
  assert(assessments[v.name]); assert.equal(hashStudyFile(v.file), v.sha256);
  return {name: v.name, file: v.file, sha256: v.sha256, inspected: true, assessment: assessments[v.name]};
});
assert.equal(inspections.length, 10);
fs.writeFileSync(prefix + '-inspections.json', JSON.stringify(inspections, null, 2) + '\n', {flag: 'wx'});
for (const [name, input] of [['tests', '/dev/shm/089-joints-final-regression.log'],
  ['build', '/dev/shm/089-joints-final-build.log'], ['browser', '/dev/shm/089-joints-corrected.log']]) {
  fs.copyFileSync(input, prefix + '-' + name + '.log', fs.constants.COPYFILE_EXCL);
}
const tests = fs.readFileSync(prefix + '-tests.log', 'utf8'), build = fs.readFileSync(prefix + '-build.log', 'utf8');
assert(tests.includes('# pass 173') && tests.includes('# fail 0') && tests.includes('# tests 173'));
assert(build.includes('built in'));
const prior = readStudyReport('artifacts/review/088-integrated-source-hashes.json');
const changed = Object.keys(prior).filter(f => hashStudyFile(f) !== prior[f]).sort();
assert.deepEqual(changed, ['src/data/display-profiles.js', 'src/data/display-profiles.json', 'src/simulation/authored-cams.js', 'tests/models.test.mjs']);
const additions = ['src/simulation/eccentric-strap-joints.js', 'tests/eccentric-strap.test.mjs',
  'scripts/capture-eccentric-strap-joints.mjs', 'scripts/measure-eccentric-strap-source.mjs', 'scripts/finalize-eccentric-strap-display.mjs', 'scripts/record-eccentric-strap-joints-review.mjs'];
const hashes = Object.fromEntries([...new Set([...Object.keys(prior), ...additions])].map(f => [f, hashStudyFile(f)]));
fs.writeFileSync('artifacts/review/089-joints-source-hashes.json', JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
const oldDisplay = JSON.parse(execFileSync('git', ['show', '698e59e:src/data/display-profiles.json'], {encoding: 'utf8'}));
const currentDisplay = readStudyReport('src/data/display-profiles.json');
for (const [id, data] of Object.entries(oldDisplay.profiles)) if (id !== '89') assert.deepEqual(currentDisplay.profiles[id], data);
const sources = freezeStudySources([...captures.sources.map(s => s.file), ...display.sources.map(s => s.file), ...additions,
  'tests/models.test.mjs', 'tests/camera-catalog.test.mjs', 'scripts/lib/weighted-clutch-solid-audit.mjs',
  'artifacts/review/089-joints-corrected.json', 'artifacts/review/089-joints-final-display.json',
  'artifacts/review/089-joints-source-measurements.json',
  'artifacts/review/089-joints-source-hashes.json', prefix + '-inspections.json', prefix + '-tests.log', prefix + '-build.log',
  prefix + '-browser.log', 'artifacts/review/089-joints-review-notes.md', 'docs/review-progress.md'], prefix);
verifyStudySources(sources);
const frames = captures.runtime.frames;
const intervals = frames.slice(1).map(f => f.intervalMs).sort((a,b) => a-b);
const updates = frames.map(f => f.updateMs).sort((a,b) => a-b);
const report = {movement: 89, sources, changedExistingInputs: changed, sourceSnapshotInputs: Object.keys(hashes).length,
  integrationChecksPassed: true, mechanicsPassed: false, reconstructionStatus: 'under-review',
  tests: {passed: 173, failed: 0, focusedTests: 6}, inspectedViews: inspections.length,
  browser: {duration: frames.at(-1).time, frames: frames.length, fps: (frames.length - 1) / frames.at(-1).time,
    p95IntervalMs: intervals[Math.floor(intervals.length * .95)], p95UpdateMs: updates[Math.floor(updates.length * .95)],
    displayCycleSeconds: captures.runtime.timing.displayCycleDuration, errors: captures.errors, unexpectedWarnings: captures.unexpectedWarnings},
  sourceMeasurements: readStudyReport('artifacts/review/089-joints-source-measurements.json').measurements,
  otherDisplayProfilesUnchanged: 506,
  qualification: 'Changed flange/wrist/channel joints pass finite-geometry and motion checks. Source proportions and remaining strap/shaft hardware are unresolved; this is not a whole-mechanism qualification.'};
fs.writeFileSync(prefix + '-checkpoint.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({tests: report.tests, sources: sources.length, snapshotInputs: report.sourceSnapshotInputs, browser: report.browser});
