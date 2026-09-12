import {makeSpringSectorContact} from './spring-sector-contact.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rotateZ = (v, q) => [q.c * v[0] - q.s * v[1], q.s * v[0] + q.c * v[1], v[2]];
const rotateY = (v, q) => [q.c * v[0] + q.s * v[2], v[1], -q.s * v[0] + q.c * v[2]];
const projection = (vertices, axis) => {
  let low = Infinity, high = -Infinity;
  for (const v of vertices) {const p = dot(v, axis); low = Math.min(low, p); high = Math.max(high, p);}
  return {low, high};
};
const separation = (a, b, axis) => {
  const A = projection(a.vertices, axis), B = projection(b.vertices, axis);
  return [B.low - A.high, A.low - B.high];
};
function* axes(a, b) {
  yield* a.normals; yield* b.normals;
  for (const e of a.edges) for (const f of b.edges) {
    const n = cross(e, f), length = Math.hypot(...n);
    if (length > 1e-12) yield n.map(v => v / length);
  }
}

// Independent continuous SAT certificates for the actual convex plate cells
// and crown wedges. A fixed separating axis need not remain a face normal.
// Endpoint projections minus chord-deviation bounds cover every intermediate
// point of each solid, including a change of active tooth/contact feature.
export function makeSpringSectorSweep(candidate, parameters, {tolerance = 1e-6, maximumDepth = 16, roundoff = 1e-10} = {}) {
  if (!(Number.isFinite(parameters.period) && parameters.period > 0 && Number.isFinite(parameters.amplitude)
    && Number.isFinite(tolerance) && tolerance > 0 && Number.isFinite(roundoff) && roundoff >= 0
    && Number.isInteger(maximumDepth) && maximumDepth >= 0)) throw Error('Invalid sweep parameters');
  const contact = makeSpringSectorContact(candidate), g = candidate.root.userData.geometry;
  const cells = contact.cells.map(list => list.map(cell => ({...cell, radius: Math.max(...cell.vertices.map(v => Math.hypot(v[0], v[1])))})));
  const teeth = contact.teeth.map(t => ({...t, radius: Math.max(...t.cell.vertices.map(v => Math.hypot(v[0], v[2])))}));
  const omega = 2 * Math.PI / parameters.period, speedBound = Math.abs(parameters.amplitude * omega);
  const accelerationBound = Math.abs(parameters.amplitude * omega * omega);
  const crownTop = Math.max(...teeth.flatMap(t => t.cell.vertices.map(v => v[1]))), cache = new Map();
  const pose = state => {
    const q = -parameters.amplitude * Math.cos(omega * state.time);
    return {...state, q: {c: Math.cos(q), s: Math.sin(q)}, theta: {c: Math.cos(state.x[0]), s: Math.sin(state.x[0])}};
  };
  const midpoint = (a, b) => pose({time: (a.time + b.time) / 2, x: a.x.map((v, i) => (v + b.x[i]) / 2)});
  const sector = (cell, side, state) => {
    const q = state.q, lift = state.x[side + 1], plane = (side === 0 ? 1 : -1) * g.wheelPitchRadius;
    return {vertices: cell.vertices.map(v => {
      const p = rotateZ(v, q); return [p[0] - q.s * lift, p[1] + q.c * lift, p[2] + plane];
    }), normals: cell.normals.map(v => rotateZ(v, q)), edges: cell.edges.map(v => rotateZ(v, q))};
  };
  const wheel = (tooth, state) => ({vertices: tooth.cell.vertices.map(v => rotateY(v, state.theta)),
    normals: tooth.cell.normals.map(v => rotateY(v, state.theta)), edges: tooth.cell.edges.map(v => rotateY(v, state.theta))});
  const sectorChord = (cell, side, a, b) => {
    const dt = b.time - a.time, lift = Math.max(Math.abs(a.x[side + 1]), Math.abs(b.x[side + 1]));
    const liftSpeed = Math.abs(b.x[side + 1] - a.x[side + 1]) / dt;
    // P'' = R(q)[(q'' K - q'^2 I)(v + s e_y) + 2 q' K s' e_y].
    const bound = (accelerationBound + speedBound ** 2) * (cell.radius + lift) + 2 * speedBound * liftSpeed;
    return bound * dt ** 2 / 8;
  };
  const wheelChord = (tooth, a, b) => tooth.radius * (b.x[0] - a.x[0]) ** 2 / 8;
  function checkStep(start, end) {
    for (const state of [start, end]) if (!(Number.isFinite(state.time) && state.x?.length === 3
      && Array.from(state.x).every(Number.isFinite))) throw Error('Sweep needs finite states');
    if (!(end.time > start.time)) throw Error('Sweep needs an increasing time interval');
    const a = pose(start), b = pose(end), wa = teeth.map(t => wheel(t, a)), wb = teeth.map(t => wheel(t, b));
    const stats = {pairs: 0, heightExcluded: 0, boxExcluded: 0, axisCertificates: 0, subdivisions: 0,
      minimumCertifiedGap: Infinity, minimumBodyPlaneGap: Infinity, maximumDepth: 0};
    let failure = null;
    const certify = (cell, side, tooth, A, B, C, D, left, right, depth, key) => {
      stats.maximumDepth = Math.max(stats.maximumDepth, depth);
      const ca = sectorChord(cell, side, left, right), cb = wheelChord(tooth, left, right);
      const tryAxis = n => {
        const first = separation(A, C, n), last = separation(B, D, n);
        const gap = Math.max(Math.min(first[0], last[0]), Math.min(first[1], last[1]))
          - ca * Math.hypot(n[0], n[1]) - cb * Math.hypot(n[0], n[2]) - roundoff;
        if (gap < -tolerance) return false;
        stats.minimumCertifiedGap = Math.min(stats.minimumCertifiedGap, gap); cache.set(key, n); return true;
      };
      for (const n of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) if (tryAxis(n)) {stats.boxExcluded++; return true;}
      const previous = cache.get(key);
      if (previous && tryAxis(previous)) {stats.axisCertificates++; return true;}
      const mid = midpoint(left, right), M = sector(cell, side, mid), N = wheel(tooth, mid);
      let midpointSeparation = -Infinity;
      for (const n of axes(M, N)) {
        if (tryAxis(n)) {stats.axisCertificates++; return true;}
        midpointSeparation = Math.max(midpointSeparation, ...separation(M, N, n));
      }
      if (midpointSeparation < -tolerance - roundoff || depth >= maximumDepth) {
        failure = {kind: midpointSeparation < -tolerance - roundoff ? 'interior-penetration' : 'unresolved-bound',
          time: mid.time, x: mid.x, side, tooth: tooth.name, cell: key % cells[side].length,
          midpointSeparation, depth, interval: [left.time, right.time]};
        return false;
      }
      stats.subdivisions++;
      return certify(cell, side, tooth, A, M, C, N, left, mid, depth + 1, key)
        && certify(cell, side, tooth, M, B, N, D, mid, right, depth + 1, key);
    };
    for (let side = 0; side < 2; side++) for (let index = 0; index < cells[side].length; index++) {
      const cell = cells[side][index], chord = sectorChord(cell, side, a, b);
      const minimumY = state => Math.min(...cell.vertices.slice(0, 3).map(v => state.q.s * v[0] + state.q.c * (v[1] + state.x[side + 1])));
      const lowerY = Math.min(minimumY(a), minimumY(b)) - chord - roundoff;
      stats.minimumBodyPlaneGap = Math.min(stats.minimumBodyPlaneGap, lowerY - g.wheelTop);
      if (lowerY < g.wheelTop - tolerance) return {passed: false, stats,
        failure: {kind: 'wheel-body-plane-unresolved', side, cell: index, lowerY, time: a.time}};
      if (lowerY > crownTop + tolerance) {stats.heightExcluded += teeth.length; stats.pairs += teeth.length; continue;}
      const A = sector(cell, side, a), B = sector(cell, side, b);
      for (let i = 0; i < teeth.length; i++) {
        stats.pairs++;
        const key = (side * teeth.length + i) * cells[side].length + index;
        if (!certify(cell, side, teeth[i], A, B, wa[i], wb[i], a, b, 0, key)) return {passed: false, stats, failure};
      }
    }
    return {passed: true, stats};
  }
  return {checkStep, cells: cells.map(c => c.length), teeth: teeth.length, tolerance, roundoff,
    qualification: 'Fixed-axis convex-cell separation with analytic second-derivative chord bounds for exact sinusoidal input and linearly interpolated wheel/lifts. Covers both complete sector/crown pairs and separation above the wheel body. Other hardware and spring self-contact are outside this check.'};
}
