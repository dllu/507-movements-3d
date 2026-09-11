import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import profile from './lib/single-tooth-corner-source-profile.mjs';
import { makeSingleToothConstraintField } from './lib/single-tooth-constraint-field.mjs';

const source = 'artifacts/review/068-corner-projection-6400.json';
const raw = await readFile(source), study = JSON.parse(raw);
const field = makeSingleToothConstraintField(profile), tolerance = 1e-7;
const first = study.rows.findIndex(row => row.advance > 1e-8);
const before = study.rows[first - 1], after = study.rows[first];
let high = before.angle, low = after.angle;
if (field.atAngle(high)(before.q) > tolerance || field.atAngle(low)(before.q) <= tolerance) {
  throw new Error('Stored entry rows do not bracket geometric contact');
}
for (let i = 0; i < 48; i++) {
  const mid = (high + low) / 2;
  if (field.atAngle(mid)(before.q) > tolerance) low = mid; else high = mid;
}
const angle = (high + low) / 2;
study.entryEvent = { angle, outputAngle: before.q, penetrationThreshold: tolerance,
  bracket: [before.angle, after.angle], residual: field.atAngle(angle)(before.q),
  firstMovingSegmentSpeed: (after.q - before.q) / (angle - after.angle),
  method: 'Bisection of the full driver/output-corner clearance field with the output held at its seated dwell angle.' };
study.derivedFrom = { file: source, sha256: createHash('sha256').update(raw).digest('hex'),
  qualification: 'The verified 6400-step projection rows are unchanged. This derived study adds the contact-entry event as a separate interpolation knot.' };
await writeFile('artifacts/review/068-corner-events-6400.json', JSON.stringify(study, null, 2) + '\n', { flag: 'wx' });
console.log(study.entryEvent);
