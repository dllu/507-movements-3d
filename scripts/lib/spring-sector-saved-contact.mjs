const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const rotateZ = (p, q) => [q.c * p[0] - q.s * p[1], q.s * p[0] + q.c * p[1], p[2]];
const rotateY = (p, q) => [q.c * p[0] + q.s * p[2], p[1], -q.s * p[0] + q.c * p[2]];

// Reconstruct only the recorded supporting axis, without scanning unrelated
// cells. This evaluates recorded reactions; it never selects new contacts.
export function makeSpringSectorSavedContact(candidate, physics) {
  const cells = physics.contact.cells, teeth = new Map(physics.contact.teeth.map(t => [t.name, t.cell]));
  const planes = [candidate.root.userData.geometry.wheelPitchRadius, -candidate.root.userData.geometry.wheelPitchRadius];
  function at(row, saved) {
    const guide = /^([01]):(lower|upper)$/.exec(saved.id);
    if (guide) {
      const side = Number(guide[1]), lower = guide[2] === 'lower', sign = lower ? 1 : -1, J = [0, 0, 0]; J[side + 1] = sign;
      return {...saved, J, inputJacobian: 0, gap: sign * (row.x[side + 1] - physics.parameters.guideLimits[lower ? 0 : 1])};
    }
    const match = /^([01]):(\d+):(wheelTooth\d+):(.+)$/.exec(saved.id);
    if (!match) throw Error('Invalid recorded contact ID');
    const side = Number(match[1]), cell = cells[side][Number(match[2])], tooth = teeth.get(match[3]), axis = JSON.parse(match[4]);
    if (!cell || !tooth) throw Error('Recorded contact mesh is missing');
    const angle = physics.input(row.time).q, q = {c: Math.cos(angle), s: Math.sin(angle)}, w = {c: Math.cos(row.x[0]), s: Math.sin(row.x[0])};
    const A = cell.vertices.map(p => {const v = rotateZ(p, q); v[2] += planes[side]; return v;});
    const B = tooth.vertices.map(p => rotateY(p, w)), direction = [-q.s, q.c, 0];
    let raw, nq = [0, 0, 0], nt = [0, 0, 0], edgeA, edgeB;
    if (axis.type === 'sector-face') raw = rotateZ(cell.normals[axis.index], q);
    else if (axis.type === 'crown-face') raw = rotateY(tooth.normals[axis.index], w);
    else if (axis.type === 'edge-cross') {
      edgeA = rotateZ(cell.edges[axis.sector], q); edgeB = rotateY(tooth.edges[axis.crown], w); raw = cross(edgeA, edgeB);
    } else throw Error('Unknown recorded contact axis');
    const length = Math.hypot(...raw), sign = Math.sign(dot(raw, direction));
    if (!(length > 1e-12) || !sign) throw Error('Singular recorded contact axis');
    const unit = raw.map(v => v / length), normal = unit.map(v => sign * v), speed = dot(normal, direction);
    if (!(speed > 1e-12)) throw Error('Recorded contact cannot support radial motion');
    if (axis.type === 'sector-face') nq = cross([0, 0, 1], normal);
    else if (axis.type === 'crown-face') nt = cross([0, 1, 0], normal);
    else {
      const derivative = d => d.map((v, i) => sign * (v - unit[i] * dot(unit, d)) / length);
      nq = derivative(cross(cross([0, 0, 1], edgeA), edgeB));
      nt = derivative(cross(edgeA, cross([0, 1, 0], edgeB)));
    }
    const av = A.map(p => dot(p, normal)), bv = B.map(p => dot(p, normal));
    const low = Math.min(...av), high = Math.max(...bv), a = A[av.indexOf(low)], b = B[bv.indexOf(high)];
    const lift = (high - low + 2e-9) / speed, separation = sub(b, a);
    const shaft = (dot(nq, separation) - dot(normal, cross([0, 0, 1], a))
      - lift * (dot(nq, direction) + dot(normal, cross([0, 0, 1], direction)))) / speed;
    const wheel = (dot(nt, separation) + dot(normal, cross([0, 1, 0], b)) - lift * dot(nt, direction)) / speed;
    const J = [-wheel, 0, 0]; J[side + 1] = 1;
    return {...saved, J, inputJacobian: -shaft, gap: row.x[side + 1] - lift, normal, speed};
  }
  return {at};
}
