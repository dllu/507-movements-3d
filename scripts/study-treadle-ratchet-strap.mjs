import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetInput} from './lib/treadle-ratchet-input.mjs';
import {rotate} from '../src/simulation/finite-plate-geometry.js';
const candidate = makeTreadleRatchetCandidate({shortFaceFraction: .06}), u = candidate.root.userData;
const input = makeTreadleRatchetInput(u.linkage), p = u.linkage.parameters, initial = input(0), scale = u.geometry.source.scale;
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-strap-kinematics.json';
const rows = [], count = 4096, dt = p.period / count;
let axialSpeed = 0, circumferentialSlip = 0, materialSpeedError = 0, lengthRateError = 0, maximumAngleError = 0, absoluteCircumferentialSlip = 0;
let previousMaximumSlip = 0, angleMinimum = Infinity, angleMaximum = -Infinity;
for (let i = 0; i <= count; i++) {
  const time = i * dt, k = input(time), f = rotate(p.strapLocal, k.frontAngle), r = rotate(p.strapLocal, k.rearAngle);
  const fxv = -f[1] * k.treadleVelocity[0], rxv = -r[1] * k.treadleVelocity[1];
  const frontRate = -f[0] * k.treadleVelocity[0], rearRate = -r[0] * k.treadleVelocity[1];
  const transverseRate = frontRate + rearRate, dxRate = rxv - fxv, T = k.cable.transverseLength, L = k.cable.length;
  const angle = (k.cable.frontLength - k.cable.rearLength - initial.cable.frontLength + initial.cable.rearLength) / (2 * p.radius);
  const omega = (frontRate - rearRate) / (2 * p.radius);
  angleMinimum = Math.min(angleMinimum, angle); angleMaximum = Math.max(angleMaximum, angle);
  lengthRateError = Math.max(lengthRateError, Math.abs((T * transverseRate + k.cable.dx * dxRate) / L));
  let maximumSlip = 0;
  for (let j = 0; j <= 32; j++) {
    const phi = Math.PI * j / 32, material = (k.cable.frontLength + p.radius * phi) / T;
    const vx = fxv + dxRate * material, circumferential = transverseRate * material - frontRate;
    const slip = circumferential + omega * p.radius;
    axialSpeed = Math.max(axialSpeed, Math.abs(vx)); maximumSlip = Math.max(maximumSlip, Math.abs(slip));
    // Check the velocity of a fixed neutral-fiber material label, not a
    // moving sampling point on the pulley. All samples lie in the wrap;
    // extrapolating its smooth expression at the endpoints checks that side.
    const h = 1e-5, at = t => {
      const c = input(t).cable, theta = (c.transverseLength * material - c.frontLength) / p.radius;
      return [c.front[0] + c.dx * material, p.pulley[1] + p.radius * Math.sin(theta), p.radius * Math.cos(theta)];
    };
    if (i % 128 === 0) {
      const a = at(time - h), b = at(time + h), exact = [vx, circumferential * Math.cos(phi), -circumferential * Math.sin(phi)];
      materialSpeedError = Math.max(materialSpeedError, ...exact.map((v, axis) => Math.abs((b[axis] - a[axis]) / (2 * h) - v)));
    }
  }
  circumferentialSlip = Math.max(circumferentialSlip, maximumSlip);
  if (i) absoluteCircumferentialSlip += .5 * (maximumSlip + previousMaximumSlip) * dt;
  previousMaximumSlip = maximumSlip;
  if (i % 128 === 0) {
    const h = 1e-5, atAngle = t => {
      const c = input(t).cable;
      return (c.frontLength - c.rearLength - initial.cable.frontLength + initial.cable.rearLength) / (2 * p.radius);
    };
    maximumAngleError = Math.max(maximumAngleError, Math.abs((atAngle(time + h) - atAngle(time - h)) / (2 * h) - omega));
    rows.push({time, angle, omega, contactX: k.cable.contactX, maximumCircumferentialSlip: maximumSlip});
  }
}
const files = ['scripts/study-treadle-ratchet-strap.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-input.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, status: 'strap-material-velocity-and-rolling-approximation', productionChanged: false, mechanicsPassed: false,
  passed: lengthRateError < 1e-12 && materialSpeedError < 1e-7 && maximumAngleError < 1e-7,
  poses: count + 1, angleRange: [angleMinimum, angleMaximum], lengthRateError, materialSpeedError, maximumAngleError,
  axialSpeedPixelsPerSecond: axialSpeed * scale, maximumCircumferentialSlipPixelsPerSecond: circumferentialSlip * scale,
  integratedMaximumCircumferentialSlipPixels: absoluteCircumferentialSlip * scale, rows, sources,
  qualification: 'Analytic neutral-fiber velocities on the geodesic wrap and a periodic pulley angle from half the difference of leg lengths. This angle is a rolling approximation: axial creep and the measured circumferential residual remain. No no-slip, friction law, pulley inertia or traction proof is claimed. Slip extrema are sampled, not continuous certified bounds.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, rows: undefined, sources: undefined});
if (!report.passed) process.exitCode = 1;
