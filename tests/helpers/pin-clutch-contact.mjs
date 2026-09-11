import * as THREE from 'three';
import { makePinClutch } from '../../src/simulation/pin-clutch.js';
import { solidSurface, surfacePoints } from './solid-surface.mjs';

export function probePinClutchContact(intervals = 128) {
  const model = makePinClutch(), p = model.root.userData.geometry, cache = new Map();
  const times = Array.from({ length: intervals + 1 }, (_, i) => p.cyclePeriod * i / intervals);
  // Uniform cycle sampling misses the short initial entry and take-up.
  for (let i = 0; i <= 32; i += 1) times.push(p.entryTime + (p.lockTime - p.entryTime) * (i + 0.173) / 33);
  for (let i = 0; i <= 16; i += 1) times.push(p.releaseTime + (i - 8 + 0.231) * 0.00001);
  const groups = Object.entries(model.root.userData.blocks).map(([name, group]) => {
    const parts = [];
    group.traverse((mesh) => {
      if (!mesh.geometry) return;
      if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
      parts.push({ mesh, ...cache.get(mesh.geometry) });
    }); return { name, parts };
  });
  const report = { movement: 52, poses: times.length, surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, witness: null, pairs: [] };
  for (let a = 0; a < groups.length; a += 1) for (let b = a + 1; b < groups.length; b += 1) {
    const pair = [groups[a], groups[b]], result = { pair: pair.map(({ name }) => name), surfaceChecks: 0, penetratingSamples: 0 };
    for (const time of times) {
      model.update(time); model.root.updateMatrixWorld(true);
      for (const [source, target] of [pair, [...pair].reverse()]) for (const from of source.parts) for (const to of target.parts) {
        const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
        if (!from.surface.box.clone().applyMatrix4(transform).intersectsBox(to.surface.box)) continue;
        for (const local of from.points) {
          const point = local.clone().applyMatrix4(transform); result.surfaceChecks += 1;
          if (!to.surface.inside(point)) continue;
          const depth = to.surface.distance(point); if (depth <= 1e-6) continue;
          result.penetratingSamples += 1;
          if (depth > report.maximumDepth) {
            report.maximumDepth = depth; report.witness = { time, source: source.name, target: target.name,
              sourceType: from.mesh.geometry.type, targetType: to.mesh.geometry.type,
              worldPoint: local.clone().applyMatrix4(from.mesh.matrixWorld).toArray() };
          }
        }
      }
    }
    report.pairs.push(result); report.surfaceChecks += result.surfaceChecks; report.penetratingSamples += result.penetratingSamples;
  }
  return report;
}
