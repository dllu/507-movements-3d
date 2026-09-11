import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

// Historical baseline for the pre-rebuild 052 factory. Check actual mesh
// skins inside the axial overlap, where a loaded stud must touch a hole wall.
const catalog = JSON.parse(await readFile('src/data/movements.json'));
const model = createMovementModel(catalog.movements[51]);
const { blocks: b, geometry: p, stateAtTime } = model.root.userData;
model.root.traverse((part) => { if (part.material) part.material.side = THREE.DoubleSide; });
const ray = new THREE.Raycaster();
const report = { movement: 52, poses: 129, bearingRays: 0, minimumWallGap: Infinity,
  maximumWallGap: 0, minimumDiskFaceGap: Infinity, reportedTorqueTransmission: [],
  interpretation: 'The old locked state centers each stud in an oversized hole. Positive clearance around every sampled stud leaves no driving wall contact.' };
for (let pose = 0; pose < report.poses; pose += 1) {
  const phase = p.insertedPhase + (p.withdrawalStartPhase - p.insertedPhase) * (pose + 0.371) / report.poses;
  const time = p.cyclePeriod * phase, state = stateAtTime(time);
  assert.equal(state.locked, true); assert.ok(state.insertionDepth > 0);
  model.update(time); model.root.updateMatrixWorld(true);
  report.minimumDiskFaceGap = Math.min(report.minimumDiskFaceGap, state.bodyGap);
  if (!report.reportedTorqueTransmission.includes(state.torqueTransmission)) report.reportedTorqueTransmission.push(state.torqueTransmission);
  const axial = (Math.max(p.studBaseX, state.outputBodyLeftX) + Math.min(p.studTipX, state.outputBodyRightX)) / 2;
  for (const [index, center] of state.studCenters.entries()) {
    const origin = center.clone(); origin.x = axial;
    for (let sample = 0; sample < 32; sample += 1) {
      const angle = 2 * Math.PI * (sample + 0.219) / 32;
      const direction = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
      ray.set(origin, direction);
      const wall = ray.intersectObject(b.outputDisk, false)[0], pin = ray.intersectObject(b.studs[index], false)[0];
      assert.ok(wall && pin, 'ray reaches both actual skins within the insertion depth');
      const gap = wall.distance - pin.distance;
      report.minimumWallGap = Math.min(report.minimumWallGap, gap);
      report.maximumWallGap = Math.max(report.maximumWallGap, gap); report.bearingRays += 1;
    }
  }
}
await writeFile('artifacts/review/052-contact-baseline.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
