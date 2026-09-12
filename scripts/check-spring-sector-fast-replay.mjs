import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-fast-bdf-replay-parity';
const pairs = JSON.parse(process.env.PROBE_PAIRS ?? '[ ["artifacts/review/083-event-bdf-full-one-ms.json", "artifacts/review/083-fast-bdf-replay-one-ms.json"], ["artifacts/review/083-event-bdf-full-half-ms.json", "artifacts/review/083-fast-bdf-replay-half-ms.json"] ]');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const fields = ['movement', 'status', 'parameters', 'rawMass', 'dt', 'duration', 'eventStep', 'minimumStep', 'resumeFile',
  'startIndex', 'startTime', 'failures', 'minimumGap', 'maximumResidual', 'maximumIterations', 'maximumBdfMomentumResidual', 'methods', 'continuousPrimary'];
const runs = [], files = new Set(['scripts/check-spring-sector-fast-replay.mjs']);
for (const [referenceFile, fastFile] of pairs) {
  const reference = read(referenceFile), fast = read(fastFile);
  for (const d of [reference, fast]) {
    assert.equal(d.failures.length, 0);
    for (const s of d.sources) {
      assert.equal(hash(s.file), s.sha256, s.file);
      if (s.archive) assert.equal(hash(s.archive), s.sha256, s.archive);
      files.add(s.file);
    }
  }
  files.add(referenceFile); files.add(fastFile);
  for (const key of fields) assert.deepEqual(fast[key], reference[key], fastFile + ': ' + key);
  for (const key of ['rows', 'rejectedSteps']) {
    assert.equal(fast[key].length, reference[key].length, key);
    for (let i = 0; i < fast[key].length; i++) assert.deepEqual(fast[key][i], reference[key][i], fastFile + ': ' + key + '[' + i + ']');
  }
  runs.push({referenceFile, fastFile, dt: fast.dt, states: fast.rows.length, identicalRejectedTrials: fast.rejectedSteps.length,
    referenceSeconds: reference.seconds, fastSeconds: fast.seconds, observedSpeedRatio: reference.seconds / fast.seconds,
    continuousPrimaryIdentical: true, storedTrajectoryIdentical: true});
}
const sources = [...files].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'complete-stored-dynamics-replay-parity', passed: true, productionChanged: false,
  mechanicsPassed: false, fields, runs, sources,
  qualification: 'Every stored state, impulse, active feature, rejected trial, mass/parameter and continuous-clearance statistic matches the reference. Only implementation/source provenance, description and elapsed time differ. Timing ratios compare separate completed runs under their recorded workloads; they are not controlled benchmarks. This preserves the known failed motion-agreement result and does not qualify a new finer trajectory.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
