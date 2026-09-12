import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/082-settling-eighth-ms-dynamics.json","artifacts/review/082-settling-continued-eighth-ms-dynamics.json"]');
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-joined-eighth-ms-settling-view.json';
assert(inputs.length > 0); const chunks = inputs.map(file => JSON.parse(fs.readFileSync(file))), first = chunks[0];
const rows = [];
for (const [index, chunk] of chunks.entries()) {
  assert.equal(chunk.failures.length, 0); assert.deepEqual(chunk.parameters, first.parameters);
  assert.deepEqual(chunk.geometry, first.geometry); assert.equal(chunk.dt, first.dt);
  if (index) for (const key of ['time', 'x', 'v']) assert.deepEqual(chunk.rows[0][key], chunks[index - 1].rows.at(-1)[key]);
  for (const [i, row] of chunk.rows.entries()) {
    if (index && i === 0) continue;
    assert(Number.isFinite(row.time) && row.x.length === 3 && row.v.length === 3 && [...row.x, ...row.v].every(Number.isFinite));
    if (rows.length) assert(row.time > rows.at(-1).time);
    rows.push({time: row.time, x: row.x, v: row.v});
  }
}
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = [...inputs, 'scripts/join-treadle-ratchet-comparison-view.mjs'].map(file => ({file, sha256: hash(file)}));
const report = {movement: 82, status: 'joined-comparison-view', productionChanged: false, mechanicsPassed: false,
  parameters: first.parameters, geometry: first.geometry, dt: first.dt, startTime: rows[0].time,
  duration: rows.at(-1).time - rows[0].time, rows, failures: [], sources, fieldsRetained: ['time', 'x', 'v'],
  qualification: 'Contiguous chunks joined only after exact complete boundary-state agreement. Time, angles and velocities are preserved exactly, with one duplicate seam row removed. Original full reports retain contact/solver diagnostics; this compact projection is for trajectory comparisons only.'};
fs.writeFileSync(output, JSON.stringify(report) + '\n', {flag: 'wx'});
console.log({output, rows: rows.length, start: rows[0].time, end: rows.at(-1).time, bytes: fs.statSync(output).size});
