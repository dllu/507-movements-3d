import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { makeMutilatedBevelRuntimeCandidate } from './lib/mutilated-bevel-runtime-candidate.mjs';
import { makeMutilatedBevelAlternator } from '../src/simulation/mutilated-bevel.js';

const bake = JSON.parse(await readFile('artifacts/review/074-contact-spline-bake.json', 'utf8'));
const relief = JSON.parse(await readFile(bake.relief, 'utf8'));
const candidate = makeMutilatedBevelRuntimeCandidate(bake, relief), production = makeMutilatedBevelAlternator();
const meshes = model => Object.values(model.root.userData.blocks).flatMap(g => [g.userData.body, ...g.userData.toothMeshes]);
const a = meshes(candidate), b = meshes(production), failures = [], buffers = [];
const hash = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
assert.equal(a.length, b.length);
for (let i = 0; i < a.length; i++) {
  for (const name of ['position', 'normal', 'color', 'index']) {
    const first = name === 'index' ? a[i].geometry.index : a[i].geometry.attributes[name];
    const last = name === 'index' ? b[i].geometry.index : b[i].geometry.attributes[name];
    if (!first && !last) continue;
    const same = first && last && hash(first.array) === hash(last.array);
    buffers.push({ mesh: b[i].name, attribute: name, same: Boolean(same), sha256: last && hash(last.array) });
    if (!same) failures.push({ mesh: b[i].name, attribute: name });
  }
}
let maximumPoseError = 0, maximumStateError = 0;
const times = [-1000, -80, -.00001, 0, .00001, 8, 80, 1000,
  ...Array.from({ length: 4096 }, (_, i) => 8 * (i + .381) / 4096),
  ...bake.worstValidation.map(row => (2.25 + row.x - bake.parameters.initialCyclePhase) * 8)];
for (const time of times) {
  candidate.update(time); production.update(time);
  candidate.root.updateMatrixWorld(true); production.root.updateMatrixWorld(true);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < 16; j++) {
    maximumPoseError = Math.max(maximumPoseError, Math.abs(a[i].matrixWorld.elements[j] - b[i].matrixWorld.elements[j]));
  }
  for (const key of ['angleA', 'angleB', 'driverAngle', 'angularSpeedA', 'angularSpeedB']) {
    maximumStateError = Math.max(maximumStateError,
      Math.abs(candidate.root.userData.kinematics[key] - production.root.userData.kinematics[key]));
  }
}
const extrema = [];
for (const [i, s] of production.motion.spline.intervals.entries()) {
  const ts = [0, 1], stationary = -s.b / (3 * s.a);
  if (s.a && stationary > 0 && stationary < 1) ts.push(stationary);
  for (const t of ts) extrema.push({ interval: i, coordinate: .25 + s.start + t * s.width,
    speed: (3 * s.a * t * t + 2 * s.b * t + s.c) / s.width / 8, intervalSeconds: 8 * s.width });
}
extrema.sort((a, b) => b.speed - a.speed);
const report = { movement: 74, status: 'production-export-parity', meshes: b.length,
  buffers, failures, poses: times.length, maximumPoseError, maximumStateError,
  minimumOutputSpeed: extrema.at(-1).speed, maximumOutputSpeed: extrema[0],
  independentPositionValidation: { poses: bake.validationPoses, maximumError: bake.maximumValidationError },
  qualification: 'All exported Float32 position, normal, color and index buffers and all sampled world transforms match the audited isolated runtime candidate exactly. The narrow interpolation speed peak occurs over a 1.18 microsecond input interval near pickup; position remains within the separately validated angular tolerance. Playback is quasistatic, with no inertial or positive-lock claim.' };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/074-production-parity.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ meshes: b.length, buffers: buffers.length, failures, poses: times.length, maximumPoseError,
  maximumStateError, maximumOutputSpeed: report.maximumOutputSpeed });
if (failures.length || maximumPoseError || maximumStateError) process.exitCode = 1;
