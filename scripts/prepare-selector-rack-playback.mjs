import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = 'artifacts/review/084-planar-eighth-ms-pulses.json.gz', prefix = 'artifacts/review/084-compressed-playback';
const data = readStudyReport(input); verifyStudySources(data.sources); assert.equal(data.failures.length, 0);
const pixelTolerance = .00001, maximumInterval = .02, scale = 240, rows = data.rows, radius = data.vertexRadius;
const keep = new Set([0, rows.length - 1]); let previous = 0;
for (let i = 1; i < rows.length; i++) if (rows[i].time - rows[previous].time >= maximumInterval) {keep.add(i); previous = i;}
const starting = [...keep].sort((a, b) => a - b), stack = starting.slice(1).map((b, i) => [starting[i], b]);
const errorAt = (a, b, r) => {
  const f = (r.time - a.time) / (b.time - a.time), delta = r.x.map((v, k) => v - a.x[k] - f * (b.x[k] - a.x[k]));
  return scale * (Math.hypot(delta[0], delta[1]) + radius * Math.abs(delta[2]));
};
while (stack.length) {
  const [a, b] = stack.pop(); let largest = 0, worst = -1;
  for (let i = a + 1; i < b; i++) {const error = errorAt(rows[a], rows[b], rows[i]); if (error > largest) {largest = error; worst = i;}}
  if (largest > pixelTolerance) {keep.add(worst); stack.push([a, worst], [worst, b]);}
}
const indices = [...keep].sort((a, b) => a - b); let maximumPixels = 0, segment = 0;
for (const r of rows) {
  while (segment < indices.length - 2 && rows[indices[segment + 1]].time < r.time) segment++;
  maximumPixels = Math.max(maximumPixels, errorAt(rows[indices[segment]], rows[indices[segment + 1]], r));
}
assert(maximumPixels <= pixelTolerance);
const sources = freezeStudySources([input, 'scripts/prepare-selector-rack-playback.mjs', ...data.sources.map(s => s.file)], prefix);
const output = prefix + '-data.json', compressed = {movement: 84, status: 'compressed-free-rack-playback-study', duration: data.duration,
  parameters: data.parameters, rows: indices.map(i => ({time: rows[i].time, x: rows[i].x})), failures: [], vertexRadius: radius, sources};
fs.writeFileSync(output, JSON.stringify(compressed) + '\n', {flag: 'wx'});
const report = {movement: 84, passed: true, productionChanged: false, mechanicsPassed: false, input, output, pixelTolerance,
  maximumPixels, sourceStates: rows.length, knots: indices.length, bytes: fs.statSync(output).size, sources,
  qualification: 'The translation norm plus maximum frame radius times angular error bounds every frame vertex. Convexity bounds compression over every original linear segment by its endpoints. Exact cam and selector inputs are retained. This does not transfer clearance automatically; the compressed intervals require a new continuous check. Playback will pause the demonstration at 5.5 seconds for explicit replay, rather than reset the rack during motion.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
