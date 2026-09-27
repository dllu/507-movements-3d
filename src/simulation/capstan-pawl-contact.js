import * as THREE from 'three';
import { capstanPawlSamples, capstanPawlReleasePhase, capstanPawlSeatPhase, capstanPawlRecoilSamples } from './capstan-pawl-profile.js';
export { capstanPawlReleasePhase, capstanPawlSeatPhase };
const FULL_TURN = 2 * Math.PI;
function appendTriangle(positions, first, second, third) {
  for (const point of [first, second, third]) {
    positions.push(point.x, point.y, point.z);
  }
}

function appendQuad(positions, first, second, third, fourth) {
  appendTriangle(positions, first, second, third);
  appendTriangle(positions, first, third, fourth);
}

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
}) {
  const positions = [];
  const toothPitch = FULL_TURN / toothCount;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    const startAngle = phaseOffset + tooth * toothPitch;
    const endAngle = startAngle + toothPitch;
    const lowInner = polarPoint(innerRadius, lowHeight, startAngle);
    const lowOuter = polarPoint(outerRadius, lowHeight, startAngle);
    const highInner = polarPoint(innerRadius, highHeight, endAngle);
    const highOuter = polarPoint(outerRadius, highHeight, endAngle);
    const bottomStartInner = polarPoint(
      innerRadius,
      bottomHeight,
      startAngle,
    );
    const bottomStartOuter = polarPoint(
      outerRadius,
      bottomHeight,
      startAngle,
    );
    const bottomEndInner = polarPoint(
      innerRadius,
      bottomHeight,
      endAngle,
    );
    const bottomEndOuter = polarPoint(
      outerRadius,
      bottomHeight,
      endAngle,
    );

    appendQuad(positions, lowInner, highInner, highOuter, lowOuter);
    appendQuad(
      positions,
      lowOuter,
      highOuter,
      bottomEndOuter,
      bottomStartOuter,
    );
    appendQuad(
      positions,
      highInner,
      lowInner,
      bottomStartInner,
      bottomEndInner,
    );
    appendQuad(
      positions,
      highOuter,
      highInner,
      bottomEndInner,
      bottomEndOuter,
    );
    appendQuad(
      positions,
      lowInner,
      lowOuter,
      bottomStartOuter,
      bottomStartInner,
    );
    appendQuad(
      positions,
      bottomStartInner,
      bottomStartOuter,
      bottomEndOuter,
      bottomEndInner,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}


// Brown draws the pawl flat against the front of the lower capstan, swinging
// in the plane of the drawing: its pivot pin is radial, and the pawl lies in
// the tangent plane of the lower part with its nose hanging down onto the
// upward-facing crown teeth. Rotor-local frame: pivot at azimuth +Z, the pawl
// extends along +X (the recoil direction there) and turns about +Z.
export const capstanPawlDimensions = Object.freeze({
  pivotAzimuth: Math.PI / 2, planeRadius: 1.165, thickness: 0.09, pivotHeight: -1.0,
  length: 0.56, noseRadius: 0.05, bossRadius: 0.12, boreRadius: 0.06, pinRadius: 0.055,
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
