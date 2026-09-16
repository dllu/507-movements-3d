import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Revolve an outer meridian about Y, closing the end faces onto a true bore.
// Smooth curved grooves but retain sharp machined shoulders and V roots.
export function boredLatheGeometry(outerProfile, boreRadius, segments = 112) {
  if (!(boreRadius > 0) || outerProfile.some(p => p.radial <= boreRadius)) {
    throw new RangeError('A lathed through-bore must fit inside the whole profile');
  }
  const profile = outerProfile.filter((point, index) => index === 0
    || point.axial !== outerProfile[index - 1].axial
    || point.radial !== outerProfile[index - 1].radial);
  const first = profile[0], last = profile.at(-1);
  const points = [
    { axial: first.axial, radial: boreRadius }, ...profile,
    { axial: last.axial, radial: boreRadius },
    { axial: first.axial, radial: boreRadius },
  ];
  const source = new THREE.LatheGeometry(
    points.map(({ axial, radial }) => new THREE.Vector2(radial, axial)), segments,
  );
  const geometry = toCreasedNormals(source, Math.PI / 6);
  source.dispose();
  geometry.userData = { boreRadius, outerProfile: profile, segments };
  return geometry;
}
