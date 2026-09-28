import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGabDisengagerMovement} from '../src/simulation/authored-gab-disengagers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

// Whole-assembly rendered-solid screen for the gab disengagers 186-189: every
// visible mesh against every mesh of another rigid body (the models declare
// their bodies in userData.rigidBodies), over one full cycle.
// Seated contacts (claw foot on the pin, strap end in notch a) are held at
// about 0.002 units; deeper samples are reported.
const seated = 0.0025;
const results = [];
for (const id of [186, 187, 188, 189]) {
  const model = createAuthoredGabDisengagerMovement({id}), bodies = model.root.userData.rigidBodies;
  assert.ok(Array.isArray(bodies) && bodies.length >= 3, `${id}: rigid bodies`);
  const parts = [];
  model.root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible || mesh.userData.cameraFitGuide || /invisible|envelope/.test(mesh.userData.role ?? '')) return;
    let parent = mesh;while (parent && !bodies.includes(parent)) parent = parent.parent;
    parts.push({mesh, family: parent ?? model.root, points: surfacePoints(mesh.geometry), surface: solidSurface(mesh.geometry)});
  });
  // 186's flat strap continues from the blade riveted to the rod: the two
  // meshes are one spring, joined at the blade end.
  // 188's leaf end is set in the handle head's hidden tab (pass 92).
  const joined = new Set(['spring-handle-riveted-blade|spring-handle-strap-and-loop',
    'leaf-spring-set-in-handle-head|loop-handle-head-tab-carrying-leaf-end-behind-diagonal']);
  const pairs = parts.flatMap((a, i) => parts.slice(i + 1).filter(b => a.family !== b.family
    && !joined.has([a, b].map(part => part.mesh.userData.role).sort().join('|'))).map(b => [a, b]));
  const intersections = {};let queries = 0;
  const period = model.root.userData.geometry.cyclePeriod;
  try {
    for (let frame = 0; frame <= 128; frame++) {
      model.update(frame * period / 128);model.root.updateMatrixWorld(true);
      for (const part of parts) part.box = new THREE.Box3().setFromObject(part.mesh);
      for (const [a, b] of pairs) {
        if (!a.box.intersectsBox(b.box)) continue;
        for (const [from, to] of [[a, b], [b, a]]) {
          const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
          for (const sample of from.points) {
            queries++;const point = sample.clone().applyMatrix4(transform);
            if (!to.surface.inside(point)) continue;
            const depth = to.surface.distance(point);
            if (depth < seated) continue;
            const key = [a, b].map(part => part.mesh.userData.role ?? part.mesh.name ?? 'part').join('/');
            if (depth > (intersections[key]?.depth ?? 0) + 1e-6) intersections[key] = {depth, phase: frame / 128};
          }
        }
      }
    }
    results.push({id, poses: 129, bodies: bodies.length, meshes: parts.length, pairs: pairs.length, queries, intersections});
  } finally {disposeObject3D(model.root);}
}
const sources = ['scripts/review-gab-cam-solids.mjs', 'src/simulation/authored-gab-disengagers.js',
  ...[186, 187, 188, 189].map(id => `src/simulation/gab-disengager-${id}.js`), 'tests/helpers/solid-surface.mjs'];
const report = {
  status: results.every(result => !Object.keys(result.intersections).length) ? 'sampled-assembly-clear' : 'intersections-detected',
  scope: 'Movements 186-189: every visible mesh against every mesh of another declared rigid body over 129 poses of one cycle; penetrations under 0.0025 units (seated contact) are ignored, the 186 strap and its riveted blade are one joined spring, and the 188 leaf is set in the handle head tab. Sampled rendered-solid evidence, not continuous collision proof.',
  method: 'Bidirectional triangle vertices, edge midpoints and centroids against independent surface-containment BVHs, with bounding-box rejection.',
  sources: sources.map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')})), results,
};
fs.writeFileSync('docs/validation/186-187-cam-solids.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({id: r.id, meshes: r.meshes, pairs: r.pairs, intersections: r.intersections}))));
assert.equal(report.status, 'sampled-assembly-clear');
