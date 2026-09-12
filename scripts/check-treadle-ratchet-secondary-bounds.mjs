import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetInputBounds} from './lib/treadle-ratchet-input-bounds.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-startup-sixteenth-ms-dynamics.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-first-secondary-bounds.json';
const data = JSON.parse(fs.readFileSync(input)), candidate = makeTreadleRatchetCandidate(data.geometry), u = candidate.root.userData;
const p = u.linkage.parameters, bounds = makeTreadleRatchetInputBounds(u.linkage), tolerance = 1e-6, roundoff = 1e-10;
const minimumStep = Number(process.env.PROBE_MIN_INTERVAL ?? 1 / 2048), hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
assert(data.failures.length === 0 && data.rows.length > 1 && minimumStep > 0);
const freeSpeeds = [0, 0, 0];
for (let i = 1; i < data.rows.length; i++) {
  const a = data.rows[i - 1], b = data.rows[i]; assert(b.time > a.time);
  b.x.forEach((v, j) => {assert(Number.isFinite(v)); freeSpeeds[j] = Math.max(freeSpeeds[j], Math.abs((v - a.x[j]) / (b.time - a.time)));});
}
const sample = time => {
  let lo = 0, hi = data.rows.length - 1;
  while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (data.rows[mid].time <= time) lo = mid; else hi = mid;}
  const a = data.rows[lo], b = data.rows[hi], f = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
  return a.x.map((v, i) => v + f * (b.x[i] - v));
};
const unique = points => [...new Map(points.map(v => [v.toArray().join(','), v])).values()];
const directions = values => {
  const result = [], seen = new Set();
  for (const raw of values) {
    if (raw.lengthSq() < 1e-20) continue;
    const v = raw.clone().normalize(), first = v.toArray().find(x => Math.abs(x) > 1e-10);
    if (first < 0) v.negate();
    const key = v.toArray().map(x => x.toFixed(9)).join(',');
    if (!seen.has(key)) {seen.add(key); result.push(v);}
  }
  return result;
};
const boxOf = points => ['x', 'y', 'z'].map(axis => [Math.min(...points.map(v => v[axis])), Math.max(...points.map(v => v[axis]))]);
const centroid = points => points.reduce((sum, v) => sum.add(v), new THREE.Vector3()).multiplyScalar(1 / points.length);
const boxPoints = box => [0, 1].flatMap(i => [0, 1].flatMap(j => [0, 1].map(k => new THREE.Vector3(box[0][i], box[1][j], box[2][k]))));
const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const hullOf = points => {
  const hull = new ConvexHull().setFromPoints(unique(points)), vertices = [], edges = [];
  for (const face of hull.faces) {
    for (const v of points) assert(face.distanceToPoint(v) <= roundoff, 'Hull must contain every actual vertex');
    let edge = face.edge;
    do {vertices.push(edge.head().point); edges.push(edge.head().point.clone().sub(edge.tail().point)); edge = edge.next;} while (edge !== face.edge);
  }
  return {points: unique(vertices), normals: directions(hull.faces.map(f => f.normal)), edges: directions(edges)};
};
const pointSegment = (a, b) => {
  const d = b.map((v, i) => v - a[i]), n = d[0] ** 2 + d[1] ** 2;
  const t = n ? Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1]) / n)) : 0;
  return Math.hypot(a[0] + t * d[0], a[1] + t * d[1]);
};
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const parts = Object.entries(u.parts).map(([name, mesh]) => {
  mesh.updateMatrix(); const g = mesh.geometry, a = g.attributes.position;
  const vertices = Array.from({length: a.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrix));
  const family = u.families[name], radius = Math.max(...vertices.map(v => Math.hypot(v.x, v.y))), box = boxOf(vertices);
  const radialMinimum = center => {
    let minimum = Infinity;
    for (let i = 0; i < (g.index?.count ?? a.count); i += 3) {
      const v = [0, 1, 2].map(j => vertices[g.index ? g.index.getX(i + j) : i + j]).map(q => [q.x - center[0], q.y - center[1]]);
      const signs = v.map((q, j) => cross(q, v[(j + 1) % 3]));
      if (signs.reduce((s, x) => s + x, 0) !== 0 && (signs.every(x => x >= 0) || signs.every(x => x <= 0))) return 0;
      minimum = Math.min(minimum, ...v.map((q, j) => pointSegment(q, v[(j + 1) % 3])));
    }
    return minimum;
  };
  let speed = 0, enclosure = name === 'strap' ? null : hullOf(vertices), fixedEnclosure = family === 'fixed';
  if (family === 'wheel') {
    const outer = radius / Math.cos(Math.PI / 32) + roundoff;
    enclosure = hullOf(box[2].flatMap(z => Array.from({length: 32}, (_, i) =>
      new THREE.Vector3(outer * Math.cos(2 * Math.PI * i / 32), outer * Math.sin(2 * Math.PI * i / 32), z))));
    fixedEnclosure = true;
  } else if (family === 'pulley') {
    const r = Math.max(...vertices.map(v => Math.hypot(v.y - p.pulley[1], v.z)));
    enclosure = {points: boxPoints([box[0], [p.pulley[1] - r, p.pulley[1] + r], [-r, r]]), normals: axes, edges: axes}; fixedEnclosure = true;
  } else if (family === 'strap') speed = bounds.strapPointSpeed;
  else if (family !== 'fixed') {
    const i = family.startsWith('lower') ? 0 : 1, limb = bounds.limbs[i];
    if (family.endsWith('Arm')) speed = radius * limb.armSpeed;
    else if (family.endsWith('Treadle')) speed = radius * bounds.treadleSpeed[i];
    else if (family.endsWith('Rod')) speed = limb.topSpeed + radius * limb.rodAngularSpeed;
    else if (family.endsWith('Pawl')) speed = limb.pawlPivotSpeed + radius * freeSpeeds[i + 1];
    else if (family.endsWith('StrapEye')) speed = Math.hypot(...p.strapLocal) * bounds.treadleSpeed[i];
    else throw Error('Unknown moving family: ' + family);
  }
  const constantZ = family === 'pulley' ? boxOf(enclosure.points)[2] : box[2];
  return {name, mesh, family, vertices, radialMinimum, enclosure, fixedEnclosure, speed, constantZ};
});
const byName = Object.fromEntries(parts.map(part => [part.name, part])), pairId = (a, b) => [a, b].sort().join('/');
const boreDefinitions = [['ratchetBody', 'wheelAxle', [0, 0], [0, 0]], ['ratchetFace', 'wheelAxle', [0, 0], [0, 0]]];
for (const [i, a] of p.arms.entries()) {
  const key = a.name;
  boreDefinitions.push([key + 'ArmBody', 'wheelAxle', [0, 0], [0, 0]],
    [key + 'PawlBody', key + 'PawlPin', [0, 0], a.pawlLocal],
    [key + 'RodUpperEye', key + 'RodTopPin', [0, 0], a.armRodLocal],
    [key + 'RodLowerEye', key + 'RodBottomPin', [a.rodLength, 0], a.rodLocal],
    [key + 'TreadleBody', 'treadleAxle', [0, 0], p.fulcrum],
    [key + 'StrapEye', key + 'StrapPin', [0, 0], p.strapLocal]);
}
const bores = new Map(boreDefinitions.map(([bore, shaft, center, shaftCenter]) => {
  const inner = byName[bore].radialMinimum(center);
  const outer = Math.max(...byName[shaft].vertices.map(v => Math.hypot(v.x - shaftCenter[0], v.y - shaftCenter[1])));
  const gap = inner - outer - roundoff; assert(gap > 0);
  return [pairId(bore, shaft), {bore, shaft, inner, outer, gap}];
}));
const delegateFile = 'artifacts/review/082-pulley-shaft-strap-clearance.json', delegate = JSON.parse(fs.readFileSync(delegateFile));
assert(delegate.passed);
for (const s of delegate.sources) assert.equal(hash(s.file), s.sha256, 'Pulley clearance source changed: ' + s.file);
const delegated = new Map([['pulleyAxle', delegate.shaftGap], ['strap', delegate.strapGap], ...delegate.supports.map(s => [s.name, s.gap])]
  .map(([name, gap]) => [pairId('pulleyBody', name), gap]));
delegated.set(pairId('pulleyAxle', 'strap'), delegate.strapShaftGap);
const pairs = [];
for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
  const a = parts[i], b = parts[j], id = pairId(a.name, b.name);
  if (a.family === b.family || (a.name === 'strap' && b.name.endsWith('StrapEye')) || (b.name === 'strap' && a.name.endsWith('StrapEye'))) continue;
  const zGap = Math.max(a.constantZ[0] - b.constantZ[1], b.constantZ[0] - a.constantZ[1]) - roundoff;
  let kind = 'swept-hull', minimum = Infinity;
  if (zGap >= -tolerance) {kind = 'axial'; minimum = zGap;}
  else if (bores.has(id)) {kind = 'bore'; minimum = bores.get(id).gap;}
  else if (delegated.has(id)) {kind = 'pulley-bound'; minimum = delegated.get(id);}
  else if ((a.name === 'ratchetBody' && b.family.endsWith('Pawl')) || (b.name === 'ratchetBody' && a.family.endsWith('Pawl'))) kind = 'primary-profile';
  pairs.push({id, a, b, kind, minimum, certifiedIntervals: 0});
}
const transform = part => {
  if (part.name === 'strap') {
    const a = part.mesh.geometry.attributes.position, points = Array.from({length: a.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(a, i));
    return [points.slice(0, 8), points.slice(4, -4), points.slice(-8)].map(list => {
      const box = boxOf(list), points = boxPoints(box); return {points, box, center: centroid(points), normals: axes, edges: axes};
    });
  }
  const matrix = part.fixedEnclosure ? new THREE.Matrix4() : u.blocks[part.family].matrixWorld;
  const h = part.enclosure, points = h.points.map(v => v.clone().applyMatrix4(matrix));
  return [{points, box: boxOf(points), center: centroid(points), normals: h.normals.map(v => v.clone().transformDirection(matrix)), edges: h.edges.map(v => v.clone().transformDirection(matrix))}];
};
const separation = (a, b, required) => {
  let best = Math.max(...a.box.map((v, i) => Math.max(v[0] - b.box[i][1], b.box[i][0] - v[1])));
  if (best >= required) return best;
  // Both vertex centroids lie inside their convex hulls. Their distance is
  // an upper bound on separation, so a larger margin cannot pass any axis.
  const between = a.center.clone().sub(b.center);
  if (between.length() + roundoff < required) return best;
  const check = axis => {
    if (axis.lengthSq() < 1e-20) return false;
    axis.normalize();
    const A = a.points.map(v => v.dot(axis)), B = b.points.map(v => v.dot(axis));
    best = Math.max(best, Math.min(...A) - Math.max(...B), Math.min(...B) - Math.max(...A));
    return best >= required;
  };
  if (check(between)) return best;
  for (const normal of [...a.normals, ...b.normals]) if (check(normal.clone())) return best;
  for (const x of a.edges) for (const y of b.edges) if (check(x.clone().cross(y))) return best;
  return best;
};
const strapRounding = 2 * Math.hypot(Math.abs(p.fulcrum[0]) + Math.hypot(...p.strapLocal) + .1,
  Math.abs(p.fulcrum[1]) + Math.hypot(...p.strapLocal) + .1, p.radius + .006) * 2 ** -24;
const failures = [], stack = [{start: data.rows[0].time, end: data.rows.at(-1).time, pending: pairs.filter(r => r.kind === 'swept-hull')}];
let intervals = 0, testedPairs = 0;
while (stack.length) {
  const {start, end, pending} = stack.pop(), time = (start + end) / 2, half = (end - start) / 2, x = sample(time);
  candidate.setState({time, wheelAngle: x[0], pawlAngles: x.slice(1)}); intervals++;
  const world = new Map(), remaining = [];
  for (const pair of pending) {
    for (const part of [pair.a, pair.b]) if (!world.has(part.name)) world.set(part.name, transform(part));
    const motion = half * (pair.a.speed + pair.b.speed) + roundoff + (pair.a.name === 'strap' || pair.b.name === 'strap' ? strapRounding : 0);
    let gap = Infinity;
    for (const a of world.get(pair.a.name)) for (const b of world.get(pair.b.name)) gap = Math.min(gap, separation(a, b, motion - tolerance));
    const lower = gap - motion; testedPairs++;
    if (lower >= -tolerance) {pair.minimum = Math.min(pair.minimum, lower); pair.certifiedIntervals++;}
    else if (end - start <= minimumStep) failures.push({id: pair.id, start, end, time, lower, midpointHullGap: gap});
    else remaining.push(pair);
  }
  if (remaining.length) stack.push({start: time, end, pending: remaining}, {start, end: time, pending: remaining});
  if (intervals % 1000 === 0) console.log({intervals, testedPairs, failures: failures.length, pendingIntervals: stack.length, time});
}
const rows = pairs.map(({a, b, ...r}) => ({...r, a: a.name, b: b.name}));
const files = [input, delegateFile, 'scripts/check-treadle-ratchet-secondary-bounds.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-input-bounds.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 82, passed: failures.length === 0, productionChanged: false, mechanicsPassed: false, status: 'continuous-secondary-enclosure-study',
  tolerance, minimumStep, intervals, testedPairs, freeSpeeds, pairs: rows, bores: [...bores.values()], failures, sources,
  classification: Object.fromEntries([...new Set(rows.map(r => r.kind))].map(kind => [kind, rows.filter(r => r.kind === kind).length])),
  qualification: 'Constant axial layers, concentric finite-mesh bores, seven delegated pulley bounds, or swept convex enclosures cover secondary pairs. Actual rigid vertices lie inside each hull. World boxes split the strap into two legs and its upper wrap. Whole-stroke input speed bounds and maximum slopes of the free-angle linear interpolant bound vertex travel from interval midpoints; Float32 strap rounding is added. Circumscribed wheel polygons and the pulley cylinder box cover every spin angle. The two finite pawl/ratchet primary pairs remain explicitly delegated and unqualified by this study. Failed hull bounds are unresolved and need not imply actual mesh intersections.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({passed: report.passed, intervals, testedPairs, classification: report.classification, failures: failures.length, firstFailures: failures.slice(0, 12)});
if (!report.passed) process.exitCode = 1;
