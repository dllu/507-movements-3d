import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rz = (v, a) => [Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1], v[2]];
const ry = (v, a) => [Math.cos(a) * v[0] + Math.sin(a) * v[2], v[1], -Math.sin(a) * v[0] + Math.cos(a) * v[2]];
const uniqueDirections = values => {
  const result = [];
  for (const v of values) {
    const length = Math.hypot(...v); if (length < 1e-12) continue;
    const n = v.map(x => x / length);
    if (!result.some(q => Math.hypot(...sub(q, n)) < 1e-12 || Math.hypot(...add(q, n)) < 1e-12)) result.push(n);
  }
  return result;
};
const bounds = points => ({low: [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))),
  high: [0, 1, 2].map(i => Math.max(...points.map(p => p[i])))});
const convex = (vertices, faces) => {
  const normals = [], edges = [];
  for (const face of faces) {
    normals.push(cross(sub(vertices[face[1]], vertices[face[0]]), sub(vertices[face[2]], vertices[face[0]])));
    for (let j = 0; j < face.length; j++) edges.push(sub(vertices[face[(j + 1) % face.length]], vertices[face[j]]));
  }
  const n = uniqueDirections(normals);
  // A triangulated top face is allowed, but no face may cut through its own
  // vertex hull. This catches using SAT on a concave tooth by accident.
  for (const [i, face] of faces.entries()) {
    const normal = normals[i], length = Math.hypot(...normal);
    if (!length) throw Error('Degenerate convex cell');
    const distances = vertices.map(v => dot(sub(v, vertices[face[0]]), normal) / length);
    if (Math.min(...distances) < -1e-12 && Math.max(...distances) > 1e-12) throw Error('Nonconvex contact cell');
  }
  return {vertices, normals: n, edges: uniqueDirections(edges)};
};
const prismFaces = [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
const capPrisms = mesh => {
  const triangles = surfaceTriangles(mesh.geometry), z = triangles.flatMap(t => [t.a.z, t.b.z, t.c.z]);
  const low = Math.min(...z), high = Math.max(...z), cells = [];
  for (const t of triangles) if ([t.a, t.b, t.c].every(v => v.z === high)) {
    const xy = [t.a, t.b, t.c].map(v => [v.x, v.y]);
    cells.push(convex([low, high].flatMap(z => xy.map(v => [...v, z])), prismFaces));
  }
  if (!cells.length) throw Error('No finite top-cap triangles');
  return cells;
};
const meshConvex = mesh => {
  const vertices = [], ids = new Map(), faces = [];
  for (const t of surfaceTriangles(mesh.geometry)) {
    faces.push([t.a, t.b, t.c].map(v => {
      const key = v.toArray().join(','); if (!ids.has(key)) {ids.set(key, vertices.length); vertices.push(v.toArray());}
      return ids.get(key);
    }));
  }
  return convex(vertices, faces);
};
const transform = (cell, rotate, angle, translation) => {
  const vertices = cell.vertices.map(v => add(rotate(v, angle), translation));
  return {vertices, normals: cell.normals.map(v => rotate(v, angle)), edges: cell.edges.map(v => rotate(v, angle)), box: bounds(vertices)};
};

// For convex A translating by lift*d, SAT overlap requires each projected
// interval to overlap. Their intersection is the complete forbidden lift
// interval. The largest exit over all finite cell pairs seats a plate coming
// down from above. No nominal circle, sampled point, or prescribed lift curve
// replaces the actual triangular faces in this calculation.
export function convexTranslationInterval(a, b, direction, {range = [-Infinity, Infinity], padding = 0} = {}) {
  let enter = range[0], leave = range[1], limiting = null;
  const axes = [...a.normals, ...b.normals, ...a.edges.flatMap(e => b.edges.map(f => cross(e, f)))];
  for (const [axisIndex, raw] of axes.entries()) {
    const length = Math.hypot(...raw); if (length < 1e-12) continue;
    const n = raw.map(v => v / length), av = a.vertices.map(v => dot(v, n)), bv = b.vertices.map(v => dot(v, n));
    const amin = Math.min(...av), amax = Math.max(...av), bmin = Math.min(...bv), bmax = Math.max(...bv), speed = dot(n, direction);
    const low = bmin - amax - padding, high = bmax - amin + padding;
    if (Math.abs(speed) < 1e-12) {if (low > 0 || high < 0) return null; continue;}
    const lower = Math.min(low / speed, high / speed), upper = Math.max(low / speed, high / speed);
    enter = Math.max(enter, lower);
    if (upper < leave) {
      const crossIndex = axisIndex - a.normals.length - b.normals.length;
      const axis = axisIndex < a.normals.length ? {type: 'sector-face', index: axisIndex}
        : axisIndex < a.normals.length + b.normals.length ? {type: 'crown-face', index: axisIndex - a.normals.length}
          : {type: 'edge-cross', sector: Math.floor(crossIndex / b.edges.length), crown: crossIndex % b.edges.length};
      leave = upper;
      limiting = {normal: n.map(v => v * Math.sign(speed)), speed: Math.abs(speed), axis, sign: Math.sign(speed),
        sectorVertex: av.indexOf(speed > 0 ? amin : amax), crownVertex: bv.indexOf(speed > 0 ? bmax : bmin)};
    }
    if (leave < enter) return null;
  }
  return {enter, leave, limiting};
}

function intervalGradient(a, b, direction, interval) {
  const {normal: n, speed, axis, sign, sectorVertex, crownVertex} = interval.limiting;
  const Z = [0, 0, 1], Y = [0, 1, 0], zero = [0, 0, 0]; let nq = zero, nt = zero;
  if (axis.type === 'sector-face') nq = cross(Z, n);
  else if (axis.type === 'crown-face') nt = cross(Y, n);
  else {
    const ae = a.edges[axis.sector], be = b.edges[axis.crown], raw = cross(ae, be), length = Math.hypot(...raw);
    const unit = raw.map(v => v / length);
    const normalizedDerivative = dr => dr.map((v, i) => sign * (v - unit[i] * dot(unit, dr)) / length);
    nq = normalizedDerivative(cross(cross(Z, ae), be));
    nt = normalizedDerivative(cross(ae, cross(Y, be)));
  }
  const A = a.vertices[sectorVertex], B = b.vertices[crownVertex], separation = sub(B, A);
  const dq = dot(nq, direction) + dot(n, cross(Z, direction)), dt = dot(nt, direction);
  const shaft = (dot(nq, separation) - dot(n, cross(Z, A)) - interval.leave * dq) / speed;
  const wheel = (dot(nt, separation) + dot(n, cross(Y, B)) - interval.leave * dt) / speed;
  return {shaft, wheel};
}

export function makeSpringSectorContact(candidate) {
  const u = candidate.root.userData, planes = [u.geometry.wheelPitchRadius, -u.geometry.wheelPitchRadius];
  const cells = ['front', 'rear'].map(name => capPrisms(u.parts[name + 'Sector']));
  const teeth = Object.entries(u.parts).filter(([name]) => /^wheelTooth\d+$/.test(name)).map(([name, mesh]) => ({name, cell: meshConvex(mesh)}));
  const seat = (shaftAngle, wheelAngle, side, {lower = -.2, upper = .3, padding = 2e-9, prune = true,
    derivatives = false, contactMargin = .003} = {}) => {
    const direction = rz([0, 1, 0], shaftAngle), crown = teeth.map(t => ({name: t.name, cell: transform(t.cell, ry, wheelAngle, [0, 0, 0])}));
    const top = Math.max(...crown.map(t => t.cell.box.high[1])), intervals = [];
    let lift = lower, contact = null, checked = 0, excluded = 0, minimumBodyPlane = Infinity;
    for (const [index, local] of cells[side].entries()) {
      if (prune) {
        const minY = Math.min(...local.vertices.map(v => Math.sin(shaftAngle) * v[0] + Math.cos(shaftAngle) * v[1]));
        minimumBodyPlane = Math.min(minimumBodyPlane, minY);
        if (minY + Math.min(lower * direction[1], upper * direction[1]) > top + padding) {excluded += crown.length; continue;}
      }
      const a = transform(local, rz, shaftAngle, [0, 0, planes[side]]);
      minimumBodyPlane = Math.min(minimumBodyPlane, a.box.low[1]);
      for (const tooth of crown) {
        const b = tooth.cell;
        if (prune && [0, 1, 2].some(i => a.box.high[i] + Math.max(lower * direction[i], upper * direction[i]) + padding < b.box.low[i]
          || b.box.high[i] + padding < a.box.low[i] + Math.min(lower * direction[i], upper * direction[i]))) {excluded++; continue;}
        checked++;
        const interval = convexTranslationInterval(a, b, direction, {range: [lower, upper], padding});
        if (derivatives && interval?.limiting) intervals.push({index, tooth: tooth.name, a, b, interval});
        if (!interval || interval.leave <= lift) continue;
        lift = interval.leave; contact = {cell: index, tooth: tooth.name, ...interval};
      }
    }
    if (contact && (!contact.limiting || lift >= upper)) throw Error('Lift bracket does not clear crown');
    const active = derivatives ? intervals.filter(r => r.interval.leave >= lift - contactMargin).map(r => ({
      cell: r.index, tooth: r.tooth, lift: r.interval.leave, limiting: r.interval.limiting,
      gradient: intervalGradient(r.a, r.b, direction, r.interval)})) : undefined;
    return {side, shaftAngle, wheelAngle, lift, contact, checked, excluded,
      bodyPlaneGap: minimumBodyPlane + lift * direction[1] - u.geometry.wheelTop, ...(derivatives ? {active} : {})};
  };
  return {seat, cells, teeth, qualification: 'Finite convex-cell SAT translation envelope for primary sector/crown geometry; this is seating geometry, not dynamics or a guide construction.'};
}
