import fs from 'node:fs';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetContact} from './lib/treadle-ratchet-contact.mjs';
import {makeTreadleRatchetInput} from './lib/treadle-ratchet-input.mjs';
const candidate = makeTreadleRatchetCandidate(), u = candidate.root.userData;
const contact = makeTreadleRatchetContact(candidate), input = makeTreadleRatchetInput(u.linkage);
const source = u.geometry.source, k = input(0), seats = [];
for (let index = -12; index <= 12; index++) {
  const theta = index * .005;
  const pawls = k.pawls.map(p => ({key: p.key, ...contact.seat(p.key, p.pivot, theta)}));
  seats.push({theta, pawls, maximumSourcePixels: Math.max(Math.abs(theta) * source.ratchet.outerRadiusPixels,
    ...pawls.map(s => s.maximumDisplacement * source.scale))});
}
const errors = {velocity: 0, acceleration: 0}, h = 1e-4;
for (let i = 0; i <= 128; i++) {
  const time = i * 4 / 128, a = input(time - h), b = input(time), c = input(time + h);
  for (let j = 0; j < 2; j++) for (let axis = 0; axis < 2; axis++) {
    errors.velocity = Math.max(errors.velocity, Math.abs((c.pawls[j].pivot[axis] - a.pawls[j].pivot[axis]) / (2 * h) - b.pawls[j].velocity[axis]));
    errors.acceleration = Math.max(errors.acceleration, Math.abs((c.pawls[j].pivot[axis] - 2 * b.pawls[j].pivot[axis] + a.pawls[j].pivot[axis]) / h ** 2 - b.pawls[j].acceleration[axis]));
  }
}
const report = {movement: 82, status: 'initial-contact-and-input-study', derivativesPassed: errors.velocity < 1e-7 && errors.acceleration < 1e-6,
  errors, seats, qualification: 'Startup seating and finite-difference check of analytic linkage derivatives only. Loaded dynamics and complete solid clearances remain unverified.'};
fs.writeFileSync('artifacts/review/082-contact-seats.json', JSON.stringify(report, null, 2) + '\n');
console.log({...report, seats: seats.map(s => ({theta: s.theta, maximumSourcePixels: s.maximumSourcePixels,
  pawls: s.pawls.map(p => ({key: p.key, okay: p.okay, alpha: p.alpha, gap: p.minimumGap, rows: p.rows?.map(r => ({J: r.J, gap: r.gap}))}))}))});
if (!report.derivativesPassed || seats.some(s => s.pawls.some(p => !p.okay))) process.exitCode = 1;
