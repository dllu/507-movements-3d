import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const anchor = [690, 725], scale = 280 / 1.375;
const point = ([x, y]) => [(x - anchor[0]) / scale, (anchor[1] - y) / scale];
const pixel = ([x, y]) => [anchor[0] + x * scale, anchor[1] - y * scale];
const shape = new THREE.Shape(); shape.moveTo(...point([193, 704]));
const curves = [
  [[206, 471], [420, 240], [661, 238]],
  [[935, 222], [1187, 435], [1182, 727]],
  [[1181, 798], [1160, 877], [1136, 928]],
  [[1083, 929], [1055, 891], [1044, 848]],
  [[1027, 782], [985, 721], [930, 727]],
  [[853, 722], [814, 749], [773, 795]],
  [[735, 839], [711, 853], [671, 850]],
  [[613, 852], [578, 820], [555, 758]],
  [[523, 670], [490, 622], [435, 625]],
  [[369, 624], [333, 650], [316, 673]],
  [[284, 700], [228, 706], [193, 704]],
];
for (const controls of curves) shape.bezierCurveTo(...controls.flatMap(point));
shape.closePath();
const bore = 0.425, hole = new THREE.Path(); hole.absarc(0, 0, bore, 0, 2 * Math.PI, false); shape.holes.push(hole);
const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 256 });
const contour = shape.extractPoints(256).shape.map(v => pixel([v.x, v.y]));
const marks = [[194,704],[208,624],[246,534],[301,446],[375,369],[459,308],[552,264],[652,239],
  [746,241],[840,265],[936,308],[1019,369],[1094,450],[1147,537],[1175,630],[1181,724],
  [1174,796],[1156,867],[1137,927],[1098,919],[1067,889],[1045,848],[1026,796],[994,753],[952,729],
  [906,727],[865,735],[824,756],[787,780],[755,816],[724,843],[676,850],[631,842],[597,818],[571,787],
  [552,748],[532,705],[509,664],[478,638],[436,626],[396,632],[361,646],[333,666],[306,686],[255,700]];
const distance = q => contour.reduce((best, a, i) => {
  const b = contour[(i + 1) % contour.length], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
  return Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
}, Infinity);
const rows = marks.map(sourcePoint => ({ sourcePoint, residual: distance(sourcePoint) }));
let volume = 0, firstX = 0, firstY = 0, radialMoment = 0, wrongNormals = 0;
const edges = new Map(), faces = surfaceTriangles(geometry);
for (const [i, face] of faces.entries()) {
  const [a, b, c] = [face.a, face.b, face.c], v = a.dot(b.clone().cross(c)) / 6;
  volume += v; firstX += v * (a.x + b.x + c.x) / 4; firstY += v * (a.y + b.y + c.y) / 4;
  for (const axis of ['x', 'y']) radialMoment += v / 10 * (a[axis] ** 2 + b[axis] ** 2 + c[axis] ** 2
    + a[axis] * b[axis] + a[axis] * c[axis] + b[axis] * c[axis]);
  const stored = new THREE.Vector3();
  for (let j = 0; j < 3; j++) stored.add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, geometry.index ? geometry.index.getX(i * 3 + j) : i * 3 + j));
  if (face.getNormal(new THREE.Vector3()).dot(stored) <= 0) wrongNormals++;
  const keys = [a, b, c].map(q => q.toArray().map(x => Math.round(x * 1e9)).join(','));
  for (let j = 0; j < 3; j++) {
    const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
    const edge = edges.get(key) ?? { count: 0, direction: 0 }; edge.count++; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
  }
}
const summary = { readings: rows.length, maximumResidual: Math.max(...rows.map(r => r.residual)),
  rmsResidual: Math.sqrt(rows.reduce((s, r) => s + r.residual ** 2, 0) / rows.length),
  volume, centroid: [firstX / volume, firstY / volume], centroidPixel: pixel([firstX / volume, firstY / volume]),
  polarInertiaPerUnitMass: radialMoment / volume, triangles: faces.length, wrongNormals,
  unmatchedEdges: [...edges.values()].filter(e => e.count !== 2 || e.direction !== 0).length };
await writeFile('artifacts/review/067-scalloped-outline-study.json', JSON.stringify({ movement: 67,
  status: 'isolated-shape-and-mass-study', productionChanged: false, anchor, scale, bore, curves, summary, rows,
  qualification: 'An initial manual scalloped contour, including the source hidden/dashed central lower boundary, compared against separate visual boundary readings. Uniform-plate mass moments come from the actual triangulated extrusion with a bore. This is not a complete mechanism: sleeve/pin/worm geometry, complete assembly mass properties, dynamics, rendered inspection and inter-part clearances are still pending.' }, null, 2) + '\n');
const background = (await readFile('artifacts/reference/brown-067-detail.png')).toString('base64');
const svg = `<polyline points="${contour.map(q => q.join(',')).join(' ')}" fill="none" stroke="#008bff" stroke-width="2"/>`
  + marks.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#008bff"/>`).join('')
  + `<circle cx="${summary.centroidPixel[0]}" cy="${summary.centroidPixel[1]}" r="7" fill="none" stroke="#e32f00" stroke-width="3"/>`;
await writeFile('artifacts/review/067-scalloped-outline-study.html', `<!doctype html><meta charset="utf-8"><title>067 initial outline study</title><style>body{margin:0}</style><svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1150" viewBox="0 0 1300 1150"><image href="data:image/png;base64,${background}" width="1300" height="1150"/>${svg}</svg>`);
console.log(summary);
if (volume <= 0 || wrongNormals || summary.unmatchedEdges) process.exitCode = 1;
