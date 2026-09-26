import * as THREE from 'three';
import { disk, polygonClipping } from './finite-plate-geometry.js';

// Shared kit for escapements rebuilt as flat extruded parts traced from
// Brown's plates (288-296). Every working part is one extrusion of its drawn
// 2D outline; the escape wheel's motion is solved from contact with those
// same outlines, so what engages on screen is what drives the motion.

export const TAU = Math.PI * 2;

// Plate pixel -> model coordinates (y up).
export function plateMapper([ox, oy], scale) {
  const map = ([px, py]) => [(px - ox) * scale, (oy - py) * scale];
  map.scale = scale;
  map.px = (pixels) => pixels * scale;
  return map;
}

export function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

export function orient(points, ccw = true) {
  const copy = points.map((p) => [p[0], p[1]]);
  return (signedArea(copy) > 0) === ccw ? copy : copy.reverse();
}

// Drop consecutive duplicates and collinear points.
export function cleanRing(points, epsilon = 1e-9) {
  const out = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > epsilon) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) <= epsilon) out.pop();
  return out;
}

export function arcPoints([cx, cy], radius, start, end, count) {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const angle = start + (end - start) * i / count;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

export function circlePoints(center, radius, count = 96) {
  return arcPoints(center, radius, 0, TAU, count).slice(0, count);
}

export function polar(center, radius, angle) {
  return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
}

// Smooth closed curve through control points (centripetal Catmull-Rom).
export function smoothClosed(points, perSegment = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return curve.getPoints(points.length * perSegment).slice(0, -1).map((p) => [p.x, p.y]);
}

// Smooth open curve through control points, endpoints included.
export function smoothOpen(points, perSegment = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  return curve.getPoints((points.length - 1) * perSegment).map((p) => [p.x, p.y]);
}

// Extrude a flat outline (outer ring plus holes) between z0 and z1. Side
// walls are shaded smoothly along curves and split at sharp corners, so round
// rims read round and drawn corners stay crisp.
export function extrudeOutline(outerInput, holesInput = [], z0 = -0.05, z1 = 0.05, creaseAngle = 0.5) {
  const outer = orient(cleanRing(outerInput), true);
  const holes = holesInput.map((hole) => orient(cleanRing(hole), false));
  const positions = [];
  const normals = [];
  const pushVertex = (x, y, z, nx, ny, nz) => { positions.push(x, y, z); normals.push(nx, ny, nz); };
  // Caps. Earcut can mis-bridge holes with sharp, nearly touching tips
  // (lens windows); when its area is wrong, triangulate the region cut into
  // angular sectors instead, which leaves only hole-free pieces.
  const expectedArea = signedArea(outer) - holes.reduce((sum, hole) => sum - signedArea(hole), 0);
  const triangulate = (ring, rings) => {
    const faces = THREE.ShapeUtils.triangulateShape(
      ring.map(([x, y]) => new THREE.Vector2(x, y)),
      rings.map((hole) => hole.map(([x, y]) => new THREE.Vector2(x, y))),
    );
    const all = [...ring, ...rings.flat()];
    return faces.map((face) => face.map((index) => all[index]));
  };
  const triangleArea = (t) => ((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2;
  let triangles = triangulate(outer, holes);
  let sectorCaps = false;
  const capArea = triangles.reduce((sum, t) => sum + Math.abs(triangleArea(t)), 0);
  if (Math.abs(capArea - expectedArea) > 1e-7 * Math.max(1, expectedArea) && holes.length) {
    let cx = 0; let cy = 0;
    for (const [x, y] of outer) { cx += x; cy += y; }
    cx /= outer.length; cy /= outer.length;
    const far = 4 * Math.max(...outer.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const close = (ring) => [...ring, ring[0]];
    const region = [close(outer), ...holes.map(close)];
    triangles = [];
    sectorCaps = true;
    const sectors = 24;
    for (let k = 0; k < sectors; k += 1) {
      const a0 = TAU * k / sectors; const a1 = TAU * (k + 1) / sectors;
      const wedge = [[cx, cy], [cx + far * Math.cos(a0), cy + far * Math.sin(a0)], [cx + far * Math.cos((a0 + a1) / 2), cy + far * Math.sin((a0 + a1) / 2)], [cx + far * Math.cos(a1), cy + far * Math.sin(a1)]];
      for (const polygon of polygonClipping.intersection(region, [close(wedge)])) {
        const [ring, ...inner] = polygon.map((r) => r.slice(0, -1));
        triangles.push(...triangulate(orient(ring, true), inner.map((h) => orient(h, false))));
      }
    }
  }
  for (const t of triangles) {
    const ccw = triangleArea(t) > 0;
    const up = ccw ? t : [t[0], t[2], t[1]];
    for (const [x, y] of up) pushVertex(x, y, z1, 0, 0, 1);
    for (const [x, y] of [up[0], up[2], up[1]]) pushVertex(x, y, z0, 0, 0, -1);
  }
  // Walls.
  const wall = (ring) => {
    const n = ring.length;
    const edgeNormal = [];
    for (let i = 0; i < n; i += 1) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % n];
      const length = Math.hypot(x1 - x0, y1 - y0) || 1;
      edgeNormal.push([(y1 - y0) / length, -(x1 - x0) / length]);
    }
    // Vertex normal at the start (s) and end (e) of each edge.
    const vertexNormal = (i, edge) => {
      const previous = edgeNormal[(i - 1 + n) % n];
      const next = edgeNormal[i % n];
      const dot = previous[0] * next[0] + previous[1] * next[1];
      if (dot < Math.cos(creaseAngle)) return edgeNormal[edge];
      const x = previous[0] + next[0];
      const y = previous[1] + next[1];
      const length = Math.hypot(x, y) || 1;
      return [x / length, y / length];
    };
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      const na = vertexNormal(i, i);
      const nb = vertexNormal(j, i);
      pushVertex(ax, ay, z0, na[0], na[1], 0);
      pushVertex(bx, by, z0, nb[0], nb[1], 0);
      pushVertex(bx, by, z1, nb[0], nb[1], 0);
      pushVertex(ax, ay, z0, na[0], na[1], 0);
      pushVertex(bx, by, z1, nb[0], nb[1], 0);
      pushVertex(ax, ay, z1, na[0], na[1], 0);
    }
  };
  wall(outer);
  holes.forEach(wall);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.outline = { outer, holes, z0, z1 };
  geometry.userData.sectorCaps = sectorCaps;
  return geometry;
}

export function tagged(mesh, role) {
  mesh.name = role;
  mesh.userData.role = role;
  return mesh;
}

export function plateMesh(outer, holes, z0, z1, material, role) {
  return tagged(new THREE.Mesh(extrudeOutline(outer, holes, z0, z1), material), role);
}

// A turned arbor (closed, smoothly shaded) along z. It runs in bores of the
// nominal radius with a small running clearance.
export function arborMesh([x, y], radius, z0, z1, material, role, clearance = 0.006) {
  const mesh = tagged(new THREE.Mesh(disk(radius - clearance, z0, z1, 64), material), role);
  mesh.position.set(x, y, 0);
  return mesh;
}

// Escape-wheel outline from a per-tooth polar profile. `tooth` lists
// [angleOffset, radius] pairs (radians, counterclockwise positive) for one
// pitch in clockwise order, from offset 0 down to (but excluding) -pitch.
// The profile repeats `count` times clockwise from `phase`.
export function toothedOutline(center, count, phase, tooth) {
  const pitch = TAU / count;
  const points = [];
  for (let k = 0; k < count; k += 1) {
    const base = phase - k * pitch;
    for (const [offset, radius] of tooth) points.push(polar(center, radius, base + offset));
  }
  return points;
}

// ---------------------------------------------------------------------------
// Contact-driven wheel solver.
//
// Every other part moves by a prescribed law; the escape wheel is driven
// forward by a constant train torque and can never overlap the obstacles.
// Free: it accelerates at `dropAcceleration` (a drop). Touching a receding
// face: it follows it (impulse). Pushed back by a face: it recoils. Locked:
// it rests. Collision uses the exact extruded outlines (2D, one per layer).

function polygonBounds(flat) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    const x = flat[i]; const y = flat[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) return false;
  return !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}

function pointInFlat(x, y, flat) {
  let inside = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i]; const yi = flat[i + 1]; const xj = flat[j]; const yj = flat[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const nearEdges = [];
export function flatPolygonsOverlap(a, boundsA, b, boundsB) {
  if (boundsA[2] < boundsB[0] || boundsB[2] < boundsA[0] || boundsA[3] < boundsB[1] || boundsB[3] < boundsA[1]) return false;
  // Only edges of b that reach a's bounding box can cross a's edges.
  nearEdges.length = 0;
  for (let k = 0, l = b.length - 2; k < b.length; l = k, k += 2) {
    const cx = b[l]; const cy = b[l + 1]; const dx = b[k]; const dy = b[k + 1];
    if (Math.max(cx, dx) < boundsA[0] || Math.min(cx, dx) > boundsA[2]
      || Math.max(cy, dy) < boundsA[1] || Math.min(cy, dy) > boundsA[3]) continue;
    nearEdges.push(l, k);
  }
  for (let i = 0, j = a.length - 2; i < a.length && nearEdges.length; j = i, i += 2) {
    const ax = a[j]; const ay = a[j + 1]; const bx = a[i]; const by = a[i + 1];
    for (let e = 0; e < nearEdges.length; e += 2) {
      const l = nearEdges[e]; const k = nearEdges[e + 1];
      if (segmentsCross(ax, ay, bx, by, b[l], b[l + 1], b[k], b[k + 1])) return true;
    }
  }
  return pointInFlat(a[0], a[1], b) || pointInFlat(b[0], b[1], a);
}

export function toFlat(points) {
  const flat = new Float64Array(points.length * 2);
  points.forEach(([x, y], i) => { flat[2 * i] = x; flat[2 * i + 1] = y; });
  return flat;
}

// Place a local polygon (flat) at pose {x, y, angle}.
export function placeFlat(local, pose, out = new Float64Array(local.length)) {
  const c = Math.cos(pose.angle); const s = Math.sin(pose.angle);
  for (let i = 0; i < local.length; i += 2) {
    const x = local[i]; const y = local[i + 1];
    out[i] = pose.x + c * x - s * y;
    out[i + 1] = pose.y + s * x + c * y;
  }
  return out;
}

// wheel: { center:[x,y], count, parts:[{ layer, points:[[x,y]] (wheel frame at
//   angle 0, relative to center), angle (polar angle of the part), radius }] }
// obstacles(t): [{ layer, points: Float64Array world flat }]
export function solveDrivenWheel({
  wheel,
  obstacles,
  period,
  stepsPerPeriod = 1600,
  warmupPeriods = 2,
  direction = 1,
  dropAcceleration,
  advancePerPeriod,
  initialAngle = 0,
  maxBackSearch,
  maxUnresolved = 20,
  startTime = 0,
}) {
  const pitch = TAU / wheel.count;
  const parts = wheel.parts.map((part) => {
    const flat = toFlat(part.points);
    let radius = 0;
    let angle = part.angle;
    if (angle === undefined) {
      let sx = 0; let sy = 0;
      for (const [x, y] of part.points) { sx += x; sy += y; }
      angle = Math.atan2(sy, sx);
    }
    for (const [x, y] of part.points) radius = Math.max(radius, Math.hypot(x, y));
    let spread = 0;
    for (const [x, y] of part.points) {
      const r = Math.hypot(x, y);
      if (r < 1e-9) { spread = Math.PI; break; }
      let delta = Math.atan2(y, x) - angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      spread = Math.max(spread, Math.abs(delta));
    }
    return { layer: part.layer ?? 0, local: flat, angle, radius, spread, placed: new Float64Array(flat.length) };
  });
  const [cx, cy] = wheel.center;
  let current = [];
  const setObstacles = (t) => {
    current = obstacles(t).map((obstacle) => {
      const flat = obstacle.points;
      const bounds = polygonBounds(flat);
      // Angular window about the wheel centre, and radial reach.
      let minR = Infinity; let maxR = 0;
      let refAngle = null; let lo = 0; let hi = 0;
      for (let i = 0; i < flat.length; i += 2) {
        const dx = flat[i] - cx; const dy = flat[i + 1] - cy;
        const r = Math.hypot(dx, dy);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        const a = Math.atan2(dy, dx);
        if (refAngle === null) refAngle = a;
        const d = Math.atan2(Math.sin(a - refAngle), Math.cos(a - refAngle));
        lo = Math.min(lo, d); hi = Math.max(hi, d);
      }
      const containsCenter = pointInFlat(cx, cy, flat);
      return { layer: obstacle.layer ?? 0, flat, bounds, minR, maxR, refAngle, lo, hi, all: containsCenter || hi - lo > Math.PI };
    });
  };
  const partBounds = new Float64Array(4);
  let checks = 0;
  let polygonTests = 0;
  const collides = (angle) => {
    checks += 1;
    for (const obstacle of current) {
      for (const part of parts) {
        if (part.layer !== obstacle.layer) continue;
        if (part.radius < obstacle.minR) continue;
        if (!obstacle.all) {
          const a = part.angle + angle;
          const d = Math.atan2(Math.sin(a - obstacle.refAngle), Math.cos(a - obstacle.refAngle));
          if (d + part.spread < obstacle.lo - 1e-3 || d - part.spread > obstacle.hi + 1e-3) continue;
        }
        placeFlat(part.local, { x: cx, y: cy, angle }, part.placed);
        const b = polygonBounds(part.placed);
        partBounds[0] = b[0]; partBounds[1] = b[1]; partBounds[2] = b[2]; partBounds[3] = b[3];
        polygonTests += 1;
        if (flatPolygonsOverlap(part.placed, partBounds, obstacle.flat, obstacle.bounds)) return true;
      }
    }
    return false;
  };
  const dt = period / stepsPerPeriod;
  const maxStep = pitch / 40;
  const searchLimit = maxBackSearch ?? pitch * 0.03;
  const totalSteps = stepsPerPeriod * (warmupPeriods + 1);
  const recordStart = stepsPerPeriod * warmupPeriods;
  const angles = new Float64Array(stepsPerPeriod + 1);
  const states = new Uint8Array(stepsPerPeriod + 1);
  let u = initialAngle;
  let omega = 0;
  let unresolved = 0;
  const unresolvedTimes = [];
  let maxPush = 0;
  setObstacles(startTime);
  for (let k = 0; collides(direction * u); k += 1) {
    if (k > 4000) throw new Error('Escape wheel starts inside a pallet');
    u -= pitch / 1000;
  }
  const bisect = (free, blocked) => {
    for (let i = 0; i < 40; i += 1) {
      const mid = (free + blocked) / 2;
      if (collides(direction * mid)) blocked = mid; else free = mid;
      if (Math.abs(blocked - free) < 1e-9) break;
    }
    return free;
  };
  for (let step = 1; step <= totalSteps; step += 1) {
    const t = startTime + step * dt;
    setObstacles(t);
    let state = 0;
    if (collides(direction * u)) {
      // Pushed by a moving face: find the nearest free angle.
      const increment = pitch / 1500;
      let found = null;
      for (let k = 1; k * increment <= searchLimit; k += 1) {
        if (!collides(direction * (u - k * increment))) { found = bisect(u - k * increment, u - (k - 1) * increment); break; }
        if (!collides(direction * (u + k * increment))) { found = bisect(u + k * increment, u + (k - 1) * increment); break; }
      }
      if (found === null) { unresolved += 1; if (unresolvedTimes.length < 50) unresolvedTimes.push(t); found = u; if (unresolved > maxUnresolved) throw new Error('Escapement jams: a pallet is driven into the wheel'); }
      maxPush = Math.max(maxPush, Math.abs(found - u));
      omega = Math.max(0, (found - u) / dt);
      state = found < u ? 2 : 1;
      u = found;
    } else {
      let target = Math.max(0, omega) + dropAcceleration * dt;
      let remaining = target * dt;
      let moved = 0;
      let blocked = false;
      while (remaining > 1e-15) {
        const delta = Math.min(maxStep, remaining);
        if (collides(direction * (u + moved + delta))) {
          moved = bisect(u + moved, u + moved + delta) - u;
          blocked = true;
          break;
        }
        moved += delta;
        remaining -= delta;
      }
      if (blocked) {
        omega = moved / dt;
        state = moved > pitch * 1e-6 ? 1 : 3;
      } else {
        omega = target;
        state = 0;
      }
      u += moved;
    }
    if (step >= recordStart) {
      angles[step - recordStart] = u;
      states[step - recordStart] = state;
    }
  }
  const advance = angles[stepsPerPeriod] - angles[0];
  const expected = advancePerPeriod ?? pitch;
  // A failed escapement (jam or run-through) keeps its raw motion so that it
  // is visible and testable; only a small residual is redistributed.
  const closure = Math.abs(advance - expected) < pitch * 0.02 ? advance - expected : 0;
  const failed = Math.abs(advance - expected) >= pitch * 0.02;
  // Remove the (tiny) closure residual so the loop repeats exactly.
  const base = angles[0];
  for (let i = 0; i <= stepsPerPeriod; i += 1) {
    angles[i] = angles[i] - base - closure * i / stepsPerPeriod;
  }
  // Steady-state wheel angle at phase 0, reduced to within half a pitch of
  // the drawn (plate) pose.
  const phaseOffset = base - Math.round(base / pitch) * pitch;
  return { checks, polygonTests, unresolvedTimes, startTime, angles, states, advance, expected, closure, failed, unresolved, maxPush, dt, pitch, stepsPerPeriod, base, phaseOffset };
}

// Periodic lookup into a solved table: continuous angle for any time.
export function wheelAngleAt(solution, period, rawTime, offset = solution.phaseOffset) {
  const time = rawTime - (solution.startTime ?? 0);
  const cycles = Math.floor(time / period);
  const phase = (time - cycles * period) / period * solution.stepsPerPeriod;
  const index = Math.min(solution.stepsPerPeriod - 1, Math.floor(phase));
  const fraction = phase - index;
  const a = solution.angles[index];
  const b = solution.angles[index + 1];
  return offset + cycles * solution.expected + a + (b - a) * fraction;
}

// Circle through three points.
export function circleThrough(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const a2 = a[0] ** 2 + a[1] ** 2; const b2 = b[0] ** 2 + b[1] ** 2; const c2 = c[0] ** 2 + c[1] ** 2;
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { center: [x, y], radius: Math.hypot(a[0] - x, a[1] - y) };
}

// Circular arc from a to c passing through b (endpoints included).
export function arcThrough(a, b, c, count = 24) {
  const { center, radius } = circleThrough(a, b, c);
  const angleOf = (p) => Math.atan2(p[1] - center[1], p[0] - center[0]);
  const start = angleOf(a);
  let sweep = angleOf(c) - start;
  let mid = angleOf(b) - start;
  const wrap = (v) => ((v % TAU) + TAU) % TAU;
  sweep = wrap(sweep); mid = wrap(mid);
  if (mid > sweep) sweep -= TAU;
  return arcPoints(center, radius, start, start + sweep, count);
}

// Straight segment points from a to b (endpoints included).
export function linePoints(a, b, count = 1) {
  const points = [];
  for (let i = 0; i <= count; i += 1) points.push([a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count]);
  return points;
}

// Concatenate path pieces, dropping each piece's duplicated first point.
export function joinPath(...pieces) {
  const out = [];
  for (const piece of pieces) {
    for (const p of piece) {
      const last = out.at(-1);
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) out.push(p);
    }
  }
  return out;
}

// Plain straight-spoke windows for a wheel: each window is bounded by two
// spoke edges, the rim's inner circle and the hub circle. `spokes` are axis
// angles; width is the spoke width.
export function spokeWindows(center, rimInner, hubRadius, spokeAngles, width, arcCount = 48) {
  const sorted = [...spokeAngles].sort((a, b) => a - b);
  const half = width / 2;
  const edgeAngle = (radius, side) => Math.asin(Math.min(1, half / radius)) * side;
  const windows = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const a0 = sorted[i];
    let a1 = sorted[(i + 1) % sorted.length];
    if (a1 <= a0) a1 += TAU;
    const rimStart = a0 + edgeAngle(rimInner, 1);
    const rimEnd = a1 - edgeAngle(rimInner, 1);
    const hubStart = a0 + edgeAngle(hubRadius, 1);
    const hubEnd = a1 - edgeAngle(hubRadius, 1);
    windows.push(joinPath(
      arcPoints(center, rimInner, rimStart, rimEnd, arcCount),
      arcPoints(center, hubRadius, hubEnd, hubStart, Math.max(6, Math.round(arcCount / 4))),
    ));
  }
  return windows;
}

// The parts of a (local-frame) outline that can ever reach the wheel: the
// outline clipped to a disc about the wheel centre (given in the same local
// frame). Collision against these pieces equals collision against the whole
// outline wherever the wheel can be.
export function clipToDisc(points, center, radius, holes = []) {
  const circle = circlePoints(center, radius, 180);
  const close = (ring) => [...ring, ring[0]];
  const result = polygonClipping.intersection([close(points), ...holes.map(close)], [close(circle)]);
  if (result.some((polygon) => polygon.length > 1)) throw new Error('Clipped contact piece still has a hole; split it');
  return result.map((polygon) => polygon[0].slice(0, -1));
}

// Choose the time origin so that t = 0 shows the plate: among candidate
// times (where the oscillator is at its drawn angle) take the one whose
// solved wheel angle is nearest the drawn tooth phase.
export function platePhaseTime(solution, period, candidates) {
  let best = candidates[0];
  let bestError = Infinity;
  for (const time of candidates) {
    const angle = wheelAngleAt(solution, period, time);
    const error = Math.abs(angle - Math.round(angle / solution.pitch) * solution.pitch);
    if (error < bestError) { bestError = error; best = time; }
  }
  return { time: best, error: bestError };
}

// Arc about `center` from point `from` to point `to`, turning counterclockwise
// (ccw = true) or clockwise; the radius is |from - center|.
export function arcFromTo(center, from, to, ccw, count = 32) {
  const radius = Math.hypot(from[0] - center[0], from[1] - center[1]);
  const start = Math.atan2(from[1] - center[1], from[0] - center[0]);
  let end = Math.atan2(to[1] - center[1], to[0] - center[0]);
  if (ccw) { while (end <= start) end += TAU; } else { while (end >= start) end -= TAU; }
  return arcPoints(center, radius, start, end, count);
}

// Point on the circle about `center` of radius `radius` with the given x
// (the solution with larger or smaller y as `upper` says).
export function circleAtX(center, radius, x, upper) {
  const dy = Math.sqrt(Math.max(0, radius * radius - (x - center[0]) ** 2));
  return [x, center[1] + (upper ? dy : -dy)];
}

// A closed solid of revolution about z from a profile of [z, r] points
// (listed around the section, e.g. down the axis side then out along the
// surface). Normals are smooth along the profile except at corners sharper
// than `creaseAngle`, and smooth round the axis.
export function turnedSmooth(profile, { segments = 96, creaseAngle = 0.5 } = {}) {
  const n = profile.length;
  const edges = [];
  for (let i = 0; i < n; i += 1) {
    const [z0, r0] = profile[i];
    const [z1, r1] = profile[(i + 1) % n];
    const dz = z1 - z0; const dr = r1 - r0; const length = Math.hypot(dz, dr) || 1;
    // Outward normal in the (z, r) half plane for a counterclockwise profile.
    edges.push([dr / length, -dz / length]);
  }
  // Orient so normals point away from the section's interior.
  let area = 0;
  for (let i = 0; i < n; i += 1) { const [a, b] = profile[i]; const [c, d] = profile[(i + 1) % n]; area += a * d - c * b; }
  const sign = area > 0 ? 1 : -1;
  const vertexNormal = (i, edge) => {
    const previous = edges[(i - 1 + n) % n];
    const next = edges[i];
    if (previous[0] * next[0] + previous[1] * next[1] < Math.cos(creaseAngle)) return edges[edge];
    const x = previous[0] + next[0]; const y = previous[1] + next[1]; const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const positions = [];
  const normals = [];
  const put = (z, r, angle, nz, nr) => {
    const c = Math.cos(angle); const s = Math.sin(angle);
    positions.push(r * c, r * s, z);
    normals.push(sign * nr * c, sign * nr * s, sign * nz);
  };
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const [za, ra] = profile[i];
    const [zb, rb] = profile[j];
    if (ra < 1e-9 && rb < 1e-9) continue;
    const na = vertexNormal(i, i);
    const nb = vertexNormal(j, i);
    for (let k = 0; k < segments; k += 1) {
      const a0 = TAU * k / segments; const a1 = TAU * (k + 1) / segments;
      const quad = [[za, ra, a0, na], [zb, rb, a0, nb], [zb, rb, a1, nb], [za, ra, a1, na]];
      const tri = (p, q, r) => {
        const pts = [p, q, r].map(([z, rr, ang]) => new THREE.Vector3(rr * Math.cos(ang), rr * Math.sin(ang), z));
        const cross = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));
        if (cross.lengthSq() < 1e-20) return;
        const mid = [p, q, r].reduce((acc, [, , ang, nn]) => acc.add(new THREE.Vector3(nn[1] * Math.cos(ang), nn[1] * Math.sin(ang), nn[0]).multiplyScalar(sign)), new THREE.Vector3());
        const order = cross.dot(mid) < 0 ? [p, r, q] : [p, q, r];
        for (const [z, rr, ang, nn] of order) put(z, rr, ang, nn[0], nn[1]);
      };
      tri(quad[0], quad[1], quad[2]);
      tri(quad[0], quad[2], quad[3]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
