import * as THREE from 'three';
import { capstanPawlSamples, capstanPawlReleasePhase, capstanPawlSeatPhase, capstanPawlRecoilSamples } from './capstan-pawl-profile.js';
export { capstanPawlReleasePhase, capstanPawlSeatPhase };
const FULL_TURN = 2 * Math.PI;
function polarPoint(radius, height, angle) {
  return new THREE.Vector3(
    radius * Math.cos(angle),
    height,
    radius * Math.sin(angle),
  );
}

export function makeCrownRatchetGeometry({
  bottomHeight,
  highHeight,
  innerRadius,
  lowHeight,
  outerRadius,
  phaseOffset,
  toothCount,
  slices = 16,
}) {
  // Pass 106: each tooth is cut into `slices` angular slices, so the ramp is
  // a true helicoid and the outer and inner skirts are round (they were one
  // flat facet per tooth, reading polygonal from above). The skirts carry
  // radial normals and shade as smooth cylinders; the ramp, risers and foot
  // shade flat.
  const positions = [];
  const normals = [];
  const toothPitch = FULL_TURN / toothCount;
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const triangle = (points, pointNormals = null) => {
    if (!pointNormals) {
      edgeA.subVectors(points[1], points[0]);
      edgeB.subVectors(points[2], points[0]);
      faceNormal.crossVectors(edgeA, edgeB).normalize();
    }
    points.forEach((point, index) => {
      positions.push(point.x, point.y, point.z);
      const n = pointNormals ? pointNormals[index] : faceNormal;
      normals.push(n.x, n.y, n.z);
    });
  };
  const quad = (a, b, c, d, n = null) => {
    triangle([a, b, c], n && [n[0], n[1], n[2]]);
    triangle([a, c, d], n && [n[0], n[2], n[3]]);
  };
  const radial = (angle, sign) => new THREE.Vector3(sign * Math.cos(angle), 0, sign * Math.sin(angle));
  const down = new THREE.Vector3(0, -1, 0);
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    const startAngle = phaseOffset + tooth * toothPitch;
    const endAngle = startAngle + toothPitch;
    for (let slice = 0; slice < slices; slice += 1) {
      const a0 = startAngle + toothPitch * slice / slices;
      const a1 = startAngle + toothPitch * (slice + 1) / slices;
      const h0 = lowHeight + (highHeight - lowHeight) * slice / slices;
      const h1 = lowHeight + (highHeight - lowHeight) * (slice + 1) / slices;
      const inner0 = polarPoint(innerRadius, h0, a0);
      const inner1 = polarPoint(innerRadius, h1, a1);
      const outer0 = polarPoint(outerRadius, h0, a0);
      const outer1 = polarPoint(outerRadius, h1, a1);
      const innerFoot0 = polarPoint(innerRadius, bottomHeight, a0);
      const innerFoot1 = polarPoint(innerRadius, bottomHeight, a1);
      const outerFoot0 = polarPoint(outerRadius, bottomHeight, a0);
      const outerFoot1 = polarPoint(outerRadius, bottomHeight, a1);
      quad(inner0, inner1, outer1, outer0);
      const out0 = radial(a0, 1), out1 = radial(a1, 1);
      quad(outer0, outer1, outerFoot1, outerFoot0, [out0, out1, out1, out0]);
      const in0 = radial(a0, -1), in1 = radial(a1, -1);
      quad(inner1, inner0, innerFoot0, innerFoot1, [in1, in0, in0, in1]);
      quad(innerFoot0, outerFoot0, outerFoot1, innerFoot1, [down, down, down, down]);
    }
    const lowInner = polarPoint(innerRadius, lowHeight, startAngle);
    const lowOuter = polarPoint(outerRadius, lowHeight, startAngle);
    const highInner = polarPoint(innerRadius, highHeight, endAngle);
    const highOuter = polarPoint(outerRadius, highHeight, endAngle);
    quad(highOuter, highInner, polarPoint(innerRadius, bottomHeight, endAngle),
      polarPoint(outerRadius, bottomHeight, endAngle));
    quad(lowInner, lowOuter, polarPoint(outerRadius, bottomHeight, startAngle),
      polarPoint(innerRadius, bottomHeight, startAngle));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(normals, 3),
  );
  geometry.computeBoundingBox();
  return geometry;
}


// Brown draws the pawl flat against the front of the lower capstan, swinging
// in the plane of the drawing: its pivot pin is radial, and the pawl lies in
// the tangent plane of the lower part with its nose hanging down onto the
// upward-facing crown teeth. Rotor-local frame: pivot at azimuth +Z, the pawl
// extends along +X (the recoil direction there) and turns about +Z.
export const capstanPawlDimensions = Object.freeze({
  // Brown's pivot: at the centre of the collar as he draws it, on the line
  // of sight of the presentation camera (azimuth 88.9°).
  pivotAzimuth: Math.PI / 2 - Math.PI / 90, planeRadius: 1.165, thickness: 0.09, pivotHeight: -1.0,
  // The seated pawl, pivot-relative in its own plane (x toward recoil, y up):
  // the tip sits in the root, the front edge stands on the tooth face and the
  // shoulder turns just below the crest; the toe lies along the ramp.
  seatTip: Object.freeze([0.40, -0.487]), shoulderHeight: -0.31, toeLength: 0.07, toeAngle: Math.PI - 0.52,
  bellyStart: 1.48 * Math.PI, bellyLead: 0.25, shoulderRadius: 0.035, tipRadius: 0.008,
  length: Math.hypot(0.40, 0.487), noseRadius: 0.008, bossRadius: 0.15, boreRadius: 0.06, pinRadius: 0.055,
  innerRadius: 1.15, outerRadius: 1.45, lowHeight: -1.50,
  highHeight: -1.27, bottomHeight: -1.61, toothCount: 18, releaseFraction: 0.125, clearance: 0.0005,
});

// Rotor-local 3D point of a pawl-local point (x along the pawl, y up, z out
// of the pawl plane) for pawl angle beta about the radial pivot axis.
export function capstanPawlLocalToRotor(x, y, z, beta, target = new THREE.Vector3()) {
  const d = capstanPawlDimensions, c = Math.cos(beta), s = Math.sin(beta);
  const u = x*c - y*s, v = x*s + y*c, radial = d.planeRadius + z;
  const a = d.pivotAzimuth;
  // Tangential +X at azimuth a=+Z is world +X; radial is (cos a, sin a).
  return target.set(radial*Math.cos(a) + u*Math.sin(a), d.pivotHeight + v, radial*Math.sin(a) - u*Math.cos(a));
}

// The offline table follows actual crown triangles, indexed by the pivot's
// tooth phase measured from the crest release. Two columns retain the
// contact envelope separately from the prescribed continuous drop.
export function capstanPawlProfile(phase) {
  const coordinate = ((phase % 1 + 1) % 1) * (capstanPawlSamples.length-1);
  const i = Math.floor(coordinate), alpha = coordinate-i;
  const [p0,c0] = capstanPawlSamples[i], [p1,c1] = capstanPawlSamples[i+1];
  const pitch = p0+(p1-p0)*alpha, contactPitch = c0+(c1-c0)*alpha;
  const airborneClearance = Math.max(0,capstanPawlDimensions.length*(Math.sin(pitch)-Math.sin(contactPitch)));
  return {phase:coordinate/(capstanPawlSamples.length-1),pitch,contactPitch,airborneClearance,falling:airborneClearance > 1e-7};
}

// The pawl lying on the ratchet below the crest line: after it has dropped
// and while the capstan backs off, its nose slides down the ramp until it
// seats in the root against the tooth face at capstanPawlSeatPhase (< 0,
// measured from the crest release). Phase is folded into [seat, 1 + seat).
export function capstanPawlSeatedPitch(phase) {
  const seat = capstanPawlSeatPhase;
  // Rounding may put the seat itself a hair below the fold; keep it there.
  const w = ((phase - seat) % 1 + 1) % 1, v = (w > 1 - 1e-7 ? 0 : w) + seat;
  if (v >= 0) return capstanPawlProfile(v).contactPitch;
  const n = capstanPawlRecoilSamples.length - 1;
  const coordinate = Math.min(n, Math.max(0, n * (1 - v / seat)));
  const i = Math.min(n - 1, Math.floor(coordinate)), alpha = coordinate - i;
  return capstanPawlRecoilSamples[i] + (capstanPawlRecoilSamples[i + 1] - capstanPawlRecoilSamples[i]) * alpha;
}
