import { readFile, writeFile } from 'node:fs/promises';
import { sourceLayout as p, outlinePoints } from '../artifacts/review/063-provisional-source-layout.mjs';

const fit = JSON.parse(await readFile('artifacts/review/063-source-tracing.json', 'utf8'));
const direction = Number(process.env.PROBE_DIRECTION ?? -1);
if (![1, -1].includes(direction)) throw new RangeError('PROBE_DIRECTION must be 1 or -1.');
const outlines = Object.fromEntries(Object.entries(outlinePoints).map(([name, points]) => [name,
  points.map(([x, y]) => [x - p.pivot[0], p.pivot[1] - y])]));
const segments = Object.fromEntries(Object.entries(outlines).map(([name, points]) => [name,
  points.map((a, index) => {
    const b = points[(index + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
    return { a, b, dx, dy, squaredLength: dx * dx + dy * dy };
  }).filter(segment => segment.squaredLength > 1e-12)]));
const signedGap = (name, x, y, radius) => {
  let minimum = Infinity, inside = false;
  for (const { a, b, dx, dy, squaredLength } of segments[name]) {
    const fraction = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / squaredLength));
    minimum = Math.min(minimum, (x - a[0] - fraction * dx) ** 2 + (y - a[1] - fraction * dy) ** 2);
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * dx / dy) inside = !inside;
  }
  return (inside ? -1 : 1) * Math.sqrt(minimum) - radius;
};
const rotate = (point, angle) => [point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
  point[0] * Math.sin(angle) + point[1] * Math.cos(angle)];
const driverOffset = [p.driverCenter[0] - p.pivot[0], p.pivot[1] - p.driverCenter[1]];
const pinPoints = phase => Array.from({ length: 3 }, (_, index) => {
  const angle = fit.pinMountPhase + (-index + direction * phase) * 2 * Math.PI / 3;
  return [driverOffset[0] + fit.pinOrbitRadius * Math.cos(angle), driverOffset[1] + fit.pinOrbitRadius * Math.sin(angle)];
});
const camGap = (name, pins, angle) => Math.min(...pins.map(point => signedGap(name, ...rotate(point, -angle), p.pinRadius)));
const continuousClearAngle = (name, pins, previous, lowerBound = 0) => {
  const tolerance = 0.02;
  let high = Math.max(previous, lowerBound), low;
  if (camGap(name, pins, high) < tolerance) {
    while (high < 1.3 && camGap(name, pins, high) < tolerance) high += 0.002;
    if (high >= 1.3) return null;
    low = Math.max(lowerBound, high - 0.002);
  } else {
    low = Math.max(lowerBound, high - 0.002);
    while (low > lowerBound && camGap(name, pins, low) >= tolerance) {
      high = low; low = Math.max(lowerBound, low - 0.002);
    }
    if (low === lowerBound && camGap(name, pins, low) >= tolerance) return lowerBound;
  }
  for (let i = 0; i < 40; i += 1) {
    const middle = (low + high) / 2;
    if (camGap(name, pins, middle) >= tolerance) high = middle;
    else low = middle;
  }
  return high;
};
const strikerOffset = [p.striker[0] - p.pivot[0], p.pivot[1] - p.striker[1]];
const strikerGap = relativeAngle => signedGap('pawl', ...rotate(strikerOffset, relativeAngle), p.strikerRadius);
let low = -0.1, high = 0.1;
if (!(strikerGap(low) < 0 && strikerGap(high) > 0)) throw new Error('The source striker has no local contact bracket.');
for (let i = 0; i < 50; i += 1) {
  const middle = (low + high) / 2;
  if (strikerGap(middle) > 0.02) high = middle;
  else low = middle;
}
const strikerContactOffset = high;
const rows = [];
let previousPawl = 0, previousDrop = 0;
for (let index = 0; index <= 2160; index += 1) {
  const phase = index / 720, pins = pinPoints(phase);
  const pawlAngle = continuousClearAngle('pawl', pins, previousPawl);
  const dropAngle = pawlAngle === null ? null
    : continuousClearAngle('drop', pins, previousDrop, Math.max(0, pawlAngle + strikerContactOffset));
  rows.push({ phase, pawlAngle, dropAngle,
    dropPinGap: dropAngle === null ? null : camGap('drop', pins, dropAngle),
    pawlPinGap: pawlAngle === null ? null : camGap('pawl', pins, pawlAngle),
    strikerPawlGap: dropAngle === null ? null : strikerGap(dropAngle - pawlAngle) });
  previousPawl = pawlAngle ?? previousPawl; previousDrop = dropAngle ?? previousDrop;
}
const intervals = key => {
  const result = []; let current = null;
  for (const row of rows) {
    if (row[key] > 1e-6) {
      if (!current) { current = { start: row.phase, end: row.phase, maximumAngle: row[key] }; result.push(current); }
      current.end = row.phase; current.maximumAngle = Math.max(current.maximumAngle, row[key]);
    } else current = null;
  }
  return result;
};
const report = {
  status: 'provisional-planar-cam-study-not-a-reconstruction',
  method: 'Traced source polygons, circular pins and a fixed common pivot. At each phase each plate follows its preceding allowed angular component: raise to clear an approaching pin, or descend only as far as the next blocking contact. This avoids falling through a pin into a disconnected lower allowed region. All three pins and the finite striker are included. The study omits the star, inertia, finite release times, plate thickness, bearings and all other hardware. Escape discontinuities and any upward jumps are not an animation law or proof of force feasibility.',
  direction: direction === -1 ? 'clockwise' : 'counterclockwise',
  poses: rows.length, strikerContactOffset, strikerGapAtSourcePose: strikerGap(0),
  dropLiftIntervals: intervals('dropAngle'), pawlLiftIntervals: intervals('pawlAngle'),
  maximumPawlRisePerStep: Math.max(...rows.slice(1).map((row, i) => row.pawlAngle - rows[i].pawlAngle)),
  maximumDropRisePerStep: Math.max(...rows.slice(1).map((row, i) => row.dropAngle - rows[i].dropAngle)),
  pawlEscapeSteps: rows.slice(1).map((row, i) => ({ phase: row.phase, before: rows[i].pawlAngle, after: row.pawlAngle }))
    .filter(row => row.after - row.before < -0.05),
  dropEscapeSteps: rows.slice(1).map((row, i) => ({ phase: row.phase, before: rows[i].dropAngle, after: row.dropAngle }))
    .filter(row => row.after - row.before < -0.05),
  issues: rows.filter(row => row.dropAngle === null || row.dropPinGap < 0 || row.pawlPinGap < 0 || row.strikerPawlGap < 0),
  rows,
};
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/063-source-cam-study.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, rows: undefined, issues: report.issues.length }, null, 2));
