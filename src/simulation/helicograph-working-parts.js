import * as THREE from 'three';
import { helicalThread, threadAngles } from './mujoco-screw/thread-geometry.js';
import { capsule, circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';

// Local Z of the shared thread generator maps to the helicograph's radial X.
// After this rotation azimuth about X is generator azimuth minus pi/2.
export function helicographThreadGeometry({ minimum, maximum, lead, core, crest, initialRadius, nutWidth }) {
  const axialLead = lead / (2 * Math.PI), malePhase = minimum - lead / 4;
  const profile = nutWidth === undefined
    ? { inner: core - .002, outer: crest, low: minimum, high: maximum,
      width: lead / 2, lead: axialLead, phase: malePhase }
    : { inner: core + .004, outer: crest + .007, low: -nutWidth / 2, high: nutWidth / 2,
      width: lead / 2 - .006, lead: axialLead, phase: malePhase - initialRadius + lead / 2 };
  return helicalThread(profile, threadAngles(profile, 96)).rotateY(Math.PI / 2);
}

export function helicographPivotBridge({ length, width, depth, bore }) {
  const outline = capsule([width / 2, 0], [length - width / 2, 0], width / 2, 48);
  return plate(polygonClipping.difference(outline, poly(circle([width / 2, 0], bore, 96))),
    -depth / 2, depth / 2).rotateX(-Math.PI / 2);
}

// A pigment trace is a flat graphic beneath the transparent transfer sheet,
// not a raised tube that the rolling wheel would have to climb over.
export function helicographTraceGeometry(curve, width, segments = 560) {
  const positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const side = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(width / 2);
    for (const sign of [-1, 1]) positions.push(p.x + sign * side.x, p.y, p.z + sign * side.z);
    if (i < segments) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
