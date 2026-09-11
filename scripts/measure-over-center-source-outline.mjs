import { writeFile } from 'node:fs/promises';
import { sourceCamShape } from '../artifacts/review/064-provisional-source-layout.mjs';

// Independent manual boundary marks in the unchanged Brown enlargement.
const sourcePoints = [[1125, 440], [1061, 435], [989, 461], [918, 504],
  [862, 566], [835, 628], [831, 692], [839, 756], [861, 806], [902, 852],
  [955, 888], [1010, 900], [1061, 894], [1106, 864], [1130, 834], [1131, 650], [1130, 510]];
const profile = sourceCamShape().getPoints(256);
const distance = (point, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point[0] - a.x) * dx + (point[1] - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - a.x - t * dx, point[1] - a.y - t * dy);
};
const rows = sourcePoints.map(point => ({ sourcePoint: point,
  distance: Math.min(...profile.slice(1).map((b, i) => distance(point, profile[i], b))) }));
const report = { movement: 64, source: '../reference/brown-064-detail.png',
  method: 'Nearest boundary distances from 17 independently marked visible cam-outline points to the provisional trace, in source pixels. These manual readings are not an automatic complete-outline match; tooth geometry, spring and other parts are not measured here.',
  maximumResidual: Math.max(...rows.map(row => row.distance)),
  rmsResidual: Math.sqrt(rows.reduce((sum, row) => sum + row.distance ** 2, 0) / rows.length), rows };
await writeFile('artifacts/review/064-source-cam-outline.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
