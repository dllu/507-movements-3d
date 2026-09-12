import {makeSelectorRackContact} from './selector-rack-contact.mjs';
import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const bounds = points => ({low: [0, 1].map(i => Math.min(...points.map(p => p[i]))), high: [0, 1].map(i => Math.max(...points.map(p => p[i])))});
const boxGap = (a, b) => Math.max(a.low[0] - b.high[0], b.low[0] - a.high[0], a.low[1] - b.high[1], b.low[1] - a.high[1]);
const cell = points => ({points, box: bounds(points), axes: points.map((a, i) => {
  const d = sub(points[(i + 1) % points.length], a), length = Math.hypot(...d);
  if (!(length > 0)) throw Error('Degenerate planar cell'); return [-d[1] / length, d[0] / length];
})});
function hull(points) {
  const sorted = [...new Map(points.map(p => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const chain = values => {const result = []; for (const p of values) {
    while (result.length > 1 && cross(sub(result.at(-1), result.at(-2)), sub(p, result.at(-1))) <= 1e-14) result.pop();
    result.push(p);
  } return result;};
  return [...chain(sorted).slice(0, -1), ...chain([...sorted].reverse()).slice(0, -1)];
}
const transformed = (part, angle, translation) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {points: part.points.map(([x, y]) => [c * x - s * y + translation[0], s * x + c * y + translation[1]]),
    axes: part.axes.map(([x, y]) => [c * x - s * y, s * x + c * y])};
};
function separation(a, b) {
  let best = null;
  for (const [owner, axes] of [['frame', a.axes], ['body', b.axes]]) for (const [edge, axis] of axes.entries()) {
    const A = a.points.map(p => dot(p, axis)), B = b.points.map(p => dot(p, axis));
    for (const sign of [1, -1]) {
      const amin = sign > 0 ? Math.min(...A) : -Math.max(...A), bmax = sign > 0 ? Math.max(...B) : -Math.min(...B), gap = amin - bmax;
      if (best && gap <= best.gap) continue;
      best = {gap, owner, edge, sign, normal: axis.map(v => v * sign),
        pointA: a.points[A.indexOf(sign > 0 ? amin : -amin)], pointB: b.points[B.indexOf(sign > 0 ? bmax : -bmax)]};
    }
  }
  return best;
}

export function makeSelectorRackPlanarContact(candidate) {
  const u = candidate.root.userData, old = makeSelectorRackContact(candidate), center = u.frameCentroid;
  const frame = old.frame.map(part => cell(part.points.map(p => sub(p, center))));
  const disk = mesh => {
    const p = mesh.geometry.attributes.position, points = [];
    for (let i = 0; i < p.count; i++) points.push([p.getX(i) + mesh.position.x, p.getY(i) + mesh.position.y]);
    return cell(hull(points));
  };
  const fixed = [{name: 'shaft', input: 'fixed', cells: [disk(u.parts.fixedCamAxle)]}];
  for (let i = 0; i < 2; i++) {
    const geometry = u.parts['rackGuide' + i].geometry, section = [];
    for (const t of surfaceTriangles(geometry)) {
      const points = [t.a, t.b, t.c];
      for (let edge = 0; edge < 3; edge++) {
        const a = points[edge], b = points[(edge + 1) % 3];
        if (a.z * b.z > 0 || Math.abs(a.z - b.z) < 1e-14) continue;
        const f = -a.z / (b.z - a.z); section.push([a.x + f * (b.x - a.x), a.y + f * (b.y - a.y)]);
      }
    }
    const positions = geometry.attributes.position;
    const box = bounds(section), ys = [...new Set(Array.from({length: positions.count}, (_, j) => positions.getY(j)))].sort((a, b) => a - b);
    if (ys.length !== 4) throw Error('Guide section is not the expected two rectangular stops');
    if (section.some(p => p[1] > ys[1] + 1e-10 && p[1] < ys[2] - 1e-10)) throw Error('Guide section crosses its opening');
    for (const [name, low, high] of [['bottom', ys[0], ys[1]], ['top', ys[2], ys[3]]])
      fixed.push({name: 'guide' + i + ':' + name, input: 'fixed', cells: [cell([[box.low[0], low], [box.high[0], low], [box.high[0], high], [box.low[0], high]])]});
  }
  const moving = [{name: 'cam', input: 'cam', cells: old.cam.map(part => cell(part.points))},
    ...[0, 1].map(i => ({name: 'pin' + i, input: 'selector', cells: [disk(u.parts['suspensionPin' + i])]}))], bodies = [...moving, ...fixed];
  let lastInput, posedBodies;
  const at = (x, input, padding = .004) => {
    if (lastInput !== input) {
      posedBodies = bodies.map(body => {
        const angle = body.input === 'cam' ? input.camAngle : 0, translation = [0, body.input === 'selector' ? input.selectorY : 0];
        const cells = body.cells.map(part => {const p = transformed(part, angle, translation); return {...p, box: bounds(p.points)};});
        return {...body, cells, box: bounds(cells.flatMap(c => c.points))};
      }); lastInput = input;
    }
    const rows = [], gaps = Object.fromEntries(bodies.map(b => [b.name, Infinity])); let checkedPairs = 0, excludedPairs = 0;
    for (const [frameCell, local] of frame.entries()) {
      const a = transformed(local, x[2], x.slice(0, 2)); a.box = bounds(a.points);
      for (const body of posedBodies) {
        const broadGap = boxGap(a.box, body.box);
        if (broadGap > padding) {excludedPairs += body.cells.length; gaps[body.name] = Math.min(gaps[body.name], broadGap); continue;}
        for (const [bodyCell, b] of body.cells.entries()) {
          const bound = boxGap(a.box, b.box);
          if (bound > padding) {excludedPairs++; gaps[body.name] = Math.min(gaps[body.name], bound); continue;}
          checkedPairs++; const feature = separation(a, b); gaps[body.name] = Math.min(gaps[body.name], feature.gap);
          if (feature.gap > padding) continue;
          const {normal, pointA, pointB, owner, edge, sign} = feature;
          const framePoint = owner === 'frame' ? pointB : pointA;
          const J = [...normal, cross(sub(framePoint, x.slice(0, 2)), normal)];
          const camJacobian = body.input === 'cam' ? -cross(owner === 'frame' ? pointB : pointA, normal) : 0;
          const selectorJacobian = body.input === 'selector' ? -normal[1] : 0;
          if (rows.some(r => r.key === body.name && Math.max(...J.map((v, i) => Math.abs(v - r.J[i]))) < 1e-10 && Math.abs(r.gap - feature.gap) < 1e-10)) continue;
          rows.push({id: body.name + ':' + frameCell + ':' + bodyCell + ':' + owner + ':' + edge + ':' + sign,
            key: body.name, J, gap: feature.gap, camJacobian, selectorJacobian,
            inputNormalVelocity: camJacobian * input.camVelocity + selectorJacobian * input.selectorVelocity,
            normal, pointA, pointB, frameCell, bodyCell, owner, edge, sign});
        }
      }
    }
    return {rows, gaps, checkedPairs, excludedPairs};
  };
  return {at, frame, bodies, separation};
}
