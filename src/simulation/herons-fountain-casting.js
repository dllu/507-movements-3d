import * as THREE from 'three';
import {polygonClipping as clip, poly} from './finite-plate-geometry.js';
import {stackedFluidGeometry} from './stacked-fluid-volume.js';

// Pass 90: geometry for Hero's fountain (464), Brown's plate read as a
// section through one hollow casting on the plane z = 0 (the default camera
// looks at the cut). Every 2D outline below is in plate units: x across the
// plate (0 on the bowl and jet pipe axis), y up (0 under the foot). Measured
// on mm_464.png at 70 px per unit (see docs/p90-u3-review.md).
export const FOUNTAIN = Object.freeze({
  depth: 1.40, // outer depth of the casting front to back
  cover: 0.11, // back (and, cut away, front) wall
  wall: 0.11,
  trough: {half: 2.30, bottom: 4.20, floor: 4.31, rim: 5.07, innerHalf: 2.19},
  leg: {outer: 1.86, hollowOuter: 1.75, hollowInner: 1.31, inner: 1.20},
  bowl: {centerY: 3.89, outer: 1.20, inner: 1.13},
  foot: {half: 2.11, innerHalf: 2.00, floor: 0.10, ceiling: 0.76, windowBottom: 0.87, ogeeTop: 0.93, ogeeBottom: 0.53},
  tubeEnd: 0.27, // lower end of the right tube, below the foot water
  pipe: {outer: 0.28, bore: 0.17, bottom: 3.10, shoulder: 5.20, tip: 5.69, tipOuter: 0.045, tipBore: 0.025, boreShoulder: 5.24},
  slabHalf: 0.50, // floor slab piece bored for the pipe
  foot3d: {x: 1.95, z: -0.35, height: 0.27},
  gap: 0.004, // water stands this far off every wall it touches
});

const F = FOUNTAIN;
const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const arc = (cx, cy, r, a0, a1, n) => Array.from({length: n + 1}, (_, i) => {
  const a = a0 + (a1 - a0) * i / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});

// Brown's flared shoulder where a leg meets the foot: an ogee of two equal
// tangent arcs from the leg face (x = legX, y = top) out to the foot face
// (x = footX, y = bottom), vertical at both ends. `offset` > 0 gives the
// parallel curve that far inside the casting (the cavity's wall face).
export function ogee(legX, footX, top, bottom, offset = 0, n = 24) {
  const d = footX - legX, h = top - bottom, theta = 2 * Math.atan(d / h), r = h / (2 * Math.sin(theta));
  const c1 = [legX + r, top], c2 = [legX + r - 2 * r * Math.cos(theta), top - 2 * r * Math.sin(theta)];
  return [...arc(c1[0], c1[1], r + offset, Math.PI, Math.PI + theta, n),
    ...arc(c2[0], c2[1], r - offset, theta, 0, n).slice(1)];
}

const mirrorX = (points) => points.map(([x, y]) => [-x, y]);

export function fountainOutlines() {
  const {trough: t, leg, bowl, foot, wall} = F;
  const shoulder = ogee(leg.outer, foot.half, foot.ogeeTop, foot.ogeeBottom);
  const shoulderFill = poly([...shoulder, [leg.outer, foot.ogeeBottom]]);
  const solid = clip.union(rect(-t.half, t.bottom, t.half, t.rim), rect(-leg.outer, foot.ogeeBottom - 0.01, leg.outer, t.bottom + 0.01),
    rect(-foot.half, 0, foot.half, foot.ogeeBottom), shoulderFill, poly(mirrorX(shoulder).concat([[-leg.outer, foot.ogeeBottom]]).reverse()));
  // The window through the frame, under the bowl: its top is the bowl's
  // outer surface, tangent to the leg and tube walls at the rim.
  // The cusps where the bowl's surface runs tangent into the walls are
  // filled a little (a short web, 0.3 below the rim), so the bowl joins the
  // walls with real thickness instead of touching them along a line.
  const window = clip.intersection(poly([[-leg.inner, foot.windowBottom], [leg.inner, foot.windowBottom],
    ...arc(0, bowl.centerY, bowl.outer, 0, -Math.PI, 96)]), rect(-leg.inner, foot.windowBottom - 1, leg.inner, bowl.centerY - 0.3));
  const innerShoulder = ogee(leg.outer, foot.half, foot.ogeeTop, foot.ogeeBottom, wall);
  const footCavity = clip.union(rect(-foot.innerHalf, foot.floor, foot.innerHalf, foot.ceiling),
    ...[innerShoulder, mirrorX(innerShoulder)].map((c) => poly([...c, [Math.sign(c[0][0]) * leg.hollowOuter, foot.ogeeBottom]])));
  const cavities = clip.union(
    rect(-t.innerHalf, t.floor, t.innerHalf, t.rim + 0.5), // open trough
    rect(leg.hollowInner, F.tubeEnd - 0.1, leg.hollowOuter, t.floor + 0.05), // right water tube
    rect(-leg.hollowOuter, foot.ceiling - 0.05, -leg.hollowInner, t.bottom), // left air leg
    rect(-leg.hollowInner, bowl.centerY, leg.inner, t.bottom), // air chamber over the bowl
    poly(arc(0, bowl.centerY, bowl.inner, 0, -Math.PI, 96)), // the bowl
    footCavity);
  const tubeWalls = clip.union(rect(leg.inner, F.tubeEnd, leg.hollowInner, t.bottom), rect(leg.hollowOuter, F.tubeEnd, leg.outer, t.bottom));
  const cavity = clip.intersection(clip.difference(cavities, tubeWalls), solid);
  const body = clip.difference(solid, window);
  const walls = clip.difference(body, cavity);
  return {solid, window, cavity, body, walls};
}


// Close T-junctions: where one face's edge runs past a vertex of the faces
// beside it (layers and caps triangulated separately), split that face at
// the vertex so every edge is shared by exactly two triangles.
export function closeTJunctions(geometry, tolerance = 1e-6) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.attributes.position, n = g.attributes.normal;
  const key = (v) => v.toArray().map((x) => Math.round(x * 1e5)).join(',');
  const V = (i) => new THREE.Vector3().fromBufferAttribute(p, i);
  const count = new Map();
  for (let t = 0; t < p.count; t += 3) for (let k = 0; k < 3; k += 1) {
    const a = key(V(t + k)), b = key(V(t + (k + 1) % 3)), e = a < b ? a + '|' + b : b + '|' + a;
    count.set(e, (count.get(e) ?? 0) + 1);
  }
  const loose = new Map();
  for (let t = 0; t < p.count; t += 3) for (let k = 0; k < 3; k += 1) {
    const a = V(t + k), b = V(t + (k + 1) % 3), ka = key(a), kb = key(b);
    if (count.get(ka < kb ? ka + '|' + kb : kb + '|' + ka) !== 2) {loose.set(ka, a);loose.set(kb, b);}
  }
  const candidates = [...loose.values()];
  if (!candidates.length) return g;
  const positions = [], normals = [];
  for (let t = 0; t < p.count; t += 3) {
    const corners = [0, 1, 2].map((k) => ({v: V(t + k), n: new THREE.Vector3().fromBufferAttribute(n, t + k)}));
    const ring = [];
    for (let k = 0; k < 3; k += 1) {
      const a = corners[k], b = corners[(k + 1) % 3], ab = b.v.clone().sub(a.v), len2 = ab.lengthSq();
      ring.push(a);
      const inner = [];
      for (const c of candidates) {
        const s = c.clone().sub(a.v).dot(ab) / len2;
        if (s <= 1e-6 || s >= 1 - 1e-6) continue;
        if (a.v.clone().addScaledVector(ab, s).distanceToSquared(c) > tolerance * tolerance) continue;
        inner.push({s, v: c.clone(), n: a.n.clone().lerp(b.n, s).normalize()});
      }
      inner.sort((x, y) => x.s - y.s);
      ring.push(...inner);
    }
    if (ring.length === 3) {for (const c of ring) {positions.push(...c.v.toArray());normals.push(...c.n.toArray());}continue;}
    // Fan from the centroid keeps every piece inside the original triangle.
    const centre = {v: corners[0].v.clone().add(corners[1].v).add(corners[2].v).divideScalar(3),
      n: corners[0].n.clone().add(corners[1].n).add(corners[2].n).normalize()};
    for (let k = 0; k < ring.length; k += 1) for (const c of [centre, ring[k], ring[(k + 1) % ring.length]]) {positions.push(...c.v.toArray());normals.push(...c.n.toArray());}
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return out;
}

// Split a non-indexed geometry's triangles lying on z = 0 facing +z into
// group 1 (the section's cut faces); the rest are group 0.
function withCutGroup(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = g.attributes.position.array, n = g.attributes.normal.array, keep = [], cut = [];
  for (let t = 0; t < p.length; t += 9) {
    const onPlane = Math.abs(p[t + 2]) < 1e-6 && Math.abs(p[t + 5]) < 1e-6 && Math.abs(p[t + 8]) < 1e-6 && n[t + 2] > 0.99;
    (onPlane ? cut : keep).push(t);
  }
  const order = [...keep, ...cut], positions = new Float32Array(p.length), normals = new Float32Array(p.length);
  order.forEach((t, i) => {positions.set(p.subarray(t, t + 9), i * 9);normals.set(n.subarray(t, t + 9), i * 9);});
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.addGroup(0, keep.length * 3, 0);
  if (cut.length) out.addGroup(keep.length * 3, cut.length * 3, 1);
  out.computeBoundingBox();out.computeBoundingSphere();
  return out;
}

// A stack of prisms along z, built with the shared stacked-fluid surface
// (plan (x, -y) stacked along its y, then turned so the stack runs along z):
// one closed surface with no internal sheets between layers.
function zStack(layers) {
  const flip = (region) => region.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x, -y])));
  const geometry = stackedFluidGeometry(layers.map(({region, z0, z1}) => ({region: flip(region), y0: z0, y1: z1})), {smoothAngle: Math.PI / 5});
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

// The hollow casting, back half: the back wall (whole outline less the
// window) and the cut walls between it and the section plane. The trough
// floor round the jet pipe is a separate bored slab (a round bore cannot be
// cut across the z-stack); it fills the notch left in the stack exactly.
export function fountainCastingGeometry() {
  const {walls, body} = fountainOutlines(), back = -F.depth / 2, inner = back + F.cover;
  const notch = rect(-F.slabHalf, F.trough.bottom, F.slabHalf, F.trough.floor);
  const casting = withCutGroup(closeTJunctions(zStack([{region: body, z0: back, z1: inner}, {region: clip.difference(walls, notch), z0: inner, z1: 0}])));
  const plan = clip.difference(rect(-F.slabHalf, inner, F.slabHalf, 0), poly(arc(0, 0, F.pipe.outer, 0, 2 * Math.PI, 192).slice(0, -1)));
  // stackedFluidGeometry takes plan (x, z) directly and stacks along y.
  const slab = withCutGroup(stackedFluidGeometry([{region: plan, y0: F.trough.bottom, y1: F.trough.floor}], {smoothAngle: Math.PI / 5}));
  return {casting, slab};
}

// The jet pipe, [r, y] profile for latheSectionGeometry: a plain tube from
// its open foot in the bowl up through the trough to Brown's pointed spire.
export function jetPipeProfile() {
  const p = F.pipe;
  return [[p.bore, p.bottom], [p.outer, p.bottom], [p.outer, p.shoulder], [p.tipOuter, p.tip], [p.tipBore, p.tip], [p.bore, p.boreShoulder]];
}

// A turned bun foot (the claw feet reduced to a smooth turned foot), its
// top flat against the underside of the foot vessel.
export function bunFootGeometry() {
  const h = F.foot3d.height, curve = new THREE.SplineCurve([[0.13, -h], [0.19, -0.19], [0.20, -0.11], [0.16, -0.035], [0.15, 0]].map((p) => new THREE.Vector2(...p)));
  const points = [new THREE.Vector2(0, -h), ...curve.getPoints(24), new THREE.Vector2(0, 0)];
  const geometry = new THREE.LatheGeometry(points, 64);
  return geometry;
}

// ---------------------------------------------------------------- water

const G = F.gap;
const interiorZ = () => [-F.depth / 2 + F.cover + G, -G];

// Trough, right tube and foot: one body. The open trough drains down the
// tube, whose foot stands below the lower vessel's water, so the column
// joins the foot water under the tube walls.
export function rightWaterGeometry(troughLevel, footLevel) {
  const [zb, zf] = interiorZ(), {trough: t, leg, foot} = F;
  const band = (x0, x1) => rect(x0, zb, x1, zf);
  const footPlan = band(-foot.innerHalf + G, foot.innerHalf - G);
  const tubeWalls = clip.union(band(leg.inner - G, leg.hollowInner + G), band(leg.hollowOuter - G, leg.outer + G));
  const troughPlan = clip.difference(band(-t.innerHalf + G, t.innerHalf - G), poly(arc(0, 0, F.pipe.outer + G, 0, 2 * Math.PI, 191).slice(0, -1)));
  return closeTJunctions(stackedFluidGeometry([
    {region: footPlan, y0: foot.floor + G, y1: F.tubeEnd - G},
    {region: clip.difference(footPlan, tubeWalls), y0: F.tubeEnd - G, y1: footLevel},
    {region: band(leg.hollowInner + G, leg.hollowOuter - G), y0: footLevel, y1: t.floor + G},
    {region: troughPlan, y0: t.floor + G, y1: troughLevel},
  ], {smoothAngle: Math.PI / 5}));
}

// Bowl water and the water standing in the jet pipe: one body. The bowl is
// a half cylinder along z; the pipe dips into it, so the body wraps the
// pipe wall below the level and fills the bore up to the spire tip.
export function bowlWaterGeometry(level) {
  const [zb, zf] = interiorZ(), {bowl, pipe} = F;
  const r = bowl.inner - G, yc = bowl.centerY, ro = pipe.outer + G, ri = pipe.bore - G, foot = pipe.bottom - G;
  const half = Math.acos((yc - level) / r), n = 96, m = 96;
  const positions = [], normals = [];
  const tri = (a, b, c, na, nb = na, nc = na) => {
    const face = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
    const want = new THREE.Vector3(...na).add(new THREE.Vector3(...nb)).add(new THREE.Vector3(...nc));
    const list = face.dot(want) < 0 ? [[a, na], [c, nc], [b, nb]] : [[a, na], [b, nb], [c, nc]];
    for (const [p, q] of list) {positions.push(...p);normals.push(...q);}
  };
  const quad = (a, b, c, d, na, nb, nc, nd) => {tri(a, b, c, na, nb, nc);tri(a, c, d, na, nc, nd);};
  // Curved bed.
  for (let i = 0; i < n; i += 1) {
    const a0 = -Math.PI / 2 - half + 2 * half * i / n, a1 = -Math.PI / 2 - half + 2 * half * (i + 1) / n;
    const p = (a, z) => [r * Math.cos(a), yc + r * Math.sin(a), z], q = (a) => [Math.cos(a), Math.sin(a), 0];
    quad(p(a0, zb), p(a1, zb), p(a1, zf), p(a0, zf), q(a0), q(a1), q(a1), q(a0));
  }
  // The pipe bore's water surface, the tapered spire included.
  const boreProfile = [[ri, foot], [ri, pipe.boreShoulder - G], [pipe.tipBore - G, pipe.tip - G]];
  const phi0 = Math.asin(G / ri), phi1 = Math.asin(G / ro);
  const halfLathe = (profile, start, inward) => {
    for (let k = 0; k < profile.length - 1; k += 1) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1], len = Math.hypot(r1 - r0, y1 - y0);
      const nr = (inward ? -1 : 1) * (y1 - y0) / len, ny = (inward ? -1 : 1) * -(r1 - r0) / len;
      // Each ring spans the half turn behind z = -gap at its own radius.
      const s0 = start ?? Math.asin(G / r0), s1 = start ?? Math.asin(G / r1);
      const at = (s, j) => Math.PI + s + (Math.PI - 2 * s) * j / m;
      for (let j = 0; j < m; j += 1) {
        const v = (rr, y, f) => [rr * Math.cos(f), y, rr * Math.sin(f)], w = (f) => [nr * Math.cos(f), ny, nr * Math.sin(f)];
        quad(v(r0, y0, at(s0, j)), v(r0, y0, at(s0, j + 1)), v(r1, y1, at(s1, j + 1)), v(r1, y1, at(s1, j)), w(at(s0, j)), w(at(s0, j + 1)), w(at(s1, j + 1)), w(at(s1, j)));
      }
    }
  };
  halfLathe(boreProfile, null, false);
  halfLathe([[ro, foot], [ro, level]], phi1, true);
  // Flat faces, triangulated from plan regions.
  const flat = (region, map, normal) => {
    for (const [outer, ...holes] of region) {
      const ring = (rg) => rg.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
      const contour = ring(outer), hs = holes.map(ring), all = [...contour, ...hs.flat()];
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, hs)) tri(map(all[a]), map(all[b]), map(all[c]), normal);
    }
  };
  const segment = poly(arc(0, yc, r, -Math.PI / 2 + half, -Math.PI / 2 - half, n));
  flat(segment, (p) => [p.x, p.y, zb], [0, 0, -1]);
  const xo = Math.sqrt(ro * ro - G * G), xi = Math.sqrt(ri * ri - G * G);
  const bore = poly([[-xi, foot], [xi, foot], [xi, pipe.boreShoulder - G], [Math.sqrt(Math.max(0, (pipe.tipBore - G) ** 2 - G * G)), pipe.tip - G],
    [-Math.sqrt(Math.max(0, (pipe.tipBore - G) ** 2 - G * G)), pipe.tip - G], [-xi, pipe.boreShoulder - G]]);
  const pipeWall = clip.union(rect(-xo, foot, -xi, level + 1), rect(xi, foot, xo, level + 1));
  flat(clip.difference(clip.union(segment, bore), pipeWall), (p) => [p.x, p.y, zf], [0, 0, 1]);
  const hw = Math.sqrt(r * r - (yc - level) ** 2), circle = (rr, a, b) => arc(0, 0, rr, a, b, m);
  // Level surface round the pipe (plan x, z).
  const top = poly([[-hw, zb], [hw, zb], [hw, zf], ...circle(ro, -phi1, -Math.PI + phi1), [-hw, zf]]);
  flat(top, (p) => [p.x, level, p.y], [0, 1, 0]);
  // Underside of the pipe wall's foot, and the small cap at the spire tip.
  flat(poly([...circle(ro, -phi1, -Math.PI + phi1), ...circle(ri, -Math.PI + phi0, -phi0)]), (p) => [p.x, foot, p.y], [0, 1, 0]);
  const tipR = pipe.tipBore - G, phiT = Math.asin(Math.min(0.99, G / tipR));
  flat(poly(circle(tipR, -phiT, -Math.PI + phiT)), (p) => [p.x, pipe.tip - G, p.y], [0, 1, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
