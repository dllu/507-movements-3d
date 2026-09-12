import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate, THREE} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorGuidedCandidate} from './lib/spring-sector-guided-candidate.mjs';
import {boundSpringSectorHardware} from './lib/spring-sector-hardware-bounds.mjs';
import {springSectorFamilyMass} from './lib/spring-sector-mass.mjs';
import {surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-conformal-guide-fit';
const old = makeSpringSectorCandidate(), model = makeSpringSectorGuidedCandidate(), u = model.root.userData;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const edgeAxes = polygon => polygon.map((p, i) => {
  const q = polygon[(i + 1) % polygon.length], axis = [p[1] - q[1], q[0] - p[0]], length = Math.hypot(...axis);
  return length > 1e-15 ? axis.map(v => v / length) : null;
}).filter(Boolean);
function hull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = points.filter((p, i) => !i || Math.hypot(...p.map((v, j) => v - points[i - 1][j])) > 1e-12);
  const half = list => {
    const out = [];
    for (const p of list) {
      while (out.length > 1) {
        const a = out.at(-2), b = out.at(-1);
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 1e-15) break;
        out.pop();
      }
      out.push(p);
    }
    return out;
  };
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
}
const projection = (mesh, axes = [0, 2]) => surfaceTriangles(mesh.geometry).map(t => [t.a, t.b, t.c].map(p => {
  const v = p.applyMatrix4(mesh.matrixWorld).toArray(); return axes.map(i => v[i]);
}));
function polygonBoreMargin(rod, housing) {
  const polygon = hull(projection(rod).flat()), fixedAxes = edgeAxes(polygon);
  const fixed = fixedAxes.map(axis => {const r = polygon.map(p => dot(p, axis)); return {axis, low: Math.min(...r), high: Math.max(...r)};});
  let minimum = Infinity;
  for (const triangle of projection(housing)) {
    let gap = -Infinity;
    for (const {axis, low, high} of fixed) {
      const values = triangle.map(p => dot(p, axis));
      gap = Math.max(gap, Math.min(...values) - high, low - Math.max(...values));
    }
    for (const axis of edgeAxes(triangle)) {
      const a = polygon.map(p => dot(p, axis)), b = triangle.map(p => dot(p, axis));
      gap = Math.max(gap, Math.min(...a) - Math.max(...b), Math.min(...b) - Math.max(...a));
    }
    minimum = Math.min(minimum, gap);
  }
  return {hullVertices: polygon.length, margin: minimum};
}
const hardware = boundSpringSectorHardware(model);
assert(hardware.unresolved.every(p => p.method === 'slider-round-bore' ||
  (p.pair.some(n => n.endsWith('NotchBacking')) && p.pair.some(n => /SliderHousing[01]$/.test(n)))));
const boreBounds = [];
for (const record of hardware.pairs.filter(p => p.method === 'slider-round-bore')) {
  const rodName = record.pair.find(name => /GuideRod[01]$/.test(name)), housingName = record.pair.find(name => /SliderHousing[01]$/.test(name));
  const bound = polygonBoreMargin(u.parts[rodName], u.parts[housingName]);
  boreBounds.push({rod: rodName, housing: housingName, ...bound});
  record.method = 'actual-polygon-guide-bore'; record.margin = bound.margin - hardware.roundoff;
}
for (const record of hardware.pairs.filter(p => p.pair.some(n => n.endsWith('NotchBacking')) && p.method === 'unresolved-box-overlap')) {
  const backing = record.pair.find(n => n.endsWith('NotchBacking')), moving = record.pair.find(n => n !== backing);
  const box = hardware.envelopes[moving], corners = [[box[0][0], box[1][0]], [box[0][1], box[1][0]],
    [box[0][1], box[1][1]], [box[0][0], box[1][1]]];
  let minimum = Infinity;
  for (const triangle of projection(u.parts[backing], [0, 1])) {
    let gap = -Infinity;
    for (const axis of [[1, 0], [0, 1], ...edgeAxes(triangle)]) {
      const a = triangle.map(p => dot(p, axis)), b = corners.map(p => dot(p, axis));
      gap = Math.max(gap, Math.min(...a) - Math.max(...b), Math.min(...b) - Math.max(...a));
    }
    minimum = Math.min(minimum, gap);
  }
  record.method = 'backing-triangle-housing-envelope'; record.margin = minimum - hardware.roundoff;
}
hardware.unresolved = hardware.pairs.filter(p => !(p.margin >= -hardware.tolerance));
hardware.passed = hardware.unresolved.length === 0;
hardware.minimumMargin = Math.min(...hardware.pairs.map(p => p.margin));
hardware.counts = {};
for (const p of hardware.pairs) hardware.counts[p.method] = (hardware.counts[p.method] ?? 0) + 1;
// Cardinal generators supply both transverse force directions at both ends
// of each slider. Check their actual rod/housing surfaces, at guide extremes
// and several shaft angles. The original rods must fail this same fit check.
const fit = {poses: 0, points: 0, oldMaximumRodGap: 0, maximumRodGap: 0, maximumHousingGap: 0, maximumNormalConeError: 0};
const rods = Object.keys(u.parts).filter(name => /GuideRod[01]$/.test(name));
const surfaces = new Map(), triangles = new Map();
for (const candidate of [old, model]) for (const name of [...rods, ...rods.map(n => n.replace('GuideRod', 'SliderHousing'))])
  surfaces.set(candidate === old ? 'old:' + name : name, solidSurface(candidate.root.userData.parts[name].geometry));
for (const name of [...rods, ...rods.map(n => n.replace('GuideRod', 'SliderHousing'))])
  triangles.set(name, surfaceTriangles(u.parts[name].geometry));
const coneError = (name, point, wanted) => {
  const normals = [], nearest = new THREE.Vector3();
  for (const triangle of triangles.get(name)) if (triangle.closestPointToPoint(point, nearest).distanceTo(point) < 1e-7) {
    const normal = triangle.getNormal(new THREE.Vector3());
    if (!normals.some(n => n.distanceTo(normal) < 1e-10)) normals.push(normal);
  }
  let error = Infinity;
  for (let i = 0; i < normals.length; i++) {
    const a = normals[i], p = a.dot(wanted);
    if (p >= 0) error = Math.min(error, a.clone().multiplyScalar(p).distanceTo(wanted));
    for (let j = i + 1; j < normals.length; j++) {
      const b = normals[j], ab = a.dot(b), q = b.dot(wanted), det = 1 - ab * ab;
      if (det < 1e-12) continue;
      const x = (p - ab * q) / det, y = (q - ab * p) / det;
      if (x >= 0 && y >= 0) error = Math.min(error, a.clone().multiplyScalar(x).addScaledVector(b, y).distanceTo(wanted));
    }
  }
  return error;
};
for (const lift of [-.06, .06, .18]) for (const shaftAngle of [-.22, 0, .22]) {
  const state = {shaftAngle, lifts: [lift, lift]}; old.setState(state); model.setState(state); fit.poses++;
  for (const rodName of rods) {
    const housingName = rodName.replace('GuideRod', 'SliderHousing'), rod = u.parts[rodName], housing = u.parts[housingName];
    const inverseRod = rod.matrixWorld.clone().invert(), inverseHousing = housing.matrixWorld.clone().invert();
    const inverseOld = old.root.userData.parts[rodName].matrixWorld.clone().invert();
    // A rod-local XY point maps to the transverse plane after the fixed
    // -pi/2 rotation. Local Z is its axial station in the shaft frame.
    for (const axial of [-.58 + lift, -.48 + lift]) for (const xy of [[.018, 0], [-.018, 0], [0, .018], [0, -.018]]) {
      const point = new THREE.Vector3(...xy, axial).applyMatrix4(rod.matrixWorld);
      fit.maximumRodGap = Math.max(fit.maximumRodGap, surfaces.get(rodName).distance(point.clone().applyMatrix4(inverseRod)));
      fit.maximumHousingGap = Math.max(fit.maximumHousingGap, surfaces.get(housingName).distance(point.clone().applyMatrix4(inverseHousing)));
      fit.oldMaximumRodGap = Math.max(fit.oldMaximumRodGap, surfaces.get('old:' + rodName).distance(point.clone().applyMatrix4(inverseOld)));
      const rodNormal = new THREE.Vector3(...xy, 0).normalize();
      const housingNormal = rodNormal.clone().transformDirection(rod.matrixWorld).negate().transformDirection(inverseHousing);
      fit.maximumNormalConeError = Math.max(fit.maximumNormalConeError,
        coneError(rodName, point.clone().applyMatrix4(inverseRod), rodNormal),
        coneError(housingName, point.clone().applyMatrix4(inverseHousing), housingNormal));
      fit.points++;
    }
  }
}
assert(fit.maximumRodGap < 1e-7 && fit.maximumHousingGap < 1e-7 && fit.oldMaximumRodGap > .0029);
assert(fit.maximumNormalConeError < 1e-8);
// Four axial stations supply signed X and Z components. Opposite walls
// realize each sign with compressive normal forces. A right inverse proves
// that these contacts span every compatible prismatic-guide wrench, while
// supplying no force along the freely sliding Y direction.
const columns = [];
for (const x of [-.09, .09]) for (const y of [-.58, -.48]) {
  const z = -.17;
  columns.push([1, 0, 0, z, -y], [0, 1, y, -x, 0]);
}
const gram = Array.from({length: 5}, (_, i) => Array.from({length: 10}, (_, j) =>
  j < 5 ? columns.reduce((sum, c) => sum + c[i] * c[j], 0) : Number(j - 5 === i)));
let minimumPivot = Infinity;
for (let i = 0; i < 5; i++) {
  let pivot = i; for (let j = i + 1; j < 5; j++) if (Math.abs(gram[j][i]) > Math.abs(gram[pivot][i])) pivot = j;
  [gram[i], gram[pivot]] = [gram[pivot], gram[i]];
  const d = gram[i][i]; assert(Math.abs(d) > 1e-10); minimumPivot = Math.min(minimumPivot, Math.abs(d));
  gram[i] = gram[i].map(v => v / d);
  for (let j = 0; j < 5; j++) if (j !== i) {const f = gram[j][i]; gram[j] = gram[j].map((v, k) => v - f * gram[i][k]);}
}
const rightInverse = columns.map(c => Array.from({length: 5}, (_, j) => c.reduce((sum, v, i) => sum + v * gram[i][5 + j], 0)));
let wrenchResidual = 0;
for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
  wrenchResidual = Math.max(wrenchResidual, Math.abs(columns.reduce((sum, c, k) => sum + c[i] * rightInverse[k][j], 0) - Number(i === j)));
assert(wrenchResidual < 1e-10);
const wrenchSpan = {components: ['Fx', 'Fz', 'Mx', 'My', 'Mz'], freeDirection: 'Y', rank: 5, columns, rightInverse,
  minimumPivot, maximumResidual: wrenchResidual,
  rearArgument: 'The rear guide is a Z reflection of the front guide. Reflection is invertible and preserves rank and compressive normal-cone realizability.',
  qualification: 'Unbounded ideal bearing capacity is assumed. This proves existence of a compatible reaction distribution; pressure, compliance and stress are not determined.'};
// Transfer of the existing free-contact trajectories is justified only for
// meshes and masses that remain exactly identical. Record every changed mesh.
old.setState(); model.setState();
const changedMeshes = [], unchangedMeshes = [], addedMeshes = [];
for (const [name, mesh] of Object.entries(u.parts)) {
  const before = old.root.userData.parts[name];
  if (!before) {addedMeshes.push(name); continue;}
  const a = mesh.geometry, b = before.geometry;
  const same = JSON.stringify(a.index?.array) === JSON.stringify(b.index?.array)
    && ['position', 'normal'].every(k => Buffer.from(a.attributes[k].array.buffer).equals(Buffer.from(b.attributes[k].array.buffer)));
  (same ? unchangedMeshes : changedMeshes).push(name);
  assert.deepEqual(mesh.matrixWorld.elements, before.matrixWorld.elements);
}
assert.deepEqual(changedMeshes.sort(), [...rods, 'frontHubCover', 'rearHubCover'].sort());
assert.deepEqual(addedMeshes.sort(), ['frontNotchBacking', 'rearNotchBacking']);
const massParity = ['wheel', 'front', 'rear'].map(family => {
  const a = springSectorFamilyMass(old, family), b = springSectorFamilyMass(model, family); assert.deepEqual(a, b);
  return {family, volume: b.volume, first: b.first, second: b.second};
});
const topology = Object.entries(u.parts).map(([name, mesh]) => {
  const edges = new Map(), triangles = surfaceTriangles(mesh.geometry); let volume = 0, degenerate = 0;
  for (const t of triangles) {
    volume += t.a.dot(t.b.clone().cross(t.c)) / 6;
    if (t.getArea() < 1e-12) degenerate++;
    const keys = [t.a, t.b, t.c].map(v => v.toArray().map(x => Math.round(x * 1e8)).join(','));
    for (let i = 0; i < 3; i++) {
      const a = keys[i], b = keys[(i + 1) % 3], key = a < b ? a + '/' + b : b + '/' + a;
      const edge = edges.get(key) ?? {count: 0, sign: 0}; edge.count++; edge.sign += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  const invalidEdges = [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length;
  return {name, triangles: triangles.length, volume, degenerate, invalidEdges, passed: volume > 0 && !degenerate && !invalidEdges};
});
assert(topology.every(t => t.passed));
const poses = [];
for (let i = 0; i <= 24; i++) {
  const state = {shaftAngle: .22 * Math.cos(i), wheelAngle: .318 * i,
    lifts: [.06 + .12 * Math.sin(i), .06 + .12 * Math.cos(i)]}; old.setState(state); model.setState(state);
  for (const name of unchangedMeshes) {
    assert.deepEqual(u.parts[name].matrixWorld.elements, old.root.userData.parts[name].matrixWorld.elements);
    if (/Spring[01]$/.test(name)) assert.deepEqual(u.parts[name].geometry.attributes.position.array, old.root.userData.parts[name].geometry.attributes.position.array);
  }
  poses.push(state);
}
const files = ['scripts/check-spring-sector-guide-fit.mjs', 'scripts/lib/spring-sector-guided-candidate.mjs',
  'scripts/lib/spring-sector-hardware-bounds.mjs', 'scripts/lib/spring-sector-mass.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-linkage.mjs', 'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-rack-coil.mjs',
  'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'conformal-prismatic-guide-candidate', productionChanged: false, mechanicsPassed: false,
  passed: hardware.passed, hardware, boreBounds, fit, wrenchSpan, topology, changedMeshes, addedMeshes, unchangedMeshes, massParity, parityPoses: poses, guideFit: u.guideFit, sources,
  qualification: 'Only shaft-family hardware changes: four conformal guide rods, two circular hub faces and two rear notch-backing plates. The existing free-body geometry, mass, motion transforms and four spring recipes remain identical. Actual projected triangles bound the conformal polygon bores and backing plates through the full guide travel. Compressive surface-normal contacts span every compatible ideal prismatic-guide wrench. Bearing pressures, elastic deflection and stress limits are outside this reconstruction; updated shaft-family input loading is checked separately.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({passed: report.passed, changedMeshes, boreBounds, fit, hardwareMargin: hardware.minimumMargin, unresolved: hardware.unresolved});
if (!report.passed) process.exitCode = 1;
