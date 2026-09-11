import { writeFile } from 'node:fs/promises';
import { makeSmallSingleToothCandidate } from './lib/small-single-tooth-candidate.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const model = makeSmallSingleToothCandidate(), p = model.motion.parameters;
const { driverPlate, wheelPlate } = model.root.userData.parts;
const data = [driverPlate, wheelPlate].map(mesh => ({ mesh,
  solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }));
const rows = [], overtravel = .001;
for (let tooth = 0; tooth < p.teeth; tooth++) for (const sign of [-1, 1]) {
  model.update(-p.initialInputPhase);
  const seat = (sign > 0 ? p.positiveSeat : p.negativeSeat) - tooth * p.pitch;
  const inspect = (angle, stopAtFirst) => {
    model.root.userData.blocks.output.rotation.z = angle; model.root.updateMatrixWorld(true);
    let checks = 0, inside = 0, maximumDepth = 0, witness = null;
    for (const [a, b] of [[data[0], data[1]], [data[1], data[0]]]) {
      const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const sample of a.points) {
        checks++; const point = sample.clone().applyMatrix4(transform);
        if (!b.solid.inside(point)) continue;
        const depth = b.solid.distance(point); if (depth <= 1e-6) continue;
        inside++; maximumDepth = Math.max(maximumDepth, depth);
        witness ??= { source: a.mesh.name, target: b.mesh.name, point: point.toArray(), depth };
        if (stopAtFirst) return { checks, inside, maximumDepth, witness };
      }
    }
    return { checks, inside, maximumDepth, witness };
  };
  rows.push({ tooth, sign, seat, allowed: inspect(seat, false), blocked: inspect(seat + sign * overtravel, true) });
}
const issues = rows.filter(row => row.allowed.inside || !row.blocked.inside);
const report = { movement: 69, status: 'isolated-locking-solid-audit', productionChanged: false,
  method: 'Both directions of actual Float32 plate vertices, edge midpoints and face centers, at both seated load directions for all thirty teeth. Valid seats must be clear to 1e-6; 0.001 radian of extra rotation into each locking flank must produce an actual penetrating witness. Independent contact-cone checks establish reaction direction.',
  fullAngularPlay: p.fullAngularPlay, overtravel, poses: rows.length,
  checks: rows.reduce((sum, row) => sum + row.allowed.checks + row.blocked.checks, 0), rows, issues };
await writeFile('artifacts/review/069-lock-event-locking.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: report.poses, checks: report.checks, issues: issues.length });
if (issues.length) process.exitCode = 1;
