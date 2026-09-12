import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources, hashStudyFile, readStudyReport, verifyStudySources} from './lib/study-report-io.mjs';

const imageFile = 'artifacts/reference/brown-084-detail.png';
const layoutFile = 'artifacts/review/084-first-source-measurements.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-rack-face-measurements';
verifyStudySources(readStudyReport(layoutFile).sources);
const width = 1800, height = 1250, threshold = 65;
const pixels = execFileSync('convert', [imageFile, '-colorspace', 'Gray', '-depth', '8', 'gray:-'],
  {maxBuffer: width * height + 1000});
assert.equal(pixels.length, width * height);

// Manual seeds identify the short working faces, rather than counting every
// dark run: the rear wheel, long tooth flanks and lettering also cross this area.
// Endpoint heights are stroke-center estimates; only interior x readings are fitted.
const seeds = {
  upper: [
    [534, 455, 490], [578, 454, 491], [635, 455, 491], [692, 456, 493],
    [745, 458, 492], [808, 464, 495], [873, 456, 490], [932, 458, 497],
    [1012, 456, 495], [1077, 456, 494], [1143, 457, 496], [1206, 459, 500],
    [1265, 469, 502],
  ],
  lower: [
    [578, 704, 674], [638, 704, 674], [695, 701, 674], [746, 704, 674],
    [800, 704, 675], [855, 704, 674], [901, 704, 675], [947, 705, 675],
    [1006, 707, 679], [1068, 704, 678], [1107, 706, 674], [1165, 707, 676],
    [1219, 709, 676], [1279, 706, 675],
  ],
};
function lineFit(points) {
  assert(points.length >= 3);
  const mean = points.reduce((sum, p) => sum.map((v, i) => v + p[i] / points.length), [0, 0]);
  const variance = points.reduce((sum, p) => sum + (p[0] - mean[0]) ** 2, 0);
  assert(variance > 0);
  const slope = points.reduce((sum, p) => sum + (p[0] - mean[0]) * (p[1] - mean[1]), 0) / variance;
  const intercept = mean[1] - slope * mean[0];
  const residuals = points.map(p => p[1] - (intercept + slope * p[0]));
  return {intercept, slope, residuals, maximumResidual: Math.max(...residuals.map(Math.abs)),
    rmsResidual: Math.sqrt(residuals.reduce((sum, v) => sum + v * v, 0) / points.length)};
}
const rows = {};
for (const [name, rowSeeds] of Object.entries(seeds)) {
  const faces = rowSeeds.map(([seedX, rootY, tipY], index) => {
    const lowY = Math.min(rootY, tipY) + 9, highY = Math.max(rootY, tipY) - 9;
    const readings = [], missing = [];
    for (let y = lowY; y <= highY; y++) {
      const left = seedX - 15, right = seedX + 15, runs = []; let start = null;
      for (let x = left; x <= right + 1; x++) {
        const dark = x <= right && pixels[y * width + x] < threshold;
        if (dark && start === null) start = x;
        if (!dark && start !== null) {runs.push([start, x - 1]); start = null;}
      }
      const choices = runs.filter(([a, b]) => a > left && b < right && b - a + 1 <= 14)
        .sort((a, b) => Math.abs((a[0] + a[1]) / 2 - seedX) - Math.abs((b[0] + b[1]) / 2 - seedX));
      if (!choices.length) {missing.push(y); continue;}
      const stroke = choices[0]; readings.push({y, stroke, x: (stroke[0] + stroke[1]) / 2});
    }
    if (readings.length < 3) return {index: index + 1, seedX, rootY, tipY, readings, missing,
      fitted: false, occlusionNote: 'Too few isolated stroke readings; no face fit or pitch datum is inferred.'};
    const fit = lineFit(readings.map(p => [p.y, p.x]));
    const at = y => [fit.intercept + fit.slope * y, y];
    return {index: index + 1, seedX, rootY, tipY, readings, missing, fitted: true, xAsFunctionOfImageY: fit,
      root: at(rootY), tip: at(tipY), middle: at((rootY + tipY) / 2),
      occlusionNote: name === 'lower' && [7, 10, 11].includes(index + 1)
        ? 'Rear-wheel stroke overlaps or borders this tooth; inspect the labeled source before adoption.' : null};
  });
  const fitted = faces.filter(f => f.fitted);
  const pitchFit = lineFit(fitted.map(f => [f.index - 1, f.middle[0]]));
  const adjacentPitch = faces.slice(1).flatMap((f, i) => f.fitted && faces[i].fitted ? [f.middle[0] - faces[i].middle[0]] : []);
  rows[name] = {faces, manuallyIdentifiedShortFaces: faces.length, fittedFaces: fitted.length, pitchFit, adjacentPitch,
    minimumAdjacentPitch: Math.min(...adjacentPitch), maximumAdjacentPitch: Math.max(...adjacentPitch),
    meanToothDepth: faces.reduce((sum, f) => sum + Math.abs(f.tipY - f.rootY), 0) / faces.length};
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
for (const [name, row] of Object.entries(rows)) for (const f of row.faces) {
  if (!f.fitted) {
    svg += `<rect x="${f.seedX - 15}" y="${Math.min(f.rootY, f.tipY)}" width="30" height="${Math.abs(f.rootY - f.tipY)}" fill="none" stroke="#ffbb22" stroke-dasharray="3 3"/>`;
    svg += `<text x="${f.seedX - 8}" y="${name === 'upper' ? 443 : 730}" font-family="DejaVu Sans" font-size="16" fill="#ffbb22">${f.index}?</text>`;
    continue;
  }
  const color = f.occlusionNote ? '#ffbb22' : '#00ffff';
  svg += `<line x1="${f.root[0]}" y1="${f.root[1]}" x2="${f.tip[0]}" y2="${f.tip[1]}" stroke="${color}" stroke-width="2"/>`;
  for (const p of f.readings) svg += `<circle cx="${p.x}" cy="${p.y}" r="1.4" fill="#ff44ff"/>`;
  svg += `<circle cx="${f.root[0]}" cy="${f.root[1]}" r="3" fill="none" stroke="${color}"/>`;
  svg += `<circle cx="${f.tip[0]}" cy="${f.tip[1]}" r="3" fill="none" stroke="${color}"/>`;
  svg += `<text x="${f.middle[0] - 8}" y="${name === 'upper' ? 443 : 730}" font-family="DejaVu Sans" font-size="16" fill="${color}">${f.index}</text>`;
}
svg += '</svg>';
for (const suffix of ['.svg', '-marks.png', '.png', '-upper.png', '-lower.png', '.json'])
  assert(!fs.existsSync(prefix + suffix), prefix + suffix);
fs.writeFileSync(prefix + '.svg', svg, {flag: 'wx'});
execFileSync('convert', ['-background', 'none', prefix + '.svg', prefix + '-marks.png']);
execFileSync('convert', [imageFile, prefix + '-marks.png', '-compose', 'Over', '-composite', prefix + '.png']);
for (const [name, y] of [['upper', 420], ['lower', 645]])
  execFileSync('convert', [prefix + '.png', '-crop', `830x100+500+${y}`, '+repage', prefix + '-' + name + '.png']);
const sources = freezeStudySources([imageFile, layoutFile, 'scripts/measure-selector-rack-teeth.mjs',
  'scripts/lib/study-report-io.mjs'], prefix);
const report = {movement: 84, status: 'rack-working-face-stroke-measurements', productionChanged: false,
  mechanicsPassed: false, inspected: false, adopted: false, threshold, rows, sources,
  images: ['.png', '-upper.png', '-lower.png'].map(suffix => ({file: prefix + suffix, sha256: hashStudyFile(prefix + suffix)})),
  qualification: 'Manual short-face seeds and endpoint heights; least-squares fits use bounded interior black-stroke centers. Tooth counts refer to these visible contours, not a verified repeating design. Occluded wheel strokes remain flagged. Uniform-pitch fits quantify engraving irregularity and are not adopted profiles or contact laws. Inspect all labeled faces before selecting reconstruction geometry.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(Object.fromEntries(Object.entries(rows).map(([name, row]) => [name, {
  faces: row.faces.length, fittedFaces: row.fittedFaces, fittedPitch: row.pitchFit.slope, pitchRms: row.pitchFit.rmsResidual,
  maximumPitchResidual: row.pitchFit.maximumResidual, adjacentPitch: [row.minimumAdjacentPitch, row.maximumAdjacentPitch],
  meanToothDepth: row.meanToothDepth, missing: row.faces.reduce((sum, f) => sum + f.missing.length, 0),
  maximumFaceRms: Math.max(...row.faces.filter(f => f.fitted).map(f => f.xAsFunctionOfImageY.rmsResidual)),
}])));
