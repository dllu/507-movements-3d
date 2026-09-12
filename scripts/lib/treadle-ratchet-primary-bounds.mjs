import assert from 'node:assert/strict';
import {makeTreadleRatchetInputBounds} from './treadle-ratchet-input-bounds.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0], norm = v => Math.hypot(...v);
const rotate = (v, angle) => [v[0] * Math.cos(angle) - v[1] * Math.sin(angle), v[0] * Math.sin(angle) + v[1] * Math.cos(angle)];
const box = vertices => [0, 1].map(i => [Math.min(...vertices.map(v => v[i])), Math.max(...vertices.map(v => v[i]))]);
const overlaps = (a, b) => a.every((v, i) => v[0] <= b[i][1] && b[i][0] <= v[1]);
const normals = vertices => vertices.map((v, i) => {
  const d = sub(vertices[(i + 1) % vertices.length], v), length = norm(d); assert(length > 0); return [-d[1] / length, d[0] / length];
});
const distanceToOrigin = vertices => {
  const signs = vertices.map((v, i) => cross(v, vertices[(i + 1) % vertices.length]));
  if (signs.every(v => v >= 0) || signs.every(v => v <= 0)) return 0;
  return Math.min(...vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length], d = sub(b, a), square = dot(d, d);
    const t = square ? Math.max(0, Math.min(1, -dot(a, d) / square)) : 0;
    return Math.hypot(a[0] + t * d[0], a[1] + t * d[1]);
  }));
};
const projection = (vertices, n) => {const values = vertices.map(v => dot(v, n)); return [Math.min(...values), Math.max(...values)];};
const gapOnAxis = (a, b, n) => {
  const A = projection(a, n), B = projection(b, n); return [A[0] - B[1], B[0] - A[1]];
};

// Use every nondegenerate projected mesh triangle, deduplicating matching
// front/back caps. Thus the cell union contains the projection of the solid;
// no replacement tooth contour or filled convex pawl outline is introduced.
function cellsOf(mesh) {
  mesh.updateMatrix(); assert(mesh.matrix.equals(new mesh.matrix.constructor()), 'Primary meshes must use their local plate coordinates');
  const g = mesh.geometry, p = g.attributes.position, seen = new Set(), cells = [];
  for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map(j => {const k = g.index ? g.index.getX(i + j) : i + j; return [p.getX(k), p.getY(k)];});
    if (cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0])) === 0) continue;
    const signature = vertices.map(v => v.join(',')).sort().join('|'); if (seen.has(signature)) continue; seen.add(signature);
    cells.push({id: cells.length, vertices, normals: normals(vertices), box: box(vertices), radius: Math.max(...vertices.map(norm))});
  }
  assert(cells.length > 0); return cells;
}
function treeOf(cells) {
  const bounds = [0, 1].map(i => [Math.min(...cells.map(c => c.box[i][0])), Math.max(...cells.map(c => c.box[i][1]))]);
  if (cells.length <= 8) return {box: bounds, cells};
  const axis = bounds[1][1] - bounds[1][0] > bounds[0][1] - bounds[0][0] ? 1 : 0;
  const sorted = [...cells].sort((a, b) => a.box[axis][0] + a.box[axis][1] - b.box[axis][0] - b.box[axis][1]);
  const mid = sorted.length >> 1; return {box: bounds, children: [treeOf(sorted.slice(0, mid)), treeOf(sorted.slice(mid))]};
}
function query(tree, bounds, output) {
  if (!overlaps(tree.box, bounds)) return;
  if (tree.cells) for (const cell of tree.cells) {if (overlaps(cell.box, bounds)) output.push(cell);}
  else for (const child of tree.children) query(child, bounds, output);
}

export function makeTreadleRatchetPrimaryBounds(candidate) {
  const u = candidate.root.userData, p = u.linkage.parameters, inputBounds = makeTreadleRatchetInputBounds(u.linkage);
  const wheel = cellsOf(u.parts.ratchetBody), pawls = ['lower', 'upper'].map(key => cellsOf(u.parts[key + 'PawlBody']));
  const tree = treeOf(wheel), wheelRadius = Math.max(...wheel.map(c => c.radius));
  const R = norm(p.strapLocal), T = inputBounds.T[1], dx = Math.max(...inputBounds.dx.map(Math.abs));
  // F = (transverseLength² + dx² - targetLength²) / 2.
  // |Fff| and |Frr| <= R² + T*R + |dx|*R; |Ffr| <= R².
  const diagonalSecond = R * R + (T + dx) * R, mixedSecond = R * R;
  const [fv, rv] = inputBounds.treadleSpeed, frontAcceleration = p.amplitude * (2 * Math.PI / p.period) ** 2;
  const rearAcceleration = (Math.max(...inputBounds.Ff.map(Math.abs)) * frontAcceleration
    + diagonalSecond * (fv * fv + rv * rv) + 2 * mixedSecond * fv * rv) / Math.abs(inputBounds.Fr[1]) + 1e-10;
  const derivatives = inputBounds.limbs.map((limb, i) => {
    const a = p.arms[i], qv = inputBounds.treadleSpeed[i], qa = i ? rearAcceleration : frontAcceleration;
    const bottomAcceleration = norm(a.rodLocal) * (qa + qv * qv), relativeSpeed = limb.topSpeed + limb.bottomSpeed;
    const acceleration = (a.rodLength * (bottomAcceleration + a.armRodRadius * limb.armSpeed ** 2)
      + relativeSpeed ** 2) / limb.minimumCross + 1e-10;
    return {velocity: limb.armSpeed, acceleration, treadleAcceleration: qa};
  });
  const interval = (a, b, {tolerance = 1e-6, maximumDepth = 16} = {}) => {
    const dt = b.time - a.time; assert(dt > 0 && a.x.length === 3 && b.x.length === 3);
    const velocity = b.x.map((v, i) => (v - a.x[i]) / dt), roundoff = 1e-10, effectiveTolerance = tolerance - roundoff;
    assert(effectiveTolerance > 0 && velocity.every(Number.isFinite));
    const stats = {certifiedPairs: 0, radiallyExcludedPawlCells: 0, boxExcludedPairs: 0, subdivisions: 0, maximumDepth: 0, minimumLowerBound: Infinity};
    const failures = [], inputs = new Map(), poses = new Map();
    const at = time => {
      if (!inputs.has(time)) {
        const x = a.x.map((v, i) => v + (time - a.time) * velocity[i]);
        inputs.set(time, {x, linkage: u.linkage.atTime(time)});
      }
      return inputs.get(time);
    };
    const pose = (which, cell, time) => {
      const id = which + ':' + cell.id + ':' + time;
      if (!poses.has(id)) {
        const {x, linkage} = at(time), phi = linkage.arms[which].armAngle - x[0], alpha = x[which + 1] - x[0];
        const pivot = rotate(p.arms[which].pawlLocal, phi), vertices = cell.vertices.map(v => {
          const q = rotate(v, alpha); return [pivot[0] + q[0], pivot[1] + q[1]];
        });
        poses.set(id, {vertices, normals: cell.normals.map(n => rotate(n, alpha))});
      }
      return poses.get(id);
    };
    const boundPair = (which, local, cell, lo, hi, depth) => {
      const middle = (lo + hi) / 2, A = pose(which, local, lo), B = pose(which, local, hi), M = pose(which, local, middle);
      const phid = derivatives[which].velocity + Math.abs(velocity[0]), alphad = Math.abs(velocity[which + 1] - velocity[0]);
      const acceleration = norm(p.arms[which].pawlLocal) * (derivatives[which].acceleration + phid * phid) + local.radius * alphad * alphad;
      const curvature = acceleration * (hi - lo) ** 2 / 8; stats.maximumDepth = Math.max(stats.maximumDepth, depth);
      let bestMidpoint = -Infinity, bestLower = -Infinity;
      for (const axis of [...cell.normals, ...M.normals]) {
        const gapA = gapOnAxis(A.vertices, cell.vertices, axis), gapB = gapOnAxis(B.vertices, cell.vertices, axis);
        const lower = Math.max(...gapA.map((v, i) => Math.min(v, gapB[i]) - curvature));
        bestLower = Math.max(bestLower, lower);
        if (lower >= -effectiveTolerance) {
          stats.certifiedPairs++; stats.minimumLowerBound = Math.min(stats.minimumLowerBound, lower - roundoff); return;
        }
        bestMidpoint = Math.max(bestMidpoint, ...gapOnAxis(M.vertices, cell.vertices, axis));
      }
      if (bestMidpoint < -effectiveTolerance || depth >= maximumDepth) {
        failures.push({key: which ? 'upper' : 'lower', pawlCell: local.id, wheelCell: cell.id, lo, hi, time: middle,
          depth, lower: bestLower, midpointGap: bestMidpoint, x: at(middle).x,
          reason: bestMidpoint < -effectiveTolerance ? 'interpolated-triangle-overlap' : 'unresolved-curvature-bound'}); return;
      }
      stats.subdivisions++; boundPair(which, local, cell, lo, middle, depth + 1);
      if (!failures.length) boundPair(which, local, cell, middle, hi, depth + 1);
    };
    const middle = (a.time + b.time) / 2;
    for (let which = 0; which < 2; which++) for (const local of pawls[which]) {
      const phid = derivatives[which].velocity + Math.abs(velocity[0]), alphad = Math.abs(velocity[which + 1] - velocity[0]);
      const speed = norm(p.arms[which].pawlLocal) * phid + local.radius * alphad, padding = speed * dt / 2 + roundoff;
      const P = pose(which, local, middle);
      if (distanceToOrigin(P.vertices) > wheelRadius + padding) {stats.radiallyExcludedPawlCells++; continue;}
      const bounds = box(P.vertices).map(v => [v[0] - padding, v[1] + padding]), considered = [];
      query(tree, bounds, considered); stats.boxExcludedPairs += wheel.length - considered.length;
      for (const cell of considered) {
        boundPair(which, local, cell, a.time, b.time, 0);
        if (failures.length) return {passed: false, stats, failures};
      }
    }
    return {passed: true, stats, failures};
  };
  return {interval, parameters: {wheelCells: wheel.length, pawlCells: pawls.map(c => c.length), wheelRadius, derivatives, diagonalSecond, mixedSecond},
    qualification: 'Every nondegenerate projected mesh triangle is represented. In the wheel frame, a pawl vertex is R(armAngle-wheelAngle)*pivot + R(pawlAngle-wheelAngle)*localVertex. Whole-stroke arm speed/acceleration bounds and constant interpolated free-angle speeds bound its second derivative. A fixed separating axis at each subinterval gives endpoint projection gaps minus acceleration*dt²/8. Radial and box exclusions include the full first-derivative travel bound. This covers the actual wheel orientation along the supplied trajectory, not other pitch shifts or a future periodic extension.'};
}
