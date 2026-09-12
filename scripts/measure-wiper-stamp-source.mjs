import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import source from './lib/wiper-stamp-source.mjs';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources, hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-source-measurements';
const bytes = execFileSync('convert', [source.image, '-colorspace', 'Gray', '-depth', '8', 'gray:-'], {maxBuffer: source.width * source.height + 1000});
assert.equal(bytes.length, source.width * source.height);
const pixel = (x, y) => bytes[Math.round(y) * source.width + Math.round(x)];
const circles = {};
for (const [name, low, high, nominal] of [['shaft', 19, 40, 28], ['hub', 42, 66, 52]]) {
  const readings = [], missing = [];
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const angle = degrees * Math.PI / 180, runs = []; let current = [];
    for (let r = low; r <= high; r += .25) {
      if (pixel(source.center[0] + r * Math.cos(angle), source.center[1] - r * Math.sin(angle)) < 65) current.push(r);
      else if (current.length) {runs.push(current); current = [];}
    }
    if (current.length) runs.push(current);
    const choices = runs.filter(r => r[0] > low && r.at(-1) < high && r.at(-1) - r[0] >= 2)
      .sort((a, b) => Math.abs((a[0] + a.at(-1)) / 2 - nominal) - Math.abs((b[0] + b.at(-1)) / 2 - nominal));
    if (!choices.length) {missing.push(degrees); continue;}
    const stroke = [choices[0][0], choices[0].at(-1)], radius = (stroke[0] + stroke[1]) / 2;
    readings.push({degrees, stroke, point: [source.center[0] + radius * Math.cos(angle), source.center[1] - radius * Math.sin(angle)]});
  }
  assert(readings.length >= 30, name); circles[name] = {...circleFit(readings.map(r => r.point)), readings, missing};
}
const svgCommand = {moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C'};
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}">`;
for (const c of Object.values(circles)) svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
for (const key of ['upperWiper', 'lowerWiper', 'standard', 'standardInset', 'guide', 'bearingArm'])
  svg += `<path d="${source[key].map(([c, ...p]) => svgCommand[c] + p.join(' ')).join(' ')}" fill="none" stroke="#ff00ff" stroke-width="2"/>`;
for (const r of [source.rod, source.projection]) svg += `<rect x="${r.left}" y="${r.top}" width="${r.right-r.left}" height="${r.bottom-r.top}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
svg += '</svg>'; fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
for (const output of [prefix + '-marks.png', prefix + '.png']) assert(!fs.existsSync(output));
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', [source.image, prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
const sources = freezeStudySources([source.image, 'scripts/measure-wiper-stamp-source.mjs', 'scripts/lib/wiper-stamp-source.mjs',
  'scripts/lib/source-circle-fit.mjs', 'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 85, productionChanged: false, mechanicsPassed: false, inspected: false, circles,
  source, sources, image: {file: prefix + '.png', sha256: hashStudyFile(prefix + '.png')},
  qualification: 'Bounded dark-stroke circle fits plus manual visible contours. Inspection is required before adoption; no contact or hidden hardware qualification is asserted.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name, c]) => [name, {center: c.center, radius: c.radius, rms: c.rmsResidual, maximum: c.maximumResidual, readings: c.readings.length}])));
