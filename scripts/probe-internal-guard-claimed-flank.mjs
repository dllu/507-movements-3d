import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[70]), { geometry: p, blocks, stateAtTime } = model.root.userData;
const geometry = blocks.tappet.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
geometry.computeBoundingBox(); const faceY = geometry.boundingBox.min.y, faces = [];
for (let i = 0; i < positions.count; i += 3) {
  const ids = [i, i + 1, i + 2];
  if (ids.every(j => Math.abs(positions.getY(j) - faceY) < 1e-7) && ids.every(j => normals.getY(j) < -.999)) {
    faces.push(ids.map(j => [positions.getX(j), positions.getY(j), positions.getZ(j)]));
  }
}
if (!faces.length) throw new Error('Actual lower flank not found');
const rows = [];
for (let i = 0; i <= 96; i++) {
  const phase = p.contactStartPhase + (p.contactEndPhase - p.contactStartPhase) * i / 96;
  const time = (phase - p.initialCyclePhase) * p.driverCyclePeriod;
  model.update(time); model.root.updateMatrixWorld(true); const state = stateAtTime(time);
  const force = new THREE.Vector3(0, -1, 0).transformDirection(blocks.tappet.matrixWorld);
  const point = new THREE.Vector3(state.tappetContactProjection, faceY, 0).applyMatrix4(blocks.tappet.matrixWorld);
  const output = point.clone().sub(p.drivenCenter), input = point.clone().sub(p.driverCenter);
  const outputMoment = output.x * force.y - output.y * force.x;
  const inputMoment = input.x * force.y - input.y * force.x;
  rows.push({ time, phase, angle: state.driverAngle, outputSpeed: state.drivenAngularSpeed,
    force: force.toArray(), actualFlankPoint: point.toArray(), declaredPoint: state.tappetFaceContactPoint.toArray(),
    outputMoment, inputMoment, drivesClockwiseOutput: outputMoment < 0,
    motorDoesPositiveWork: inputMoment * p.driverAngularSpeed > 0 });
}
const report = { movement: 71, status: 'claimed-flank-force-diagnosis', productionChanged: false,
  method: 'Recover the actual straight lower flank from Float32 side triangles and outward normals. Project each declared contact along the nominal normal to this physical face. A compressive force from that face would exert the reported signed moments; this does not assume the declared point is an actual contact, and does not solve alternative contacts. Clockwise output torque and positive counterclockwise motor work are required under a resisting load.',
  nominalFaceY: -p.tappetHalfWidth, actualFaceY: faceY, bevelExpansion: -p.tappetHalfWidth - faceY,
  actualFlankTriangles: faces, poses: rows.length,
  wrongOutputMoment: rows.filter(row => !row.drivesClockwiseOutput).length,
  negativeMotorWork: rows.filter(row => !row.motorDoesPositiveWork).length, rows };
await writeFile('artifacts/review/071-claimed-contact-force-baseline.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: report.poses, wrongOutputMoment: report.wrongOutputMoment, negativeMotorWork: report.negativeMotorWork,
  bevelExpansion: report.bevelExpansion, first: rows[0], last: rows.at(-1) });
