import * as THREE from 'three';

// Normal-system involute teeth swept along a constant-lead helix. The two
// halves of a herringbone share the same section at their central crease.
export function involuteHelicalGeometry({
  teeth, normalModule, normalPressureAngle = Math.PI / 9,
  helixAngle, faceWidth, handedness, herringbone = false,
  backlash = 0.0003, axialSegments = 48,
}) {
  const transverseModule = normalModule / Math.cos(helixAngle);
  const pressureAngle = Math.atan(Math.tan(normalPressureAngle) / Math.cos(helixAngle));
  const pitchRadius = transverseModule * teeth / 2;
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const rootRadius = pitchRadius - 1.25 * normalModule;
  const tipRadius = pitchRadius + normalModule;
  const angularPitch = 2 * Math.PI / teeth;
  const pitchHalfAngle = Math.PI / (2 * teeth) - backlash / (4 * pitchRadius);
  const inv = (r) => {
    const t = Math.sqrt(Math.max(0, (r / baseRadius) ** 2 - 1));
    return t - Math.atan(t);
  };
  const halfAngle = (r) => pitchHalfAngle + inv(pitchRadius) - inv(r);
  // These reconstructions have roots above their base cylinders. A smaller
  // tooth count would need a generated root transition, not an extrapolation.
  if (rootRadius <= baseRadius) throw new RangeError('Helical roots require a generated undercut transition.');
  const segments = [];
  const arc = (r, from, to, count) => {
    for (let i = 0; i < count; i += 1) {
      const a = from + (to - from) * i / count;
      const b = from + (to - from) * (i + 1) / count;
      segments.push({ a: [r * Math.cos(a), r * Math.sin(a)], b: [r * Math.cos(b), r * Math.sin(b)],
        na: [Math.cos(a), Math.sin(a)], nb: [Math.cos(b), Math.sin(b)] });
    }
  };
  const flankPoint = (r, center, side) => {
    const angle = center + side * halfAngle(r);
    const c = Math.cos(angle), s = Math.sin(angle);
    const t = Math.sqrt((r / baseRadius) ** 2 - 1);
    const normal = side === -1 ? [s + c * t, -c + s * t] : [-s + c * t, c + s * t];
    const length = Math.hypot(...normal);
    return { p: [r * c, r * s], n: normal.map((v) => v / length) };
  };
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const center = tooth * angularPitch;
    arc(rootRadius, center - angularPitch / 2, center - halfAngle(rootRadius), 3);
    for (const side of [-1, 1]) {
      if (side === 1) arc(tipRadius, center - halfAngle(tipRadius), center + halfAngle(tipRadius), 6);
      for (let i = 0; i < 24; i += 1) {
        const fraction = side === -1 ? i / 24 : 1 - i / 24;
        const next = side === -1 ? (i + 1) / 24 : 1 - (i + 1) / 24;
        const a = flankPoint(rootRadius + (tipRadius - rootRadius) * fraction, center, side);
        const b = flankPoint(rootRadius + (tipRadius - rootRadius) * next, center, side);
        segments.push({ a: a.p, b: b.p, na: a.n, nb: b.n });
      }
    }
    arc(rootRadius, center + halfAngle(rootRadius), center + angularPitch / 2, 3);
  }
  const leadRate = handedness * Math.tan(helixAngle) / pitchRadius;
  const phaseAt = (z) => leadRate * (herringbone ? faceWidth / 2 - Math.abs(z) : z);
  const positions = [], normals = [], indices = [];
  const rotated = (p, angle, z) => [p[0] * Math.cos(angle) - p[1] * Math.sin(angle),
    p[0] * Math.sin(angle) + p[1] * Math.cos(angle), z];
  for (let step = 0; step < axialSegments; step += 1) {
    const za = faceWidth * (step / axialSegments - 0.5);
    const zb = faceWidth * ((step + 1) / axialSegments - 0.5);
    const derivative = herringbone && za >= 0 ? -leadRate : leadRate;
    for (const { a, b, na, nb } of segments) {
      const first = positions.length / 3;
      for (const [p, n, z] of [[a, na, za], [b, nb, za], [b, nb, zb], [a, na, zb]]) {
        const angle = phaseAt(z);
        positions.push(...rotated(p, angle, z));
        const normal = rotated(n, angle, derivative * (n[0] * p[1] - n[1] * p[0]));
        const length = Math.hypot(...normal);
        normals.push(...normal.map((v) => v / length));
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  for (const z of [-faceWidth / 2, faceWidth / 2]) {
    for (const { a, b } of segments) {
      const first = positions.length / 3;
      const corners = [[0, 0, z], rotated(a, phaseAt(z), z), rotated(b, phaseAt(z), z)];
      if (z < 0) corners.reverse();
      for (const p of corners) { positions.push(...p); normals.push(0, 0, Math.sign(z)); }
      indices.push(first, first + 1, first + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.userData = { teeth, normalModule, transverseModule, normalPressureAngle, pressureAngle,
    pitchRadius, baseRadius, rootRadius, tipRadius, angularPitch, faceWidth, helixAngle,
    handedness, herringbone, backlash, axialSegments, sectionVertexCount: segments.length,
    toothProfile: 'normal-system-involute', lead: 2 * Math.PI / Math.abs(leadRate) };
  return { geometry, phaseAt };
}
