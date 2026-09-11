import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

// Preserve baseline failures independently of the existing kinematic tests.
// Only closed individual target solids certify penetration. Open tube ends
// are excluded as targets, but their actual skins remain source samples.
const catalog = JSON.parse(await readFile('src/data/movements.json'));
for (const id of [50, 51]) {
  const model = createMovementModel(catalog.movements[id - 1]), b = model.root.userData.blocks;
  const pairs = id === 50 ? [
    ['inputYoke', 'leftIntermediateYoke'], ['rightIntermediateYoke', 'outputYoke'],
    ['inputYoke', 'leftSpider'], ['leftIntermediateYoke', 'leftSpider'],
    ['rightIntermediateYoke', 'rightSpider'], ['outputYoke', 'rightSpider'],
  ] : [['inputYoke', 'outputYoke'], ['inputYoke', 'trunnionRing'], ['outputYoke', 'trunnionRing']];
  const cache = new Map(), parts = new Map();
  for (const name of new Set(pairs.flat())) {
    const list = [];
    b[name].traverse((mesh) => {
      if (!mesh.geometry) return;
      if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, {
        points: surfacePoints(mesh.geometry), surface: solidSurface(mesh.geometry),
      });
      list.push({ mesh, ...cache.get(mesh.geometry),
        label: Object.entries(mesh.userData).filter(([, value]) => value === true || typeof value === 'string')
          .map(([key, value]) => value === true ? key : `${key}:${value}`).join(',') || mesh.geometry.type,
        closed: mesh.geometry.type !== 'TubeGeometry' });
    });
    parts.set(name, list);
  }
  const report = { movement: id, status: 'baseline-contact-review', poses: 65,
    explanation: 'Actual source vertices, triangle centers and edge midpoints tested against closed target solids. Open yoke tubes are excluded as targets. Intended rigid connections within one member are not compared.',
    surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, witness: null, pairs: [] };
  for (const pair of pairs) {
    const result = { pair, surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0 };
    for (let pose = 0; pose <= 64; pose += 1) {
      model.update(model.root.userData.animationTiming.authoredCyclePeriod * pose / 64);
      model.root.updateMatrixWorld(true);
      for (const [source, target] of [pair, [...pair].reverse()]) {
        for (const from of parts.get(source)) for (const to of parts.get(target)) {
          if (!to.closed) continue;
          const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
          const sourceBounds = from.surface.box.clone().applyMatrix4(transform);
          if (!sourceBounds.intersectsBox(to.surface.box)) continue;
          for (const local of from.points) {
            const point = local.clone().applyMatrix4(transform); result.surfaceChecks += 1;
            if (!to.surface.inside(point)) continue;
            const depth = to.surface.distance(point);
            if (depth <= 1e-6) continue;
            result.penetratingSamples += 1;
            result.maximumDepth = Math.max(result.maximumDepth, depth);
            if (depth > report.maximumDepth) {
              report.maximumDepth = depth;
              report.witness = { pose, source, target, sourcePart: from.label, targetPart: to.label,
                sourcePoint: local.toArray(), targetPoint: point.toArray(),
                worldPoint: local.clone().applyMatrix4(from.mesh.matrixWorld).toArray() };
            }
          }
        }
      }
    }
    report.pairs.push(result); report.surfaceChecks += result.surfaceChecks;
    report.penetratingSamples += result.penetratingSamples;
  }
  await writeFile(`artifacts/review/${String(id).padStart(3, '0')}-contact-baseline.json`, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report) + '\n');
}
