import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile, freezeStudySources} from './lib/study-report-io.mjs';

const file = 'artifacts/reference/brown-084-detail.png', width = 1800, height = 1250;
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-first-source-measurements';
const bytes = execFileSync('convert', [file, '-colorspace', 'Gray', '-depth', '8', 'gray:-'], {maxBuffer: width * height + 1000});
assert.equal(bytes.length, width * height);
const pixel = (x, y) => {
  x = Math.round(x); y = Math.round(y);
  return x >= 0 && x < width && y >= 0 && y < height ? bytes[y * width + x] : 255;
};
const angles = (a, b, step = 5) => Array.from({length: Math.floor((b - a) / step) + 1}, (_, i) => a + i * step);
const wheelAngles = [...angles(165, 195, 3), ...angles(345, 375, 3), ...angles(235, 305, 3)];
const circles = {};
for (const [name, cx, cy, low, high, nominal, directions] of [
  ['shaft', 911, 592, 5, 24, 13, angles(0, 355)],
  ['hub', 910, 592, 25, 48, 35, angles(0, 355)],
  ['camRoundBody', 909, 592, 47, 75, 60, [...angles(110, 160), ...angles(200, 250), ...angles(290, 340)]],
  ['rearWheelOuter', 909, 592, 215, 252, 233, wheelAngles],
  ['rearWheelInner', 909, 592, 185, 220, 205, wheelAngles],
]) {
  const readings = [], missing = [];
  for (const degrees of directions) {
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
  assert(readings.length >= 15, name);
  circles[name] = {...circleFit(readings.map(r => r.point)), readings, missing};
}
const pins = {};
for (const [name, cx, cy] of [['left', 802, 389], ['right', 1034, 389]]) {
  const readings = [], missing = [];
  for (const degrees of angles(0, 355)) {
    const angle = degrees * Math.PI / 180;
    let radius = 5;
    for (; radius < 24 && pixel(cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)) >= 65; radius += .25) {}
    if (radius === 5 || radius >= 24) {missing.push(degrees); continue;}
    readings.push({degrees, radius, point: [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)]});
  }
  assert(readings.length >= 30, name);
  pins[name] = {...circleFit(readings.map(r => r.point)), readings, missing, boundary: 'first dark boundary of the white pin-face region'};
}
const landmarks = {
  camLobe: [[881, 541], [902, 531], [926, 508], [944, 514], [956, 520], [944, 548], [951, 561]],
  slots: [{left: 592, right: 868, top: 369, bottom: 411}, {left: 940, right: 1247, top: 370, bottom: 412}],
  frame: {left: 382, right: 1444, bottom: 744, shoulderY: 421, housingLeft: 526, housingRight: 1294, housingTop: 327},
  yoke: {pins: [[802, 389], [1034, 389]], outerTop: 231, innerTop: 269, rodLeft: 888, rodRight: 934, rodTop: 87},
  toothRegions: {upper: [529, 455, 759, 48], lower: [528, 669, 756, 44]},
  outputRod: {left: 64, right: 1716, top: 569, bottom: 611},
  qualification: 'Manual stroke-center estimates and region bounds for the next reconstruction step. The cam-lobe polyline is a contour target, not an adopted working profile. Tooth pitch, exact flank geometry, suspension clearances and hidden depth remain unmeasured.',
};
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
for (const [name, c] of Object.entries({...circles, ...Object.fromEntries(Object.entries(pins).map(([name, c]) => [name + 'PinFace', c]))})) {
  svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
  for (const r of c.readings) svg += `<circle cx="${r.point[0]}" cy="${r.point[1]}" r="1.5" fill="#ff44ff"/>`;
  svg += `<text x="${c.center[0] + c.radius + 6}" y="${c.center[1]}" font-family="DejaVu Sans" font-size="16" fill="#00ffff">${name}</text>`;
}
svg += `<polyline points="${landmarks.camLobe.map(p => p.join(',')).join(' ')}" fill="none" stroke="#ffdd00" stroke-width="2"/>`;
for (const r of landmarks.slots) svg += `<rect x="${r.left}" y="${r.top}" width="${r.right-r.left}" height="${r.bottom-r.top}" fill="none" stroke="#ffdd00" stroke-width="2"/>`;
svg += '</svg>';
fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
for (const output of [prefix + '-marks.png', prefix + '.png']) assert(!fs.existsSync(output));
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', [file, prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
const sources = freezeStudySources([file, 'scripts/measure-selector-rack-source.mjs', 'scripts/lib/source-circle-fit.mjs',
  'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 84, status: 'preliminary-selector-rack-source-measurements', productionChanged: false,
  mechanicsPassed: false, inspected: false, adopted: false, circles, pins, landmarks, sources,
  image: {file: prefix + '.png', sha256: hashStudyFile(prefix + '.png')},
  qualification: 'Circular regions use bounded dark-stroke center readings; pin faces use the first dark boundary around their white regions. The image overlay must be inspected before adoption. No conjugacy, tooth count, cam contact law, slot fit or hidden support arrangement is established.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(Object.fromEntries(Object.entries({...circles, ...pins}).map(([name, c]) => [name,
  {center: c.center, radius: c.radius, rms: c.rmsResidual, readings: c.readings.length, missing: c.missing.length}])));
