import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';

const file = 'artifacts/reference/brown-083-detail.png', width = 1120, height = 1250;
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-source-measurements';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bytes = execFileSync('convert', [file, '-colorspace', 'Gray', '-depth', '8', 'gray:-'], {maxBuffer: width * height + 1000});
assert.equal(bytes.length, width * height);
const pixel = (x, y) => {
  x = Math.round(x); y = Math.round(y);
  return x >= 0 && x < width && y >= 0 && y < height ? bytes[y * width + x] : 255;
};
const circles = {};
for (const [name, cx, cy, low, high, nominal] of [
  ['rodEyeOuter', 607, 170, 34, 53, 43], ['rodEyeInner', 607, 170, 16, 32, 24],
  ['rockshaftEyeOuter', 603, 385, 37, 58, 48],
]) {
  const readings = [], missing = [];
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const angle = degrees * Math.PI / 180, runs = []; let current = [];
    for (let radius = low; radius <= high; radius += .25) {
      if (pixel(cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)) < 65) current.push(radius);
      else if (current.length) {runs.push(current); current = [];}
    }
    if (current.length) runs.push(current);
    const choices = runs.filter(r => r[0] > low && r.at(-1) < high && r.at(-1) - r[0] >= 2)
      .sort((a, b) => Math.abs((a[0] + a.at(-1)) / 2 - nominal) - Math.abs((b[0] + b.at(-1)) / 2 - nominal));
    if (!choices.length) {missing.push(degrees); continue;}
    const stroke = [choices[0][0], choices[0].at(-1)], radius = (stroke[0] + stroke[1]) / 2;
    readings.push({degrees, stroke, point: [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)]});
  }
  assert(readings.length >= 30);
  circles[name] = {...circleFit(readings.map(r => r.point)), readings, missing};
}
const landmarks = {
  rodEdges: [[[645, 153], [1007, 257]], [[645, 195], [1018, 304]]],
  sectorSides: [[[562, 416], [310, 772]], [[651, 414], [912, 791]]],
  leftOpening: [[541, 527], [562, 517], [578, 527], [584, 555], [582, 697], [578, 770],
    [568, 800], [553, 811], [526, 806], [430, 782], [406, 766], [400, 742], [411, 715]],
  rightOpening: [[634, 527], [650, 517], [674, 525], [690, 546], [749, 626], [801, 708],
    [811, 736], [802, 757], [775, 779], [722, 796], [662, 811], [641, 805], [629, 785], [624, 753], [626, 604]],
  wheel: {left: 246, right: 963, bottom: 968, hub: [508, 684, 970, 1012], shaft: [584, 631, 1014, 1155]},
  qualification: 'Manually located stroke centers and outline targets. Opening lists indicate closed contours; they are not final splines. Wheel tooth count, sector tooth pitch, contact faces, hidden springs and guides remain unmeasured.',
};
const center = circles.rockshaftEyeOuter.center;
const crank = {length: Math.hypot(...circles.rodEyeOuter.center.map((v, i) => v - center[i])),
  angle: Math.atan2(center[1] - circles.rodEyeOuter.center[1], circles.rodEyeOuter.center[0] - center[0])};
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
for (const [name, c] of Object.entries(circles)) {
  svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
  svg += `<text x="${c.center[0] + c.radius + 8}" y="${c.center[1]}" font-family="DejaVu Sans" font-size="16" fill="#00ffff">${name}</text>`;
}
for (const line of [...landmarks.rodEdges, ...landmarks.sectorSides]) svg += `<polyline points="${line.map(p => p.join(',')).join(' ')}" fill="none" stroke="#ff44ff" stroke-width="2"/>`;
for (const name of ['leftOpening', 'rightOpening']) svg += `<polygon points="${landmarks[name].map(p => p.join(',')).join(' ')}" fill="none" stroke="#ffdd00" stroke-width="2"/>`;
svg += `<line x1="${landmarks.wheel.left}" x2="${landmarks.wheel.right}" y1="${landmarks.wheel.bottom}" y2="${landmarks.wheel.bottom}" stroke="#00ffff" stroke-width="2"/>`;
svg += '</svg>';
fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
for (const output of [prefix + '-marks.png', prefix + '.png']) assert(!fs.existsSync(output));
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', [file, prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
const sources = [file, 'scripts/measure-spring-sector-source.mjs', 'scripts/lib/source-circle-fit.mjs'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'preliminary-layout-measurements', productionChanged: false, mechanicsPassed: false,
  inspected: false, adopted: false, circles, crank, landmarks, sources, image: {file: prefix + '.png', sha256: hash(prefix + '.png')},
  qualification: 'Bounded dark-stroke circle readings and manually selected source contours. These measurements do not infer depth, tooth count, conjugate contact geometry or spring construction.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({circles: Object.fromEntries(Object.entries(circles).map(([name, c]) => [name,
  {center: c.center, radius: c.radius, rms: c.rmsResidual, readings: c.readings.length}])), crank});
