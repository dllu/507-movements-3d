import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGrooveDrumMovement} from '../src/simulation/authored-groove-drums.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model = createAuthoredGrooveDrumMovement({id: 167});
const blocks = model.root.userData.blocks;
const meshes = {
  studTip: blocks.studTip,
  drum: blocks.drum,
  grooveTrack: blocks.grooveTrack,
  guideSleeve: blocks.guideSleeve,
  guideRail: blocks.guideRail,
  shaft: blocks.outputShaft,
  lowerBearing: blocks.shaftBearings[0],
  upperBearing: blocks.shaftBearings[1],
};
const parts = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) =>
  [name, {mesh, surface: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}]));
const pairs = [
  ['studTip', 'drum'], ['studTip', 'grooveTrack'],
  ['guideSleeve', 'guideRail'], ['shaft', 'lowerBearing'], ['shaft', 'upperBearing'],
];
const intersections = {};
let queries = 0, maximumReportedCenterError = 0;
try {
  for (let i = 0; i <= 96; i++) {
    const time = model.root.userData.geometry.inputCyclePeriod * i / 96;
    model.update(time);
    model.root.updateMatrixWorld(true);
    maximumReportedCenterError = Math.max(maximumReportedCenterError,
      model.root.userData.kinematics.surfacePointError);
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
  const sources = ['scripts/review-groove-drum-existing.mjs',
    'src/simulation/authored-groove-drums.js', 'tests/helpers/solid-surface.mjs']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {
    movement: 167, status: 'existing-contact-defects-confirmed', poses: 97,
    pairs, queries, intersections, maximumReportedCenterError,
    period: model.root.userData.geometry.inputCyclePeriod,
    method: 'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Selected follower, guide and shaft interfaces only; not whole-assembly qualification.',
    sources,
  };
  fs.writeFileSync('docs/validation/167-existing-contact.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report);
} finally {
  disposeObject3D(model.root);
}
