import * as THREE from 'three';
import { fuseeTierPath } from './fusee-motion.js';

// Brown's stepped fusee as one closed turned solid: flat cylindrical tiers of
// decreasing radius over a base flange. The chain sits on each tier's shelf
// against the riser above it. Where the chain climbs to the next tier, the
// tier carries a short spiral lobe that follows the chain outward over the
// shelf (a constant gap inside the chain line) and ends in a radial step once
// the chain has dropped below the shelf.
export function steppedFuseeGeometry(parameters, { angularSegments = 1440 } = {}) {
  const p = parameters;
  const path = fuseeTierPath(p);
  const tierCount = p.tierChainRadii.length;
  const risers = p.tierChainRadii.map((radius) => radius - p.riserGap);
  const fullTurn = 2 * Math.PI;
  const lobeEnds = p.transitionStarts.map((start, k) => {
    // Hold the lobe until the descending chain's top is below the shelf.
    const drop = p.tierChainHeights[k] - p.tierShelves[k] + 0.037 + 0.002;
    let low = 0, high = 1;
    for (let i = 0; i < 60; i += 1) {
      const middle = (low + high) / 2;
      const height = path.at(start + p.riseAngle + middle * p.descentAngle).height;
      if (p.tierChainHeights[k] - height < drop) low = middle; else high = middle;
    }
    return start + p.riseAngle + high * p.descentAngle;
  });
  // Plan outline of tier k at local angle phi (0..2pi).
  const lobeRadiusAt = (k, phi) => {
    if (k >= p.transitionStarts.length) return risers[k];
    const start = p.transitionStarts[k], end = lobeEnds[k];
    const relative = THREE.MathUtils.euclideanModulo(phi - start, fullTurn);
    if (relative > end - start) return risers[k];
    const chain = path.at(start + relative).radius;
    return Math.max(risers[k], chain - p.lobeGap);
  };
  // Every outline shares one angle list, so shelves are simple strips between
  // neighbouring outlines. Each lobe ends in a (very nearly) radial step
  // between two listed angles a small fraction of a segment apart.
  const step = fullTurn / angularSegments;
  const dropAngles = lobeEnds.map((end) => THREE.MathUtils.euclideanModulo(end, fullTurn));
  const angles = [];
  for (let i = 0; i < angularSegments; i += 1) {
    const phi = step * i;
    if (dropAngles.some((drop) => Math.abs(THREE.MathUtils.euclideanModulo(phi - drop + step / 2, fullTurn) - step / 2) < 0.45 * step
      || Math.abs(THREE.MathUtils.euclideanModulo(phi - drop - 0.3 * step + step / 2, fullTurn) - step / 2) < 0.45 * step)) continue;
    angles.push(phi);
  }
  for (const drop of dropAngles) angles.push(drop, THREE.MathUtils.euclideanModulo(drop + 0.3 * step, fullTurn));
  angles.sort((a, b) => a - b);
  const outlines = [];
  for (let k = 0; k <= tierCount; k += 1) {
    const corners = new Set();
    if (k < lobeEnds.length) {
      corners.add(dropAngles[k]);
      corners.add(THREE.MathUtils.euclideanModulo(dropAngles[k] + 0.3 * step, fullTurn));
    }
    outlines.push(angles.map((phi) => {
      const radius = k < tierCount ? lobeRadiusAt(k, phi) : p.baseRadius;
      return { phi, radius, corner: corners.has(phi),
        xy: new THREE.Vector2(radius * Math.cos(phi), radius * Math.sin(phi)) };
    }));
  }
  const tops = [p.tierTop, ...p.tierShelves];
  const bottoms = [...p.tierShelves, p.baseBottom];

  const positions = [], normals = [];
  const emit = (a, b, c, na, nb, nc) => {
    // Orient by the stored (single-precision) coordinates, so near-straight
    // cap slivers keep the winding their normals claim after rounding.
    for (const v of [a, b, c]) v.set(Math.fround(v.x), Math.fround(v.y), Math.fround(v.z));
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.lengthSq() < 1e-24) return;
    if (cross.dot(na.clone().add(nb).add(nc)) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
  };
  // Side walls: smooth radial shading along the turned faces, flat on the
  // lobe's radial step.
  outlines.forEach((outline, k) => {
    const count = outline.length;
    const wallNormal = (i, j) => {
      const a = outline[i].xy, b = outline[j].xy;
      return new THREE.Vector3(b.y - a.y, a.x - b.x, 0).normalize();
    };
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      const a = outline[i], b = outline[j];
      const face = wallNormal(i, j);
      const stepFace = a.corner && b.corner;
      const vertexNormal = (index) => {
        const point = outline[index];
        if (stepFace || point.corner) return face;
        const previous = (index - 1 + count) % count, next = (index + 1) % count;
        return wallNormal(previous, index).add(wallNormal(index, next)).normalize();
      };
      const na = vertexNormal(i), nb = vertexNormal(j);
      const a0 = new THREE.Vector3(a.xy.x, a.xy.y, bottoms[k]), a1 = new THREE.Vector3(a.xy.x, a.xy.y, tops[k]);
      const b0 = new THREE.Vector3(b.xy.x, b.xy.y, bottoms[k]), b1 = new THREE.Vector3(b.xy.x, b.xy.y, tops[k]);
      emit(a0, b0, b1, na, nb, nb);
      emit(a0, b1, a1, na, nb, na);
    }
  });
  const up = new THREE.Vector3(0, 0, 1), down = new THREE.Vector3(0, 0, -1);
  const at = (point, z) => new THREE.Vector3(point.xy.x, point.xy.y, z);
  const disk = (outline, z, normal) => {
    const center = new THREE.Vector3(0, 0, z);
    outline.forEach((point, i) => {
      emit(center.clone(), at(point, z), at(outline[(i + 1) % outline.length], z), normal, normal, normal);
    });
  };
  const shelf = (inner, outer, z) => {
    inner.forEach((point, i) => {
      const j = (i + 1) % inner.length;
      emit(at(point, z), at(outer[i], z), at(outer[j], z), up, up, up);
      emit(at(point, z), at(outer[j], z), at(inner[j], z), up, up, up);
    });
  };
  disk(outlines[0], tops[0], up);
  for (let k = 0; k < tierCount; k += 1) shelf(outlines[k], outlines[k + 1], tops[k + 1]);
  disk(outlines[tierCount], bottoms[tierCount], down);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { angularSegments, steppedTiers: true, tierCount, risers, lobeEnds,
    tops, bottoms, bodyTop: tops[0], bodyBottom: bottoms[tierCount], baseRadius: p.baseRadius,
    outlineRadiusAt: (k, phi) => (k < tierCount ? lobeRadiusAt(k, phi) : p.baseRadius) };
  return geometry;
}
