import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import profile from './lib/small-single-tooth-balanced-profile.mjs';
import { makeSmallSingleToothCandidate } from './lib/small-single-tooth-candidate.mjs';
import { extrudedPlateContour } from './lib/extruded-plate-contour.mjs';

const model = makeSmallSingleToothCandidate({ profile }), p = profile.parameters;
const driver = extrudedPlateContour(model.root.userData.parts.driverPlate.geometry);
const wheel = extrudedPlateContour(model.root.userData.parts.wheelPlate.geometry);
const lower = profile.driver[0][0].map(Math.fround);
if (!driver.some(point => point[0] === lower[0] && point[1] === lower[1])) throw new Error('Missing rim/relief junction');
const targetQ = p.initialQ - p.advancePerCycle, beta = Math.atan2(lower[1], lower[0]);
const candidates = [];
for (const point of wheel) {
  const x = point[0] * Math.cos(targetQ) - point[1] * Math.sin(targetQ) - p.centerDistance;
  const y = point[0] * Math.sin(targetQ) + point[1] * Math.cos(targetQ);
  if (Math.abs(Math.hypot(x, y) - p.driverRadius) > 1e-6) continue;
  let angle = Math.atan2(y, x) - beta; while (angle < 0) angle += p.period;
  if (Math.abs(angle - p.exitAngle) < .01) candidates.push({ angle, point, radius: Math.hypot(x, y) });
}
if (candidates.length !== 1) throw new Error('Ambiguous final lock contact');
const event = candidates[0], original = profile.motion;
const motion = original.filter(row => row[0] < event.angle);
if (motion.at(-1)[1] > p.advancePerCycle) throw new Error('Lock endpoint would reverse output');
motion.push([event.angle, p.advancePerCycle]);
for (const row of original) if (row[0] > event.angle) motion.push([row[0], p.advancePerCycle]);
const result = { ...profile, motion, parameters: { ...p, exitAngle: event.angle,
  originalProjectionCycleClosureError: p.cycleClosureError, cycleClosureError: 0 } };
await writeFile('scripts/lib/small-single-tooth-lock-event-profile.mjs', '// Same Brown-profile geometry; final seating uses the actual Float32 rim-junction contact event.\nexport default '
  + JSON.stringify(result) + ';\n', { flag: 'wx' });
await writeFile('artifacts/review/069-final-lock-event.json', JSON.stringify({ movement: 69, status: 'derived-lock-event',
  method: 'At the exact repeatable wheel seat, match the lower rim/relief junction to the adjacent wheel tip using their actual Float32 mesh coordinates. Replace the interpolated terminal half-step and later numerical drift with that continuous endpoint and a constant locked output.',
  source: 'scripts/lib/small-single-tooth-balanced-profile.mjs',
  sourceSha256: createHash('sha256').update(await readFile('scripts/lib/small-single-tooth-balanced-profile.mjs')).digest('hex'),
  event, lowerRimJunction: lower, targetQ, advancePerCycle: p.advancePerCycle,
  previousRow: motion[motion.findIndex(row => row[0] === event.angle) - 1],
  removedClosureResidual: p.cycleClosureError, motionRows: motion.length,
  qualification: 'Circle locking and engagement impacts remain idealized. Full revised-motion clearance and contact-force audits are required.' }, null, 2) + '\n', { flag: 'wx' });
console.log({ event, targetQ, removedClosureResidual: p.cycleClosureError, motionRows: motion.length });
