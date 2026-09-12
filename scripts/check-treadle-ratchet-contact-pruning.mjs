import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetContact} from './lib/treadle-ratchet-contact.mjs';
const checkpoint = JSON.parse(fs.readFileSync('artifacts/review/082-contact-dynamics-checkpoint.json'));
const previous = checkpoint.sources.find(s => s.file === 'scripts/lib/treadle-ratchet-contact.mjs');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(previous.archive)).digest('hex'), previous.sha256,
  'The archived comparison implementation must match its checkpoint');
const code = fs.readFileSync(previous.archive, 'utf8').replaceAll("'../../src/", "'" + pathToFileURL(process.cwd() + '/src/').href);
const {makeTreadleRatchetContact: oldFactory} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const input = 'artifacts/review/082-source-seat-dynamics.json', data = JSON.parse(fs.readFileSync(input));
const candidate = makeTreadleRatchetCandidate(data.geometry), old = oldFactory(candidate), current = makeTreadleRatchetContact(candidate), cases = [];
for (const r of data.rows) {
  const k = candidate.root.userData.linkage.atTime(r.time);
  for (let i = 0; i < 2; i++) cases.push({key: i ? 'upper' : 'lower', pivot: k.arms[i].pawlPivot, theta: r.x[0], alpha: r.x[i + 1], padding: .003});
}
for (let i = 0; i < 81; i++) {
  const r = data.rows[Math.floor(i * (data.rows.length - 1) / 80)], k = candidate.root.userData.linkage.atTime(r.time);
  for (let j = 0; j < 2; j++) for (const padding of [0, .01]) cases.push({key: j ? 'upper' : 'lower', pivot: k.arms[j].pawlPivot,
    theta: r.x[0] + .001 * Math.sin(i), alpha: r.x[j + 1] + .002 * Math.cos(i + j), padding});
}
const before = performance.now(), baseline = cases.map(c => old.pair(c.key, c.pivot, c.theta, c.alpha, c.padding)), oldMs = performance.now() - before;
const start = performance.now(); let rows = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i], actual = current.pair(c.key, c.pivot, c.theta, c.alpha, c.padding);
  if (JSON.stringify(actual) !== JSON.stringify(baseline[i])) throw Error('Contact changed at case ' + i);
  rows += actual.rows.length;
}
const currentMs = performance.now() - start, hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report = {movement: 82, status: 'contact-pruning-equivalence', passed: true, cases: cases.length, rows, oldMs, currentMs, speedup: oldMs / currentMs, previous,
  current: {file: 'scripts/lib/treadle-ratchet-contact.mjs', sha256: hash('scripts/lib/treadle-ratchet-contact.mjs')}, input: {file: input, sha256: hash(input)},
  qualification: 'Every primary pair at all 6,001 saved poses plus 324 perturbed margin cases has bitwise-identical serialized contact rows and minimum gap. A circumscribed disk gives the analytic conservative pruning bound. Timing is local diagnostic evidence only.'};
fs.writeFileSync(process.env.PROBE_OUTPUT ?? 'artifacts/review/082-contact-pruning-check.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(report);
