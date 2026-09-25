import * as THREE from 'three';
import { PALETTE, matte } from './primitives.js';

// Plain supports for parts that Brown crops or leaves floating. They are
// placed where the plate does not show them: behind a fixed pin (hidden by
// the part it carries in the plate's view) or below the plate's crop.

// A bracket carrying a fixed pin from behind: the pin's own shank runs back
// to a small square flange bolted to the framing (or wall) behind the
// mechanism. `zPin` is the pin's current back face; the shank fills the gap.
export function pinWallBracket({ x, y, pinRadius, zPin, zWall, flange = 0.42, material, role, beyondPlateCrop = false }) {
  const group = new THREE.Group();
  group.userData.role = role;
  // Hidden supports may be kept out of a plate-framing fit.
  group.userData.beyondPlateCrop = beyondPlateCrop;
  const mat = material ?? matte(PALETTE.frame, { metalness: 0.15, roughness: 0.65 });
  const shankLength = zPin - zWall;
  if (shankLength > 0) {
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, shankLength, 32), mat);
    shank.rotation.x = Math.PI / 2;
    shank.position.set(x, y, (zPin + zWall) / 2);
    shank.userData.role = `${role}-shank`;
    group.add(shank);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(flange, flange, 0.08), mat);
  plate.position.set(x, y, zWall - 0.04);
  plate.userData.role = `${role}-flange`;
  group.add(plate);
  return group;
}

// A closed cylinder, axis along y, that a rod enters through a gland in its
// top cover: the rod's end lies inside, out of sight.
export function glandCylinder({ x, topY, z, length, glandRadius, boreRadius, outerRadius, material, role }) {
  const profile = [
    [glandRadius, 0], [glandRadius, -0.2], [boreRadius, -0.2], [boreRadius, -length + 0.2],
    [0.001, -length + 0.2], [0.001, -length], [outerRadius, -length], [outerRadius, 0], [glandRadius, 0],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const cylinder = new THREE.Mesh(new THREE.LatheGeometry(profile, 48),
    material ?? matte(PALETTE.frame, { metalness: 0.15, roughness: 0.62 }));
  cylinder.position.set(x, topY, z);
  cylinder.userData.role = role;
  cylinder.userData.beyondPlateCrop = true;
  return cylinder;
}

// A plain column on the framing plane behind the mechanism, standing on the
// floor below the plate's crop and carrying a small fixed pin's wall flange
// at its head, so the flange is not left floating.
export function flangeColumn({ x, yTop, yFloor, zWall, width = 0.24, material, role, beyondPlateCrop = false }) {
  const mat = material ?? matte(PALETTE.frame, { metalness: 0.15, roughness: 0.65 });
  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.beyondPlateCrop = beyondPlateCrop;
  const column = new THREE.Mesh(new THREE.BoxGeometry(width, yTop - yFloor, 0.08), mat);
  column.position.set(x, (yTop + yFloor) / 2, zWall - 0.04);
  column.userData.role = `${role}-shaft`;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(width * 3, 0.1, 0.5), mat);
  foot.position.set(x, yFloor + 0.05, zWall - 0.04);
  foot.userData.role = `${role}-foot`;
  group.add(column, foot);
  return group;
}
