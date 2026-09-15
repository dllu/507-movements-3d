import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredMarineValveGearMovement({id: 171});
const blocks = model.root.userData.blocks;
const meshes = {}, families = {}, assigned = new Set();
for (const [family, names] of Object.entries({
  shaft:['inputRotor'], ahead:['aheadStrap'], astern:['asternStrap'],
  link:['linkGroup'], die:['dieBlock'], output:['outputRadiusRod'],
  slide:['curvedSlide'], follower:['followerPin'],
  fixed:['dieGuide','trunnionFace','trunnionShaft','slideGuidePosts'],
  reach:['reversingReachRod'],
})) for(const name of names) for(const [j,root] of [blocks[name]].flat().entries()) {
  let index=0;
  root.traverse(mesh=>{if(mesh.isMesh){
    assert.ok(!assigned.has(mesh));assigned.add(mesh);
    const key=name+'/'+j+'/'+index++;meshes[key]=mesh;families[key]=family;
  }});
}
model.root.traverse(mesh=>{if(mesh.isMesh && mesh!==blocks.cameraEnvelope)assert.ok(assigned.has(mesh),'unclassified physical mesh');});
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const names=Object.keys(meshes),pairs=[];
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)
  if(families[names[i]]!==families[names[j]])pairs.push([names[i],names[j]]);
const intersections = {};
let queries = 0;
try {
  for (let i = 0; i <= 128; i++) {
    const time = 18 * i / 128;
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const mesh of Object.values(meshes)) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
    const tailBounds = new THREE.Box3().setFromObject(blocks.outputRadiusRod);
    const guideBounds = new THREE.Box3().setFromObject(blocks.dieGuide);
    assert.ok(tailBounds.max.y > guideBounds.max.y && tailBounds.min.y < guideBounds.min.y,
      'central tail must remain through its guide throughout playback');
    for(let side=0;side<2;side++) {
      const post = new THREE.Box3().setFromObject(blocks.slideGuidePosts[side]);
      const block = new THREE.Box3().setFromObject(blocks.slideBlocks[side]);
      assert.ok(post.max.y > block.max.y && post.min.y < block.min.y,
        'lower guide post must span its moving block');
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
  const sources = ['scripts/review-marine-valve-all-solids.mjs',
    'src/simulation/authored-marine-valve-gears.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 171, status: 'whole-assembly-sampled-clearance', poses: 129,
    meshes:names.length, families, pairCount:pairs.length, queries, intersections,
    sampledDuration: 18,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Every cross-rigid-family mesh pair; same rigid-part unions and the non-rendering camera envelope excluded. Sampling does not prove continuous clearance.',
    sources,
  };
  fs.writeFileSync('docs/validation/171-all-clearance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report); assert.ok(queries > 0); assert.equal(Object.keys(intersections).length, 0);
} finally {
  disposeObject3D(model.root);
}
