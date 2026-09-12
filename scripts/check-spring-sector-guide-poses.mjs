import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-strict-finite-seating.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-guide-poses';
const data = JSON.parse(fs.readFileSync(input)), reports = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = [input, 'scripts/check-spring-sector-guide-poses.mjs'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
for (const i of [0, 4, 8]) for (const j of [0, 5, 12]) {
  const row = data.rows[i * 13 + j], pose = {shaftAngle: row.shaftAngle, wheelAngle: row.wheelAngle, lifts: row.lifts};
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
  qualification: 'Nine independent seated geometry poses including both shaft-angle limits and several wheel phases. Complete distinct-family sampled surfaces and mesh topology are checked at each pose, including four deforming springs. This is not continuous clearance, spring self-contact, a force solution or an animation.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
assert(report.passed, 'Guided pose screen failed');
