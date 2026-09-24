import * as THREE from 'three';
import { keyedBoreRadius } from './clutch-section-geometry.js';

// Circular rack generation includes the root transition below the base
// circle. Only one tooth needs cutting; the result repeats exactly.
const spurCache = new Map();
export function boredSpurGeometry({ teeth, module, depth, boreRadius,
  pressureAngle = Math.PI / 9, profileShift = 0, addendumCoefficient = 1 + profileShift }) {
  const key = `${teeth},${module},${pressureAngle},${profileShift},${addendumCoefficient}`;
  let outline = spurCache.get(key);
  const radius = teeth * module / 2, pitch = Math.PI * module;
  if (!outline) {
    const tooth = [], count = 256, cutterSteps = 4096;
    const pressureTangent = Math.tan(pressureAngle), backlash = module * 0.008, clearance = module * 0.001;
    for (let sample = 0; sample < count; sample += 1) {
      const angle = (sample / count - 0.5) * 2 * Math.PI / teeth;
      let limit = radius + module * addendumCoefficient;
      for (let step = 0; step <= cutterSteps; step += 1) {
        const cutterAngle = angle - 0.8 + 1.6 * step / cutterSteps;
        const un = Math.cos(angle - cutterAngle), ut = Math.sin(angle - cutterAngle);
        const root = (radius - (1.25 - profileShift) * module) / un;
        if (root >= limit) continue;
        const s = radius * cutterAngle;
        const first = Math.floor((Math.min(root * ut, limit * ut) + s) / pitch - 0.5) - 1;
        const last = Math.ceil((Math.max(root * ut, limit * ut) + s) / pitch - 0.5) + 1;
        for (let toothIndex = first; toothIndex <= last; toothIndex += 1) {
          const center = (toothIndex + 0.5) * pitch - s;
          let entry = root, exit = limit;
          for (const side of [-1, 1]) {
            const slope = side * ut - pressureTangent * un;
            // Shift the rack normally, keeping its rolling travel on the
            // reference circle. An explicit addendum can trim pointed tips.
            const bound = side * center + pitch / 4 + backlash / 2 - pressureTangent * (radius + profileShift * module);
            if (slope > 1e-12) exit = Math.min(exit, bound / slope);
            else if (slope < -1e-12) entry = Math.max(entry, bound / slope);
            else if (bound < 0) exit = -Infinity;
          }
          if (entry < exit && entry > 0) limit = entry - clearance;
        }
      }
      tooth.push({ angle, radius: limit });
    }
    outline = Array.from({ length: teeth }, (_, i) => tooth.map((p) => new THREE.Vector2(
      p.radius * Math.cos(p.angle + i * 2 * Math.PI / teeth), p.radius * Math.sin(p.angle + i * 2 * Math.PI / teeth)))).flat();
    spurCache.set(key, outline);
  }
  const shape = new THREE.Shape(outline), hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, 2 * Math.PI, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 });
  geometry.translate(0, 0, -depth / 2);
  // Smooth only the axially extruded perimeter; the flat end faces retain
  // axial normals. Dense generated flank samples avoid faceted teeth.
  geometry.userData = { teeth, module, pitchRadius: radius, outerRadius: radius + module * addendumCoefficient,
    rootRadius: radius - (1.25 - profileShift) * module, boreRadius, depth, outline,
    pressureAngle, profileShift, addendumCoefficient,
    toothProfile: 'rack-generated-involute-with-root-transition' };
  return geometry;
}

export function jawClutchGeometry(profile, { movingIndices, direction, phase = 0, jawCount = 6,
  jawFraction = 0.36, jawHeight = 0.18, boreRadius, keyHalfWidth = 0, keywayTop = 0,
  smoothProfileIndices = [], color, hand = direction, topFraction = 0.16, relief = 'cosine',
  symmetric = false, frontRadialSegments = 1, toothStations = null }) {
  const pitch = 2 * Math.PI / jawCount, half = jawFraction / 2;
  const stations = [];
  if (toothStations) {
    // Caller-supplied tooth outline: {u, height} over one pitch, u in [0, 1),
    // with the tooth's leading flank at u = 0; the closing station repeats
    // the first height one revolution on.
    for (let tooth = 0; tooth < jawCount; tooth += 1) {
      for (const { u, height } of toothStations) stations.push({ angle: (tooth - half + u) * pitch, height });
    }
    stations.push({ angle: (jawCount - half) * pitch, height: toothStations[0].height });
  } else if (symmetric) {
    for (let i = 0; i <= jawCount * 64; i += 1) {
      const u = (i % 64) / 64;
      stations.push({ angle: i * pitch / 64, height: jawHeight * Math.abs(2 * u - 1) });
    }
  } else {
  for (let tooth = 0; tooth < jawCount; tooth += 1) {
    const start = (tooth - half) * pitch;
    stations.push({ angle: start, height: 0 }, { angle: start, height: jawHeight });
    if (topFraction > 0) for (let i = 1; i <= 12; i += 1) stations.push({ angle: start + topFraction * pitch * i / 12, height: jawHeight });
    for (let i = 1; i <= 40; i += 1) stations.push({ angle: start + (topFraction + (jawFraction - topFraction) * i / 40) * pitch,
      height: jawHeight * (relief === 'linear' ? 1 - i / 40 : 0.5 + 0.5 * Math.cos(Math.PI * i / 40)) });
    for (let i = 1; i <= 48; i += 1) stations.push({ angle: start + (jawFraction + (1 - jawFraction) * i / 48) * pitch, height: 0 });
  }
  }
  if (hand < 0) stations.reverse();
  for (const station of stations) station.angle = hand * station.angle + phase;
  const lower = stations[0].angle, upper = stations.at(-1).angle;
  if (keyHalfWidth && keywayTop) {
    const a = Math.acos(keyHalfWidth / boreRadius), b = Math.atan2(keywayTop, keyHalfWidth);
    for (const raw of [a, b, Math.PI - b, Math.PI - a]) {
      const angle = lower + THREE.MathUtils.euclideanModulo(raw - lower, 2 * Math.PI);
      if (angle <= lower + 1e-10 || angle >= upper - 1e-10) continue;
      const index = stations.findIndex((s) => s.angle > angle);
      const left = stations[index - 1], right = stations[index];
      stations.splice(index, 0, { angle, height: THREE.MathUtils.lerp(left.height, right.height,
        (angle - left.angle) / (right.angle - left.angle)) });
    }
  }
  const positions = [], normals = [], colors = [], baseColor = new THREE.Color(color), paint = new THREE.Color(0xf1ebdc);
  const outerRadius = Math.max(...profile.map(([, r]) => r));
  const profileNormal = (index, angle) => {
    if (!smoothProfileIndices.includes(index)) return null;
    const previous = profile[(index + profile.length - 1) % profile.length], current = profile[index], next = profile[(index + 1) % profile.length];
    const a = new THREE.Vector2(current[0] - previous[0], current[1] - previous[1]).normalize();
    const b = new THREE.Vector2(next[0] - current[0], next[1] - current[1]).normalize();
    const tangent = a.add(b).normalize();
    return new THREE.Vector3(tangent.x * Math.cos(angle), tangent.x * Math.sin(angle), -tangent.y);
  };
  const point = (index, station) => {
    const [x, rawRadius] = profile[index];
    const angle = Math.abs(station.angle - upper) < 1e-12 ? lower : station.angle;
    const r = Math.abs(rawRadius - boreRadius) < 1e-12 ? keyedBoreRadius(angle, boreRadius, keyHalfWidth, keywayTop) : rawRadius;
    return new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle),
      x + (movingIndices.includes(index) ? direction * station.height : 0));
  };
  const emit = (a, b, c, smoothNormals, shade) => {
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-22) return;
    normal.normalize();
    for (const [i, v] of [a, b, c].entries()) {
      positions.push(v.x, v.y, v.z);
      const n = smoothNormals ? smoothNormals[i] : normal;
      normals.push(n.x, n.y, n.z); colors.push(shade.r, shade.g, shade.b);
    }
  };
  let frontTriangleStart, frontTriangleCount;
  for (let j = 0; j < profile.length; j += 1) {
    const next = (j + 1) % profile.length;
    const isFront = movingIndices.includes(j) && movingIndices.includes(next);
    if (isFront) frontTriangleStart = positions.length / 9;
    for (let i = 0; i + 1 < stations.length; i += 1) {
      const first = stations[i], last = stations[i + 1];
      const a = point(j, first), b = point(j, last), c = point(next, last), d = point(next, first);
      if (isFront && frontRadialSegments > 1) {
        // The tooth flanks are helicoids, not warped single quads. A
        // geometric radial grid keeps their chord error small at the bore
        // as well as the rim; boundary vertices remain exactly shared.
        const along = (outer, inner, u) => {
          if (u === 0) return outer;
          if (u === 1) return inner;
          const ra = Math.hypot(outer.x, outer.y), rb = Math.hypot(inner.x, inner.y);
          const radius = ra * (rb / ra) ** u;
          return new THREE.Vector3(outer.x * radius / ra, outer.y * radius / ra, outer.z);
        };
        const derivative = (last.height - first.height) / (last.angle - first.angle);
        const faceNormal = (v, angle) => new THREE.Vector3(derivative * Math.sin(angle) / Math.hypot(v.x, v.y),
          -derivative * Math.cos(angle) / Math.hypot(v.x, v.y), direction).normalize();
        for (let band = 0; band < frontRadialSegments; band += 1) {
          const aa = along(a, d, band / frontRadialSegments), bb = along(b, c, band / frontRadialSegments);
          const cc = along(b, c, (band + 1) / frontRadialSegments), dd = along(a, d, (band + 1) / frontRadialSegments);
          const ns = [faceNormal(aa, first.angle), faceNormal(bb, last.angle), faceNormal(cc, last.angle), faceNormal(dd, first.angle)];
          emit(aa, bb, cc, ns.slice(0, 3), baseColor); emit(aa, cc, dd, [ns[0], ns[2], ns[3]], baseColor);
        }
        continue;
      }
      const isOuter = profile[j][1] === outerRadius && profile[next][1] === outerRadius;
      let radialNormals = isOuter ? [first.angle, last.angle, last.angle, first.angle]
        .map((angle) => new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)) : null;
      if (smoothProfileIndices.includes(j) && smoothProfileIndices.includes(next)) radialNormals = [
        profileNormal(j, first.angle), profileNormal(j, last.angle), profileNormal(next, last.angle), profileNormal(next, first.angle)];
      const shade = isOuter && THREE.MathUtils.euclideanModulo((first.angle + last.angle) / 2 + 0.035, 2 * Math.PI) < 0.07
        ? paint : baseColor;
      // A side wall meets a vertical flank whose lower end is raised (a
      // rounded trough) in a T-junction: split the taller edge at the
      // flank's lower height so both walls and the flank share vertices.
      const movingEnd = movingIndices.includes(j) !== movingIndices.includes(next)
        ? (movingIndices.includes(j) ? j : next) : null;
      const splitAt = (station, neighbour) => {
        if (movingEnd === null || !neighbour || Math.abs(neighbour.angle - station.angle) > 1e-12) return null;
        const low = Math.min(station.height, neighbour.height);
        return low > 1e-9 && station.height > low + 1e-9 ? point(movingEnd, { angle: station.angle, height: low }) : null;
      };
      const wrap = (k) => stations[k] ?? (k >= stations.length ? stations[k - stations.length + 1] : stations[k + stations.length - 1]);
      const p = splitAt(last, wrap(i + 2)), q = splitAt(first, wrap(i - 1));
      if (p) { emit(a, b, p, null, shade); emit(a, p, c, null, shade); } else emit(a, b, c, radialNormals?.slice(0, 3), shade);
      if (q) { emit(a, c, q, null, shade); emit(q, c, d, null, shade); }
      else emit(a, c, d, radialNormals ? [radialNormals[0], radialNormals[2], radialNormals[3]] : null, shade);
    }
    if (isFront) frontTriangleCount = positions.length / 9 - frontTriangleStart;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { profile, movingIndices, stations, direction, phase, hand, topFraction, relief, symmetric, frontRadialSegments, customToothStations: Boolean(toothStations), jawCount, jawFraction, jawHeight,
    boreRadius, keyHalfWidth, keywayTop, frontTriangleStart, frontTriangleCount };
  return geometry;
}
