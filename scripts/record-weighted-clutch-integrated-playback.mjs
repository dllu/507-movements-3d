import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import profile from '../src/data/weighted-clutch-profile.js';
import {readStudyReport, hashStudyFile, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = 'artifacts/review/087-integrated-playback';
const captureFile = prefix + '-captures.json', captures = readStudyReport(captureFile);
const closureFile = 'artifacts/review/087-periodic-playback-closure.json', closure = readStudyReport(closureFile);
assert(captures.passed && captures.views.length === 13 && closure.passed);
verifyStudySources(captures.sources); verifyStudySources(closure.sources);
assert.deepEqual(profile, readStudyReport('artifacts/review/087-periodic-playback-profile.json'));
const fifth = [];
for (const direction of ['CW', 'CCW']) {
  const file = 'artifacts/review/087-sequence-' + direction + '-segment-3-check.json';
  const freeFile = 'artifacts/review/087-sequence-' + direction + '-segment-3-free-shaft.json';
  const check = readStudyReport(file), free = readStudyReport(freeFile), b = check.branches[0];
  verifyStudySources(check.sources); verifyStudySources(free.sources);
  assert(Math.max(...b.positionDifference) < .002 && b.maximumComplementarity < 1e-8 && b.minimumNativeJawGap > -1e-6);
  assert(check.poses.every(p => !p.issues.length && !p.topologyIssues.length));
  assert(free.passed && free.checks.length && free.checks.every(c => c.maximumAngleError < .001 && c.maximumSpeedError < .001 && c.maximumEnergyError < 1e-8));
  fifth.push({direction, file, sha256: hashStudyFile(file), freeFile, freeSha256: hashStudyFile(freeFile), states: b.states,
    maximumPositionDifference: Math.max(...b.positionDifference), maximumEventDifference: Math.max(...b.eventDifferences.map(e => e.difference))});
}
const searchFile = 'artifacts/review/087-contact-aware-source-fit.json', search = readStudyReport(searchFile);
verifyStudySources(search.sources); assert(search.rows.every(r => !r.feasible));
const assessments = {
  source: 'Complete initial assembly is framed; finite jaw teeth, rod and pins are legible.',
  'source-overlay': 'One source registration retains the overall layout and exposes the documented crank-pin and fulcrum differences; source proportions remain under review.',
  'first-lift': 'Weight rises, rod stays connected and the stud meets the upper bell arm.',
  'first-over-center': 'Weight crosses its pivot, with the shifter and quadrant still separately articulated.',
  'first-neutral-oblique': 'Oblique view exposes the moving clutch and layered shifter; no conspicuous crossing is visible.',
  'first-seat': 'Left jaw seat, fallen weight and rigid connecting rod are visibly coherent.',
  'return-lift': 'The opposite stud approach lifts the weight back toward center.',
  'return-neutral-oblique': 'Return transfer and full background/input wheel are framed in the oblique view.',
  'return-seat': 'The right jaw seat and source-side lever posture return coherently.',
  'loop-before': 'Settled pose immediately before the seam, with the continuous gear phase retained.',
  'loop-after': 'Visually matches the preceding seam capture; no linkage or wheel reset is visible.',
  desktop: 'Actual desktop route frames the complete mechanism alongside the engraving and playback controls.',
  mobile: 'Actual narrow route frames the complete mechanism; playback controls and engraving remain accessible.',
};
const views = captures.views.map(v => {
  assert(assessments[v.name]); assert.equal(hashStudyFile(v.file), v.sha256);
  return {name: v.name, file: v.file, sha256: v.sha256, inspected: true, assessment: assessments[v.name]};
});
fs.writeFileSync(prefix + '-inspections.json', JSON.stringify({capture: {file: captureFile, sha256: hashStudyFile(captureFile)}, views,
  qualification: 'All thirteen images were opened for manual review. Individual stills do not establish continuous clearance.'}, null, 2) + '\n', {flag: 'wx'});
for (const [name, input] of [['tests', '/dev/shm/087-production-final-tests.log'], ['build', '/dev/shm/087-production-build.log'],
  ['browser', '/dev/shm/087-production-browser.log'], ['initial-test-failure', '/dev/shm/087-production-tests-initial.log']]) {
  fs.copyFileSync(input, prefix + '-' + name + '.log', fs.constants.COPYFILE_EXCL);
}
const testLog = fs.readFileSync(prefix + '-tests.log', 'utf8');
assert(testLog.includes('# tests 174') && testLog.includes('# pass 174') && testLog.includes('# fail 0'));
assert(fs.readFileSync(prefix + '-build.log', 'utf8').includes('built in'));
const baselineFile = 'artifacts/review/086-integrated-verified-source-hashes.json', baseline = readStudyReport(baselineFile);
const changed = Object.keys(baseline).filter(file => hashStudyFile(file) !== baseline[file]);
assert.deepEqual(changed.sort(), ['src/data/display-profiles.js', 'src/data/display-profiles.json', 'src/simulation/authored-gears.js', 'tests/models.test.mjs'].sort());
const previousDisplay = JSON.parse(execFileSync('git', ['show', 'c2d620c:src/data/display-profiles.json'], {encoding: 'utf8'}));
const display = readStudyReport('src/data/display-profiles.json');
for (const [id, p] of Object.entries(previousDisplay.profiles)) if (id !== '87') assert.deepEqual(display.profiles[id], p);
const newProduction = ['src/data/weighted-clutch-profile.js', 'src/simulation/weighted-clutch.js', 'src/simulation/weighted-clutch-motion.js',
  ...fs.readdirSync('src/simulation/weighted-clutch').map(f => 'src/simulation/weighted-clutch/' + f), 'tests/weighted-clutch.test.mjs'];
const current = Object.fromEntries([...Object.keys(baseline), ...newProduction].map(file => [file, hashStudyFile(file)]));
fs.writeFileSync('artifacts/review/087-integrated-source-hashes.json', JSON.stringify(current, null, 2) + '\n', {flag: 'wx'});
const scripts = ['scripts/extract-weighted-clutch-periodic-playback.mjs', 'scripts/export-weighted-clutch-playback.mjs',
  'scripts/finalize-weighted-clutch-display.mjs', 'scripts/capture-weighted-clutch-integrated.mjs',
  'scripts/record-weighted-clutch-integrated-playback.mjs', 'scripts/study-weighted-clutch-contact-aware-fit.mjs'];
for (const file of [...scripts, ...newProduction]) execFileSync(process.execPath, ['--check', file]);
const sources = freezeStudySources([...captures.sources.map(s => s.file), ...closure.sources.map(s => s.file), ...scripts, ...newProduction,
  'tests/models.test.mjs', 'tests/camera-catalog.test.mjs', 'artifacts/review/087-production-display.json',
  'artifacts/review/087-integrated-source-hashes.json', baselineFile, captureFile, closureFile, searchFile,
  prefix + '-inspections.json', prefix + '-tests.log', prefix + '-build.log', prefix + '-browser.log',
  'artifacts/review/087-integrated-playback-notes.md', 'docs/review-progress.md'], prefix + '-record');
verifyStudySources(sources);
fs.writeFileSync(prefix + '-checkpoint.json', JSON.stringify({movement: 87, candidateIntegrated: true, productionChanged: true,
  integrationChecksPassed: true, mechanicsPassed: false, reconstructionStatus: 'under-review', sources, fifth,
  closures: closure.closures.map(c => ({direction: c.direction, period: c.period, coordinateDifference: c.coordinateDifference, velocityDifference: c.velocityDifference})),
  reduction: profile.reduction, tests: {passed: 174, failed: 0}, browser: captures.summary, inspectedViews: views.length,
  previousBaseline: baselineFile, changedExistingInputs: changed, otherDisplayProfilesUnchanged: 506,
  qualification: 'Integrated improvement with contact-derived periodic playback. Source-proportion acceptance and continuous whole-solid clearance remain open. Historical evidence keeps its original source archives; this checkpoint does not certify the complete 507-movement collection.'}, null, 2) + '\n', {flag: 'wx'});
console.log({sources: sources.length, tests: 174, views: views.length, baselineInputs: Object.keys(current).length, changed, fifth});
