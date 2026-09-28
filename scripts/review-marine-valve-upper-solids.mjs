import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredMarineValveGearMovement({id: 171});
const blocks = model.root.userData.blocks;
const meshes = {plate:blocks.upperLinkPlate, die:blocks.dieBody, diePin:blocks.diePin, aheadPin:blocks.linkPinAssemblies[0].children.at(-1), asternPin:blocks.linkPinAssemblies[1].children.at(-1), reachPin:blocks.reachLug.children[1]};
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const pairs = [['die','plate'],['diePin','plate'],['diePin','die'],['aheadPin','plate'],['asternPin','plate'],['reachPin','plate']];
const intersections = {};
let queries = 0;
try {
  for (let i = 0; i <= 96; i++) {
    const time = 18 * i / 96;
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const mesh of Object.values(meshes)) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
    const plateBox = new THREE.Box3().setFromObject(meshes.plate);
    for (const name of ['diePin', 'aheadPin', 'asternPin', 'reachPin']) {
      const pinBox = new THREE.Box3().setFromObject(meshes[name]);
      assert.ok(Math.min(pinBox.max.z, plateBox.max.z) - Math.max(pinBox.min.z, plateBox.min.z) > .15,
        name + ' must span the plate axially');
    }
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
  const sources = ['scripts/review-marine-valve-upper-solids.mjs',
    'src/simulation/authored-marine-valve-gears.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 171, status: 'repaired-upper-slot-interface-diagnostic', poses: 97,
    pairs, queries, intersections,
    sampledDuration: 18,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Selected upper-slot die, pivot pins and bored plate interfaces only; not whole-assembly qualification.',
    sources,
  };
  fs.writeFileSync('docs/validation/171-upper-clearance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report); assert.ok(queries > 0); assert.equal(Object.keys(intersections).length, 0);
} finally {
  disposeObject3D(model.root);
}
