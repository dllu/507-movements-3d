import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const input = 'artifacts/review/083-first-source-measurements.json';
const measurements = JSON.parse(fs.readFileSync(input));
const file = 'artifacts/reference/brown-083-detail.png', width = 1120, height = 1250;
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-corrected-tooth-measurements';
const center = measurements.circles.rockshaftEyeOuter.center;
const bytes = execFileSync('convert', [file, '-colorspace', 'Gray', '-depth', '8', 'gray:-'], {maxBuffer: width * height + 1000});
assert.equal(bytes.length, width * height);
const pixel = (x, y) => bytes[Math.round(y) * width + Math.round(x)];
const samples = [];
for (let i = 0; i <= 760; i++) {
  const degrees = -127 + i / 10, angle = degrees * Math.PI / 180, runs = []; let current = [];
  for (let radius = 460; radius <= 550; radius += .25) {
    if (pixel(center[0] + radius * Math.cos(angle), center[1] - radius * Math.sin(angle)) < 65) current.push(radius);
    else if (current.length) {runs.push(current); current = [];}
  }
  if (current.length) runs.push(current);
  // The first overlay exposes wheel ink at -108 degrees, beyond the third
  // sector tip. Exclude that overlap before peak selection so it cannot
  // suppress the real neighbouring tip during the minimum-spacing filter.
  const first = runs[0], masked = degrees > -108.2 && degrees < -79;
  const bounded = first && first[0] > 460 && first.at(-1) < 550
    && first.at(-1) - first[0] >= 2 && first.at(-1) - first[0] <= 20;
  const radius = bounded ? (first[0] + first.at(-1)) / 2 : null;
  samples.push({degrees, radius, masked, stroke: first ? [first[0], first.at(-1)] : null,
    point: radius === null ? null : [center[0] + radius * Math.cos(angle), center[1] - radius * Math.sin(angle)]});
}
const peaks = [];
for (let i = 1; i < samples.length - 1; i++) {
  const s = samples[i]; if (s.masked || s.radius === null || s.radius < 500) continue;
  const neighbours = samples.slice(Math.max(0, i - 10), i + 11).filter(s => s.radius !== null && !s.masked);
  if (!neighbours.every(n => n.radius <= s.radius)) continue;
  if (peaks.length && s.degrees - peaks.at(-1).degrees < 3.5) {
    if (s.radius <= peaks.at(-1).radius) continue; peaks.pop();
  }
  peaks.push(s);
}
assert(peaks.length >= 5, 'Need at least five separated visible tip candidates');
const fits = Array.from({length: 25}, (_, i) => 48 + i).map(divisions => {
  const angles = peaks.map(p => p.degrees * Math.PI / 180), pitch = 2 * Math.PI / divisions;
  const phase = Math.atan2(angles.reduce((s, a) => s + Math.sin(divisions * a), 0),
    angles.reduce((s, a) => s + Math.cos(divisions * a), 0)) / divisions;
  const residuals = angles.map((a, i) => 2 * peaks[i].radius * Math.sin((a - phase - Math.round((a - phase) / pitch) * pitch) / 2));
  return {divisions, pitchDegrees: 360 / divisions, phaseDegrees: phase * 180 / Math.PI,
    rmsPixels: Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / residuals.length), residuals};
}).sort((a, b) => a.rmsPixels - b.rmsPixels);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
for (const s of samples) if (s.point) svg += `<circle cx="${s.point[0]}" cy="${s.point[1]}" r="1.4" fill="${s.masked ? '#ff9933' : '#00ffff'}"/>`;
for (const [i, s] of peaks.entries()) svg += `<circle cx="${s.point[0]}" cy="${s.point[1]}" r="5" fill="none" stroke="#ff00ff" stroke-width="2"/><text x="${s.point[0] - 10}" y="${s.point[1] - 18}" fill="#ff00ff" font-family="DejaVu Sans" font-size="18">${i}</text>`;
svg += '</svg>'; fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
for (const output of [prefix + '-marks.png', prefix + '.png']) assert(!fs.existsSync(output));
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', [file, prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = [input, file, 'scripts/measure-spring-sector-teeth.mjs'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'sector-tooth-readings-awaiting-review', productionChanged: false, mechanicsPassed: false,
  inspected: false, adopted: false, center, samples, peaks, fits, sources, image: {file: prefix + '.png', sha256: hash(prefix + '.png')},
  qualification: 'First bounded dark radial stroke outside the sector openings. Central angles overlapping the wheel are excluded from tip fitting. Peaks and periodic-division fits are candidates requiring inspection; the crown tooth count and final manufactured profile are not established.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({peaks: peaks.map(p => ({degrees: p.degrees, radius: p.radius, point: p.point})), fits: fits.slice(0, 5)});
