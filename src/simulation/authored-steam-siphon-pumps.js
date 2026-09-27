import {correctEjectorTrapParts, ejectorOperatingStage} from './ejector-trap-working-parts.js';
import * as THREE from 'three';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

function makeTube(curve, radius, material, role, tubularSegments = 80) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function cylinderBetween(start, end, radius, material, role, sides = 44) {
  const direction = end.clone().sub(start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  cylinder.userData.role = role;
  return cylinder;
}

// ---------------------------------------------------------------------------
// Watertight fork. Each leg is swept as an annulus along the planar half
// curve (z = 0 plane, binormal +z), cell by cell, so that every kept cell
// contributes its outer and inner skin and a return face wherever its
// neighbour is missing (pipe mouths, the port for A). The left leg is clipped
// to x <= 0 and the right leg to x >= 0; both halves are generated in the
// left frame and the right one mirrored, so the seam on x = 0 matches vertex
// for vertex. The result is closed, so the cutaway caps its section fully.
// ---------------------------------------------------------------------------
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function sweepRings(curve, segments) {
  const rings = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const center = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).setZ(0).normalize();
    const normal = new THREE.Vector3().crossVectors(Z_AXIS, tangent).normalize();
    rings.push({ center, normal, tangent });
  }
  return rings;
}

function ringPoint(ring, radius, angle, target = new THREE.Vector3()) {
  return target.copy(ring.center)
    .addScaledVector(ring.normal, radius * Math.cos(angle))
    .addScaledVector(Z_AXIS, radius * Math.sin(angle));
}

// Triangles as flat arrays of {p, n}; each face oriented along `facing`.
function pushQuad(out, corners, normals, facing) {
  const [a, b, c, d] = corners;
  const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  const flip = cross.dot(facing) < 0;
  const flat = cross.lengthSq() > 0 ? cross.clone().normalize().multiplyScalar(flip ? -1 : 1) : facing.clone().normalize();
  const n = normals ?? [flat, flat, flat, flat];
  const tri = (i, j, k) => out.push(flip
    ? [{ p: corners[i], n: n[i] }, { p: corners[k], n: n[k] }, { p: corners[j], n: n[j] }]
    : [{ p: corners[i], n: n[i] }, { p: corners[j], n: n[j] }, { p: corners[k], n: n[k] }]);
  tri(0, 1, 2);
  tri(0, 2, 3);
  return d;
}

function annularSweepCells(rings, inner, outer, sides, removed = () => false, adjust = null, skip = () => false) {
  const segments = rings.length - 1;
  const wrap = (j) => ((j % sides) + sides) % sides;
  const cos = [], sin = [];
  for (let j = 0; j <= 2 * sides; j += 1) {cos.push(Math.cos((j * Math.PI) / sides)); sin.push(Math.sin((j * Math.PI) / sides));}
  const cache = new Array(2 * (segments + 1) * sides);
  const at = (radius, i, j) => {
    const w = wrap(j), key = ((radius === outer ? 1 : 0) * (segments + 1) + i) * sides + w;
    let p = cache[key];
    if (!p) {
      const r = rings[i];
      p = new THREE.Vector3(r.center.x + radius * cos[2 * w] * r.normal.x, r.center.y + radius * cos[2 * w] * r.normal.y, radius * sin[2 * w]);
      if (adjust) p = adjust(p, i, w);
      cache[key] = p;
    }
    return p;
  };
  const normalCache = new Array((segments + 1) * sides * 2);
  // Outward radial unit vector at ring i, half-step angle index h (0..2*sides).
  const radial = (i, h) => {
    const w = ((h % (2 * sides)) + 2 * sides) % (2 * sides), key = i * 2 * sides + w;
    let v = normalCache[key];
    if (!v) {
      const n = rings[i].normal;
      v = normalCache[key] = new THREE.Vector3(cos[w] * n.x, cos[w] * n.y, sin[w]);
    }
    return v;
  };
  const kept = (i, j) => i >= 0 && i < segments && !removed(i, wrap(j));
  const tris = [];
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      if (!kept(i, j) || skip(i, wrap(j))) continue;
      for (const [radius, sign] of [[outer, 1], [inner, -1]]) {
        const corners = [at(radius, i, j), at(radius, i + 1, j), at(radius, i + 1, j + 1), at(radius, i, j + 1)];
        const normals = [radial(i, 2 * j), radial(i + 1, 2 * j), radial(i + 1, 2 * j + 2), radial(i, 2 * j + 2)];
        pushQuad(tris, corners, sign > 0 ? normals : normals.map((v) => v.clone().negate()), radial(i, 2 * j + 1).clone().multiplyScalar(sign));
      }
      // Return faces where the neighbouring cell is absent.
      const missing = [!kept(i - 1, j), !kept(i + 1, j), !kept(i, j - 1), !kept(i, j + 1)];
      if (!missing.some(Boolean)) continue;
      const mid = new THREE.Vector3();
      for (const radius of [inner, outer]) for (const [ci, cj] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) mid.add(at(radius, ci, cj));
      mid.multiplyScalar(1 / 8);
      const edges = [[[i, j], [i, j + 1]], [[i + 1, j], [i + 1, j + 1]], [[i, j], [i + 1, j]], [[i, j + 1], [i + 1, j + 1]]];
      edges.forEach(([[ai, aj], [bi, bj]], k) => {
        if (!missing[k]) return;
        const corners = [at(inner, ai, aj), at(outer, ai, aj), at(outer, bi, bj), at(inner, bi, bj)];
        const edgeMid = corners.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25);
        pushQuad(tris, corners, null, edgeMid.sub(mid));
      });
    }
  }
  return tris;
}

// Sutherland-Hodgman against x <= 0, interpolating normals.
function clipToNegativeX(tris) {
  const out = [];
  for (const tri of tris) {
    for (const v of tri) if (Math.abs(v.p.x) < 1e-6) v.p.x = 0;
    // A face lying in the seam plane would be doubled by the mirror.
    if (tri.every((v) => v.p.x === 0)) continue;
    if (tri.every((v) => v.p.x <= 0)) {out.push(tri); continue;}
    if (tri.every((v) => v.p.x >= 0)) continue;
    const poly = [];
    for (let k = 0; k < 3; k += 1) {
      const a = tri[k], b = tri[(k + 1) % 3];
      const aIn = a.p.x <= 0, bIn = b.p.x <= 0;
      if (aIn) poly.push(a);
      if (aIn !== bIn) {
        const t = a.p.x / (a.p.x - b.p.x);
        const p = a.p.clone().lerp(b.p, t);
        p.x = 0;
        poly.push({ p, n: a.n.clone().lerp(b.n, t).normalize() });
      }
    }
    for (let k = 1; k + 1 < poly.length; k += 1) out.push([poly[0], poly[k], poly[k + 1]]);
  }
  // Drop slivers collapsed onto the seam (two corners at one point).
  const u = new THREE.Vector3(), w = new THREE.Vector3();
  return out.filter(([a, b, c]) => u.subVectors(b.p, a.p).cross(w.subVectors(c.p, a.p)).lengthSq() > 1e-20);
}

function trianglesToGeometry(groups) {
  const total = groups.reduce((n, { tris }) => n + tris.length, 0);
  const positions = new Float32Array(total * 9), normals = new Float32Array(total * 9);
  let o = 0;
  for (const { tris, mirror } of groups) {
    const sx = mirror ? -1 : 1, order = mirror ? [0, 2, 1] : [0, 1, 2];
    for (const tri of tris) {
      for (const k of order) {
        const { p, n } = tri[k];
        positions[o] = sx * p.x; positions[o + 1] = p.y; positions[o + 2] = p.z;
        normals[o] = sx * n.x; normals[o + 1] = n.y; normals[o + 2] = n.z;
        o += 3;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function polylineDistance(points, reach = Infinity) {
  const closest = new THREE.Vector3();
  const segments = [];
  for (let k = 0; k < points.length - 1; k += 1) {
    const line = new THREE.Line3(points[k], points[k + 1]);
    segments.push({ line, box: new THREE.Box3().setFromPoints([points[k], points[k + 1]]).expandByScalar(reach) });
  }
  const far = { distance: Infinity, axis: null };
  return (p) => {
    let best = Infinity, axis = null;
    for (const { line, box } of segments) {
      if (!box.containsPoint(p)) continue;
      line.closestPointToPoint(p, true, closest);
      const d = closest.distanceTo(p);
      if (d < best) {best = d; axis = closest.clone();}
    }
    return axis ? { distance: best, axis } : far;
  };
}

// Earcut drops collinear outline points (the patch's straight cell rows);
// put every dropped point back by splitting the edge it lies on, so the
// patch meets the neighbouring cells vertex for vertex.
function conformingTriangulation(contour, hole) {
  const all = [...contour, ...hole];
  let triangles = THREE.ShapeUtils.triangulateShape(contour, [hole]).map((t) => t.map((k) => all[k]));
  const used = new Set(triangles.flat());
  for (const q of all) {
    if (used.has(q)) continue;
    let best = null;
    triangles.forEach((t, index) => {
      for (let k = 0; k < 3; k += 1) {
        const a = t[k], b = t[(k + 1) % 3], ab = b.clone().sub(a), length = ab.length();
        if (!length) continue;
        const along = q.clone().sub(a).dot(ab) / (length * length);
        if (along <= 1e-9 || along >= 1 - 1e-9) continue;
        const off = Math.abs(ab.x * (q.y - a.y) - ab.y * (q.x - a.x)) / length;
        if (!best || off < best.off) best = { off, index, k };
      }
    });
    if (!best || best.off > 1e-6) continue;
    // Split both faces sharing the edge.
    const t = triangles[best.index], a = t[best.k], b = t[(best.k + 1) % 3];
    const next = [];
    for (const tri of triangles) {
      const i = tri.findIndex((p, k) => (p === a && tri[(k + 1) % 3] === b) || (p === b && tri[(k + 1) % 3] === a));
      if (i < 0) {next.push(tri); continue;}
      const p = tri[i], r = tri[(i + 1) % 3], o = tri[(i + 2) % 3];
      next.push([p, q, o], [q, r, o]);
    }
    triangles = next;
    used.add(q);
  }
  return triangles;
}

// Split parameter-space triangles until no edge is longer than `limit`
// (one cell), so the mapped faces follow the curved wall. Whether an edge is
// split depends only on the edge, so neighbours stay conforming; the patch
// boundary (unit cell edges) and the short port-curve edges are never split.
function refineParameterTriangles(triangles, limit, keepWhole = []) {
  const midpoints = new Map();
  const key = (p) => `${p.x.toFixed(9)},${p.y.toFixed(9)}`;
  // Edges of the port curve are shared with the bore and are never split.
  const whole = new Set();
  for (let k = 0; k < keepWhole.length; k += 1) whole.add([key(keepWhole[k]), key(keepWhole[(k + 1) % keepWhole.length])].sort().join('|'));
  const splittable = (a, b) => a.distanceTo(b) > limit && !whole.has([key(a), key(b)].sort().join('|'));
  const mid = (a, b) => {
    const k = [key(a), key(b)].sort().join('|');
    if (!midpoints.has(k)) midpoints.set(k, a.clone().add(b).multiplyScalar(0.5));
    return midpoints.get(k);
  };
  let current = triangles;
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    const next = [];
    for (const [a, b, c] of current) {
      const long = [splittable(a, b), splittable(b, c), splittable(c, a)];
      const count = long.filter(Boolean).length;
      if (!count) {next.push([a, b, c]); continue;}
      changed = true;
      if (count === 3) {
        const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      } else if (count === 1) {
        const [p, q, r] = long[0] ? [a, b, c] : long[1] ? [b, c, a] : [c, a, b];
        const m = mid(p, q);
        next.push([p, m, r], [m, q, r]);
      } else {
        // Two long edges: rotate so they are p-q and q-r.
        const [p, q, r] = !long[2] ? [a, b, c] : !long[0] ? [b, c, a] : [c, a, b];
        const pq = mid(p, q), qr = mid(q, r);
        next.push([pq, q, qr], [p, pq, qr], [p, qr, r]);
      }
    }
    current = next;
    if (!changed) break;
  }
  return current;
}

// The fork wall with a sealed port for A. The port is a patch of the grid
// round A's crossing, retriangulated in the sweep's (u, v) parameters: each
// skin runs from the patch's cell boundary to the exact curve where that
// skin meets A's fit cylinder, and a smooth bore joins the two curves. So the
// port is round, lies in the wall, and seals on A with a small clearance.
export function watertightForkWall(halfCurve, inner, outer, aPath, portRadius, { segments = 300, sides = 80, rays = 72, margin = 2 } = {}) {
  const rings = sweepRings(halfCurve, segments);
  // A rises through the crotch on x = 0, so its port straddles the seam:
  // the port is cut for A and its mirror image alike, which keeps the two
  // halves identical. Away from the crotch A runs clear of every wall.
  const toA = polylineDistance(aPath, portRadius * 3);
  const toMirror = polylineDistance(aPath.map((p) => new THREE.Vector3(-p.x, p.y, p.z)), portRadius * 3);
  const nearest = (p) => {
    const a = toA(p), m = toMirror(p);
    return a.distance <= m.distance ? a : m;
  };
  const excess = (p) => nearest(p).distance - portRadius;
  const surface = (radius, u, v) => {
    const i0 = Math.max(0, Math.min(segments - 1, Math.floor(u))), f = u - i0;
    const a = rings[i0], b = rings[i0 + 1];
    const normal = a.normal.clone().lerp(b.normal, f).normalize();
    const theta = (v * 2 * Math.PI) / sides;
    const radial = normal.multiplyScalar(Math.cos(theta)).addScaledVector(Z_AXIS, Math.sin(theta));
    return { p: a.center.clone().lerp(b.center, f).addScaledVector(radial, radius), n: radial };
  };
  const wrap = (j) => ((j % sides) + sides) % sides;
  // Cells crossed by the cylinder on either skin.
  const hit = [];
  for (let i = 0; i < segments; i += 1) for (let j = 0; j < sides; j += 1) {
    if (excess(surface(outer, i + 0.5, j + 0.5).p) < 0 || excess(surface(inner, i + 0.5, j + 0.5).p) < 0) hit.push([i, j]);
  }
  const patch = new Set();
  let tris;
  const info = { cells: hit.length, radius: portRadius };
  if (!hit.length) {
    tris = annularSweepCells(rings, inner, outer, sides);
  } else {
    const jRef = hit[0][1], unwrap = (j) => jRef + wrap(j - jRef + sides / 2) - sides / 2;
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
    for (const [i, j] of hit) {const v = unwrap(j); i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, v); j1 = Math.max(j1, v);}
    // A rectangle of cells round the crossing, `margin` cells wider.
    i0 = Math.max(0, i0 - margin); i1 = Math.min(segments - 1, i1 + margin); j0 -= margin; j1 += margin;
    for (let i = i0; i <= i1; i += 1) for (let v = j0; v <= j1; v += 1) patch.add(i * sides + wrap(v));
    tris = annularSweepCells(rings, inner, outer, sides, () => false, null, (i, j) => patch.has(i * sides + j));
    const center = [(i0 + i1 + 1) / 2, (j0 + j1 + 1) / 2];
    const contour = [];
    for (let i = i0; i <= i1 + 1; i += 1) contour.push(new THREE.Vector2(i, j0));
    for (let v = j0 + 1; v <= j1 + 1; v += 1) contour.push(new THREE.Vector2(i1 + 1, v));
    for (let i = i1; i >= i0; i -= 1) contour.push(new THREE.Vector2(i, j1 + 1));
    for (let v = j1; v > j0; v -= 1) contour.push(new THREE.Vector2(i0, v));
    const curves = {};
    for (const [radius, sign] of [[outer, 1], [inner, -1]]) {
      // Where each ray from the patch centre first leaves the cylinder.
      const curve = [];
      for (let k = 0; k < rays; k += 1) {
        const angle = (k * 2 * Math.PI) / rays;
        const du = Math.cos(angle), dv = Math.sin(angle);
        const reach = Math.min(du ? ((du > 0 ? i1 + 1 : i0) - center[0]) / du : Infinity, dv ? ((dv > 0 ? j1 + 1 : j0) - center[1]) / dv : Infinity);
        const at = (t) => [center[0] + du * t, center[1] + dv * t];
        let lo = 0, hi = reach;
        // March out to the first sample outside, then bisect.
        const steps = 64;
        for (let m = 1; m <= steps; m += 1) {
          const t = (reach * m) / steps;
          if (excess(surface(radius, ...at(t)).p) >= 0) {hi = t; lo = (reach * (m - 1)) / steps; break;}
        }
        for (let m = 0; m < 40; m += 1) {
          const mid = (lo + hi) / 2;
          if (excess(surface(radius, ...at(mid)).p) < 0) lo = mid; else hi = mid;
        }
        curve.push(new THREE.Vector2(...at(hi)));
      }
      curves[radius] = curve;
      // The skin between the patch boundary and the port curve.
      const hole = [...curve].reverse();
      const all = [...contour, ...hole];
      const facing = sign;
      for (const [a, b, c] of refineParameterTriangles(conformingTriangulation(contour, hole), 1.01, curve)) {
        const verts = [a, b, c].map((q) => {
          const { p, n } = surface(radius, q.x, q.y);
          return { p, n: n.multiplyScalar(facing) };
        });
        const cross = verts[1].p.clone().sub(verts[0].p).cross(verts[2].p.clone().sub(verts[0].p));
        const out = verts[0].n.clone().add(verts[1].n).add(verts[2].n);
        tris.push(cross.dot(out) >= 0 ? verts : [verts[0], verts[2], verts[1]]);
      }
    }
    // The bore of the port, facing A's axis.
    for (let k = 0; k < rays; k += 1) {
      const q = [curves[outer][k], curves[outer][(k + 1) % rays], curves[inner][(k + 1) % rays], curves[inner][k]];
      const pts = [surface(outer, q[0].x, q[0].y).p, surface(outer, q[1].x, q[1].y).p, surface(inner, q[2].x, q[2].y).p, surface(inner, q[3].x, q[3].y).p];
      const normals = pts.map((p) => {
        const { axis } = nearest(p);
        return axis.clone().sub(p).normalize();
      });
      const facing = normals.reduce((sum, n) => sum.add(n), new THREE.Vector3());
      pushQuad(tris, pts, normals, facing);
    }
    Object.assign(info, { patch: patch.size, rows: [i0, i1], columns: [j0, j1] });
  }
  const half = clipToNegativeX(tris);
  const geometry = trianglesToGeometry([{ tris: half, mirror: false }, { tris: half, mirror: true }]);
  geometry.userData.port = info;
  return geometry;
}

// The water filling the fork's bore, built only behind the section plane:
// a half sweep (angles pi..2pi) closed by a flat face just behind z = 0,
// with round ends, clipped and mirrored like the wall. It is one closed
// body, and its section face does not lie on the wall's cut face.
export function halfWaterBody(halfCurve, radius, { segments = 240, sides = 40, behind = 5e-4 } = {}) {
  const rings = sweepRings(halfCurve, segments);
  const tris = [];
  const angle = (j) => Math.PI + (j * Math.PI) / sides;
  const point = (i, j) => {
    const p = ringPoint(rings[i], radius, angle(j));
    p.z = Math.min(p.z, -behind);
    return p;
  };
  const radial = (i, j) => rings[i].normal.clone().multiplyScalar(Math.cos(angle(j))).addScaledVector(Z_AXIS, Math.sin(angle(j))).normalize();
  const pts = rings.map((_, i) => Array.from({ length: sides + 1 }, (__, j) => point(i, j)));
  const flatNormal = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < segments; i += 1) {
    const facing = radial(i, sides / 2);
    for (let j = 0; j < sides; j += 1) {
      pushQuad(tris, [pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], pts[i][j + 1]],
        [radial(i, j), radial(i + 1, j), radial(i + 1, j + 1), radial(i, j + 1)], radial(i, j + 0.5));
    }
    // Flat section face: the diameter from angle pi to 2pi, split at the
    // axis so that it meets the half-disc ends edge to edge.
    const c0 = rings[i].center.clone().setZ(-behind), c1 = rings[i + 1].center.clone().setZ(-behind);
    pushQuad(tris, [pts[i][0], pts[i + 1][0], c1, c0], [flatNormal, flatNormal, flatNormal, flatNormal], flatNormal);
    pushQuad(tris, [c0, c1, pts[i + 1][sides], pts[i][sides]], [flatNormal, flatNormal, flatNormal, flatNormal], flatNormal);
    void facing;
  }
  // Half-disc ends.
  for (const [i, sign] of [[0, -1], [segments, 1]]) {
    const facing = rings[i].tangent.clone().multiplyScalar(sign);
    const hub = rings[i].center.clone().setZ(-behind);
    for (let j = 0; j < sides; j += 1) {
      const a = pts[i][j], b = pts[i][j + 1];
      const cross = new THREE.Vector3().crossVectors(a.clone().sub(hub), b.clone().sub(hub));
      const n = facing.clone().normalize();
      tris.push(cross.dot(facing) >= 0 ? [{ p: hub, n }, { p: a, n }, { p: b, n }] : [{ p: hub, n }, { p: b, n }, { p: a, n }]);
    }
  }
  const half = clipToNegativeX(tris);
  return trianglesToGeometry([{ tris: half, mirror: false }, { tris: half, mirror: true }]);
}

// The free surface of the water at height `level`: the section of the water
// body's triangles by the horizontal plane, chained into loops and filled.
function waterSurfaceSlicer(geometry, capacity = 4096) {
  const position = geometry.attributes.position;
  const count = position.count;
  // Shared vertex ids, so both faces on an edge meet at one crossing point.
  const ids = new Int32Array(count), xs = [], ys = [], zs = [], lookup = new Map();
  for (let i = 0; i < count; i += 1) {
    const key = `${position.getX(i).toFixed(6)},${position.getY(i).toFixed(6)},${position.getZ(i).toFixed(6)}`;
    let id = lookup.get(key);
    if (id === undefined) {id = xs.length; lookup.set(key, id); xs.push(position.getX(i)); ys.push(position.getY(i)); zs.push(position.getZ(i));}
    ids[i] = id;
  }
  const vertices = xs.length;
  // Triangles binned by height.
  const box = new THREE.Box3().setFromBufferAttribute(position), bins = 256;
  const low = box.min.y, span = Math.max(1e-9, box.max.y - low), binOf = (y) => Math.min(bins - 1, Math.max(0, Math.floor(((y - low) / span) * bins)));
  const binned = Array.from({ length: bins }, () => []);
  for (let t = 0; t < count; t += 3) {
    const y0 = Math.min(ys[ids[t]], ys[ids[t + 1]], ys[ids[t + 2]]), y1 = Math.max(ys[ids[t]], ys[ids[t + 1]], ys[ids[t + 2]]);
    for (let k = binOf(y0); k <= binOf(y1); k += 1) binned[k].push(t);
  }
  const surface = new THREE.BufferGeometry();
  const buffer = new Float32Array(capacity * 9);
  const normals = new Float32Array(capacity * 9);
  for (let i = 0; i < capacity * 3; i += 1) normals[i * 3 + 1] = 1;
  surface.setAttribute('position', new THREE.BufferAttribute(buffer, 3).setUsage(THREE.DynamicDrawUsage));
  surface.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  surface.setDrawRange(0, 0);
  const slice = (level) => {
    const adjacency = new Map(), coords = new Map();
    const crossing = (i, j) => {
      if (i > j) [i, j] = [j, i];
      const key = i * vertices + j;
      if (!coords.has(key)) {
        const t = (level - ys[i]) / (ys[j] - ys[i]);
        coords.set(key, new THREE.Vector2(xs[i] + (xs[j] - xs[i]) * t, zs[i] + (zs[j] - zs[i]) * t));
      }
      return key;
    };
    for (const t of binned[binOf(level)]) {
      const found = [];
      for (let k = 0; k < 3; k += 1) {
        const i = ids[t + k], j = ids[t + (k + 1) % 3];
        if ((ys[i] < level) !== (ys[j] < level)) found.push(crossing(i, j));
      }
      if (found.length !== 2 || found[0] === found[1]) continue;
      for (const [a, b] of [[found[0], found[1]], [found[1], found[0]]]) {
        if (!adjacency.has(a)) adjacency.set(a, []);
        adjacency.get(a).push(b);
      }
    }
    const used = new Set(), loops = [];
    for (const start of adjacency.keys()) {
      if (used.has(start)) continue;
      const loop = [start];
      used.add(start);
      let previous = null, current = start;
      for (;;) {
        const next = adjacency.get(current).find((k) => k !== previous && !used.has(k));
        if (next === undefined) break;
        used.add(next);
        loop.push(next);
        previous = current;
        current = next;
      }
      if (loop.length >= 3) loops.push(loop.map((k) => coords.get(k)));
    }
    let n = 0;
    for (const loop of loops) {
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(loop, [])) {
        if (n >= capacity) break;
        // Negative (x, z) winding faces +y.
        const cross = (loop[b].x - loop[a].x) * (loop[c].y - loop[a].y) - (loop[b].y - loop[a].y) * (loop[c].x - loop[a].x);
        const order = cross < 0 ? [loop[a], loop[b], loop[c]] : [loop[a], loop[c], loop[b]];
        order.forEach((q, k) => buffer.set([q.x, level, q.y], n * 9 + k * 3));
        n += 1;
      }
    }
    surface.attributes.position.needsUpdate = true;
    surface.setDrawRange(0, n * 3);
    surface.computeBoundingSphere();
    return loops.length;
  };
  return { surface, slice };
}

// Replace the shared fork's open wall (its port for A was punched by
// deleting triangles, leaving the skins unjoined, so the section could not be
// capped) and its annular water body with closed solids.
function sealFork(root) {
  const d = root.userData, b = d.blocks;
  const branch = d.flowPaths.branchShellCurves[0];
  const leg = branch.points.filter((p) => p.x < -0.9).map((p) => p.clone());
  leg.unshift(leg[0].clone().setY(-2.86));
  const halfCurve = new THREE.CatmullRomCurve3([...leg, new THREE.Vector3(-0.45, 0.95, 0), new THREE.Vector3(-0.12, 1.32, 0), new THREE.Vector3(0, 1.75, 0), new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(0, 3.42, 0)], false, 'centripetal');
  // A comes forward under the crotch and rises through it on x = 0 (Brown
  // draws its bend below the crotch), so its port is round and symmetric.
  const steamCurve = d.flowPaths.steamPipeCurve;
  steamCurve.points.splice(5, steamCurve.points.length - 5,
    new THREE.Vector3(0.26, 0.22, -0.30), new THREE.Vector3(0, 0.56, 0), new THREE.Vector3(0, 0.95, 0), d.geometry.nozzleTip.clone());
  steamCurve.updateArcLengths();
  d.flowPaths.steamFlowCurve.updateArcLengths();
  b.steamPipe.geometry.dispose();
  b.steamPipe.geometry = curvedPipeWall(steamCurve, 0.092, 0.17, 120, 32);
  b.steamCore.geometry.dispose();
  b.steamCore.geometry = new THREE.TubeGeometry(steamCurve, 120, 0.070, 16, false);
  // Only A's rise through the crotch meets the fork; elsewhere A runs clear
  // of both legs (checked by the body-intersection screen and the tests).
  const aPath = steamCurve.getSpacedPoints(240).filter((p) => p.y > 0.4 && p.x < 0.3);
  const wall = b.suctionBranches[0];
  wall.geometry.dispose();
  wall.geometry = watertightForkWall(halfCurve, 0.38, 0.46, aPath, 0.172);
  const water = b.waterFill[0];
  water.geometry.dispose();
  water.geometry = halfWaterBody(halfCurve, 0.372);
  const slicer = waterSurfaceSlicer(water.geometry);
  const surfaceMaterial = [].concat(water.material)[0].clone();
  surfaceMaterial.side = THREE.DoubleSide;
  const surface = new THREE.Mesh(slicer.surface, surfaceMaterial);
  surface.userData.role = 'free-water-level-in-B-fork-and-C';
  surface.renderOrder = water.renderOrder;
  root.add(surface);
  b.waterSurface = surface;

  d.forkConstruction = {
    wall: 'closed annular sweep, legs mirrored on x = 0, sealed port for A (0.002 clearance)',
    water: 'closed half body behind the section plane with a sliced free surface',
    port: wall.geometry.userData.port,
  };
  const previous = d.updateWorkingParts;
  let lastLevel = NaN;
  d.updateWorkingParts = (time, state) => {
    previous(time, state);
    const level = water.userData.waterLevelY;
    if (level === lastLevel) return;
    lastLevel = level;
    surface.visible = level > -2.859 && level < 3.419;
    if (surface.visible) slicer.slice(level);
  };
}

function lansdellSteamSiphonPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const steamMarkerPassesPerCycle = 3;
  const waterMarkerPassesPerCycle = 2;
  const steamMarkerCount = 9;
  const waterMarkersPerPath = 5;
  const suctionBranchCount = 2;
  const waterPathsPerBranch = 2;

  const atmosphericPressurePascal = 101325;
  const steamSupplyPressurePascal = 240000;
  const mixingPressurePascal = 84000;
  const steamSupplyTemperatureKelvin = 405;
  const steamHeatCapacityRatio = 1.30;
  const steamSpecificGasConstant = 461.5;
  const steamDischargeCoefficient = 0.85;
  const steamNozzleRadiusMetre = 0.003;
  const waterDensityKilogramPerCubicMetre = 998;
  const gravityMetrePerSecondSquared = 9.80665;
  const suctionLiftMetre = 0.90;
  const waterDischargeCoefficient = 0.74;
  const suctionBranchRadiusMetre = 0.0065;

  const criticalPressureRatio = (2 / (steamHeatCapacityRatio + 1)) ** (
    steamHeatCapacityRatio / (steamHeatCapacityRatio - 1)
  );
  const mixingPressureRatio = mixingPressurePascal
    / steamSupplyPressurePascal;
  const steamNozzleAreaSquareMetre = Math.PI
    * steamNozzleRadiusMetre ** 2;
  const chokedFlowFactor = Math.sqrt(steamHeatCapacityRatio)
    * (2 / (steamHeatCapacityRatio + 1)) ** (
      (steamHeatCapacityRatio + 1)
      / (2 * (steamHeatCapacityRatio - 1))
    );
  const steamMassFlowKilogramPerSecond = steamDischargeCoefficient
    * steamNozzleAreaSquareMetre
    * steamSupplyPressurePascal
    / Math.sqrt(
      steamSpecificGasConstant * steamSupplyTemperatureKelvin,
    )
    * chokedFlowFactor;
  const steamExitTemperatureKelvin = steamSupplyTemperatureKelvin
    * mixingPressureRatio ** (
      (steamHeatCapacityRatio - 1) / steamHeatCapacityRatio
    );
  const steamSpecificHeatAtConstantPressure = steamHeatCapacityRatio
    * steamSpecificGasConstant / (steamHeatCapacityRatio - 1);
  const steamJetSpeedMetrePerSecond = Math.sqrt(
    2 * steamSpecificHeatAtConstantPressure
      * (steamSupplyTemperatureKelvin - steamExitTemperatureKelvin),
  );
  const steamDensityAtMixingPlane = mixingPressurePascal
    / (steamSpecificGasConstant * steamExitTemperatureKelvin);
  const maximumStaticLiftMetre = (
    atmosphericPressurePascal - mixingPressurePascal
  ) / (waterDensityKilogramPerCubicMetre
    * gravityMetrePerSecondSquared);
  const suctionHeadMarginMetre = maximumStaticLiftMetre
    - suctionLiftMetre;
  const waterSpeedPerBranchMetrePerSecond = waterDischargeCoefficient
    * Math.sqrt(
      2 * gravityMetrePerSecondSquared * suctionHeadMarginMetre,
    );
  const suctionBranchAreaSquareMetre = Math.PI
    * suctionBranchRadiusMetre ** 2;
  const waterMassFlowPerBranchKilogramPerSecond =
    waterDensityKilogramPerCubicMetre
    * suctionBranchAreaSquareMetre
    * waterSpeedPerBranchMetrePerSecond;
  const totalWaterMassFlowKilogramPerSecond = suctionBranchCount
    * waterMassFlowPerBranchKilogramPerSecond;
  const totalMassFlowKilogramPerSecond = steamMassFlowKilogramPerSecond
    + totalWaterMassFlowKilogramPerSecond;
  const inletMomentumNewton = steamMassFlowKilogramPerSecond
    * steamJetSpeedMetrePerSecond
    + totalWaterMassFlowKilogramPerSecond
      * waterSpeedPerBranchMetrePerSecond;
  const mixedSpeedMetrePerSecond = inletMomentumNewton
    / totalMassFlowKilogramPerSecond;
  const steamVolumetricFlowAtMixingPlane = steamMassFlowKilogramPerSecond
    / steamDensityAtMixingPlane;
  const totalWaterVolumetricFlow = totalWaterMassFlowKilogramPerSecond
    / waterDensityKilogramPerCubicMetre;
  const mixedVolumetricFlow = steamVolumetricFlowAtMixingPlane
    + totalWaterVolumetricFlow;
  const derivedDischargeAreaSquareMetre = mixedVolumetricFlow
    / mixedSpeedMetrePerSecond;
  const outletMomentumNewton = totalMassFlowKilogramPerSecond
    * mixedSpeedMetrePerSecond;

  const forkCenter = new THREE.Vector3(0, 1.26, 0);
  // Brown's A rises through the crotch and ends well up inside the fork,
  // about two thirds of a leg's width above the crotch, short of C's neck.
  const nozzleTip = new THREE.Vector3(0, 1.40, 0);
  const dischargeTop = new THREE.Vector3(0, 3.48, 0);
  const branchShellCurves = [-1, 1].map((side) =>
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.38, -2.62, 0),
      new THREE.Vector3(side * 1.38, -1.35, 0),
      new THREE.Vector3(side * 1.30, -0.25, 0),
      new THREE.Vector3(side * 1.02, 0.48, 0),
      new THREE.Vector3(side * 0.51, 1.05, 0),
      forkCenter,
    ], false, 'centripetal'));
  const steamFeedStart = new THREE.Vector3(2.22, 1.82, 0.34);
  const steamPipeCurve = new THREE.CatmullRomCurve3([
    steamFeedStart,
    new THREE.Vector3(2.22, 1.15, 0.34),
    new THREE.Vector3(2.18, 0.44, 0.34),
    new THREE.Vector3(1.58, 0.13, 0.30),
    new THREE.Vector3(0.84, 0.13, 0.20),
    new THREE.Vector3(0.26, 0.47, 0.05),
    nozzleTip,
  ], false, 'centripetal');
  const steamFlowCurve = new THREE.CurvePath();
  steamFlowCurve.add(steamPipeCurve);
  steamFlowCurve.add(new THREE.LineCurve3(nozzleTip, dischargeTop));

  const waterCurves = [];
  for (const side of [-1, 1]) {
    for (const lane of [-1, 1]) {
      waterCurves.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.38, -2.73, lane * 0.13),
        new THREE.Vector3(side * 1.36, -1.38, lane * 0.15),
        new THREE.Vector3(side * 1.25, -0.24, lane * 0.19),
        new THREE.Vector3(side * 0.92, 0.51, lane * 0.23),
        new THREE.Vector3(side * 0.47, 1.00, lane * 0.27),
        new THREE.Vector3(side * 0.25, 1.32, lane * 0.24),
        new THREE.Vector3(side * 0.15, 2.12, lane * 0.18),
        new THREE.Vector3(side * 0.12, 3.48, lane * 0.13),
      ], false, 'centripetal'));
    }
  }

  const geometry = {
    atmosphericPressurePascal,
    chokedFlowFactor,
    criticalPressureRatio,
    cycleDuration,
    derivedDischargeAreaSquareMetre,
    forkCenter: forkCenter.clone(),
    gravityMetrePerSecondSquared,
    inletMomentumNewton,
    maximumStaticLiftMetre,
    mixedSpeedMetrePerSecond,
    mixedVolumetricFlow,
    mixingPressurePascal,
    mixingPressureRatio,
    nozzleTip: nozzleTip.clone(),
    outletMomentumNewton,
    steamDensityAtMixingPlane,
    steamDischargeCoefficient,
    steamExitTemperatureKelvin,
    steamHeatCapacityRatio,
    steamJetSpeedMetrePerSecond,
    steamMarkerCount,
    steamMarkerPassesPerCycle,
    steamMassFlowKilogramPerSecond,
    steamNozzleAreaSquareMetre,
    steamNozzleRadiusMetre,
    steamSpecificGasConstant,
    steamSpecificHeatAtConstantPressure,
    steamSupplyPressurePascal,
    steamSupplyTemperatureKelvin,
    steamVolumetricFlowAtMixingPlane,
    suctionBranchAreaSquareMetre,
    suctionBranchCount,
    suctionBranchRadiusMetre,
    suctionHeadMarginMetre,
    suctionLiftMetre,
    totalMassFlowKilogramPerSecond,
    totalWaterMassFlowKilogramPerSecond,
    totalWaterVolumetricFlow,
    waterDensityKilogramPerCubicMetre,
    waterDischargeCoefficient,
    waterMarkerPassesPerCycle,
    waterMarkersPerPath,
    waterMassFlowPerBranchKilogramPerSecond,
    waterPathsPerBranch,
    waterSpeedPerBranchMetrePerSecond,
  };

  const shellMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    opacity: 0.34,
    roughness: 0.42,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const jointMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.44,
  });
  const steamPipeMaterial = matte(PALETTE.driver, {
    metalness: 0.23,
    opacity: 0.80,
    roughness: 0.43,
    transparent: true,
  });
  const steamMaterial = matte(PALETTE.white, {
    opacity: 0.47,
    roughness: 0.24,
    transparent: true,
  });
  steamMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.52,
    roughness: 0.25,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const waterMarkerMaterial = matte(0x91d7e2, {
    opacity: 0.84,
    roughness: 0.29,
    transparent: true,
  });
  waterMarkerMaterial.depthWrite = false;

  const suctionBranches = branchShellCurves.map((curve, index) => {
    const branch = makeTube(
      curve,
      0.43,
      shellMaterial,
      `stationary-suction-pipe-B-${index + 1}-of-two-to-fork`,
      96,
    );
    root.add(branch);
    return branch;
  });
  const dischargePipe = cylinderBetween(
    new THREE.Vector3(0, 1.22, 0),
    new THREE.Vector3(0, 3.42, 0),
    0.54,
    shellMaterial,
    'stationary-single-discharge-pipe-C-above-fork',
    56,
  );
  root.add(dischargePipe);
  // Brown draws plain pipe mouths and a smooth fork neck: no ink rings.

  const steamPipe = makeTube(
    steamPipeCurve,
    0.17,
    steamPipeMaterial,
    'stationary-jet-pipe-A-entering-behind-right-B-at-fork',
    92,
  );
  root.add(steamPipe);
  const steamCore = makeTube(
    steamPipeCurve,
    0.070,
    steamMaterial,
    'steam-inside-A-to-unobstructed-central-nozzle',
    92,
  );
  root.add(steamCore);
  const steamJet = cylinderBetween(
    nozzleTip,
    new THREE.Vector3(0, 3.18, 0),
    0.070,
    steamMaterial,
    'upward-steam-jet-on-centerline-of-C',
    28,
  );
  root.add(steamJet);

  const waterStreams = waterCurves.map((curve, index) => {
    const stream = makeTube(
      curve,
      0.070,
      waterMaterial,
      `unbroken-water-current-${index + 1}-of-four-through-B-fork-C`,
      100,
    );
    root.add(stream);
    return stream;
  });

  const basin = new THREE.Mesh(
    new THREE.BoxGeometry(4.20, 0.18, 2.45),
    jointMaterial,
  );
  basin.position.y = -2.96;
  basin.userData.role = 'fixed-water-source-basin-under-two-B-mouths';
  root.add(basin);
  const basinWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.95, 0.055, 2.20),
    waterMaterial,
  );
  basinWater.position.y = -2.84;
  basinWater.userData.role = 'water-surface-feeding-both-suction-branches';
  root.add(basinWater);

  const steamMarkers = [];
  for (let index = 0; index < steamMarkerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 16, 11),
      steamMaterial,
    );
    marker.userData.role = `steam-A-marker-${index + 1}`;
    root.add(marker);
    steamMarkers.push(marker);
  }
  const waterMarkers = [];
  for (let pathIndex = 0; pathIndex < waterCurves.length;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < waterMarkersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.084, 16, 11),
        waterMarkerMaterial,
      );
      marker.userData.role =
        `water-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      waterMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      // Presented start, run and stop loop; the flows below are those of
      // the steady running stage.
      ...ejectorOperatingStage(cycleTime / cycleDuration),
      cycleTime,
      inletMomentumNewton,
      mixedSpeedMetrePerSecond,
      mixingPressurePascal,
      outletMomentumNewton,
      phase: cycleTime / cycleDuration,
      steamMassFlowKilogramPerSecond,
      totalMassFlowKilogramPerSecond,
      totalWaterMassFlowKilogramPerSecond,
      waterMassFlowPerBranchKilogramPerSecond,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    for (let index = 0; index < steamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        state.phase * steamMarkerPassesPerCycle
          + index / steamMarkerCount,
        1,
      );
      steamMarkers[index].position.copy(steamFlowCurve.getPointAt(progress));
      steamMarkers[index].scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55,
      );
    }
    for (const entry of waterMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        state.phase * waterMarkerPassesPerCycle
          + entry.markerIndex / waterMarkersPerPath,
        1,
      );
      entry.marker.position.copy(
        waterCurves[entry.pathIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55,
      );
    }
    root.userData.updateWorkingParts?.(time, state);
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'lansdell-steam-siphon-pump-with-unobstructed-central-jet-at-y-fork-twin-suction-branches-and-single-unbroken-upper-discharge',
    blocks: {
      basin,
      basinWater,
      dischargePipe,
      steamCore,
      steamJet,
      steamMarkers,
      steamPipe,
      suctionBranches,
      waterMarkers: waterMarkers.map(({ marker }) => marker),
      waterStreams,
    },
    degreesOfFreedom: {
      mechanicalMovingParts: 0,
      operatingDegreesOfFreedom: 0,
      prescribedAdvectiveFlowPhases: 2,
    },
    dynamics: {
      assumptionScope:
        'The steady visual state specifies the fork pressure and uses choked ideal-steam flow, equal branch suction, and one-dimensional equal-pressure momentum mixing. Startup air purge, condensation, diffuser recovery, turbulence, cavitation, pipe friction, leakage, unequal source heads, and downstream back-pressure are not integrated. The presented loop starts, runs and shuts off the siphon: the discharge issuing from the open mouth of C grows once the water reaches it, holds while running and collapses at shut-off (prescribed smoothstep ramps).',
      markerContinuity:
        'Every marker follows one complete A-to-C or B-to-C curve by arc length with getPointAt and shrinks continuously to zero at both recycling endpoints.',
      unbrokenCurrent:
        'Each water path is one continuous spline from a lower B mouth, around the central A nozzle, across the fork, and through C; no marker teleports between separately animated pipe pieces.',
    },
    fidelity: 'authored',
    flowPaths: {
      branchShellCurves,
      steamFlowCurve,
      steamPipeCurve,
      waterCurves,
    },
    geometry,
    mechanism:
      'Lansdell’s stationary steam siphon has two separate lower suction pipes B that curve inward as a symmetric Y and join one upper discharge C. Jet pipe A descends outside the right branch, passes behind it into the open fork, turns upward, and ends on the C centerline. Its narrow steam jet occupies only the middle of the fork; equal water currents rise unobstructed on both sides, merge around the jet, and continue through C without a break. There are no mechanical moving parts.',
    motion: {
      branchFlowDirections: [
        new THREE.Vector3(0.35, 1, 0).normalize(),
        new THREE.Vector3(-0.35, 1, 0).normalize(),
      ],
      cycleDuration,
      dischargeDirection: new THREE.Vector3(0, 1, 0),
      steamDirectionAtNozzle: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 476 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate476: {
        approximateDischargeCCenterPixels: [257, 78],
        approximateJetNozzlePixels: [255, 231],
        approximateLeftBPipeCenterPixels: [139, 406],
        approximateRightBPipeCenterPixels: [355, 406],
        approximateSteamSupplyTopPixels: [390, 205],
        approximateYForkCenterPixels: [258, 289],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is the jet pipe',
          'B and B are two suction pipes',
          'the two B pipes have a forked connection with discharge C',
          'A enters at the fork without obstructing upward water',
          'water moves upward in an unbroken current',
        ],
        engravingEvidence:
          'Brown’s section shows two widely separated vertical B legs curving symmetrically into one narrow C neck, while a separate right-side supply bends behind the right B wall to an upward-facing A nozzle in the open fork.',
        historicalCorroboration:
          'The official catalogue of the United States products at Paris in 1867 lists the Steam Siphon Company, H. S. Lansdell superintendent, New York, exhibiting a steam syphon pump and railroad-station pump model.',
        patentIdentityDisclosure:
          'Brown calls this Lansdell’s patent but gives no patent number or claims, and the 1867 catalogue identifies Lansdell as company superintendent rather than expressly as inventor. No patent identifier is inferred.',
        reconstructionDisclosure:
          'All dimensions, SI states, 0.9 m lift, coefficients, branch bores, streamlines, frame colors, and display timing are independently engineered and exposed. Twin suction legs, their Y fork, single discharge, rear-entering central jet, unobstructed annular water route, unbroken upward current, and lack of moving parts are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      paris1867CatalogueUrl:
        'https://upload.wikimedia.org/wikipedia/commons/a/ac/Official_catalogue_of_the_products_of_the_United_States_of_America_exhibited_at_Paris_1867_-_with_statistical_notices_-_catalogue_in_English_%3D_catalogue_fran%C3%A7ais_%3D_deutscher_Catalog_%28IA_gri_33125008624427%29.pdf',
      plate: 'Brown 1868, Movement 476',
    },
    stateAtTime,
    thermodynamics: {
      primaryNozzleChoked: mixingPressureRatio < criticalPressureRatio,
      steamMassFlowEquation:
        'm_s=Cd*A*p0/sqrt(R*T0)*sqrt(gamma)*(2/(gamma+1))^((gamma+1)/(2*(gamma-1)))',
    },
    transmission: {
      equalBranchFlow:
        'm_water_total=2*m_water_branch under equal source level, bore, coefficient, and fork pressure',
      momentumEquation:
        'm_s*v_s+m_water_total*v_B=(m_s+m_water_total)*v_C',
      suctionEquation:
        'v_B=Cd_w*sqrt(2*g*((p_atm-p_fork)/(rho_w*g)-lift))',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.25, -3.15, -1.52),
    new THREE.Vector3(2.52, 4.02, 1.52),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(7.2, 3.8, 9.4);
  root.userData.groundFloorY = -3.15;
  correctEjectorTrapParts(root,476,update);
  sealFork(root);
  markShadows(root);
  basin.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSteamSiphonPumpMovement(movement) {
  if (movement.id !== 476) return null;
  return applyCutawayFor(lansdellSteamSiphonPump(movement), movement.id);
}
