import * as THREE from 'three';
import { makeReversingClutch } from '../../src/simulation/reversing-clutch.js';
import { solidSurface, surfaceTriangles } from './solid-surface.mjs';

export function probeReversingCrownContact(intervals = 128) {
  const model = makeReversingClutch(), { geometry: p, parts } = model.root.userData;
  const report = { movement: 53, poses: 0, surfaceChecks: 0, minimumGap: Infinity, maximumToothGap: 0, penetratingSamples: 0 };
  for (const side of ['left', 'right']) {
    const source = parts[`${side}Crown`], target = parts[`${side}SlidingCrown`], surface = solidSurface(target.geometry);
    const g = source.geometry.userData, faces = surfaceTriangles(source.geometry).slice(g.frontTriangleStart, g.frontTriangleStart + g.frontTriangleCount);
    const peaks = Array.from({ length: p.jawCount }, () => new Map());
    // Use actual rendered peak vertices. Peaks remain on the loaded flank
    // even when the contact patch narrows immediately before withdrawal.
    for (const face of faces) for (const v of [face.a, face.b, face.c]) {
      const angle = THREE.MathUtils.euclideanModulo(Math.atan2(v.y, v.x) - g.phase, 2 * Math.PI), index = Math.round(angle / p.pitch);
      const radius = Math.hypot(v.x, v.y);
      if (Math.abs(angle - index * p.pitch) > 1e-6 || radius < 0.08 || radius > 0.24) continue;
      peaks[index % p.jawCount].set(v.toArray().join(','), v);
    }
    if (peaks.some((points) => points.size === 0)) throw new Error('Missing a rendered crown peak');
    for (let i = 0; i <= intervals; i += 1) {
      const local = p.lockTime + (p.releaseTime - p.lockTime) * (i + 0.173) / (intervals + 1);
      model.update(local + (side === 'right' ? p.cyclePeriod / 2 : 0) - p.sourceTime);
      model.root.updateMatrixWorld(true); report.poses += 1;
      const transform = target.matrixWorld.clone().invert().multiply(source.matrixWorld);
      for (const tooth of peaks) {
        let gap = Infinity;
        for (const vertex of tooth.values()) {
          const point = vertex.clone().applyMatrix4(transform), distance = surface.signedDistance(point, 0.005);
          report.surfaceChecks += 1; if (distance < -1e-7) report.penetratingSamples += 1;
          gap = Math.min(gap, distance); report.minimumGap = Math.min(report.minimumGap, distance);
        }
        report.maximumToothGap = Math.max(report.maximumToothGap, gap);
      }
    }
  }
  return report;
}
