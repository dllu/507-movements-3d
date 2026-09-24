import * as THREE from 'three';

// Brown engraves many spur wheels with square teeth: straight flanks, flat
// tips and a flat root. This outline keeps that drawn form. It is not a
// conjugate profile: speed ratios stay prescribed, and the tooth width and
// slight taper must leave backlash so mating outlines clear through the mesh.
// Tooth k is centred on angle k * 2π / teeth; `width` is the chordal tooth
// width at mid-height and `taper` narrows each flank toward the tip.
export function squareToothOutline({ teeth, radius, addendum, dedendum, width, taper = 0, rootSamples = 3 }) {
  const pitch = 2 * Math.PI / teeth;
  const rootRadius = radius - dedendum, tipRadius = radius + addendum;
  const rootHalf = width / 2 + taper, tipHalf = width / 2 - taper;
  const rootAngle = Math.asin(rootHalf / rootRadius);
  const polar = (r, a) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  // A flank point at signed half-width h and radius r about tooth angle c.
  const flank = (c, h, r) => {
    const y = Math.sqrt(r * r - h * h);
    return new THREE.Vector2(Math.cos(c) * y - Math.sin(c) * h, Math.sin(c) * y + Math.cos(c) * h);
  };
  const points = [];
  for (let k = 0; k < teeth; k += 1) {
    const c = k * pitch;
    for (let i = 0; i < rootSamples; i += 1) {
      points.push(polar(rootRadius, c - pitch / 2 + (pitch / 2 - rootAngle) * i / rootSamples));
    }
    points.push(flank(c, -rootHalf, rootRadius), flank(c, -tipHalf, tipRadius),
      flank(c, tipHalf, tipRadius), flank(c, rootHalf, rootRadius));
    for (let i = 1; i < rootSamples; i += 1) {
      points.push(polar(rootRadius, c + rootAngle + (pitch / 2 - rootAngle) * i / rootSamples));
    }
  }
  const shape = new THREE.Shape(points);
  shape.closePath();
  return { points, shape, rootRadius, tipRadius, rootAngle, tipAngle: Math.asin(tipHalf / tipRadius) };
}
