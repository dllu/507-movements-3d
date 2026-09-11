import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { circleFit } from './lib/source-circle-fit.mjs';

const file = 'artifacts/reference/brown-070-detail.png', source = await readFile(file);
const width = 1510, height = 1270;
const decoded = spawnSync('convert', [file, '-depth', '8', 'rgb:-'], { maxBuffer: 8 * 1024 * 1024 });
if (decoded.status !== 0 || decoded.stdout.length !== width * height * 3) throw new Error('Failed source decode');
const readCircle = (center, low, high, angles) => {
  const points = [], missing = [];
  for (const degrees of angles) {
    const angle = degrees * Math.PI / 180; let start = null, end = null;
    for (let radius = low; radius <= high; radius += .25) {
      const x = Math.round(center[0] + radius * Math.cos(angle)), y = Math.round(center[1] - radius * Math.sin(angle));
      const dark = decoded.stdout[3 * (width * y + x)] < 100;
      if (dark && start === null) start = radius;
      if (!dark && start !== null) { end = radius - .25; break; }
    }
    if (start === null || end === null) { missing.push(degrees); continue; }
    const radius = (start + end) / 2;
    points.push([center[0] + radius * Math.cos(angle), center[1] - radius * Math.sin(angle)]);
  }
  return { ...circleFit(points), missing };
};
const output = readCircle([445, 758], 350, 420, Array.from({ length: 49 }, (_, i) => 60 + i * 5));
const driver = readCircle([1090, 773], 390, 430, Array.from({ length: 72 }, (_, i) => i * 5));
const studs = [[134,740],[200,565],[348,456],[546,456],[716,592],[756,820],
  [692,976],[520,1070],[323,1055],[174,920]];
const studOrbit = circleFit(studs);
const rimPoints = [[1082,404],[1182,418],[1294,469],[1380,555],[1435,651],
  [1460,774],[1448,870],[1413,967],[1343,1054],[1238,1117],[1127,1143],
  [1017,1137],[910,1096],[820,1033],[760,959],[774,568],[851,489],[953,432]];
const rim = circleFit(rimPoints);
const centerDistance = Math.hypot(driver.center[0] - output.center[0], driver.center[1] - output.center[1]);
const report = { movement: 70, status: 'source-layout-study', productionChanged: false,
  source: { file, sha256: createHash('sha256').update(source).digest('hex'), pdfPage: 26, printedPage: 22,
    scaleTo: 6000, crop: [1600, 1180, width, height], inspected: true },
  method: 'First dark-stroke radial midpoints for the visible output arc (60–300 degrees) and the outer driver circle, plus manual centers of ten distinct studs and eighteen dashed-rim marks. Occluded output outline is excluded. Irregular ink and manual readings limit accuracy; this establishes approximate proportions, not working contact geometry.',
  output, driver, studOrbit, rim, studCount: 10, centerDistance,
  centerlineAngle: Math.atan2(output.center[1] - driver.center[1], driver.center[0] - output.center[0]),
  ratios: { driverToOutput: driver.radius / output.radius, rimToDriver: rim.radius / driver.radius,
    studOrbitToOutput: studOrbit.radius / output.radius, centersToOutput: centerDistance / output.radius },
  animationAvailable: false, animationReviewed: false,
  visibility: 'The outer driver disk covers the right edge of A. The dotted outlines depict the hidden rim, tappet and one stud; source depth ordering must be preserved or explicitly sectioned.' };
await writeFile('artifacts/review/070-source-layout-study.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const numbered = studs.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="29" fill="none" stroke="#00bfff" stroke-width="3"/><text x="${q[0] + 30}" y="${q[1] - 18}" fill="#006cff" font-family="sans-serif" font-size="30">${i + 1}</text>`).join('');
await writeFile('artifacts/review/070-source-stud-readings.svg', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image xlink:href="data:image/png;base64,${source.toString('base64')}" width="${width}" height="${height}"/>${numbered}</svg>`, { flag: 'wx' });
console.log({ output: { center: output.center, radius: output.radius, rms: output.rmsResidual, missing: output.missing },
  driver: { center: driver.center, radius: driver.radius, rms: driver.rmsResidual, missing: driver.missing },
  rim: { center: rim.center, radius: rim.radius, rms: rim.rmsResidual },
  studs: { center: studOrbit.center, radius: studOrbit.radius, rms: studOrbit.rmsResidual }, ratios: report.ratios });
