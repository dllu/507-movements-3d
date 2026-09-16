import * as THREE from 'three';
import {makeBoredLinkRod} from './bored-link-rod.js';

// Constant-length rods with the legacy analytic endpoint API; no geometry rebuild.
export function foldingRod({length, width, depth, bore, material, role, planeZ = 0}) {
  const {rod, body} = makeBoredLinkRod({length, width, depth, boreRadius: bore,
    bodyMaterial: material, role, planeZ});
  rod.userData.body = body;
  rod.userData.setEndpoints = (start, end) => {
    rod.position.copy(start);
    rod.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  return rod;
}

// Closed hollow sphere, including annular port faces; meridian matches the
// hollow spherical cavity approach used by movement 249, revolved about X.
export function hollowPipeBall(outer, inner, port, segments = 64) {
  const outerEnd = Math.sqrt(outer * outer - (port + outer - inner) ** 2);
  const innerEnd = Math.sqrt(inner * inner - port * port);
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const x = -outerEnd + 2 * outerEnd * i / 32;
    points.push(new THREE.Vector2(Math.sqrt(outer * outer - x * x), x));
  }
  points.push(new THREE.Vector2(port, outerEnd));
  for (let i = 0; i <= 32; i++) {
    const x = innerEnd - 2 * innerEnd * i / 32;
    points.push(new THREE.Vector2(Math.sqrt(inner * inner - x * x), x));
  }
  points.push(new THREE.Vector2(port, -outerEnd), points[0].clone());
  const geometry = new THREE.LatheGeometry(points, segments).rotateZ(-Math.PI / 2);
  geometry.userData = {outerRadius: outer, cavityRadius: inner, portRadius: port, outerEnd};
  return geometry;
}
