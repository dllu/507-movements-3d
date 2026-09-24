import * as THREE from 'three';

// One closed solid, with hard V creases and smooth circumferential normals.
// An optional small pale index is paint in the vertex colors, with no raised
// geometry; a null indexAngle leaves the solid unpainted as Brown draws it.
export function groovedFrictionGeometry({ pitchRadius, faceWidth, grooveAmplitude,
  grooveCount, profileSign, color, indexAngle, angularSegments = 256 }) {
  const profile = Array.from({ length: 2 * grooveCount + 1 }, (_, index) => ({
    axialPosition: -faceWidth / 2 + faceWidth * index / (2 * grooveCount),
    radius: pitchRadius + profileSign * (index % 2 === 0 ? 1 : -1) * grooveAmplitude,
    wave: profileSign * (index % 2 === 0 ? 1 : -1) * grooveAmplitude,
  }));
  const positions = [], normals = [], colors = [], indices = [];
  const baseColor = new THREE.Color(color), paintColor = new THREE.Color(0xe6dbc5);
  const append = (x, y, z, nx, ny, nz, shade) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(shade.r, shade.g, shade.b);
  };
  for (let strip = 0; strip < profile.length - 1; strip += 1) {
    const a = profile[strip], b = profile[strip + 1];
    const slope = (b.radius - a.radius) / (b.axialPosition - a.axialPosition);
    const normalScale = 1 / Math.hypot(1, slope);
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angles = [segment, segment + 1].map((i) => 2 * Math.PI * i / angularSegments);
      const middle = (angles[0] + angles[1]) / 2;
      const distance = Math.abs(Math.atan2(Math.sin(middle - indexAngle), Math.cos(middle - indexAngle)));
      const shade = indexAngle != null && distance < 2 * Math.PI / angularSegments * 2 ? paintColor : baseColor;
      const start = positions.length / 3;
      for (const [point, angle] of [[a, angles[0]], [a, angles[1]], [b, angles[1]], [b, angles[0]]]) {
        const cosine = Math.cos(angle), sine = Math.sin(angle);
        append(point.radius * cosine, point.radius * sine, point.axialPosition,
          cosine * normalScale, sine * normalScale, -slope * normalScale, shade);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  for (const [point, side] of [[profile[0], -1], [profile.at(-1), 1]]) {
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const start = positions.length / 3;
      append(0, 0, point.axialPosition, 0, 0, side, baseColor);
      for (const index of side > 0 ? [segment, segment + 1] : [segment + 1, segment]) {
        const angle = 2 * Math.PI * index / angularSegments;
        append(point.radius * Math.cos(angle), point.radius * Math.sin(angle), point.axialPosition,
          0, 0, side, baseColor);
      }
      indices.push(start, start + 1, start + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { profile, angularSegments, grooveCount, profileSign, pitchRadius,
    faceWidth, grooveAmplitude, indexAngle, paintedIndex: indexAngle != null, closedGroovedSolid: true };
  return geometry;
}
