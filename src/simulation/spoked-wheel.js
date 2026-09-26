import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { creaseIndexedNormals } from './crease-normals.js';

// Shared spoked wheel: one plate extruded along +Z (centred on z = 0), made
// of an outer outline (a circle, or a supplied tooth profile for gears and
// ratchets with a spoked web) minus one window between each pair of
// adjacent spokes, and a bore.
//
// Each window is the classical three-piece outline: the two straight edges
// of the neighbouring spokes and an arc concentric with the wheel (the
// inside of the rim). The spoke-spoke corner near the hub is rounded with
// the larger hub fillet and the two spoke-rim corners with the smaller rim
// fillet, so the spokes flare into both hub and rim. All fillets are exact
// tangent arcs sampled finely enough to shade smoothly; the flat faces and
// the plate edges keep hard creases (crease-normals.js).
//
// Units are the caller's. Angles in radians, anticlockwise from +X.
//
//   spokes          spoke count (>= 3)                     default 4
//   outerRadius     plain circular rim outside radius      default 1
//   outline         tooth profile instead of outerRadius: [x, y] pairs or
//                   THREE.Vector2s, a closed ring about the wheel centre
//   rimInnerRadius  inside of the rim (window arcs)        default 0.80 * rim outside
//   spokeWidth      spoke width at the hub                 default 0.14 * rimInnerRadius
//   spokeTipWidth   spoke width at the rim (taper)         default spokeWidth
//   hubRadius       solid web radius about the centre; sets the hub fillet
//                   when hubFillet is omitted              default 0.24 * rimInnerRadius
//   hubFillet       spoke-spoke corner radius               default from hubRadius
//   rimFillet       spoke-rim corner radius                 default 0.07 * rimInnerRadius
//                   (hubFillet/rimFillet 0: plain sharp corners, for wheels
//                   Brown draws with plain spokes)
//   hubArcRadius    optional: close each window on the hub side with an
//                   arc concentric with the wheel (a large hub or an inner
//                   ring) instead of the spoke-spoke corner; its corners
//                   take hubFillet (default rimFillet)
//   windowShape     'filleted' (default) or 'lens': the curved-crossing
//                   clock wheel, each window two circular arcs meeting in
//                   sharp tips on the rim's inside, the crossings
//                   spokeTipWidth wide there (a chord) and the window's inner
//                   arc coming to hubRadius on its mid-line (no fillets)
//   boreRadius      axle bore (0 for none)                  default 0.32 * hubRadius
//   thickness       plate thickness along Z                 default 0.12 * rim outside
//   phase           angle of the first spoke's centre line  default 0
//   arcSegments     segments per full turn of the rim/bore  default 192
//   filletSegments  segments per fillet arc                 default 12
//
// "Rim outside" is outerRadius, or the smallest radius of the supplied
// outline (its tooth roots).

const TAU = Math.PI * 2;

function asPoint(point) {
  return point?.isVector2 ? [point.x, point.y] : [point[0], point[1]];
}

function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

// Resolved parameters (with defaults filled in) for a spoked wheel.
export function spokedWheelParameters(options = {}) {
  const spokes = options.spokes ?? 4;
  if (!(Number.isInteger(spokes) && spokes >= 3)) throw new Error(`spoked wheel needs >= 3 spokes, got ${spokes}`);
  const outline = options.outline?.map(asPoint) ?? null;
  const rimOutside = outline
    ? Math.min(...outline.map(([x, y]) => Math.hypot(x, y)))
    : options.outerRadius ?? 1;
  const rimInnerRadius = options.rimInnerRadius ?? rimOutside * 0.8;
  if (!(rimInnerRadius < rimOutside)) throw new Error('spoked wheel rim inner radius must lie inside the rim');
  const spokeWidth = options.spokeWidth ?? rimInnerRadius * 0.14;
  const spokeTipWidth = options.spokeTipWidth ?? spokeWidth;
  const hubRadius = options.hubRadius ?? rimInnerRadius * 0.24;
  const rimFillet = options.rimFillet ?? rimInnerRadius * 0.07;
  return {
    spokes,
    outline,
    outerRadius: outline ? null : rimOutside,
    rimOutside,
    rimInnerRadius,
    spokeWidth,
    spokeTipWidth,
    hubRadius,
    hubFillet: options.hubFillet ?? null,
    hubArcRadius: options.hubArcRadius ?? null,
    windowShape: options.windowShape ?? 'filleted',
    rimFillet,
    boreRadius: options.boreRadius ?? hubRadius * 0.32,
    thickness: options.thickness ?? rimOutside * 0.12,
    phase: options.phase ?? 0,
    arcSegments: options.arcSegments ?? 192,
    filletSegments: options.filletSegments ?? 12,
  };
}

// Spoke edge as a line n . p = c whose normal n points into the window.
// side +1 is the spoke's anticlockwise edge, -1 its clockwise edge.
function spokeEdge(angle, side, p) {
  const u = [Math.cos(angle), Math.sin(angle)];
  const v = [-u[1], u[0]];
  const r0 = p.hubRadius;
  const r1 = p.rimInnerRadius;
  const h0 = p.spokeWidth / 2;
  const h1 = p.spokeTipWidth / 2;
  // Two points on the edge (radial distance, lateral offset).
  const a = [u[0] * r0 + v[0] * side * h0, u[1] * r0 + v[1] * side * h0];
  const b = [u[0] * r1 + v[0] * side * h1, u[1] * r1 + v[1] * side * h1];
  const d = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(...d);
  const t = [d[0] / length, d[1] / length];
  // Normal pointing away from the spoke centre line (into the window).
  let n = [-t[1], t[0]];
  if (n[0] * v[0] * side + n[1] * v[1] * side < 0) n = [-n[0], -n[1]];
  return { n, c: n[0] * a[0] + n[1] * a[1], t };
}

function arcPoints(center, radius, from, to, segments, includeStart = true) {
  // A zero fillet is a plain sharp corner: the corner point itself, once.
  if (!(radius > 0)) return includeStart ? [[center[0], center[1]]] : [];
  const points = [];
  for (let i = includeStart ? 0 : 1; i <= segments; i += 1) {
    const angle = from + (to - from) * i / segments;
    points.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
  }
  return points;
}

// Anticlockwise sweep from angle a to angle b in (0, 2pi].
function sweep(a, b) {
  let d = (b - a) % TAU;
  if (d <= 0) d += TAU;
  return d;
}

// Lens window between the crossings at a0 and a0 + 2pi/N: the rim's inside
// between tips a crossing's width (chord) apart, closed by a circular arc
// through both tips and the point hubRadius out on the window's mid-line.
function lensWindow(p, index) {
  const pitch = TAU / p.spokes;
  const middle = p.phase + (index + 0.5) * pitch;
  const R = p.rimInnerRadius;
  const halfAngle = pitch / 2 - Math.asin(Math.min(1, p.spokeTipWidth / 2 / R));
  const along = R * Math.cos(halfAngle);
  const across = R * Math.sin(halfAngle);
  const inner = p.hubRadius;
  if (!(inner < along)) throw new Error('lens window inner point must lie inside its tips');
  // Arc centre on the mid-line, distance centre from the wheel centre.
  const centre = (along ** 2 + across ** 2 - inner ** 2) / (2 * (along - inner));
  const radius = centre - inner;
  const arcHalf = Math.atan2(across, centre - along);
  const rimCount = Math.max(4, Math.ceil(2 * halfAngle / TAU * p.arcSegments));
  const innerCount = Math.max(8, Math.ceil(2 * arcHalf / TAU * Math.max(p.arcSegments, 96)));
  const u = [Math.cos(middle), Math.sin(middle)];
  const c = [u[0] * centre, u[1] * centre];
  // Rim arc anticlockwise from tip to tip, then the inner arc back.
  const points = arcPoints([0, 0], R, middle - halfAngle, middle + halfAngle, rimCount);
  const back = middle + Math.PI;
  points.push(...arcPoints(c, radius, back - arcHalf, back + arcHalf, innerCount).slice(1, -1));
  return points;
}

// Window between the spoke at angle a0 and the next at a1 = a0 + 2pi/N:
// clockwise edge of spoke a1 (line 2) and anticlockwise edge of a0 (line 1).
// Returned anticlockwise (as seen from +Z) as [x, y] pairs.
export function spokedWheelWindow(p, index) {
  const pitch = TAU / p.spokes;
  const a0 = p.phase + index * pitch;
  const a1 = a0 + pitch;
  const e1 = spokeEdge(a0, +1, p);
  const e2 = spokeEdge(a1, -1, p);
  const R = p.rimInnerRadius;
  const rf = p.rimFillet;

  // Hub corner: intersection of the two edges, rounded by the hub fillet.
  // The fillet centre q satisfies n1 . q = c1 + rh and n2 . q = c2 + rh.
  const solve = (off1, off2) => {
    const det = e1.n[0] * e2.n[1] - e1.n[1] * e2.n[0];
    const k1 = e1.c + off1;
    const k2 = e2.c + off2;
    return [(k1 * e2.n[1] - k2 * e1.n[1]) / det, (e1.n[0] * k2 - e2.n[0] * k1) / det];
  };
  const foot = (q, e, r) => [q[0] - e.n[0] * r, q[1] - e.n[1] * r];
  // Centres at distance r from edge e (window side) and at distance
  // circleRadius from the wheel centre: the two intersections of an offset
  // line with a circle. The one further out along the spoke is returned.
  const lineCircleCenter = (e, r, circleRadius, spokeAngle) => {
    const k = e.c + r;
    const base = [e.n[0] * k, e.n[1] * k];
    const bt = base[0] * e.t[0] + base[1] * e.t[1];
    const bb = base[0] ** 2 + base[1] ** 2;
    const disc = bt * bt - (bb - circleRadius ** 2);
    if (disc < 0) throw new Error('spoked wheel fillet does not fit');
    const u = [Math.cos(spokeAngle), Math.sin(spokeAngle)];
    const candidates = [-bt + Math.sqrt(disc), -bt - Math.sqrt(disc)]
      .map((s) => [base[0] + e.t[0] * s, base[1] + e.t[1] * s]);
    return candidates.reduce((best, q) => (
      q[0] * u[0] + q[1] * u[1] > best[0] * u[0] + best[1] * u[1] ? q : best));
  };
  const along = (e, point) => point[0] * e.t[0] + point[1] * e.t[1];
  const angleOf = (center, point) => Math.atan2(point[1] - center[1], point[0] - center[0]);
  const fs = p.filletSegments;

  // Rim fillets: centre rf from the edge and R - rf from the wheel centre.
  const c1 = lineCircleCenter(e1, rf, R - rf, a0);
  const c2 = lineCircleCenter(e2, rf, R - rf, a1);
  const t1 = foot(c1, e1, rf);
  const t2 = foot(c2, e2, rf);

  // Hub side: either the spoke-spoke corner rounded by the hub fillet, or
  // (hubArcRadius) an inner arc concentric with the wheel, joined to the
  // spokes by hub fillets.
  let rh = p.hubFillet;
  const hubPoints = [];
  let h1;
  let h2;
  if (p.hubArcRadius) {
    rh ??= p.rimFillet;
    const q1 = lineCircleCenter(e1, rh, p.hubArcRadius + rh, a0);
    const q2 = lineCircleCenter(e2, rh, p.hubArcRadius + rh, a1);
    h1 = foot(q1, e1, rh);
    h2 = foot(q2, e2, rh);
    const in1 = Math.atan2(q1[1], q1[0]);
    const in2 = Math.atan2(q2[1], q2[0]);
    // Fillet from edge 2 onto the inner arc, the arc clockwise back toward
    // spoke a0, then the fillet onto edge 1.
    const g2 = angleOf(q2, h2);
    hubPoints.push(...arcPoints(q2, rh, g2, g2 + sweep(g2, in2 + Math.PI), fs));
    const innerSweep = sweep(in1, in2);
    const innerCount = Math.max(2, Math.ceil(innerSweep / TAU * p.arcSegments));
    hubPoints.push(...arcPoints([0, 0], p.hubArcRadius, in2, in2 - innerSweep, innerCount, false).slice(0, -1));
    const g1 = in1 + Math.PI;
    hubPoints.push(...arcPoints(q1, rh, g1, g1 + sweep(g1, angleOf(q1, h1)), fs));
  } else {
    const solve = (off1, off2) => {
      const det = e1.n[0] * e2.n[1] - e1.n[1] * e2.n[0];
      const k1 = e1.c + off1;
      const k2 = e2.c + off2;
      return [(k1 * e2.n[1] - k2 * e1.n[1]) / det, (e1.n[0] * k2 - e2.n[0] * k1) / det];
    };
    if (rh == null) {
      // Choose the fillet so the web stays solid out to hubRadius along
      // the window's bisector: |q(rh)| - rh = hubRadius, q linear in rh.
      const q0 = solve(0, 0);
      const qu = solve(1, 1);
      const dq = [qu[0] - q0[0], qu[1] - q0[1]];
      const A = dq[0] ** 2 + dq[1] ** 2 - 1;
      const B = 2 * (q0[0] * dq[0] + q0[1] * dq[1]) - 2 * p.hubRadius;
      const C = q0[0] ** 2 + q0[1] ** 2 - p.hubRadius ** 2;
      const roots = Math.abs(A) < 1e-12 ? [-C / B]
        : [(-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A), (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A)];
      rh = Math.max(0, Math.min(...roots.filter((r) => r >= 0)));
    }
    // The fillet centre lies rh from both edges.
    const hubCenter = solve(rh, rh);
    h1 = foot(hubCenter, e1, rh);
    h2 = foot(hubCenter, e2, rh);
    const hs = angleOf(hubCenter, h2);
    hubPoints.push(...arcPoints(hubCenter, rh, hs, hs + sweep(hs, angleOf(hubCenter, h1)), fs));
  }
  if (along(e1, h1) >= along(e1, t1) || along(e2, h2) >= along(e2, t2)) {
    throw new Error('spoked wheel fillets overlap: shrink hubFillet/rimFillet or widen the rim gap');
  }
  const rimAngle1 = Math.atan2(c1[1], c1[0]);
  const rimAngle2 = Math.atan2(c2[1], c2[0]);
  const points = [...hubPoints];
  // Edge 1 (straight) to the first rim fillet, which turns anticlockwise
  // from the edge onto the rim arc.
  const f1s = angleOf(c1, t1);
  points.push(...arcPoints(c1, rf, f1s, f1s + sweep(f1s, rimAngle1), fs));
  // Rim arc (concentric) anticlockwise from fillet 1 to fillet 2.
  const rimSweep = sweep(rimAngle1, rimAngle2);
  const rimCount = Math.max(2, Math.ceil(rimSweep / TAU * p.arcSegments));
  points.push(...arcPoints([0, 0], R, rimAngle1, rimAngle1 + rimSweep, rimCount, false));
  // Second rim fillet down to edge 2, then edge 2 back to the hub side.
  const f2s = rimAngle2;
  points.push(...arcPoints(c2, rf, f2s, f2s + sweep(f2s, angleOf(c2, t2)), fs, false));
  return points;
}

// The wheel's 2D outline: { outer, windows, bore }, each ring anticlockwise.
export function spokedWheelOutline(options = {}) {
  const p = options.spokes !== undefined && options.rimOutside !== undefined ? options : spokedWheelParameters(options);
  let outer;
  if (p.outline) {
    outer = p.outline.slice();
    if (signedArea(outer) < 0) outer.reverse();
  } else {
    outer = arcPoints([0, 0], p.outerRadius, 0, TAU, p.arcSegments).slice(0, -1);
  }
  const windowOf = p.windowShape === 'lens' ? lensWindow : spokedWheelWindow;
  const windows = Array.from({ length: p.spokes }, (_, index) => windowOf(p, index));
  const bore = p.boreRadius > 0
    ? arcPoints([0, 0], p.boreRadius, 0, TAU, Math.max(24, Math.round(p.arcSegments / 3))).slice(0, -1)
    : null;
  return { outer, windows, bore, parameters: p };
}

// One extruded, crease-shaded BufferGeometry, z in [-thickness/2, thickness/2].
export function spokedWheelGeometry(options = {}) {
  const p = spokedWheelParameters(options);
  const { outer, windows, bore } = spokedWheelOutline(p);
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  // Holes run clockwise.
  for (const ring of [...windows, ...(bore ? [bore] : [])]) {
    shape.holes.push(new THREE.Path(ring.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  }
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: p.thickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  extruded.translate(0, 0, -p.thickness / 2);
  extruded.deleteAttribute('normal');
  extruded.deleteAttribute('uv');
  const geometry = mergeVertices(extruded, 1e-7);
  geometry.clearGroups();
  extruded.dispose();
  // Fillet and rim facets stay smooth; face-to-wall edges and the tooth or
  // spoke corners that the outline does not round stay crisp.
  creaseIndexedNormals(geometry, Math.PI / 5);
  geometry.computeBoundingSphere();
  geometry.userData.spokedWheel = {
    ...p,
    outline: p.outline ? p.outline.length : null,
  };
  return geometry;
}

// Mesh convenience: the wheel as a single part that takes no rotation cue
// (the spokes show its turning).
export function makeSpokedWheel(options = {}, material) {
  const mesh = new THREE.Mesh(spokedWheelGeometry(options), material);
  mesh.userData.role = options.role ?? 'spoked-wheel';
  mesh.userData.noRotationIndicator = true;
  return mesh;
}

// Spokes and hub web for a separately turned rim (a grooved rope sheave or
// a crowned tread): the plate's own rim is buried `embed` deep inside the
// turned rim's bore, so only the spokes and their rim fillets show,
// meeting the bore.
export function spokedWebGeometry({ rimBoreRadius, embed, ...options } = {}) {
  const depth = embed ?? rimBoreRadius * 0.03;
  return spokedWheelGeometry({
    ...options,
    outerRadius: rimBoreRadius + depth,
    rimInnerRadius: rimBoreRadius,
  });
}

// Recasts a makePulley (primitives.js) spoked pulley as a one-piece cast
// pulley: its open rim and separate bar spokes become one spoked plate the
// full width of the tread, bored for the pulley's hub, for plates that draw
// the filleted single-face kind. Tread radius, width and hub are unchanged.
// Returns the pulley.
export function filletPulleySpokes(pulley, options = {}) {
  const data = pulley.userData;
  const spokeCount = data.spokes?.length ?? 0;
  if (spokeCount < 3) return pulley;
  const radius = data.treadRadius ?? data.radius;
  // The hub is turned about its local Y axis.
  const hubPosition = data.hub.geometry.attributes.position;
  let hubRadius = 0;
  for (let i = 0; i < hubPosition.count; i += 1) {
    hubRadius = Math.max(hubRadius, Math.hypot(hubPosition.getX(i), hubPosition.getZ(i)));
  }
  const tread = data.tread;
  tread.geometry.dispose();
  tread.geometry = spokedWheelGeometry({
    spokes: spokeCount,
    outerRadius: radius,
    rimInnerRadius: radius * 0.8,
    spokeWidth: radius * 0.13,
    hubRadius: Math.max(radius * 0.32, hubRadius + radius * 0.05),
    rimFillet: radius * 0.045,
    boreRadius: hubRadius,
    thickness: data.width,
    arcSegments: 160,
    ...options,
    // Lathe frame (axis along Y) like the turned rim it replaces, so the
    // tread's quarter turn still stands it in the pulley plane.
  }).rotateX(-Math.PI / 2);
  tread.userData.noRotationIndicator = true;
  tread.userData.role = 'one-piece-filleted-spoked-pulley';
  for (const spoke of data.spokes) {
    spoke.removeFromParent();
    spoke.geometry.dispose();
  }
  data.spokes = [];
  return pulley;
}
