import * as THREE from 'three';
import { ring } from './finite-plate-geometry.js';
import { PALETTE, matte } from './primitives.js';

// A minimal fixed guide for a straight rod that Brown crops: a bored boss
// round the rod and a narrow web run straight back (behind the boss, so it
// is hidden in the plate's front view) to the framing member at z = zWall.
// Local frame: the rod axis passes through the origin along `axis` ('x' or
// 'y') at z = 0; the web lies at negative z. Returns meshes named `${name}`
// and `${name}Web`.
export function wallGuide({ name, axis = 'x', halfLength, boreRadius, outerRadius, zWall, material, segments = 96 }) {
  const mat = material ?? matte(PALETTE.muted, { metalness: 0.14, roughness: 0.6 });
  const boss = new THREE.Mesh(ring(boreRadius, outerRadius, -halfLength, halfLength, segments), mat);
  if (axis === 'x') boss.rotation.y = Math.PI / 2;
  else boss.rotation.x = -Math.PI / 2;
  boss.name = name;
  // The web starts inside the boss wall, clear of the bore.
  const webFront = -(boreRadius + outerRadius) / 2, webWidth = outerRadius;
  const along = 2 * halfLength;
  const web = new THREE.Mesh(new THREE.BoxGeometry(
    axis === 'x' ? along : webWidth, axis === 'x' ? webWidth : along, webFront - zWall), mat);
  web.position.z = (webFront + zWall) / 2;
  web.name = `${name}Web`;
  return [boss, web];
}
