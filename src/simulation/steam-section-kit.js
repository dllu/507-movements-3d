import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { plate } from './finite-plate-geometry.js';
import { cutFaceMaterial } from './cutaway-section.js';
import { curvedPipeWall } from './finite-fluid-passages.js';

// Shared 2D-section toolkit for the sectioned steam engines 421-428 (pass 69).
// Brown draws these engines as one section on the plane facing the reader.
// Every fixed casting is a plate extruded from its back face up to the cut
// plane z = 0, whose front face takes the plain cut-face shade; the working
// spaces are real voids in that plate. Steam is shown as clean translucent
// volumes that fill exactly the part of a working space that is connected to
// the steam supply (live) or to the exhaust, recomputed from the actual part
// positions every frame.

export { polygonClipping };

export const arcPoints = (center, radius, start, end, count = 48) => Array.from(
  { length: count + 1 },
  (_, index) => {
    const angle = start + (end - start) * index / count;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  },
);

export const ringPolygon = (points) => [[[...points, points[0]]]];

export const circlePolygon = (center, radius, count = 96) => ringPolygon(
  arcPoints(center, radius, 0, Math.PI * 2, count).slice(0, count),
);

// Closed path through `vertices` with each corner rounded by its radius
// (0 = sharp). Works for convex and concave corners alike.
export function filletPath(vertices, radii, segments = 10) {
  const out = [];
  const count = vertices.length;
  for (let index = 0; index < count; index += 1) {
    const previous = vertices[(index + count - 1) % count];
    const vertex = vertices[index];
    const next = vertices[(index + 1) % count];
    const radius = Array.isArray(radii) ? radii[index] ?? 0 : radii;
    const toPrevious = [previous[0] - vertex[0], previous[1] - vertex[1]];
    const toNext = [next[0] - vertex[0], next[1] - vertex[1]];
    const lengthPrevious = Math.hypot(...toPrevious);
    const lengthNext = Math.hypot(...toNext);
    const u = [toPrevious[0] / lengthPrevious, toPrevious[1] / lengthPrevious];
    const v = [toNext[0] / lengthNext, toNext[1] / lengthNext];
    const cosine = THREE.MathUtils.clamp(u[0] * v[0] + u[1] * v[1], -1, 1);
    const angle = Math.acos(cosine);
    if (!(radius > 0) || angle < 1e-3 || Math.PI - angle < 1e-3) {
      out.push([...vertex]);
      continue;
    }
    const tangentDistance = Math.min(
      radius / Math.tan(angle / 2),
      lengthPrevious * 0.49,
      lengthNext * 0.49,
    );
    const effectiveRadius = tangentDistance * Math.tan(angle / 2);
    const start = [vertex[0] + u[0] * tangentDistance, vertex[1] + u[1] * tangentDistance];
    const end = [vertex[0] + v[0] * tangentDistance, vertex[1] + v[1] * tangentDistance];
    const bisector = [u[0] + v[0], u[1] + v[1]];
    const bisectorLength = Math.hypot(...bisector);
    const centerDistance = effectiveRadius / Math.sin(angle / 2);
    const center = [
      vertex[0] + bisector[0] / bisectorLength * centerDistance,
      vertex[1] + bisector[1] / bisectorLength * centerDistance,
    ];
    const a0 = Math.atan2(start[1] - center[1], start[0] - center[0]);
    const a1 = Math.atan2(end[1] - center[1], end[0] - center[0]);
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    for (let step = 0; step <= segments; step += 1) {
      const angleStep = a0 + sweep * step / segments;
      out.push([
        center[0] + effectiveRadius * Math.cos(angleStep),
        center[1] + effectiveRadius * Math.sin(angleStep),
      ]);
    }
  }
  return out;
}

// Strip of half-width `halfWidth` about an open centre line (flat ends).
export function bandPolygon(centerLine, halfWidth) {
  const left = [];
  const right = [];
  for (let index = 0; index < centerLine.length; index += 1) {
    const a = centerLine[Math.max(0, index - 1)];
    const b = centerLine[Math.min(centerLine.length - 1, index + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    const normal = [-dy / length, dx / length];
    const p = centerLine[index];
    left.push([p[0] + normal[0] * halfWidth, p[1] + normal[1] * halfWidth]);
    right.push([p[0] - normal[0] * halfWidth, p[1] - normal[1] * halfWidth]);
  }
  return ringPolygon([...left, ...right.reverse()]);
}

export function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point, polygon) {
  return pointInRing(point, polygon[0])
    && !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInMulti(point, multi) {
  return multi.some((polygon) => pointInPolygon(point, polygon));
}

export function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area) / 2;
}

export function multiArea(multi) {
  return multi.reduce((sum, [outer, ...holes]) => sum + ringArea(outer)
    - holes.reduce((holeSum, hole) => holeSum + ringArea(hole), 0), 0);
}

// Pieces of a multipolygon that contain (any of) the given probe points.
export function piecesContaining(multi, probes) {
  return multi.filter((polygon) => probes.some((probe) => pointInPolygon(probe, polygon)));
}

// Extruded section plate: back face at z0, cut face at z1 (the front face
// takes the plain darker cut-face shade, as in cutaway-section.js).
// Drop near-duplicate and near-collinear vertices, so the cap triangulation
// and the side walls use exactly the same contour (no T-junctions).
export function cleanMulti(multi, tolerance = 1e-5) {
  const cleanRing = (ring) => {
    let points = ring.slice(0, ring.length - (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? 1 : 0));
    let changed = true;
    while (changed && points.length > 3) {
      changed = false;
      const kept = [];
      for (let i = 0; i < points.length; i += 1) {
        const a = kept.length ? kept.at(-1) : points.at(-1);
        const b = points[i];
        const c = points[(i + 1) % points.length];
        const dx = c[0] - a[0];
        const dy = c[1] - a[1];
        const length = Math.hypot(dx, dy);
        const offLine = length > 0 ? Math.abs((b[0] - a[0]) * dy - (b[1] - a[1]) * dx) / length : 0;
        const between = length > 0 && ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) > 0
          && ((c[0] - b[0]) * dx + (c[1] - b[1]) * dy) > 0;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < tolerance || (offLine < tolerance && between)) { changed = true; continue; }
        kept.push(b);
      }
      points = kept;
    }
    return [...points, points[0]];
  };
  return multi.map((polygon) => polygon.map(cleanRing).filter((ring) => ring.length >= 4));
}

export function sectionPlate(multi, z0, z1, material, role) {
  const source = plate(cleanMulti(multi), z0, z1);
  const geometry = source.index ? source.toNonIndexed() : source;
  source.userData.plate && (geometry.userData.plate = source.userData.plate);
  const position = geometry.attributes.position;
  const front = [];
  const rest = [];
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    const isFront = [0, 1, 2].every((k) => Math.abs(position.getZ(triangle * 3 + k) - z1) < 1e-6);
    (isFront ? front : rest).push(triangle * 3, triangle * 3 + 1, triangle * 3 + 2);
  }
  geometry.setIndex([...rest, ...front]);
  geometry.clearGroups();
  geometry.addGroup(0, rest.length, 0);
  geometry.addGroup(rest.length, front.length, 1);
  const mesh = new THREE.Mesh(geometry, [material, cutFaceMaterial(material)]);
  mesh.userData.role = role;
  mesh.userData.cutawaySection = true;
  mesh.userData.sectionOutline = multi;
  return mesh;
}

// Plain extruded moving part (whole, not cut).
export function partPlate(multi, z0, z1, material, role) {
  const mesh = new THREE.Mesh(plate(multi, z0, z1), material);
  mesh.userData.role = role;
  mesh.userData.outline = multi;
  return mesh;
}

// Pass 93: live steam is a faint warm tint clearly off the page (luminance
// < 0.85), so it no longer reads as a hole or missing face; exhaust keeps
// its blue-grey.
export const STEAM_COLORS = Object.freeze({ live: 0xdcc9a6, exhaust: 0xc9d4d6 });
export const STEAM_OPACITY = Object.freeze({ live: 0.62, exhaust: 0.2 });

export function steamMaterial(kind = 'live') {
  const material = new THREE.MeshStandardMaterial({
    color: STEAM_COLORS[kind] ?? STEAM_COLORS.live,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: STEAM_OPACITY[kind] ?? STEAM_OPACITY.live,
    depthWrite: false,
    emissive: new THREE.Color(0x3a3834),
  });
  material.userData.steam = kind;
  return material;
}

// A translucent steam volume between z0 and z1 whose outline is set every
// frame from a multipolygon (fixed-capacity buffer, no per-frame allocation
// of GPU buffers). `pressure` in [0, 1] blends exhaust to live appearance.
export function steamVolume(role, z0, z1, { capacity = 24000, sealed = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(capacity * 3);
  const normals = new Float32Array(capacity * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = steamMaterial('live');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = role;
  mesh.userData.steamVolume = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  let count = 0;
  let high = 0; // sealed volumes: vertices written by earlier frames
  const vertex = (x, y, z, nx, ny, nz) => {
    if (count >= capacity) return;
    positions[count * 3] = x; positions[count * 3 + 1] = y; positions[count * 3 + 2] = z;
    normals[count * 3] = nx; normals[count * 3 + 1] = ny; normals[count * 3 + 2] = nz;
    count += 1;
  };
  const live = new THREE.Color(STEAM_COLORS.live);
  const exhaust = new THREE.Color(STEAM_COLORS.exhaust);
  // `shared` (from steamEdgeIndex, see setSteamRegions) drops the stretches
  // of side wall where another steam region abuts this one, so abutting
  // regions draw as one closed volume with no internal sheet.
  const setRegion = (multi, pressure = 1, visibility = 1, { shared = null } = {}) => {
    count = 0;
    let area = 0;
    for (const polygon of multi ?? []) {
      const sources = [];
      const rings = polygon.map((ring) => {
        const points = ring.slice(0, ring.length - (ring.length > 1
          && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? 1 : 0));
        const vectors = points.map(([x, y]) => new THREE.Vector2(x, y));
        vectors.source = ring;
        return vectors;
      }).filter((ring) => ring.length >= 3);
      if (!rings.length) continue;
      const [outer, ...holes] = rings;
      if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
      for (const hole of holes) if (!THREE.ShapeUtils.isClockWise(hole)) hole.reverse();
      area += Math.abs(THREE.ShapeUtils.area(outer))
        - holes.reduce((sum, hole) => sum + Math.abs(THREE.ShapeUtils.area(hole)), 0);
      const all = [outer, ...holes].flat();
      const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
      for (const [a, b, c] of triangles) {
        vertex(all[a].x, all[a].y, z1, 0, 0, 1);
        vertex(all[b].x, all[b].y, z1, 0, 0, 1);
        vertex(all[c].x, all[c].y, z1, 0, 0, 1);
        vertex(all[a].x, all[a].y, z0, 0, 0, -1);
        vertex(all[c].x, all[c].y, z0, 0, 0, -1);
        vertex(all[b].x, all[b].y, z0, 0, 0, -1);
      }
      for (const ring of [outer, ...holes]) {
        for (let i = 0; i < ring.length; i += 1) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy) || 1;
          // Outer ring counter-clockwise, holes clockwise: outward is right.
          const nx = dy / length;
          const ny = -dx / length;
          if (!shared) {
            vertex(a.x, a.y, z0, nx, ny, 0); vertex(b.x, b.y, z0, nx, ny, 0); vertex(b.x, b.y, z1, nx, ny, 0);
            vertex(a.x, a.y, z0, nx, ny, 0); vertex(b.x, b.y, z1, nx, ny, 0); vertex(a.x, a.y, z1, nx, ny, 0);
            continue;
          }
          for (const [t0, t1] of shared.uncovered(a.x, a.y, b.x, b.y, ring.source)) {
            const p = [a.x + dx * t0, a.y + dy * t0];
            const q = [a.x + dx * t1, a.y + dy * t1];
            vertex(p[0], p[1], z0, nx, ny, 0); vertex(q[0], q[1], z0, nx, ny, 0); vertex(q[0], q[1], z1, nx, ny, 0);
            vertex(p[0], p[1], z0, nx, ny, 0); vertex(q[0], q[1], z1, nx, ny, 0); vertex(p[0], p[1], z1, nx, ny, 0);
          }
        }
      }
    }
    const written = count;
    // A space squeezed to nothing (rubber on the bore, a piston at its end)
    // is not drawn.
    if (area < 1e-4 || visibility <= 1e-3) count = 0;
    if (sealed) {
      // Clear what earlier, larger frames left past the draw range, so the
      // buffer holds only the drawn volume.
      const end = Math.max(high, written);
      if (end > count) { positions.fill(0, count * 3, end * 3); normals.fill(0, count * 3, end * 3); }
      high = count;
    }
    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    const p = THREE.MathUtils.clamp(pressure, 0, 1);
    material.color.copy(exhaust).lerp(live, p);
    material.opacity = THREE.MathUtils.lerp(STEAM_OPACITY.exhaust, STEAM_OPACITY.live, p)
      * THREE.MathUtils.clamp(visibility, 0, 1);
    mesh.visible = count > 0;
    mesh.userData.area = area;
    mesh.userData.pressure = p;
    mesh.userData.overflow = count >= capacity;
  };
  mesh.userData.setRegion = setRegion;
  return mesh;
}

// Index of the boundary edges of several steam regions (multipolygons in
// the section plane, all extruded over the same z range), each ring oriented
// with its region on the left. `uncovered(ax, ay, bx, by, ring)` returns the
// parameter spans of edge a-b that no edge of another ring runs back along
// (within `tolerance`): the stretches of wall that bound steam, rather than
// separate two abutting steam regions.
export function steamEdgeIndex(regions, { tolerance = 1e-5, cells = 96 } = {}) {
  const segments = [];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const multi of regions) {
    for (const polygon of multi ?? []) {
      polygon.forEach((ring, index) => {
        const closed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
        let points = ring.slice(0, ring.length - (closed ? 1 : 0));
        if (points.length < 3) return;
        let signed = 0;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          signed += (points[j][0] - points[i][0]) * (points[j][1] + points[i][1]);
        }
        // signed > 0: counter-clockwise. Outer rings CCW, holes CW.
        if ((signed > 0) !== (index === 0)) points = points.slice().reverse();
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          segments.push({ ring, ax: a[0], ay: a[1], bx: b[0], by: b[1] });
          minX = Math.min(minX, a[0]); maxX = Math.max(maxX, a[0]);
          minY = Math.min(minY, a[1]); maxY = Math.max(maxY, a[1]);
        }
      });
    }
  }
  const size = Math.max(maxX - minX, maxY - minY, 1e-9) / cells;
  const grid = new Map();
  const cellRange = (x0, y0, x1, y1) => [
    Math.floor((Math.min(x0, x1) - tolerance - minX) / size), Math.floor((Math.min(y0, y1) - tolerance - minY) / size),
    Math.floor((Math.max(x0, x1) + tolerance - minX) / size), Math.floor((Math.max(y0, y1) + tolerance - minY) / size),
  ];
  segments.forEach((segment, index) => {
    const [i0, j0, i1, j1] = cellRange(segment.ax, segment.ay, segment.bx, segment.by);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const key = i * 65536 + j;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    }
  });
  const seen = new Set();
  const uncovered = (ax, ay, bx, by, ring) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    if (!(lengthSquared > 0) || !segments.length) return [[0, 1]];
    const length = Math.sqrt(lengthSquared);
    const spans = [];
    seen.clear();
    const [i0, j0, i1, j1] = cellRange(ax, ay, bx, by);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        for (const index of grid.get(i * 65536 + j) ?? []) {
          if (seen.has(index)) continue;
          seen.add(index);
          const s = segments[index];
          if (s.ring === ring) continue;
          const sx = s.bx - s.ax;
          const sy = s.by - s.ay;
          if (sx * dx + sy * dy >= 0) continue; // must run back along a-b
          const offA = Math.abs((s.ax - ax) * dy - (s.ay - ay) * dx) / length;
          const offB = Math.abs((s.bx - ax) * dy - (s.by - ay) * dx) / length;
          if (offA > tolerance || offB > tolerance) continue;
          const tA = ((s.ax - ax) * dx + (s.ay - ay) * dy) / lengthSquared;
          const tB = ((s.bx - ax) * dx + (s.by - ay) * dy) / lengthSquared;
          const lo = Math.max(0, Math.min(tA, tB));
          const hi = Math.min(1, Math.max(tA, tB));
          if (hi - lo > 1e-9) spans.push([lo, hi]);
        }
      }
    }
    if (!spans.length) return [[0, 1]];
    spans.sort((p, q) => p[0] - q[0]);
    const open = [];
    let at = 0;
    const gap = tolerance / length;
    for (const [lo, hi] of spans) {
      if (lo - at > gap) open.push([at, lo]);
      at = Math.max(at, hi);
    }
    if (1 - at > gap) open.push([at, 1]);
    return open;
  };
  return { uncovered, segments: segments.length };
}

// Sets several steam volumes at once (entries { mesh, region, pressure,
// visibility }), dropping the walls between abutting regions: each connected
// body of steam is then bounded by one closed surface, with its pieces'
// shades meeting edge to edge on the front and back faces. Regions too small
// to be drawn do not open their neighbours' walls.
export function setSteamRegions(entries, options) {
  const drawn = entries.filter(({ region, visibility = 1 }) => visibility > 1e-3 && multiArea(region ?? []) >= 1e-4);
  const shared = steamEdgeIndex(drawn.map(({ region }) => region), options);
  for (const { mesh, region, pressure = 1, visibility = 1 } of entries) {
    mesh.userData.setRegion(region, pressure, visibility, { shared });
  }
  return shared;
}

// Robust difference/intersection wrappers: polygon-clipping can throw on
// degenerate touching input; a tiny rotation-free jitter retry keeps frames
// alive and the result stays within 1e-7 of exact.
export function safeClip(operation, subject, ...clips) {
  try {
    return polygonClipping[operation](subject, ...clips);
  } catch {
    const jitter = (multi) => multi.map((polygon) => polygon.map((ring) => ring.map(
      ([x, y], index) => [x + ((index * 7919) % 13 - 6) * 1e-8, y + ((index * 104729) % 11 - 5) * 1e-8],
    )));
    try {
      return polygonClipping[operation](jitter(subject), ...clips.map(jitter));
    } catch {
      return [];
    }
  }
}

// Fillet of radius rho tangent to a straight line (through `point` along
// `direction`, fillet centre on the `side` = +1 left / -1 right of it) and to
// a circle (centre, radius), lying outside the circle (`outside` true, a
// concave corner of the material inside the circle) or inside it. `hint`
// picks between the two solutions. Returns the arc from the line tangent
// point to the circle tangent point.
export function lineCircleFillet({ point, direction, side = 1 }, { center = [0, 0], radius }, rho, {
  outside = true,
  hint = point,
  count = 16,
} = {}) {
  const length = Math.hypot(...direction);
  const d = [direction[0] / length, direction[1] / length];
  const n = [-d[1] * side, d[0] * side];
  const base = [point[0] + n[0] * rho - center[0], point[1] + n[1] * rho - center[1]];
  const reach = outside ? radius + rho : radius - rho;
  // |base + d s| = reach
  const b = base[0] * d[0] + base[1] * d[1];
  const c = base[0] ** 2 + base[1] ** 2 - reach ** 2;
  const discriminant = Math.max(0, b * b - c);
  const roots = [-b - Math.sqrt(discriminant), -b + Math.sqrt(discriminant)];
  const candidates = roots.map((s) => [center[0] + base[0] + d[0] * s, center[1] + base[1] + d[1] * s]);
  const filletCenter = candidates.sort((p, q) => Math.hypot(p[0] - hint[0], p[1] - hint[1])
    - Math.hypot(q[0] - hint[0], q[1] - hint[1]))[0];
  const onLine = [filletCenter[0] - n[0] * rho, filletCenter[1] - n[1] * rho];
  const scale = radius / reach;
  const onCircle = [center[0] + (filletCenter[0] - center[0]) * scale, center[1] + (filletCenter[1] - center[1]) * scale];
  const a0 = Math.atan2(onLine[1] - filletCenter[1], onLine[0] - filletCenter[0]);
  let sweep = Math.atan2(onCircle[1] - filletCenter[1], onCircle[0] - filletCenter[0]) - a0;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;
  return {
    points: arcPoints(filletCenter, rho, a0, a0 + sweep, count),
    onLine,
    onCircle,
    center: filletCenter,
  };
}

export const angleOf = ([x, y], center = [0, 0]) => Math.atan2(y - center[1], x - center[0]);

// Arc about `center` from angle a0 to a1 going the short or given way.
export function arcBetween(center, radius, a0, a1, { ccw = true, step = Math.PI / 90 } = {}) {
  let sweep = a1 - a0;
  if (ccw) while (sweep < 0) sweep += Math.PI * 2;
  else while (sweep > 0) sweep -= Math.PI * 2;
  return arcPoints(center, radius, a0, a0 + sweep, Math.max(2, Math.ceil(Math.abs(sweep) / step)));
}

// Convex hull (counter-clockwise) of 2D points.
export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Farthest distance from the origin along the ray at `angle` inside a convex
// polygon (NaN when the ray misses it).
export function farRadiusAlongRay(hull, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = Number.NaN;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const t = (a[0] * ey - a[1] * ex) / denominator;
    const u = (a[0] * dy - a[1] * dx) / denominator;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && !(t <= best)) best = t;
  }
  return best;
}

// Exhaust pipe leaving the back of a casting: straight back from an outlet
// hole, then turned down, ending cleanly (so the open outlet reads as a dark
// bore from the front rather than as a window).
export function exhaustElbowGeometry([x, y], zStart, radius, wall = 0.05, { back = 0.35, drop = 0.9 } = {}) {
  const curve = new THREE.CurvePath();
  const bend = radius * 1.6;
  curve.add(new THREE.LineCurve3(new THREE.Vector3(x, y, zStart), new THREE.Vector3(x, y, zStart - back)));
  curve.add(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(x, y, zStart - back),
    new THREE.Vector3(x, y, zStart - back - bend),
    new THREE.Vector3(x, y - bend, zStart - back - bend),
  ));
  curve.add(new THREE.LineCurve3(
    new THREE.Vector3(x, y - bend, zStart - back - bend),
    new THREE.Vector3(x, y - bend - drop, zStart - back - bend),
  ));
  return curvedPipeWall(curve, radius, radius + wall, 64, 28);
}
