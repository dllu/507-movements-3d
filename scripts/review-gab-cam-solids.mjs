import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGabDisengagerMovement} from '../src/simulation/authored-gab-disengagers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const results = [];
for (const id of [186, 187]) {
  const model = createAuthoredGabDisengagerMovement({id}), b = model.root.userData.blocks;
  const cam = b.camLever ?? b.upperCamHandle;
  const moving = [cam, b.eccentricRod, b.valveRocker], parts = [];
  model.root.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.cameraFitGuide || /visible-|white-|index/.test(mesh.userData.role ?? '')) return;
    let parent = mesh;while (parent && !moving.includes(parent)) parent = parent.parent;
    parts.push({mesh, family: parent ?? model.root, points: surfacePoints(mesh.geometry), surface: solidSurface(mesh.geometry)});
  });
  const changed = new Set([b.camContactNose, b.camToeNeck, b.camLeverBody ?? b.upperCamBody, ...b.camSupportShoe.children]);
  assert.ok([...changed].every(Boolean));
  const pairs = parts.flatMap((a, i) => parts.slice(i + 1)
    .filter(b => a.family !== b.family && (changed.has(a.mesh) || changed.has(b.mesh))).map(b => [a, b]));
  const intersections = {};let queries = 0;
  try {
    for (let frame = 0; frame <= 128; frame++) {
      model.update(frame * model.root.userData.geometry.cyclePeriod / 128);model.root.updateMatrixWorld(true);
      for (const part of parts) part.box = new THREE.Box3().setFromObject(part.mesh);
      for (const [a, b] of pairs) {
        if (!a.box.intersectsBox(b.box)) continue;
        for (const [from, to] of [[a, b], [b, a]]) {
          const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
          for (const sample of from.points) {
            queries++;const point = sample.clone().applyMatrix4(transform);
            if (!to.surface.inside(point)) continue;
            const depth = to.surface.distance(point);
            const key = [a, b].map(part => part.mesh.userData.role ?? part.mesh.parent.userData.role ?? 'part').join('/');
            if (depth > (intersections[key]?.depth ?? 0) + 1e-6) intersections[key] = {depth, phase: frame / 128};
          }
        }
      }
    }
    results.push({id, poses: 129, meshes: parts.length, pairs: pairs.length, queries, intersections});
  } finally {disposeObject3D(model.root);}
}
const sources = ['scripts/review-gab-cam-solids.mjs', 'src/simulation/authored-gab-disengagers.js', 'tests/helpers/solid-surface.mjs'];
const report = {
  status: results.every(result => !Object.keys(result.intersections).length) ? 'sampled-contact-neighborhood-clear' : 'intersections-detected',
  scope: 'Corrected cam toe, axial neck, handle plate and shoulder against every other rigid family. Same-body joins, indices and floating markers excluded. This is sampled rendered-solid evidence, not whole-assembly or continuous collision proof.',
  method: 'Bidirectional triangle vertices, edge midpoints and centroids against independent surface-containment BVHs, with bounding-box rejection. The toe tangency test separately verifies finite axial overlap and rejects missing contact.',
  sources: sources.map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')})), results,
};
fs.writeFileSync('docs/validation/186-187-cam-solids.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
assert.equal(report.status, 'sampled-contact-neighborhood-clear');
