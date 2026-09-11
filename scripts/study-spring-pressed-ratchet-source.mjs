import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { circleFit } from './lib/source-circle-fit.mjs';

const file = 'artifacts/reference/brown-073-detail.png', width = 1250, height = 1170;
const decoded = spawnSync('convert', [file, '-depth', '8', 'rgb:-'], { maxBuffer: 8 * 1024 * 1024 });
if (decoded.status !== 0 || decoded.stdout.length !== width * height * 3) throw new Error('Invalid source decode');
const readRays = (center, low, high, angles) => {
  const points = [], rows = [], missing = [];
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
    const point = [center[0] + radius * Math.cos(angle), center[1] - radius * Math.sin(angle)];
    points.push(point); rows.push({ degrees, radius, point });
  }
  return { points, rows, missing };
};
const driverRead = readRays([714, 588], 380, 435,
  Array.from({ length: 36 }, (_, i) => i * 10).filter(angle => angle < 150 || angle > 210));
const driver = circleFit(driverRead.points);
const hubRead = readRays([714, 588], 71, 96, Array.from({ length: 36 }, (_, i) => i * 10));
const hub = circleFit(hubRead.points);
const tips = [[644,330], [799,337], [938,447], [977,610], [920,756],
  [793,843], [635,846], [506,762], [444,600], [497,432]];
const roots = [[650,390], [786,389], [889,468], [929,605], [870,719],
  [784,784], [650,795], [555,731], [495,600], [538,465]];
const toothCircle = circleFit(tips);
const flankRead = readRays(hub.center, 190, 295, Array.from({ length: 30 }, (_, i) => 73 + i));
const flank = circleFit(flankRead.points);
const report = {
  movement: 73, status: 'source-geometry-study', productionChanged: false,
  source: { file, sha256: createHash('sha256').update(await readFile(file)).digest('hex'), width, height,
    pdfPage: 26, printedPage: 22, scaleTo: 6000, crop: [3140, 2580, width, height], inspected: true },
  animationAvailable: false, animationReviewed: false,
  method: 'First dark radial-stroke midpoints on the driver circumference and hub. Thirty rays sample the visible top ratchet flank. Ten tip/root pairs were counted and read manually around the entire engraving; they are construction readings, not independent validation. Initial circle fits must be checked on their overlay.',
  driver: { ...driver, ...driverRead }, hub: { ...hub, ...hubRead },
  ratchet: { teeth: 10, tips, roots, tipCircle: toothCircle, flank: { ...flank, ...flankRead } },
  catchSpring: { mount: [728,251], centerlineReadings: [[728,251],[813,270],[900,312],[976,380],[1022,451],[1059,540]],
    widthPixels: 20, note: 'Approximate centerline of the inner visible spring face, excluding its extruded side face.' },
  strongSpring: { anchor: [303,1140], centerlineReadings: [[303,1140],[281,1010],[284,904],[317,770],[370,661],[448,554],[523,463]],
    widthPixels: 24, note: 'The source breaks its lines where it crosses the driver outline. The physical spring is continuous.' },
};
await writeFile('artifacts/review/073-source-geometry-study.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const circle = (c, r, color) => `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="${color}" stroke-width="2"/>`;
const point = (p, color, text = '') => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"/>${text ? `<text x="${p[0]+7}" y="${p[1]-7}" fill="${color}" font-size="18">${text}</text>` : ''}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="data:image/png;base64,${(await readFile(file)).toString('base64')}" width="${width}" height="${height}"/>`
  + circle(driver.center, driver.radius, '#00d7ff') + circle(hub.center, hub.radius, '#ffdc00')
  + circle(flank.center, flank.radius, '#ff4444') + driverRead.points.map(p => point(p, '#00d7ff')).join('')
  + flankRead.points.map(p => point(p, '#ff4444')).join('') + tips.map((p,i) => point(p, '#45ff45', i+1)).join('')
  + roots.map(p => point(p, '#a84dff')).join('') + '</svg>';
await writeFile('artifacts/review/073-source-readings.svg', svg, { flag: 'wx' });
const render = spawnSync('convert', ['-background', 'white', 'artifacts/review/073-source-readings.svg', 'artifacts/review/073-source-readings.png']);
if (render.status !== 0) throw new Error('Overlay rendering failed: ' + render.stderr);
console.log({ driver: { center: driver.center, radius: driver.radius, rms: driver.rmsResidual, missing: driverRead.missing },
  hub: { center: hub.center, radius: hub.radius, rms: hub.rmsResidual, missing: hubRead.missing },
  teeth: tips.length, tipCircle: { center: toothCircle.center, radius: toothCircle.radius, rms: toothCircle.rmsResidual },
  flank: { center: flank.center, radius: flank.radius, rms: flank.rmsResidual, missing: flankRead.missing } });
