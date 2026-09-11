import * as THREE from 'three';
import { makeUniversalJoint } from '../../src/simulation/universal-joint.js';
import { solidSurface, surfacePoints } from './solid-surface.mjs';

export function probeUniversalJointContact(id, intervals = 128) {
  const model = makeUniversalJoint(id), blocks = model.root.userData.blocks, cache = new Map();
  const groups = Object.entries(blocks).filter(([, group]) => group).map(([name, group]) => {
    const parts = [];
    group.traverse((mesh) => {
      if (!mesh.geometry) return;
      if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
      const label = Object.entries(mesh.userData).filter(([, value]) => value === true).map(([key]) => key).join(',') || mesh.geometry.type;
      parts.push({ mesh, label, ...cache.get(mesh.geometry) });
    });
    return { name, parts };
  });
  const report = { movement: id, poses: intervals + 1, surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, witness: null, pairs: [] };
  for (let a = 0; a < groups.length; a += 1) for (let b = a + 1; b < groups.length; b += 1) {
    const pair = [groups[a], groups[b]], result = { pair: pair.map(({ name }) => name), surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0 };
    for (let pose = 0; pose <= intervals; pose += 1) {
      model.update(model.root.userData.geometry.cyclePeriod * pose / intervals); model.root.updateMatrixWorld(true);
      for (const [source, target] of [pair, [...pair].reverse()]) {
        for (const from of source.parts) for (const to of target.parts) {
          const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
          if (!from.surface.box.clone().applyMatrix4(transform).intersectsBox(to.surface.box)) continue;
          for (const local of from.points) {
            const point = local.clone().applyMatrix4(transform); result.surfaceChecks += 1;
            if (!to.surface.inside(point)) continue;
            const depth = to.surface.distance(point); if (depth <= 1e-6) continue;
            result.penetratingSamples += 1; result.maximumDepth = Math.max(result.maximumDepth, depth);
            if (depth > report.maximumDepth) {
              report.maximumDepth = depth;
              report.witness = { pose, source: source.name, target: target.name, sourcePart: from.label, targetPart: to.label,
                sourcePoint: local.toArray(), targetPoint: point.toArray(), worldPoint: local.clone().applyMatrix4(from.mesh.matrixWorld).toArray() };
            }
          }
        }
      }
    }
    report.pairs.push(result); report.surfaceChecks += result.surfaceChecks; report.penetratingSamples += result.penetratingSamples;
  }
  return report;
}
