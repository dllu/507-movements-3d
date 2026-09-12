import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorSweep} from './lib/spring-sector-sweep.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-slower-drive-dynamics.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-continuous-sweep';
const data = JSON.parse(fs.readFileSync(input)), model = makeSpringSectorCandidate(), sweep = makeSpringSectorSweep(model, data.parameters);
const indices = process.env.PROBE_INDICES ? JSON.parse(process.env.PROBE_INDICES) : Array.from({length: data.rows.length - 1}, (_, i) => i + 1);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const s of data.sources) assert.equal(hash(s.file), s.sha256, s.file);
const files = [...new Set([input, 'scripts/check-spring-sector-sweep.mjs', 'scripts/lib/spring-sector-sweep.mjs', ...data.sources.map(s => s.file)])];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const failures = [], totals = {pairs: 0, heightExcluded: 0, boxExcluded: 0, axisCertificates: 0, subdivisions: 0};
let minimumCertifiedGap = Infinity, minimumBodyPlaneGap = Infinity, maximumDepth = 0;
for (const [i, index] of indices.entries()) {
  assert(index >= 1 && index < data.rows.length);
  const result = sweep.checkStep(data.rows[index - 1], data.rows[index]);
  for (const key of Object.keys(totals)) totals[key] += result.stats[key];
  minimumCertifiedGap = Math.min(minimumCertifiedGap, result.stats.minimumCertifiedGap);
  minimumBodyPlaneGap = Math.min(minimumBodyPlaneGap, result.stats.minimumBodyPlaneGap);
  maximumDepth = Math.max(maximumDepth, result.stats.maximumDepth);
  if (!result.passed) failures.push({index, ...result.failure});
  else assert.equal(result.stats.pairs, sweep.cells.reduce((a, b) => a + b, 0) * sweep.teeth);
  if ((i + 1) % 250 === 0) console.log({intervals: i + 1, failures: failures.length, minimumCertifiedGap, ...totals});
}
for (const s of sources) assert.equal(hash(s.file), s.sha256, s.file);
const report = {movement: 83, status: 'continuous-primary-convex-cell-sweep', productionChanged: false, mechanicsPassed: false,
  passed: failures.length === 0, intervals: indices.length,
  completeTrajectory: indices.length === data.rows.length - 1 && indices.every((index, i) => index === i + 1),
  tolerance: sweep.tolerance, roundoff: sweep.roundoff, cells: sweep.cells, teeth: sweep.teeth, totals,
  minimumCertifiedGap, minimumBodyPlaneGap, maximumDepth, failures, sources, qualification: sweep.qualification};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, failures: failures.slice(0, 8), sources: undefined}); if (!report.passed) process.exitCode = 1;
