import * as THREE from 'three';
import {polygonClipping as clip} from './finite-plate-geometry.js';

// Pass 88: one closed fluid surface for a region built as a stack of prisms
// along the world y axis. Each layer is a plan multipolygon in (x, z) held
// between two levels; consecutive layers share their dividing level. Walls
// are emitted per layer and caps only where the plan changes between layers
// (the symmetric difference), so neighbouring layers leave no internal sheet
// and no coplanar duplicate faces. `openBottom` / `openTop` are plan regions
// left uncapped where another fluid surface continues the same body, and
// `caps` adds extra horizontal faces ({region, y, up}); a layer's `open`
// region is left uncapped at its top level.
export function stackedFluidGeometry(layers, {openBottom = null, openTop = null, caps = [], smoothAngle = Math.PI / 6} = {}) {
  const positions = [], normals = [];
  const ringPoints = (ring) => {
    const points = ring.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z));
    return points.filter((p, i) => p.distanceTo(points[(i + 1) % points.length]) > 1e-9);
  };
  const cap = (multipolygon, y, up) => {
    for (const [outerRing, ...holeRings] of multipolygon) {
      const contour = ringPoints(outerRing), holes = holeRings.map(ringPoints);
      if (contour.length < 3) continue;
      const all = [...contour, ...holes.flat()];
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        let [a, b, c] = triangle.map((i) => all[i]);
        // World (x, y, z) from plan (x, z): the face normal is (0, -cross, 0)
        // for a plan-anticlockwise triangle, so +y needs a clockwise one.
        const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
        if (ccw === up) [b, c] = [c, b];
        for (const p of [a, b, c]) {positions.push(p.x, y, p.y);normals.push(0, up ? 1 : -1, 0);}
      }
    }
  };
  const walls = (multipolygon, low, high) => {
    for (const polygon of multipolygon) {
      polygon.forEach((ring, index) => {
        let points = ringPoints(ring);
        if (points.length < 3) return;
        // Outer rings clockwise in plan (x, z), holes anticlockwise, so the
        // outward normal (dz, -dx) points away from the fluid.
        if (THREE.ShapeUtils.isClockWise(points) !== (index === 0)) points = points.reverse();
        const n = points.length;
        const edgeNormal = (i) => {
          const a = points[i], b = points[(i + 1) % n];
          return new THREE.Vector2(-(b.y - a.y), b.x - a.x).normalize();
        };
        const vertexNormal = (i, edge) => {
          const here = edgeNormal(edge), other = edgeNormal(edge === i ? (i + n - 1) % n : i);
          return here.dot(other) > Math.cos(smoothAngle) ? here.clone().add(other).normalize() : here;
        };
        for (let i = 0; i < n; i += 1) {
          const j = (i + 1) % n, a = points[i], b = points[j], na = vertexNormal(i, i), nb = vertexNormal(j, i);
          const quad = [[a, na, low], [b, nb, low], [b, nb, high], [a, na, low], [b, nb, high], [a, na, high]];
          for (const [p, q, y] of quad) {positions.push(p.x, y, p.y);normals.push(q.x, 0, q.y);}
        }
      });
    }
  };
  layers.forEach(({region, y0, y1}, i) => {
    walls(region, y0, y1);
    if (i === 0) cap(openBottom ? clip.difference(region, openBottom) : region, y0, false);
    const next = layers[i + 1];
    if (!next) {cap(openTop ? clip.difference(region, openTop) : region, y1, true);return;}
    const open = layers[i].open;
    const trim = (r) => (open ? clip.difference(r, open) : r);
    cap(trim(clip.difference(region, next.region)), y1, true);
    cap(trim(clip.difference(next.region, region)), y1, false);
  });
  for (const {region, y, up} of caps) cap(region, y, up);
  // Orient every triangle to its authored normal.
  for (let t = 0; t < positions.length; t += 9) {
    const p = (k) => new THREE.Vector3(positions[t + 3 * k], positions[t + 3 * k + 1], positions[t + 3 * k + 2]);
    const face = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
    const want = new THREE.Vector3(normals[t] + normals[t + 3] + normals[t + 6], normals[t + 1] + normals[t + 4] + normals[t + 7], normals[t + 2] + normals[t + 5] + normals[t + 8]);
    if (face.dot(want) < 0) {
      for (let k = 0; k < 3; k += 1) {
        [positions[t + 3 + k], positions[t + 6 + k]] = [positions[t + 6 + k], positions[t + 3 + k]];
        [normals[t + 3 + k], normals[t + 6 + k]] = [normals[t + 6 + k], normals[t + 3 + k]];
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

// A surface of revolution about the y axis through `profile` ([y, r] pairs,
// in order), sampled at the given angles (radians, measured from +x toward
// +z) so its rim can meet another surface's ring vertex for vertex. Open
// unless the profile itself runs to r = 0. Normals point away from the axis
// side the profile encloses (outward for a profile running upward).
export function latheAtAngles(profile, angles) {
  const positions = [], normals = [], n = angles.length;
  const tangents = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    return [b[0] - a[0], b[1] - a[1]];
  });
  for (let i = 0; i < profile.length - 1; i += 1) {
    const [y0, r0] = profile[i], [y1, r1] = profile[i + 1];
    // Outward in (r, y) for a profile running up: (dy, -dr).
    const seg = [y1 - y0, r1 - r0], len = Math.hypot(...seg) || 1;
    const segNormal = [seg[0] / len, -seg[1] / len];
    const smooth = (k) => {
      const t = tangents[k], l = Math.hypot(...t) || 1, v = [t[0] / l, -t[1] / l];
      return v[0] * segNormal[0] + v[1] * segNormal[1] > Math.cos(Math.PI / 6) ? v : segNormal;
    };
    const nr0 = smooth(i), nr1 = smooth(i + 1);
    for (let k = 0; k < n; k += 1) {
      const a = angles[k], b = angles[(k + 1) % n];
      const vertex = (angle, y, r) => [r * Math.cos(angle), y, r * Math.sin(angle)];
      const normal = (angle, [nrr, ny]) => [nrr * Math.cos(angle), ny, nrr * Math.sin(angle)];
      const quad = [[a, y0, r0, nr0], [b, y0, r0, nr0], [b, y1, r1, nr1], [a, y0, r0, nr0], [b, y1, r1, nr1], [a, y1, r1, nr1]];
      const tri = [];
      for (const [angle, y, r, nrm] of quad) {tri.push(vertex(angle, y, r));normals.push(...normal(angle, nrm));}
      for (const v of tri) positions.push(...v);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  // Orient each triangle to its normals.
  const p = geometry.attributes.position.array, q = geometry.attributes.normal.array;
  for (let t = 0; t < p.length; t += 9) {
    const v = (k) => new THREE.Vector3(p[t + 3 * k], p[t + 3 * k + 1], p[t + 3 * k + 2]);
    const face = new THREE.Vector3().subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0)));
    const want = new THREE.Vector3(q[t] + q[t + 3] + q[t + 6], q[t + 1] + q[t + 4] + q[t + 7], q[t + 2] + q[t + 5] + q[t + 8]);
    if (face.dot(want) < 0) for (let k = 0; k < 3; k += 1) {
      [p[t + 3 + k], p[t + 6 + k]] = [p[t + 6 + k], p[t + 3 + k]];
      [q[t + 3 + k], q[t + 6 + k]] = [q[t + 6 + k], q[t + 3 + k]];
    }
  }
  return geometry;
}

// Drop the triangles of `geometry` lying in the plane `axis` = `value` whose
// normal points along `sign` (±1), inside an optional plan `within(p)`
// predicate: the face where another fluid surface continues the body.
export function withoutPlaneFaces(geometry, axis, value, sign, within = () => true, tolerance = 1e-5) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = source.attributes.position.array, k = {x: 0, y: 1, z: 2}[axis], keep = [];
  for (let t = 0; t < p.length; t += 9) {
    const a = new THREE.Vector3(p[t], p[t + 1], p[t + 2]), b = new THREE.Vector3(p[t + 3], p[t + 4], p[t + 5]), c = new THREE.Vector3(p[t + 6], p[t + 7], p[t + 8]);
    const onPlane = [a, b, c].every((v) => Math.abs(v.getComponent(k) - value) < tolerance);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    if (onPlane && Math.sign(n.getComponent(k)) === sign && within(centroid)) continue;
    keep.push(t / 3, t / 3 + 1, t / 3 + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const size = attribute.itemSize, array = new Float32Array(keep.length * size);
    keep.forEach((v, i) => {for (let s = 0; s < size; s += 1) array[i * size + s] = attribute.array[v * size + s];});
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  return out;
}
