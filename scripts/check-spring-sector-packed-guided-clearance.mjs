import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readStudyReport, freezeStudySources} from './lib/study-report-io.mjs';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorGuidedCandidate} from './lib/spring-sector-guided-candidate.mjs';

const baselineFile = process.env.PROBE_BASE_CLEARANCE ?? 'artifacts/review/083-complete-candidate-clearance.json';
const guideFile = 'artifacts/review/083-final-circular-guide-fit.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-guided-complete-clearance';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = readStudyReport;
const baseline = read(baselineFile), guide = read(guideFile);
const checked = new Set();
function verify(file) {
  if (checked.has(file)) return; checked.add(file);
  const report = read(file);
  for (const s of report.sources ?? []) {
    assert.equal(hash(s.file), s.sha256, s.file);
    if (s.archive) assert.equal(hash(s.archive), s.sha256, s.archive);
    if (s.file.endsWith('.json') || s.file.endsWith('.json.gz')) verify(s.file);
  }
}
verify(baselineFile); verify(guideFile);
assert(baseline.passed && guide.passed && baseline.springSelfClearance);
const originalHardwareFile = baseline.sources.find(s => s.file.endsWith('083-hardware-verified-travel-bounds.json')).file;
const originalHardware = read(originalHardwareFile), hardware = guide.hardware;
assert.deepEqual(hardware.domain, originalHardware.domain);
assert.deepEqual(hardware.primaryPairs, originalHardware.primaryPairs);
const old = makeSpringSectorCandidate(), model = makeSpringSectorGuidedCandidate(), u = model.root.userData;
assert.equal(model.setState.toString(), old.setState.toString());
assert.deepEqual(u.geometry, old.root.userData.geometry);
for (const name of [...guide.changedMeshes, ...guide.addedMeshes]) assert.equal(u.families[name], 'shaft');
assert(guide.topology.every(t => t.passed));
for (const name of Object.keys(u.parts)) if (u.families[name] !== 'shaft') assert(guide.unchangedMeshes.includes(name));
const names = Object.keys(u.parts), expected = new Set(), key = pair => [...pair].sort().join('/');
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
  if (u.families[names[i]] !== u.families[names[j]]) expected.add(key([names[i], names[j]]));
const actual = [...hardware.pairs.map(p => p.pair), ...hardware.primaryPairs].map(key);
assert.equal(actual.length, new Set(actual).size); assert.deepEqual(new Set(actual), expected);
assert.equal(hardware.primaryPairs.length, baseline.crownPairs + baseline.bodyPlanePairs);
assert.equal(hardware.tolerance, baseline.tolerance);
const files = ['scripts/check-spring-sector-packed-guided-clearance.mjs', baselineFile, guideFile];
const sources = freezeStudySources([...files, 'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 83, status: 'conformal-guide-candidate-complete-clearance', passed: true,
  productionChanged: false, mechanicsPassed: false, candidateIntegrated: false, tolerance: baseline.tolerance,
  meshes: names.length, distinctFamilyPairs: expected.size, secondaryPairs: hardware.pairs.length,
  crownPairs: baseline.crownPairs, bodyPlanePairs: baseline.bodyPlanePairs, springSelfClearance: true,
  states: baseline.states, intervals: baseline.intervals, duration: baseline.duration, dt: baseline.dt,
  minimumPrimaryGap: baseline.primaryMinimumGap, minimumHardwareMargin: hardware.minimumMargin,
  guideWrenchRank: guide.wrenchSpan.rank, transferredMeshes: guide.unchangedMeshes, sources,
  qualification: 'Only prescribed shaft hardware changes. Identical free meshes, masses, spring recipes and state-update code preserve the existing primary and coil certificates. Fresh hardware bounds and exhaustive pair accounting cover every new or changed pair over the same domain. Conformal surface normals span the ideal prismatic-guide reactions. This does not establish motion convergence, periodic playback, bearing stresses or final app integration.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, transferredMeshes: undefined, sources: undefined});
