import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetInput} from './lib/treadle-ratchet-input.mjs';
import {makeTreadleRatchetPrimaryBounds} from './lib/treadle-ratchet-primary-bounds.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-sixteenth-ms-compressed-trajectory.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-first-primary-continuous-bounds.json';
const data = JSON.parse(fs.readFileSync(input)), candidate = makeTreadleRatchetCandidate(data.geometry);
assert(data.failures.length === 0 && data.rows.length > 1);
const primary = makeTreadleRatchetPrimaryBounds(candidate), kinematics = makeTreadleRatchetInput(candidate.root.userData.linkage);
const files = [input, 'scripts/check-treadle-ratchet-primary-bounds.mjs', 'scripts/lib/treadle-ratchet-primary-bounds.mjs',
  'scripts/lib/treadle-ratchet-input-bounds.mjs', 'scripts/lib/treadle-ratchet-input.mjs',
  'scripts/lib/treadle-ratchet-candidate.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
let maximumAccelerationFraction = 0;
for (let i = 0; i <= 4096; i++) {
  const k = kinematics(i * candidate.root.userData.linkage.parameters.period / 4096);
  k.pawls.forEach((p, j) => {maximumAccelerationFraction = Math.max(maximumAccelerationFraction, Math.abs(p.armAcceleration) / primary.parameters.derivatives[j].acceleration);});
}
assert(maximumAccelerationFraction <= 1 + 1e-8);
console.log({parameters: primary.parameters, maximumAccelerationFraction, intervals: data.rows.length - 1});
const totals = {certifiedPairs: 0, radiallyExcludedPawlCells: 0, boxExcludedPairs: 0, subdivisions: 0, maximumDepth: 0, minimumLowerBound: Infinity};
const failures = []; let intervals = 0;
for (let i = 1; i < data.rows.length; i++) {
  const result = primary.interval(data.rows[i - 1], data.rows[i]); intervals++;
  for (const key of ['certifiedPairs', 'radiallyExcludedPawlCells', 'boxExcludedPairs', 'subdivisions']) totals[key] += result.stats[key];
  totals.maximumDepth = Math.max(totals.maximumDepth, result.stats.maximumDepth);
  totals.minimumLowerBound = Math.min(totals.minimumLowerBound, result.stats.minimumLowerBound);
  failures.push(...result.failures.map(f => ({interval: i - 1, ...f})));
  if (!result.passed) break;
  if (i % 500 === 0) console.log({intervals, time: data.rows[i].time, ...totals});
}
for (const s of sources) assert.equal(hash(s.file), s.sha256, 'Source changed during the bound: ' + s.file);
const report = {movement: 82, passed: failures.length === 0 && intervals === data.rows.length - 1,
  productionChanged: false, mechanicsPassed: false, status: 'continuous-primary-mesh-triangle-bounds',
  tolerance: 1e-6, intervals, totalIntervals: data.rows.length - 1, parameters: primary.parameters,
  sampledAccelerationChecks: 4097, maximumAccelerationFraction, totals, failures, sources, qualification: primary.qualification};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
