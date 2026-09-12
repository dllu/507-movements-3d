import {makeSpringSectorContact} from './spring-sector-contact.mjs';

const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rz = (v, a) => [Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1], v[2]];
const ry = (v, a) => [Math.cos(a) * v[0] + Math.sin(a) * v[2], v[1], -Math.sin(a) * v[0] + Math.cos(a) * v[2]];
const bounds = points => ({low: [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))),
  high: [0, 1, 2].map(i => Math.max(...points.map(p => p[i])))});
const transform = (cell, rotate, angle, translation) => {
  const vertices = cell.vertices.map(v => add(rotate(v, angle), translation));
  return {vertices, normals: cell.normals.map(v => rotate(v, angle)), edges: cell.edges.map(v => rotate(v, angle)), box: bounds(vertices)};
};

// Same SAT axes, order, projection arithmetic, tie rules and lift padding as
// the reference implementation. Generate cross axes only when reached, and
// reduce projections without allocating a temporary array for every axis.
export function fastConvexTranslationInterval(a, b, direction, {range = [-Infinity, Infinity], padding = 0} = {}) {
  let enter = range[0], leave = range[1], limiting = null;
  const faceCount = a.normals.length + b.normals.length;
  const axisCount = faceCount + a.edges.length * b.edges.length;
  for (let axisIndex = 0; axisIndex < axisCount; axisIndex++) {
    const crossIndex = axisIndex - faceCount;
    const raw = axisIndex < a.normals.length ? a.normals[axisIndex] : axisIndex < faceCount ? b.normals[axisIndex - a.normals.length]
      : cross(a.edges[Math.floor(crossIndex / b.edges.length)], b.edges[crossIndex % b.edges.length]);
    const length = Math.hypot(...raw); if (length < 1e-12) continue;
    const nx = raw[0] / length, ny = raw[1] / length, nz = raw[2] / length;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    let aminIndex = 0, amaxIndex = 0, bminIndex = 0, bmaxIndex = 0;
    for (let i = 0; i < a.vertices.length; i++) {
      const v = a.vertices[i], value = ((0 + v[0] * nx) + v[1] * ny) + v[2] * nz;
      if (value < amin) aminIndex = i; if (value > amax) amaxIndex = i;
      amin = Math.min(amin, value); amax = Math.max(amax, value);
    }
    for (let i = 0; i < b.vertices.length; i++) {
      const v = b.vertices[i], value = ((0 + v[0] * nx) + v[1] * ny) + v[2] * nz;
      if (value < bmin) bminIndex = i; if (value > bmax) bmaxIndex = i;
      bmin = Math.min(bmin, value); bmax = Math.max(bmax, value);
    }
    const speed = ((0 + nx * direction[0]) + ny * direction[1]) + nz * direction[2];
    const low = bmin - amax - padding, high = bmax - amin + padding;
    if (Math.abs(speed) < 1e-12) {if (low > 0 || high < 0) return null; continue;}
    const lower = Math.min(low / speed, high / speed), upper = Math.max(low / speed, high / speed);
    enter = Math.max(enter, lower);
    if (upper < leave) {
      const axis = axisIndex < a.normals.length ? {type: 'sector-face', index: axisIndex}
        : axisIndex < faceCount ? {type: 'crown-face', index: axisIndex - a.normals.length}
          : {type: 'edge-cross', sector: Math.floor(crossIndex / b.edges.length), crown: crossIndex % b.edges.length};
      leave = upper;
      const sign = Math.sign(speed);
      limiting = {normal: [nx * sign, ny * sign, nz * sign], speed: Math.abs(speed), axis, sign,
        sectorVertex: speed > 0 ? aminIndex : amaxIndex, crownVertex: speed > 0 ? bmaxIndex : bminIndex};
    }
    if (leave < enter) return null;
  }
  return {enter, leave, limiting};
}

// Kept in the reference operation order so the speed study changes neither
// the contact Jacobian nor which supporting vertex supplies it.
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

// Cache only transforms of the immutable mesh cells. Every query still scans
// the same cells/tooth pairs and recomputes the complete translation envelope.
export function makeSpringSectorFastContact(candidate) {
  const reference = makeSpringSectorContact(candidate), {cells, teeth} = reference;
  const u = candidate.root.userData, planes = [u.geometry.wheelPitchRadius, -u.geometry.wheelPitchRadius];
  let cachedShaft, cachedWheel, crown, top, direction, transformed, minimumY;
  const seat = (shaftAngle, wheelAngle, side, {lower = -.2, upper = .3, padding = 2e-9, prune = true,
    derivatives = false, contactMargin = .003} = {}) => {
    if (!Object.is(cachedShaft, shaftAngle)) {
      cachedShaft = shaftAngle; direction = rz([0, 1, 0], shaftAngle);
      transformed = cells.map(side => Array(side.length));
      minimumY = cells.map(side => side.map(local => Math.min(...local.vertices.map(v => Math.sin(shaftAngle) * v[0] + Math.cos(shaftAngle) * v[1]))));
    }
    if (!Object.is(cachedWheel, wheelAngle)) {
      cachedWheel = wheelAngle;
      crown = teeth.map(t => ({name: t.name, cell: transform(t.cell, ry, wheelAngle, [0, 0, 0])}));
      top = Math.max(...crown.map(t => t.cell.box.high[1]));
    }
    const intervals = [], lowShift = direction.map(v => Math.min(lower * v, upper * v));
    const highShift = direction.map(v => Math.max(lower * v, upper * v));
    let lift = lower, contact = null, checked = 0, excluded = 0, minimumBodyPlane = Infinity;
    for (let index = 0; index < cells[side].length; index++) {
      if (prune) {
        const minY = minimumY[side][index]; minimumBodyPlane = Math.min(minimumBodyPlane, minY);
        if (minY + lowShift[1] > top + padding) {excluded += crown.length; continue;}
      }
      const a = transformed[side][index] ??= transform(cells[side][index], rz, shaftAngle, [0, 0, planes[side]]);
      minimumBodyPlane = Math.min(minimumBodyPlane, a.box.low[1]);
      for (const tooth of crown) {
        const b = tooth.cell;
        if (prune && [0, 1, 2].some(i => a.box.high[i] + highShift[i] + padding < b.box.low[i]
          || b.box.high[i] + padding < a.box.low[i] + lowShift[i])) {excluded++; continue;}
        checked++;
        const interval = fastConvexTranslationInterval(a, b, direction, {range: [lower, upper], padding});
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
  return {seat, cells, teeth, qualification: reference.qualification};
}
