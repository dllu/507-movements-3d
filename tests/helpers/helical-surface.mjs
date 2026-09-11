import * as THREE from 'three';

// Locate a radial intersection with the actual triangulated helix. At an
// intermediate z, a twisted quad intersects the plane in two segments, not
// the single segment obtained by interpolating its end outlines.
export function helicalSurfaceQuery(geometry) {
  const p = geometry.attributes.position;
  const { teeth, sectionVertexCount: count, axialSegments, faceWidth, angularPitch } = geometry.userData;
  const perTooth = count / teeth;
  const sectionPoint = (step, tooth, vertex, t) => {
    if (vertex === 2 * perTooth) {
      const base = (step * count + tooth * perTooth + perTooth - 1) * 4;
      return [p.getX(base + 1) * (1 - t) + p.getX(base + 2) * t,
        p.getY(base + 1) * (1 - t) + p.getY(base + 2) * t];
    }
    const base = (step * count + tooth * perTooth + Math.floor(vertex / 2)) * 4;
    const end = base + (vertex % 2 ? 2 : 3);
    return [p.getX(base) * (1 - t) + p.getX(end) * t, p.getY(base) * (1 - t) + p.getY(end) * t];
  };
  const positiveAngle = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const triangle = new THREE.Triangle(), closest = new THREE.Vector3();
  return {
    radial(point) {
      if (Math.abs(point.z) > faceWidth / 2 + 1e-8) return null;
      const step = Math.min(axialSegments - 1, Math.max(0, Math.floor((point.z / faceWidth + 0.5) * axialSegments)));
      const za = p.getZ(step * count * 4), zb = p.getZ(step * count * 4 + 3);
      const t = THREE.MathUtils.clamp((point.z - za) / (zb - za), 0, 1);
      const start = sectionPoint(step, 0, 0, t);
      const theta = Math.atan2(point.y, point.x);
      const tooth = THREE.MathUtils.euclideanModulo(Math.floor((theta - Math.atan2(start[1], start[0])) / angularPitch), teeth);
      let selectedTooth = tooth;
      let first = sectionPoint(step, selectedTooth, 0, t);
      let target = positiveAngle(theta - Math.atan2(first[1], first[0]));
      if (target > angularPitch * 1.5) {
        selectedTooth = (selectedTooth + teeth - 1) % teeth;
        first = sectionPoint(step, selectedTooth, 0, t);
        target = positiveAngle(theta - Math.atan2(first[1], first[0]));
      }
      let low = 0, high = 2 * perTooth;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        const q = sectionPoint(step, selectedTooth, middle, t);
        const angle = Math.atan2(first[0] * q[1] - first[1] * q[0], first[0] * q[0] + first[1] * q[1]);
        if (angle <= target) low = middle;
        else high = middle;
      }
      const a = sectionPoint(step, selectedTooth, low, t), b = sectionPoint(step, selectedTooth, high, t);
      const radius = Math.hypot(point.x, point.y);
      const ux = point.x / radius, uy = point.y / radius;
      const surface = (a[0] * b[1] - a[1] * b[0]) / (ux * (b[1] - a[1]) - uy * (b[0] - a[0]));
      return { penetration: surface - radius, surface, step, edge: selectedTooth * perTooth + Math.floor(low / 2) };
    },
    distance(point, hit) {
      let minimum = Infinity;
      for (let step = Math.max(0, hit.step - 2); step <= Math.min(axialSegments - 1, hit.step + 2); step += 1) {
        for (let offset = -2; offset <= 2; offset += 1) {
          const edge = THREE.MathUtils.euclideanModulo(hit.edge + offset, count);
          const base = (step * count + edge) * 4;
          for (const indices of [[0, 1, 2], [0, 2, 3]]) {
            triangle.a.fromBufferAttribute(p, base + indices[0]);
            triangle.b.fromBufferAttribute(p, base + indices[1]);
            triangle.c.fromBufferAttribute(p, base + indices[2]);
            triangle.closestPointToPoint(point, closest);
            minimum = Math.min(minimum, point.distanceTo(closest));
          }
        }
      }
      return minimum;
    },
  };
}

export function helicalSurfaceSamples(geometry) {
  const p = geometry.attributes.position;
  const { sectionVertexCount: count, axialSegments } = geometry.userData;
  const points = [];
  for (let step = 0; step < axialSegments; step += 1) {
    for (let edge = 0; edge < count; edge += 1) {
      const base = (step * count + edge) * 4;
      const v = Array.from({ length: 4 }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, base + i));
      points.push(v[0]);
      if (step === axialSegments - 1) points.push(v[3]);
      // Both rendered triangles, including points well inside their faces.
      points.push(v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1 / 3));
      points.push(v[0].clone().add(v[2]).add(v[3]).multiplyScalar(1 / 3));
    }
  }
  const capStart = axialSegments * count * 4;
  for (let base = capStart; base < p.count; base += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, base);
    const b = new THREE.Vector3().fromBufferAttribute(p, base + 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, base + 2);
    points.push(a.clone().add(b).add(c).multiplyScalar(1 / 3));
    // Also sample the outer part of each fan triangle, where interference
    // could otherwise remain outside its centroid.
    const center = [a, b, c].find((v) => v.x === 0 && v.y === 0);
    const outside = [a, b, c].filter((v) => v !== center);
    points.push(center.clone().multiplyScalar(0.03).addScaledVector(outside[0], 0.485).addScaledVector(outside[1], 0.485));
  }
  return points;
}
