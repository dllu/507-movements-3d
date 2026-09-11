import * as THREE from 'three';

/**
 * Straight bevel teeth developed on the back cone using a virtual spur gear.
 * This is the Tredgold involute approximation, not a generated octoid flank.
 * Both ends lie on cones normal to the pitch generator, including for nearly
 * flat crown wheels. Distances are axial positions measured from the apex.
 */
export function bevelToothGeometry({
  teeth,
  innerDistance,
  outerDistance,
  pitchConeAngle,
  toothHeight,
  pressureAngle = Math.PI / 9,
  toothThicknessFactor = 0.96,
  flankSegments = 12,
  tipSegments = 4,
}) {
  const cosine = Math.cos(pitchConeAngle);
  const sine = Math.sin(pitchConeAngle);
  const pitchRadius = outerDistance * Math.tan(pitchConeAngle);
  const virtualRadius = pitchRadius / cosine;
  const module = 2 * pitchRadius / teeth;
  // The tooth depth must follow the module, not an arbitrary fraction of the
  // wheel radius (which creates pointed, self-crossing teeth on large wheels).
  const height = Math.min(toothHeight, 2.25 * module);
  const dedendum = height * 0.55;
  const addendum = height * 0.45;
  const baseRadius = virtualRadius * Math.cos(pressureAngle);
  const startRadius = Math.max(baseRadius, virtualRadius - dedendum);
  const tipRadius = virtualRadius + addendum;
  const involute = (radius) => {
    const t = Math.sqrt(Math.max(0, (radius / baseRadius) ** 2 - 1));
    return t - Math.atan(t);
  };
  const halfAtPitch = Math.PI / (2 * teeth) * toothThicknessFactor;
  const halfAngle = (radius) => halfAtPitch
    + (involute(virtualRadius) - involute(radius)) / cosine;
  const outline = [];
  const append = (radius, angle) => outline.push({ radius, angle });
  append(virtualRadius - dedendum, -halfAngle(startRadius));
  if (startRadius > virtualRadius - dedendum + 1e-10) {
    append(startRadius, -halfAngle(startRadius));
  }
  for (let i = 1; i <= flankSegments; i += 1) {
    const radius = THREE.MathUtils.lerp(startRadius, tipRadius, i / flankSegments);
    append(radius, -halfAngle(radius));
  }
  // Sample the top arc too: heels and toes are curved surfaces, not planar
  // quadrilaterals disguised by averaged corner normals.
  for (let i = 1; i <= tipSegments; i += 1) {
    append(tipRadius, THREE.MathUtils.lerp(-halfAngle(tipRadius), halfAngle(tipRadius), i / tipSegments));
  }
  for (let i = flankSegments - 1; i >= 0; i -= 1) {
    const radius = THREE.MathUtils.lerp(startRadius, tipRadius, i / flankSegments);
    append(radius, halfAngle(radius));
  }
  if (startRadius > virtualRadius - dedendum + 1e-10) {
    append(virtualRadius - dedendum, halfAngle(startRadius));
  }
  const innerScale = innerDistance / outerDistance;
  const point = ({ radius, angle }, scale) => new THREE.Vector3(
    radius * cosine * Math.cos(angle) * scale,
    radius * cosine * Math.sin(angle) * scale,
    (outerDistance - (radius - virtualRadius) * sine) * scale,
  );
  const inner = outline.map((entry) => point(entry, innerScale));
  const outer = outline.map((entry) => point(entry, 1));
  const positions = [];
  const indices = [];
  const addFace = (vertices, triangles) => {
    const start = positions.length / 3;
    vertices.forEach((vertex) => positions.push(...vertex.toArray()));
    triangles.forEach((triangle) => indices.push(...triangle.map((index) => start + index)));
  };
  const planarOutline = outline.map(({ radius, angle }) => new THREE.Vector2(
    radius * Math.cos(angle * cosine), radius * Math.sin(angle * cosine),
  ));
  const cap = THREE.ShapeUtils.triangulateShape(planarOutline, []);
  addFace(inner, cap.map(([a, b, c]) => [c, b, a]));
  addFace(outer, cap);
  for (let i = 0; i < outline.length; i += 1) {
    const next = (i + 1) % outline.length;
    addFace([inner[i], inner[next], outer[next], outer[i]], [[0, 1, 2], [0, 2, 3]]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.profile = 'back-cone-involute-approximation';
  geometry.userData.pitchConeAngle = pitchConeAngle;
  geometry.userData.pitchRadius = pitchRadius;
  geometry.userData.height = height;
  geometry.userData.toothThicknessFactor = toothThicknessFactor;
  geometry.userData.innerScale = innerScale;
  geometry.userData.root = {
    radius: pitchRadius - dedendum * cosine,
    z: outerDistance + dedendum * sine,
  };
  return geometry;
}

export function bevelBodyGeometry(toothGeometry, boreRadius = 0) {
  const { root, innerScale } = toothGeometry.userData;
  const profile = [
    new THREE.Vector2(boreRadius, root.z * innerScale),
    new THREE.Vector2(root.radius * innerScale, root.z * innerScale),
    new THREE.Vector2(root.radius, root.z),
    new THREE.Vector2(boreRadius, root.z),
    new THREE.Vector2(boreRadius, root.z * innerScale),
  ];
  const geometry = new THREE.LatheGeometry(profile, 96);
  // Lathe's +Y axis becomes +Z, keeping the cone apex at the origin.
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
