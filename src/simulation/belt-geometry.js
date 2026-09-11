import * as THREE from 'three';

export function beltFrameAt(curve, u, widthDirection = new THREE.Vector3(0, 0, 1)) {
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  const width = typeof widthDirection === 'function'
    ? widthDirection(u, point, tangent).clone() : widthDirection.clone();
  width.addScaledVector(tangent, -width.dot(tangent));
  if (width.lengthSq() < 1e-10) {
    width.set(0, 1, 0).addScaledVector(tangent, -tangent.y);
    if (width.lengthSq() < 1e-10) width.set(1, 0, 0);
  }
  width.normalize();
  const normal = new THREE.Vector3().crossVectors(tangent, width).normalize();
  return { point, tangent, width, normal };
}

/** A closed rectangular belt section, with smooth running faces and sharp edges. */
export function flatBeltGeometry(curve, {
  width = 0.18,
  thickness = 0.024,
  widthDirection = new THREE.Vector3(0, 0, 1),
  sectionAt,
  segments = 256,
  closed = true,
} = {}) {
  const frames = Array.from({ length: segments + 1 }, (_, i) => beltFrameAt(curve, i / segments, widthDirection));
  // CurvePath's default numerical tangent can differ slightly at u=0 and
  // u=1. Share the seam frame so a closed band has no microscopic slit.
  if (closed) frames[segments] = frames[0];
  const corners = frames.map((frame, i) => {
    if (sectionAt) return sectionAt(i / segments, frame);
    const { point, width: across, normal } = frame;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => point.clone()
      .addScaledVector(across, a * width / 2).addScaledVector(normal, b * thickness / 2));
  });
  if (closed) corners[segments] = corners[0];
  const positions = [];
  const normals = [];
  const indices = [];
  for (let side = 0; side < 4; side += 1) {
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const normal = (side % 2 === 0 ? frames[i].normal : frames[i].width).clone()
        .multiplyScalar(side === 0 || side === 3 ? -1 : 1);
      for (const corner of [side, (side + 1) % 4]) {
        positions.push(...corners[i][corner].toArray());
        normals.push(...normal.toArray());
      }
      if (i < segments) {
        const a = start + 2 * i;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
  }
  if (!closed) {
    for (const i of [0, segments]) {
      const start = positions.length / 3;
      const normal = frames[i].tangent.clone().multiplyScalar(i === 0 ? -1 : 1);
      corners[i].forEach((point) => {
        positions.push(...point.toArray());
        normals.push(...normal.toArray());
      });
      const cap = i === 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      indices.push(...cap.map((index) => start + index));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  if (sectionAt) geometry.computeVertexNormals();
  geometry.userData.crossSection = 'rectangular';
  return geometry;
}
