import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredMarineValveGearMovement({id: 171});
const blocks = model.root.userData.blocks;
const meshes = {aheadRod:blocks.aheadStrap.children[0], asternRod:blocks.asternStrap.children[0],
  aheadSheave:blocks.aheadSheave.userData.body, asternSheave:blocks.asternSheave.userData.body,
  aheadRim:blocks.aheadSheave.userData.rim, asternRim:blocks.asternSheave.userData.rim,
  aheadPin:blocks.linkPinAssemblies[0].children.at(-1), asternPin:blocks.linkPinAssemblies[1].children.at(-1),
  aheadCap:blocks.linkPinAssemblies[0].children[0], asternCap:blocks.linkPinAssemblies[1].children[0],
  plate:blocks.upperLinkPlate, outputRod:blocks.outputRadiusRod.children[0]};
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const pairs = [['aheadRod','asternRod'], ...['aheadRod','asternRod'].flatMap(rod =>
  Object.keys(meshes).filter(name => !name.endsWith('Rod') || name === 'outputRod').map(name => [rod,name]))];
const intersections = {};
let queries = 0;
try {
  for (let i = 0; i <= 96; i++) {
    const time = 18 * i / 96;
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const mesh of Object.values(meshes)) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
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
  const sources = ['scripts/review-marine-valve-eccentric-solids.mjs',
    'src/simulation/authored-marine-valve-gears.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 171, status: 'repaired-eccentric-interface-diagnostic', poses: 97,
    pairs, queries, intersections,
    sampledDuration: 18,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Selected eccentric rods, sheaves, rims, rod-end pins/caps, upper plate and output rod only; not whole-assembly qualification.',
    sources,
  };
  fs.writeFileSync('docs/validation/171-eccentric-clearance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report); assert.ok(queries > 0); assert.equal(Object.keys(intersections).length, 0);
} finally {
  disposeObject3D(model.root);
}
