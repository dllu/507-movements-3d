import * as THREE from 'three';
import { capsule, circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';

// Constant-length planar rod, including optional intermediate pin stations.
// The same solid supplies shank and eyes, so added bosses cannot fill its bores.
export function makeBoredLinkRod({ bodyMaterial, depth, length, planeZ, role, width,
  boreRadius = width * 0.85 + 0.004, startBoreRadius = boreRadius }) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role = role;
  const eyes = [0, length].map(x => {
    const radius = x === 0 ? startBoreRadius : boreRadius;
    return { x, boreRadius: radius, radius: radius + 0.035 };
  });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), bodyMaterial);
  body.position.z = planeZ;
  body.userData.role = `${role}-bored-constant-length-shank`;
  const rebuild = () => {
    const outline = clip.union(capsule([0, 0], [length, 0], width / 2, 24),
      ...eyes.map(eye => poly(circle([eye.x, 0], eye.radius, 64))));
    body.geometry.dispose();
    body.geometry = plate(clip.difference(outline,
      ...eyes.map(eye => poly(circle([eye.x, 0], eye.boreRadius, 64)))), -depth / 2, depth / 2);
    body.userData.bores = eyes.map(eye => ({ x: eye.x, y: 0, radius: eye.boreRadius }));
  };
  rod.userData.addPinEye = (x, radius, eyeRadius) => {
    eyes.push({ x, boreRadius: radius, radius: eyeRadius ?? radius + 0.035 });
    rebuild();
  };
  rebuild();
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = planeZ;
  startAnchor.userData.role = `${role}-analytic-start`;
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(length, 0, planeZ);
  endAnchor.userData.role = `${role}-analytic-end`;
  rod.add(body, startAnchor, endAnchor);
  return { rod, body, startAnchor, endAnchor };
}
