import * as THREE from 'three';
import { PALETTE } from './primitives.js';

// Open water rendered as a real body: a translucent blue volume where the
// water physically is, instead of Brown's ruled strokes (engraving notation).
// depthWrite is off so the immersed parts inside stay visible through it, and
// opacity < 0.6 marks it as fluid for the solid-clearance screens.
export function waterVolumeMaterial({ color = PALETTE.fluid, opacity = 0.4 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.02,
    roughness: 0.18,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.fog = false;
  return material;
}

// Axis-aligned water body from its free surface down to its bed, in the
// caller's local frame.
export function waterVolumeGeometry({ xMin, xMax, surfaceY, bottomY, zMin, zMax }) {
  const geometry = new THREE.BoxGeometry(xMax - xMin, surfaceY - bottomY, zMax - zMin);
  geometry.translate((xMin + xMax) / 2, (surfaceY + bottomY) / 2, (zMin + zMax) / 2);
  return geometry;
}

export function waterVolume(bounds, material = waterVolumeMaterial()) {
  const mesh = new THREE.Mesh(waterVolumeGeometry(bounds), material);
  mesh.renderOrder = 1;
  return mesh;
}

