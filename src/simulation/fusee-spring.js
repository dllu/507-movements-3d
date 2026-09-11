import * as THREE from 'three';

// A kinematic ribbon with constant neutral-line length. Changing the radial
// distribution lets it expand from the fixed arbor toward the barrel wall.
// It illustrates winding; it is not an elastic stress/torque solver.
export function fuseeSpringGeometry(initialBarrelAngle, {
  segments = 1024, initialTurns = 8, innerRadius = 0.118, outerRadius = 0.915,
  thickness = 0.010, bottom = -0.45, top = 0.49,
} = {}) {
  const geometry = new THREE.BufferGeometry();
  const count = segments * 24 + 12;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const initialAngle = 2 * Math.PI * initialTurns;
  const innerAngle = initialBarrelAngle - initialAngle;
  const radiusAt = (k, t) => innerRadius + (outerRadius - innerRadius)
    * (Math.abs(k) < 1e-8 ? t : Math.expm1(k * t) / Math.expm1(k));
  const lengthAt = (angle, k) => {
    const cosine = Math.cos(angle / segments);
    let previous = innerRadius, length = 0;
    for (let i = 1; i <= segments; i += 1) {
      const r = radiusAt(k, i / segments);
      length += Math.sqrt((r - previous) ** 2 + 2 * r * previous * (1 - cosine));
      previous = r;
    }
    return length;
  };
  const neutralLength = lengthAt(initialAngle, 1.5);
  let cursor = 0;
  const append = (v, n) => {
    positions.set(v.toArray(), cursor);
    normals.set(n.toArray(), cursor);
    cursor += 3;
  };
  const quad = (a, b, c, d, normal) => {
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.dot(normal) < 0) [b, d] = [d, b];
    for (const v of [a, b, c, a, c, d]) append(v, normal);
  };
  const setBarrelAngle = (barrelAngle) => {
    const angle = initialAngle + barrelAngle - initialBarrelAngle;
    let low = -8, high = 8;
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const middle = (low + high) / 2;
      // Positive k concentrates coils near the arbor and shortens the line.
      if (lengthAt(angle, middle) > neutralLength) low = middle;
      else high = middle;
    }
    const k = (low + high) / 2;
    const centers = [], sections = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments, theta = innerAngle + angle * t;
      const r = radiusAt(k, t), cosine = Math.cos(theta), sine = Math.sin(theta);
      const derivative = (outerRadius - innerRadius) * (Math.abs(k) < 1e-8 ? 1 : k * Math.exp(k * t) / Math.expm1(k));
      const tangent = new THREE.Vector3(derivative * cosine - r * angle * sine,
        derivative * sine + r * angle * cosine, 0).normalize();
      const normal = new THREE.Vector3(tangent.y, -tangent.x, 0);
      const center = new THREE.Vector3(r * cosine, r * sine, 0);
      centers.push(center);
      const inner = center.clone().addScaledVector(normal, -thickness / 2);
      const outer = center.clone().addScaledVector(normal, thickness / 2);
      sections.push({ tangent, normal, points: [inner.clone().setZ(bottom), outer.clone().setZ(bottom),
        outer.clone().setZ(top), inner.clone().setZ(top)] });
    }
    cursor = 0;
    for (let i = 0; i < segments; i += 1) {
      const a = sections[i], b = sections[i + 1];
      const radial = a.normal.clone().add(b.normal).normalize();
      quad(a.points[0], b.points[0], b.points[1], a.points[1], new THREE.Vector3(0, 0, -1));
      quad(a.points[1], b.points[1], b.points[2], a.points[2], radial);
      quad(a.points[2], b.points[2], b.points[3], a.points[3], new THREE.Vector3(0, 0, 1));
      quad(a.points[3], b.points[3], b.points[0], a.points[0], radial.negate());
    }
    quad(...sections[0].points, sections[0].tangent.clone().negate());
    quad(...sections.at(-1).points, sections.at(-1).tangent);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    Object.assign(geometry.userData, { barrelAngle, angle, k, centers,
      currentNeutralLength: centers.slice(1).reduce((sum, point, i) => sum + point.distanceTo(centers[i]), 0) });
  };
  geometry.userData = { segments, initialTurns, innerRadius, outerRadius, thickness, bottom, top,
    initialBarrelAngle, innerAngle, neutralLength, setBarrelAngle, constantLengthRibbon: true };
  setBarrelAngle(initialBarrelAngle);
  return geometry;
}
