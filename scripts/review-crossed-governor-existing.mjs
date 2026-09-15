import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGovernorMovement} from '../src/simulation/authored-governors.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredGovernorMovement({id: 170});
const blocks = model.root.userData.blocks;
const meshes = {crossPin:blocks.crossPivotPin,outputPin:blocks.outputCrossPin,collar:blocks.rotatingOutputCollarBody,clevis:blocks.valveRodClevis,
 leftArm:blocks.armAssemblies[0].longArm.children[0],rightArm:blocks.armAssemblies[1].longArm.children[0],
 leftLink:blocks.armAssemblies[0].shortLink.children[0],rightLink:blocks.armAssemblies[1].shortLink.children[0],
 leftWrist:blocks.armAssemblies[0].upperWristPin,rightWrist:blocks.armAssemblies[1].upperWristPin};
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const pairs = [['crossPin','leftArm'],['crossPin','rightArm'],['leftWrist','leftLink'],['rightWrist','rightLink'],['outputPin','leftLink'],['outputPin','rightLink'],['collar','clevis']];
const intersections = {};
let queries = 0;
try {
  for (let i = 0; i <= 96; i++) {
    const time = 8 * i / 96;
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
  const sources = ['scripts/review-crossed-governor-existing.mjs',
    'src/simulation/authored-governors.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 170, status: 'existing-contact-defects-confirmed', poses: 97,
    pairs, queries, intersections,
    period: 8,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Selected crossed-arm pin and rotating output interfaces only; not whole-assembly qualification.',
    sources,
  };
  fs.writeFileSync('docs/validation/170-existing-contact.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report);
} finally {
  disposeObject3D(model.root);
}
