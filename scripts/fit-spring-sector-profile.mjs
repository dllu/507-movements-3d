import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const input = 'artifacts/review/083-corrected-tooth-measurements.json';
const data = JSON.parse(fs.readFileSync(input));
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-counted-uniform-profile';
// Inspection of the enlarged central overlap gives four intervening sector
// tips, hence 12 across the arc. A nearest-pitch fit to only the eight clear
// tips aliases this gap and inserts an extra tooth at 63 divisions.
const divisions = 57, pitch = 360 / divisions, firstTipIndex = -19, lastTipIndex = -8;
const visibleTipOrdinals = [0, 1, 2, 7, 8, 9, 10, 11];
const indexedFits = Array.from({length: 25}, (_, i) => 48 + i).map(divisions => {
  const pitch = 360 / divisions;
  const firstDegrees = data.peaks.reduce((sum, p, i) => sum + p.degrees - visibleTipOrdinals[i] * pitch, 0) / data.peaks.length;
  const residuals = data.peaks.map((p, i) => 2 * p.radius * Math.sin((p.degrees - firstDegrees - visibleTipOrdinals[i] * pitch) * Math.PI / 360));
  return {divisions, firstDegrees, residuals, rmsPixels: Math.hypot(...residuals) / Math.sqrt(residuals.length)};
}).sort((a, b) => a.rmsPixels - b.rmsPixels);
assert.equal(indexedFits[0].divisions, divisions);
const samples = data.samples.filter(s => !s.masked && s.radius !== null && s.degrees >= -121.8 && s.degrees <= -53.4);
const radiusAt = (degrees, p) => {
  const [tip, root, fraction, phase] = p, t = ((degrees - phase) % pitch + pitch) % pitch;
  const short = t <= fraction * pitch, a = short ? 0 : fraction * pitch, b = short ? fraction * pitch : pitch;
  const ra = short ? tip : root, rb = short ? root : tip, radians = Math.PI / 180;
  return ra * rb * Math.sin((b - a) * radians)
    / (rb * Math.sin((b - t) * radians) + ra * Math.sin((t - a) * radians));
};
const cost = p => p[0] <= p[1] || p[2] <= .03 || p[2] >= .65 ? Infinity
  : samples.reduce((sum, s) => sum + (radiusAt(s.degrees, p) - s.radius) ** 2, 0) / samples.length;
let parameters = [510, 486, .22, -2.09], value = cost(parameters);
for (let step = 1; step >= 1e-5; step /= 2) {
  let moved;
  do {
    moved = false;
    for (let i = 0; i < 4; i++) for (const sign of [-1, 1]) {
      const proposal = [...parameters]; proposal[i] += sign * step * [4, 4, .025, .3][i];
      const next = cost(proposal);
      if (next < value) {parameters = proposal; value = next; moved = true;}
    }
  } while (moved);
}
const [tipRadiusPixels, rootRadiusPixels, shortFaceFraction, phaseDegrees] = parameters;
const point = (radius, degrees) => [data.center[0] + radius * Math.cos(degrees * Math.PI / 180),
  data.center[1] - radius * Math.sin(degrees * Math.PI / 180)];
const outline = [point(rootRadiusPixels, phaseDegrees + (firstTipIndex - 1 + shortFaceFraction) * pitch)];
for (let i = firstTipIndex; i <= lastTipIndex; i++) {
  outline.push(point(tipRadiusPixels, phaseDegrees + i * pitch));
  if (i < lastTipIndex) outline.push(point(rootRadiusPixels, phaseDegrees + (i + shortFaceFraction) * pitch));
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1250"><polyline points="${outline.map(p => p.join(',')).join(' ')}" fill="none" stroke="#ff00ff" stroke-width="2"/></svg>`;
fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
for (const path of [prefix + '.png', prefix + '-marks.png']) assert(!fs.existsSync(path));
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', ['artifacts/reference/brown-083-detail.png', prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const sources = [input, 'scripts/fit-spring-sector-profile.mjs', 'artifacts/reference/brown-083-detail.png'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'provisional-uniform-sector-profile', productionChanged: false, inspected: false,
  adopted: false, mechanicsPassed: false, divisions, pitchDegrees: pitch, tipRadiusPixels, rootRadiusPixels,
  shortFaceFraction, phaseDegrees, tipIndices: [firstTipIndex, lastTipIndex], visibleTipOrdinals, indexedFits, outline, sampleCount: samples.length,
  radialRmsPixels: Math.sqrt(value), maximumRadialResidualPixels: Math.max(...samples.map(s => Math.abs(radiusAt(s.degrees, parameters) - s.radius))),
  sources, image: {file: prefix + '.png', sha256: hash(prefix + '.png')},
  qualification: 'Local least-squares fit of a uniform, straight-flanked asymmetric profile to inspected visible radial strokes. Central overlap is excluded from radial fitting, but its four intervening tips establish correspondence for the 12-tooth arc. 57 full-circle divisions is a provisional reconstruction choice, not a specified manufacturing dimension. The earlier 63-division fit inserted an extra central tooth and is rejected. No crown tooth count, contact conjugacy, clearance or dynamics is established.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({parameters, samples: samples.length, radialRmsPixels: report.radialRmsPixels, maximumRadialResidualPixels: report.maximumRadialResidualPixels});
