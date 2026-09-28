import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { creaseIndexedNormals } from './crease-normals.js';

// three's ExtrudeGeometry is non-indexed and computes one normal per side
// triangle, so a finely sampled curved outline still shades as a row of flat
// facets. Weld the extrusion by position and recompute creased normals: the
// flat caps keep their own normal (they meet the side wall at 90 degrees),
// genuine outline corners sharper than creaseAngle stay sharp, and finely
// sampled curves shade smoothly. Positions are unchanged.
export function smoothShadeExtrusion(geometry, creaseAngle = Math.PI / 6) {
  const bare = new THREE.BufferGeometry();
  bare.setAttribute('position', geometry.attributes.position.clone());
  const welded = mergeVertices(bare, 1e-7);
  bare.dispose();
  welded.deleteAttribute('normal');
  creaseIndexedNormals(welded, creaseAngle);
  if (!welded.attributes.normal) welded.computeVertexNormals();
  welded.userData = { ...geometry.userData, smoothShadedExtrusion: { creaseAngle } };
  if (geometry.parameters) welded.parameters = geometry.parameters;
  return welded;
}

// A flat extrusion of shapes over [low, low + depth] with smooth side walls.
export function smoothExtrudeGeometry(shapes, depth, { low = 0, curveSegments = 64, creaseAngle } = {}) {
  const extruded = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments, steps: 1 });
  extruded.translate(0, 0, low);
  const geometry = smoothShadeExtrusion(extruded, creaseAngle);
  extruded.dispose();
  return geometry;
}

// Exact external involute spur outline: root arcs, radial flanks below the
// base circle, finely sampled involutes and a tip arc concentric with the
// gear, as three's makeGear defines them (same pitch, pressure angle, root,
// base and outer radii and tooth thickness) but without its chord polyline.
export function involuteSpurOutline({ teeth, pitchRadius, rootRadius, outerRadius, pressureAngle = THREE.MathUtils.degToRad(20),
  flankSamples = 48, tipSamples = 24, rootSamples = 24 }) {
  const baseRadius = pitchRadius * Math.cos(pressureAngle), pitch = Math.PI * 2 / teeth;
  const inv = r => { if (r <= baseRadius) return 0; const t = Math.sqrt((r / baseRadius) ** 2 - 1); return t - Math.atan(t); };
  const half = r => Math.PI / (2 * teeth) + Math.tan(pressureAngle) - pressureAngle - inv(r);
  const start = Math.max(rootRadius, baseRadius), points = [];
  const at = (r, a) => points.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  const t0 = start > baseRadius ? Math.sqrt((start / baseRadius) ** 2 - 1) : 0, t1 = Math.sqrt((outerRadius / baseRadius) ** 2 - 1);
  const flank = i => { const t = t0 + (t1 - t0) * i / flankSamples; return baseRadius * Math.sqrt(1 + t * t); };
  const startHalf = half(start), tipHalf = half(outerRadius);
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const c = tooth * pitch;
    for (let i = 0; i < rootSamples; i += 1) at(rootRadius, c - pitch / 2 + (pitch / 2 - startHalf) * i / rootSamples);
    at(rootRadius, c - startHalf);
    for (let i = 0; i <= flankSamples; i += 1) { const r = flank(i); if (i || start > rootRadius + 1e-10) at(r, c - half(r)); }
    for (let i = 1; i < tipSamples; i += 1) at(outerRadius, c - tipHalf + 2 * tipHalf * i / tipSamples);
    for (let i = flankSamples; i >= 0; i -= 1) { const r = flank(i); if (i || start > rootRadius + 1e-10) at(r, c + half(r)); }
    at(rootRadius, c + startHalf);
    for (let i = 1; i < rootSamples; i += 1) at(rootRadius, c + startHalf + (pitch / 2 - startHalf) * i / rootSamples);
  }
  return points;
}
