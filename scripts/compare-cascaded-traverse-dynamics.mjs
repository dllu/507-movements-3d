import fs from 'node:fs';
import assert from 'node:assert/strict';
import {freezeStudySources, verifyStudySources, hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/125-refinement';
const baseFile = process.env.BASELINE_REPORT;
const trialFiles = JSON.parse(process.env.TRIAL_REPORTS ?? '[]');
assert(baseFile && trialFiles.length, 'Set BASELINE_REPORT and TRIAL_REPORTS');
const sources = freezeStudySources([
  'scripts/compare-cascaded-traverse-dynamics.mjs', 'scripts/lib/study-report-io.mjs',
  baseFile, ...trialFiles,
], prefix);
function read(file) {
  const report = JSON.parse(fs.readFileSync(file));
  assert.equal(report.timeResets, 0);
  assert.equal(report.maximumPassiveActuation, 0);
  for (const s of report.sources) assert.equal(hashStudyFile(s.archive ?? s.file), s.sha256);
  assert(report.rows.length > 1);
  for (let i = 1; i < report.rows.length; i++) assert(report.rows[i].time > report.rows[i - 1].time);
  return report;
}
const base = read(baseFile), comparisons = [];
for (const file of trialFiles) {
  const trial = read(file), stats = Object.fromEntries(['slider', 'lowerSlide'].map(name => [name, {
    maximumDifferencePixels: 0, squaredDifferencePixels: 0,
    baselineRange: [Infinity, -Infinity], trialRange: [Infinity, -Infinity],
  }]));
  let j = 0, samples = 0, firstTime, lastTime;
  for (const row of trial.rows) {
    if (row.time < base.rows[0].time || row.time > base.rows.at(-1).time) continue;
    while (j + 1 < base.rows.length - 1 && base.rows[j + 1].time < row.time) j++;
    const a = base.rows[j], b = base.rows[j + 1], fraction = (row.time - a.time) / (b.time - a.time);
    assert(fraction >= 0 && fraction <= 1);
    firstTime ??= row.time; lastTime = row.time; samples++;
    for (const [name, stat] of Object.entries(stats)) {
      const x = a.qpos[name] + fraction * (b.qpos[name] - a.qpos[name]), y = row.qpos[name];
      const difference = 100 * Math.abs(x - y);
      assert(Number.isFinite(difference));
      stat.maximumDifferencePixels = Math.max(stat.maximumDifferencePixels, difference);
      stat.squaredDifferencePixels += difference ** 2;
      for (const [range, value] of [[stat.baselineRange, x], [stat.trialRange, y]]) {
        range[0] = Math.min(range[0], value); range[1] = Math.max(range[1], value);
      }
    }
  }
  assert(samples > 1);
  for (const stat of Object.values(stats)) {
    stat.rmsDifferencePixels = Math.sqrt(stat.squaredDifferencePixels / samples);
    delete stat.squaredDifferencePixels;
    stat.spanDifferencePixels = 100 * Math.abs((stat.trialRange[1] - stat.trialRange[0]) - (stat.baselineRange[1] - stat.baselineRange[0]));
  }
  comparisons.push({file, options: trial.options, samples, firstTime, lastTime, stats});
}
verifyStudySources(sources);
const report = {sources, baseFile, comparisons, qualification: 'Same-time position comparison. Baseline 10 ms snapshots are linearly interpolated onto trial times; ranges use only that common sampled window. This does not establish continuous clearance, velocity or force convergence.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(comparisons, null, 2));
