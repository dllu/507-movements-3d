import * as THREE from 'three';
import { circle, poly, plate, polygonClipping } from './finite-plate-geometry.js';

// The rigid plate has actual pin bores; only its transform changes in playback.
// A narrow web joins larger eyes, matching the usual engraved connecting rod.
export function boredPlanarLinkGeometry({ length, width, eyeRadius, boreRadius, depth }) {
  const centers = length === 0 ? [[0, 0]] : [[0, 0], [length, 0]];
  const eyes = centers.map(center => poly(circle(center, eyeRadius, 64)));
  const outline = length === 0 ? eyes[0] : polygonClipping.union(
    ...eyes, poly([[0, -width / 2], [length, -width / 2],
      [length, width / 2], [0, width / 2]]),
  );
  const bored = polygonClipping.difference(outline,
    ...centers.map(center => poly(circle(center, boreRadius, 64))));
  const geometry = plate(bored, -depth / 2, depth / 2);
  geometry.userData.bores = centers.map(([x, y]) => ({ x, y, radius: boreRadius }));
  return geometry;
}

export function makeBoredPlanarLink(options, material) {
  const link = new THREE.Mesh(boredPlanarLinkGeometry(options), material);
  link.userData.setEndpoints = (start, end) => {
    link.position.copy(start);
    link.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  return link;
}
