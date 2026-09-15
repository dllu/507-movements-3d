import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredMarineValveGearMovement({id: 171});
const blocks = model.root.userData.blocks;
const meshes = {follower:blocks.followerPin,innerRail:blocks.lowerInnerRail,outerRail:blocks.lowerOuterRail,leftGuide:blocks.slideGuidePosts[0],rightGuide:blocks.slideGuidePosts[1],leftBlock:blocks.slideBlocks[0],rightBlock:blocks.slideBlocks[1],slidePin:blocks.slideEyePin,outputRod:blocks.outputRadiusRod.children[0]};
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const pairs = [['follower','innerRail'],['follower','outerRail'],['leftGuide','leftBlock'],['rightGuide','rightBlock'],['slidePin','outputRod']];
const intersections = {};
let queries = 0;
try {
  for (let i = 0; i <= 96; i++) {
    const time = 18 * i / 96;
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const [a, b] of pairs) for (const [from, to] of [[a, b], [b, a]]) {
      const p = parts[from], q = parts[to];
      if (!new THREE.Box3().setFromObject(p.mesh).intersectsBox(new THREE.Box3().setFromObject(q.mesh))) continue;
      const matrix = q.mesh.matrixWorld.clone().invert().multiply(p.mesh.matrixWorld);
      for (const sample of p.points) {
        const point = sample.clone().applyMatrix4(matrix);
        queries++;
        if (!q.surface.inside(point)) continue;
        const depth = q.surface.distance(point);
        if (depth <= 1e-6) continue;
        const key = a + '/' + b;
        const entry = intersections[key] ?? {firstTime: time, maximumDepth: 0, samples: 0};
        entry.maximumDepth = Math.max(entry.maximumDepth, depth);
        entry.samples++;
        intersections[key] = entry;
      }
    }
  }
  const sources = ['scripts/review-marine-valve-existing.mjs',
    'src/simulation/authored-marine-valve-gears.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 171, status: 'existing-contact-defects-confirmed', poses: 97,
    pairs, queries, intersections,
    sampledDuration: 18,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Selected lower-slot, slide guide and connecting-pin interfaces only; not whole-assembly qualification.',
    sources,
  };
  fs.writeFileSync('docs/validation/171-existing-contact.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report);
} finally {
  disposeObject3D(model.root);
}
