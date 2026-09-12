import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics} from './lib/spring-sector-dynamics.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-slower-drive-dynamics.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-slower-drive-midpoints';
const fractions = JSON.parse(process.env.PROBE_FRACTIONS ?? '[0.5]');
assert(fractions.length && fractions.every(f => f > 0 && f < 1));
const data = JSON.parse(fs.readFileSync(input)), model = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(model, data.parameters);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(data.failures.length, 0); for (const s of data.sources) assert.equal(hash(s.file), s.sha256, s.file);
const files = [...new Set([input, 'scripts/probe-spring-sector-motion-clearance.mjs', ...data.sources.map(s => s.file)])];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const issues = []; let minimumGap = Infinity, witness, samples = 0, intrusions = 0;
for (let index = 1; index < data.rows.length; index++) {
  const a = data.rows[index - 1], b = data.rows[index];
  for (const fraction of fractions) {
    const time = a.time + fraction * (b.time - a.time), x = a.x.map((v, i) => v + fraction * (b.x[i] - v));
    const q = physics.input(time).q;
    for (let side = 0; side < 2; side++) {
      const seat = physics.contact.seat(q, x[0], side, {lower: -.06, upper: .18}), gap = x[side + 1] - seat.lift;
      samples++;
      const pose = {shaftAngle: q, wheelAngle: x[0], lifts: x.slice(1)};
      if (gap < minimumGap) {minimumGap = gap; witness = {index, fraction, time, side, gap, pose, contact: seat.contact};}
      if (gap < -1e-6) {intrusions++; if (issues.length < 20) issues.push({index, fraction, time, side, gap, pose});}
    }
  }
  if (index % 1000 === 0) console.log({intervals: index, samples, minimumGap, intrusions});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'interior-time-contact-envelope-screen', productionChanged: false, mechanicsPassed: false,
  passed: intrusions === 0, input, intervals: data.rows.length - 1, fractions, samples, minimumGap, intrusions, witness, issues, sources,
  qualification: 'Finite convex-cell seating envelopes sampled strictly between stored states, with linearly interpolated free coordinates and exact prescribed input. This diagnostic can find missed tooth crossings; passing sampled times does not prove continuous clearance. A failing envelope witness still needs independent actual-solid confirmation.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined, issues: issues.slice(0, 3)}); if (!report.passed) process.exitCode = 1;
