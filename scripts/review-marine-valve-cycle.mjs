import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const model = createAuthoredMarineValveGearMovement({id: 171});
const data = model.root.userData;
const period = data.geometry.selectorPeriod;
const epsilon = 1e-4;
const matricesAt = time => {
  model.update(time);
  model.root.updateMatrixWorld(true);
  const values = [];
  model.root.traverse(object => {
    if (object.isMesh) values.push(...object.matrixWorld.elements);
  });
  assert.ok(values.length > 0 && values.every(Number.isFinite));
  return values;
};
try {
  const start = matricesAt(0), end = matricesAt(period);
  const before = matricesAt(period - epsilon), after = matricesAt(epsilon);
  let maximumPoseSeam = 0, maximumVelocitySeam = 0;
  for (let i = 0; i < start.length; i++) {
    maximumPoseSeam = Math.max(maximumPoseSeam, Math.abs(start[i] - end[i]));
    maximumVelocitySeam = Math.max(maximumVelocitySeam,
      Math.abs((end[i] - before[i]) / epsilon - (after[i] - start[i]) / epsilon));
  }
  assert.ok(maximumPoseSeam < 1e-10);
  // One-sided derivatives differ by O(epsilon); this catches a playback snap.
  assert.ok(maximumVelocitySeam < 1e-3);
  const initial = data.stateAtTime(0), geometry = data.geometry;
  const sourcePinErrors = [
    ['aheadLinkPin', geometry.sourceRasterAheadLinkPin],
    ['asternLinkPin', geometry.sourceRasterAsternLinkPin],
    ['diePoint', geometry.sourceRasterLinkDie],
  ].map(([name, raster]) => ({name, error: initial[name].distanceTo(data.sourcePointFromRaster(raster))}));
  assert.ok(sourcePinErrors.every(({error}) => error < 1e-10));
  const report = {movement: 171, period, crankPeriod: period / 3,
    meshes: start.length / 16, maximumPoseSeam, maximumVelocitySeam, epsilon, sourcePinErrors,
    scope: 'All visible mesh transforms at the cycle seam and three recorded initial source anchors. This does not qualify whole-contour fidelity or finite whole-assembly contact.',
    sources: ['scripts/review-marine-valve-cycle.mjs', 'src/simulation/authored-marine-valve-gears.js'].map(file =>
      ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
  fs.writeFileSync('docs/validation/171-cycle.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report);
} finally { disposeObject3D(model.root); }
