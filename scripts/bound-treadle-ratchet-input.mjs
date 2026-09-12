import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetInput} from './lib/treadle-ratchet-input.mjs';
import {makeTreadleRatchetInputBounds} from './lib/treadle-ratchet-input-bounds.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-input-motion-bounds.json';
const candidate = makeTreadleRatchetCandidate({shortFaceFraction: .06}), u = candidate.root.userData;
const bounds = makeTreadleRatchetInputBounds(u.linkage), input = makeTreadleRatchetInput(u.linkage), count = 4096;
let maximumSpeedFraction = 0, maximumWrapSpeedFraction = 0;
for (let i = 0; i <= count; i++) {
  const time = u.linkage.parameters.period * i / count, k = input(time);
  for (const [j, q] of [k.frontAngle, k.rearAngle].entries()) {
    const range = j ? bounds.rearAngle : bounds.frontAngle;
    assert(q >= range[0] - 1e-12 && q <= range[1] + 1e-12);
    maximumSpeedFraction = Math.max(maximumSpeedFraction, Math.abs(k.treadleVelocity[j]) / bounds.treadleSpeed[j],
      Math.abs(k.pawls[j].armVelocity) / bounds.limbs[j].armSpeed);
  }
  if (i % 16 === 0) {
    const h = 1e-5, a = input(time - h).cable.points, b = input(time + h).cable.points;
    for (let j = 0; j < a.length; j++) {
      const speed = Math.hypot(...a[j].map((v, axis) => (b[j][axis] - v) / (2 * h)));
      maximumWrapSpeedFraction = Math.max(maximumWrapSpeedFraction, speed / bounds.strapPointSpeed);
    }
  }
}
assert(maximumSpeedFraction <= 1 + 1e-8 && maximumWrapSpeedFraction <= 1 + 1e-8);
const files = ['scripts/bound-treadle-ratchet-input.mjs', 'scripts/lib/treadle-ratchet-input-bounds.mjs',
  'scripts/lib/treadle-ratchet-input.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, passed: true, status: 'whole-stroke-input-velocity-bounds', productionChanged: false, mechanicsPassed: false,
  bounds, sampledCrossCheckPoses: count + 1, maximumSpeedFraction, maximumWrapSpeedFraction, sources,
  qualification: bounds.qualification + ' These are kinematic speed bounds for subsequent continuous clearance checks, not a completed collision certificate. Analytic bounds are additionally cross-checked at sampled poses.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'}); console.log({...report, sources: undefined});
