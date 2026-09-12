import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-strict-finite-seating.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-guide-poses';
const data = JSON.parse(fs.readFileSync(input)), reports = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const dynamic = data.status === 'finite-spring-dynamics-ran';
if (dynamic) {assert.equal(data.failures.length, 0); for (const source of data.sources) assert.equal(hash(source.file), source.sha256, source.file);}
const sources = [input, 'scripts/check-spring-sector-guide-poses.mjs'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const selections = dynamic ? Array.from({length: 9}, (_, i) => [i, 0]) : [0, 4, 8].flatMap(i => [0, 5, 12].map(j => [i, j]));
for (const [i, j] of selections) {
  let pose;
  if (dynamic) {
    const time = data.rows.at(-1).time - data.parameters.period + i / 8 * data.parameters.period;
    const row = data.rows.reduce((a, b) => Math.abs(a.time - time) < Math.abs(b.time - time) ? a : b);
    pose = {shaftAngle: -data.parameters.amplitude * Math.cos(2 * Math.PI * row.time / data.parameters.period), wheelAngle: row.x[0], lifts: row.x.slice(1)};
  } else {
    const row = data.rows[i * 13 + j]; pose = {shaftAngle: row.shaftAngle, wheelAngle: row.wheelAngle, lifts: row.lifts};
  }
  const output = prefix + '-pose-' + i + '-' + j + '.json', log = output.replace(/\.json$/, '.log');
  const stdout = execFileSync('node', ['scripts/check-spring-sector-candidate.mjs'],
    {env: {...process.env, PROBE_STATE: JSON.stringify(pose), PROBE_OUTPUT: output}, encoding: 'utf8'});
  fs.writeFileSync(log, stdout, {flag: 'wx'});
  const report = JSON.parse(fs.readFileSync(output));
  reports.push({file: output, sha256: hash(output), pose, parts: report.topology.length, pairs: report.pairs.length,
    topologyPassed: report.topologyPassed, checks: report.checks, intrusions: report.intrusions, maximumDepth: report.maximumDepth});
  console.log(reports.at(-1));
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'guided-candidate-geometry-poses', productionChanged: false, mechanicsPassed: false,
  passed: reports.every(r => r.topologyPassed && r.intrusions === 0), reports, sources,
  totalChecks: reports.reduce((sum, r) => sum + r.checks, 0), intrusions: reports.reduce((sum, r) => sum + r.intrusions, 0),
  dynamic, qualification: 'Nine supplied geometry poses, either independently seated or sampled from the last complete saved dynamics cycle. Complete distinct-family sampled surfaces and mesh topology are checked at each pose, including four deforming springs. This is not continuous clearance, spring self-contact or a force qualification.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
assert(report.passed, 'Guided pose screen failed');
