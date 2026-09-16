import { circle, poly, plate, polygonClipping, sector } from './finite-plate-geometry.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';

// Closed cutaway solids: a missing inspection sector is explicit geometry,
// rather than transparent material covering a moving joint.
export function sectionedCylinder(radius, length, openingHalfWidth = 0) {
  let outline = poly(circle([0, 0], radius, 128));
  if (openingHalfWidth) outline = polygonClipping.difference(outline,
    poly([[-openingHalfWidth, -radius - 1], [openingHalfWidth, -radius - 1],
      [openingHalfWidth, 0.16], [-openingHalfWidth, 0.16]]));
  const geometry = plate(outline, -length / 2, length / 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function annularSector(inner, outer, start, end, depth) {
  return plate(sector(inner, outer, start, end, 96), -depth / 2, depth / 2);
}

export function engineRod(length, width, eyeRadius, boreRadius, depth, material, role) {
  const rod = makeBoredPlanarLink({ length, width, eyeRadius, boreRadius, depth }, material);
  rod.userData.role = role;
  return rod;
}
