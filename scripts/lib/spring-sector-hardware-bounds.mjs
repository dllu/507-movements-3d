import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const edges = t => t.map((p, i) => [p, t[(i + 1) % t.length]]);
const pointSegment = (p, a, b) => {
  const d = sub(b, a), length2 = dot(d, d);
  const f = length2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / length2)) : 0;
  return Math.hypot(...p.map((v, i) => v - a[i] - f * d[i]));
};
const inside = (p, t) => {
  if (Math.abs(cross(sub(t[1], t[0]), sub(t[2], t[0]))) < 1e-18) return false;
  const signs = edges(t).map(([a, b]) => cross(sub(b, a), sub(p, a)));
  return signs.every(v => v >= 0) || signs.every(v => v <= 0);
};
const segmentDistance = (a, b, c, d) => {
  const ab = sub(b, a), cd = sub(d, c), determinant = cross(ab, cd);
  if (Math.abs(determinant) > 1e-18) {
    const ac = sub(c, a), t = cross(ac, cd) / determinant, u = cross(ac, ab) / determinant;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
};
const segmentTriangle = (a, b, t) => inside(a, t) || inside(b, t) ? 0 :
  Math.min(...edges(t).map(([c, d]) => segmentDistance(a, b, c, d)));

// Exact extrema of A*cos(t) + B*sin(t), including every stationary point.
function trigRange(A, B, lo, hi) {
  const values = [lo, hi].map(t => A * Math.cos(t) + B * Math.sin(t));
  const phase = Math.atan2(B, A);
  for (let k = Math.ceil((lo - phase) / Math.PI); k <= Math.floor((hi - phase) / Math.PI); k++)
    values.push(A * Math.cos(phase + k * Math.PI) + B * Math.sin(phase + k * Math.PI));
  return [Math.min(...values), Math.max(...values)];
}
const emptyBox = () => [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
const include = (box, p) => p.forEach((v, i) => {box[i][0] = Math.min(box[i][0], v); box[i][1] = Math.max(box[i][1], v);});
const boxGap = (a, b) => Math.max(...a.map((r, i) => Math.max(b[i][0] - r[1], r[0] - b[i][1])));
const project = (body, axes) => body.triangles.map(t => t.map(p => axes.map(i => p[i])));
const boreGap = (body, axes, a, b, radius) => {
  let minimum = Infinity;
  for (const t of project(body, axes)) minimum = Math.min(minimum, segmentTriangle(a, b, t));
  return minimum - radius;
};
const radialMaximum = (body, axes, center) => Math.max(...body.vertices.map(p => Math.hypot(...axes.map((axis, i) => p[axis] - center[i]))));

// A projected triangle and rectangle have disjoint interiors if one SAT
// axis separates them. Caps of each closed frame fill its material projection.
function windowGap(frame, box) {
  const corners = [[box[0][0], box[1][0]], [box[0][1], box[1][0]],
    [box[0][1], box[1][1]], [box[0][0], box[1][1]]];
  let minimum = Infinity;
  for (const triangle of project(frame, [0, 1])) {
    const axes = [[1, 0], [0, 1], ...edges(triangle).map(([a, b]) => [a[1] - b[1], b[0] - a[0]])];
    let gap = -Infinity;
    for (const axis of axes) {
      const length = Math.hypot(...axis); if (length < 1e-15) continue;
      const a = triangle.map(p => dot(p, axis) / length), b = corners.map(p => dot(p, axis) / length);
      gap = Math.max(gap, Math.min(...a) - Math.max(...b), Math.min(...b) - Math.max(...a));
    }
    minimum = Math.min(minimum, gap);
  }
  return minimum;
}

// All rigid bounds are in the common shaft frame. The two sector lifts
// translate along its Y axis; the input rod is bounded about its fixed pin.
// This covers the entire guide travel, independently of any saved poses.
export function boundSpringSectorHardware(model, {liftRange = [-.06, .18], amplitude = .22, tolerance = 1e-6} = {}) {
  if (liftRange.length !== 2 || !liftRange.every(Number.isFinite) || liftRange[0] > liftRange[1] ||
      liftRange[0] < -.06 || liftRange[1] > .18 || !(amplitude >= 0 && amplitude < Math.PI / 2) ||
      !(Number.isFinite(tolerance) && tolerance > 0)) throw Error('Invalid hardware bound domain');
  model.setState();
  const u = model.root.userData, roundoff = 2e-7, bodies = {};
  for (const [name, mesh] of Object.entries(u.parts)) {
    const triangles = surfaceTriangles(mesh.geometry).map(t => [t.a, t.b, t.c].map(p => p.applyMatrix4(mesh.matrixWorld).toArray()));
    const vertices = triangles.flat(), box = emptyBox(); vertices.forEach(p => include(box, p));
    bodies[name] = {name, family: u.families[name], triangles, vertices, box, sourceBox: box.map(r => [...r])};
  }
  const {pin, length, direction} = u.linkage, displacement = 2 * Math.hypot(...pin) * Math.sin(amplitude / 2);
  if (!(displacement < length)) throw Error('Rod bound includes a linkage toggle');
  const relativeAngle = amplitude + Math.asin(displacement / length), rod = bodies.inputRod;
  rod.box = emptyBox();
  for (const p of rod.vertices) {
    const x = p[0] - pin[0], y = p[1] - pin[1];
    const xr = trigRange(x, -y, -relativeAngle, relativeAngle), yr = trigRange(y, x, -relativeAngle, relativeAngle);
    include(rod.box, [pin[0] + xr[0], pin[1] + yr[0], p[2]]);
    include(rod.box, [pin[0] + xr[1], pin[1] + yr[1], p[2]]);
  }
  for (const body of Object.values(bodies)) if (['front', 'rear'].includes(body.family))
    body.box[1] = [body.box[1][0] + liftRange[0], body.box[1][1] + liftRange[1]];

  const springs = {};
  for (const spring of u.springs) {
    const {family, x, plane, guideZ, coil} = spring, p = coil.geometry.userData.coil;
    const span = [p.span - liftRange[1], p.span - liftRange[0]];
    const radii = [coil.radiusAt(span[1]), coil.radiusAt(span[0])], outer = radii[1] + p.wireRadius;
    const inner = radii[0] * Math.cos(Math.PI * p.turns / p.segments) - p.wireRadius;
    const box = [[x - outer, x + outer], [p.bottom + liftRange[0], p.top],
      [plane + guideZ - outer, plane + guideZ + outer]];
    bodies[family].box = box;
    springs[family] = {span, radii, inner, outer, bottom: p.bottom, top: p.top, center: [x, plane + guideZ],
      turns: p.turns, segments: p.segments, sides: p.sides, wireRadius: p.wireRadius};
  }
  const wheelY = Object.values(bodies).filter(b => b.family === 'wheel').reduce((r, b) =>
    [Math.min(r[0], b.box[1][0]), Math.max(r[1], b.box[1][1])], [Infinity, -Infinity]);
  const globalY = body => {
    const values = [];
    for (const x of body.box[0]) for (const y of body.box[1]) values.push(...trigRange(y, x, -amplitude, amplitude));
    return [Math.min(...values), Math.max(...values)];
  };
  const pairs = [], primaryPairs = [], unresolved = [], counts = {};
  const add = (a, b, method, margin, extra = {}) => {
    const record = {pair: [a.name, b.name], method, margin: margin - roundoff, ...extra};
    pairs.push(record); counts[method] = (counts[method] ?? 0) + 1;
    if (!(record.margin >= -tolerance)) unresolved.push(record);
  };
  const all = Object.values(bodies);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]; if (a.family === b.family) continue;
    const wheel = a.family === 'wheel' ? a : b.family === 'wheel' ? b : null;
    if (wheel) {
      const other = wheel === a ? b : a;
      if (['frontSector', 'rearSector'].includes(other.name)) {
        primaryPairs.push([a.name, b.name]); continue;
      }
      const yr = globalY(other);
      add(a, b, 'wheel-global-height', Math.max(yr[0] - wheelY[1], wheelY[0] - yr[1])); continue;
    }
    const gap = boxGap(a.box, b.box);
    if (gap >= roundoff) {add(a, b, 'shaft-frame-box', gap); continue;}
    const byName = name => a.name === name ? a : b.name === name ? b : null;
    const shaft = byName('rockshaft'), sector = [a, b].find(v => /^(front|rear)Sector$/.test(v.name));
    if (shaft && sector) {
      const radius = radialMaximum(shaft, [0, 1], [0, 0]);
      add(a, b, 'shaft-swept-notch', boreGap(sector, [0, 1], [0, -liftRange[1]], [0, -liftRange[0]], radius)); continue;
    }
    const springBody = [a, b].find(v => springs[v.name]), spring = springBody && springs[springBody.name];
    const other = springBody === a ? b : a;
    if (spring && other.name === springBody.name.replace('Spring', 'GuideRod')) {
      add(a, b, 'coil-core-cylinder', spring.inner - radialMaximum(other, [0, 2], spring.center)); continue;
    }
    if (spring && other.name === springBody.name.replace('Spring', 'SliderHousing')) {
      add(a, b, 'moving-spring-seat', spring.bottom - other.sourceBox[1][1]); continue;
    }
    const guide = [a, b].find(v => /GuideRod[01]$/.test(v.name)), housing = [a, b].find(v => /SliderHousing[01]$/.test(v.name));
    if (guide && housing && guide.name.replace('GuideRod', 'SliderHousing') === housing.name) {
      const center = [0, 2].map(k => (guide.sourceBox[k][0] + guide.sourceBox[k][1]) / 2);
      add(a, b, 'slider-round-bore', boreGap(housing, [0, 2], center, center, radialMaximum(guide, [0, 2], center))); continue;
    }
    const frame = [a, b].find(v => /GuideFrame$/.test(v.name)), windowPart = frame === a ? b : a;
    if (frame && (springs[windowPart.name] || /SliderHousing[01]$/.test(windowPart.name))) {
      add(a, b, 'actual-frame-window', windowGap(frame, windowPart.box)); continue;
    }
    if (byName('inputPin') && byName('inputRod')) {
      add(a, b, 'input-round-bore', boreGap(rod, [0, 1], pin, pin, radialMaximum(bodies.inputPin, [0, 1], pin))); continue;
    }
    if (byName('inputRod') && byName('frontHubCover')) {
      const initial = Math.atan2(direction[1], direction[0]);
      const distances = trigRange(-pin[1], pin[0], initial - relativeAngle, initial + relativeAngle);
      const lineDistance = distances[0] <= 0 && distances[1] >= 0 ? 0 : Math.min(...distances.map(Math.abs));
      const strip = Math.max(...rod.vertices.map(p => Math.abs(cross(sub(p.slice(0, 2), pin), direction))));
      add(a, b, 'rod-strip-hub-radius', lineDistance - strip - radialMaximum(bodies.frontHubCover, [0, 1], [0, 0])); continue;
    }
    add(a, b, 'unresolved-box-overlap', gap);
  }
  return {passed: unresolved.length === 0, meshes: all.length, distinctFamilyPairs: pairs.length + primaryPairs.length,
    boundedPairs: pairs.length, primaryPairs, domain: {liftRange, amplitude, wheelAngle: 'arbitrary'}, tolerance, roundoff,
    envelopes: Object.fromEntries(all.filter(b => b.family !== 'wheel').map(b => [b.name, b.box])),
    linkage: {length, displacement, relativeAngle}, springs, counts, minimumMargin: Math.min(...pairs.map(p => p.margin)),
    pairs, unresolved, qualification: 'Bounds cover distinct moving families of the current finite candidate over the stated domain. Wheel/sector pairs require the separate continuous tooth/body-plane certificate. Spring self-contact, loads, stresses and missing external supports are outside this hardware-pair bound.'};
}
