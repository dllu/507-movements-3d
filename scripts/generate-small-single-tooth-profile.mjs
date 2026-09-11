import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeSmallSingleToothSourceProfiles } from './lib/small-single-tooth-source.mjs';
import { makeSmallSingleToothConstraintField } from './lib/small-single-tooth-constraint-field.mjs';

const sourceFile = 'artifacts/review/069-balanced-fine-5200.json';
const source = await readFile(sourceFile), fine = JSON.parse(source);
const coarse = JSON.parse(await readFile('artifacts/review/069-balanced-fine-2600.json', 'utf8'));
if (fine.failed.length || fine.rows.length !== 5201 || coarse.failed.length) throw new Error('Incomplete motion study');
const profile = makeSmallSingleToothSourceProfiles(fine.parameters), field = makeSmallSingleToothConstraintField(profile, fine.parameters);
const rows = fine.rows.map(row => [row.angle, row.advance]), events = [];
let flatBegin = null;
for (let i = 1; i < fine.rows.length; i++) {
  const current = fine.rows[i];
  if (current.stepAdvance === 0) { flatBegin ??= i - 1; continue; }
  if (flatBegin !== null && i - flatBegin > 3 && current.stepAdvance > 1e-7) {
    const previous = fine.rows[i - 1], advance = previous.advance;
    let low = previous.angle, high = current.angle;
    for (let iteration = 0; iteration < 50; iteration++) {
      const mid = (low + high) / 2;
      if (field.atAngle(mid)(advance) > 1e-7) high = mid; else low = mid;
    }
    const angle = (low + high) / 2;
    rows.push([angle, advance]);
    events.push({ angle, advance, bracket: [previous.angle, current.angle], residual: field.atAngle(angle)(advance) });
  }
  flatBegin = null;
}
rows.sort((a, b) => a[0] - b[0]);
const assemblyAngle = 29 * Math.PI / 180;
profile.parameters = { ...fine.parameters, assemblyAngle,
  initialInputPhase: fine.parameters.centerlineAngle - assemblyAngle,
  period: 2 * Math.PI, advancePerCycle: 2 * fine.parameters.pitch,
  entryAngle: events[0].angle, exitAngle: 4.328,
  cycleClosureError: fine.actualAdvance - fine.expectedAdvance,
};
profile.motion = rows;
const refinement = { movement: 69, coarsePoses: coarse.rows.length, finePoses: fine.rows.length,
  maximumMatchedAdvanceDifference: Math.max(...coarse.rows.map((row, i) => Math.abs(row.advance - fine.rows[2 * i].advance))),
  peakSpeeds: [coarse.maximumSpeed, fine.maximumSpeed], peakDifference: Math.abs(coarse.maximumSpeed - fine.maximumSpeed),
  cycleClosureErrors: [coarse.actualAdvance - coarse.expectedAdvance, fine.actualAdvance - fine.expectedAdvance],
};
await writeFile('scripts/lib/small-single-tooth-balanced-profile.mjs', '// Independent Brown-profile geometry and quasistatic motion; isolated candidate.\nexport default '
  + JSON.stringify(profile) + ';\n', { flag: 'wx' });
await writeFile('artifacts/review/069-balanced-profile.json', JSON.stringify({ movement: 69, status: 'isolated-candidate-profile',
  sourceFile, sourceSha256: createHash('sha256').update(source).digest('hex'), parameters: profile.parameters,
  driverVertices: profile.driver[0].length, outputVertices: profile.output[0].length, motionRows: rows.length, events, refinement,
  qualification: 'The original sampled rows are retained and explicit entry knots added after dwells. A short loaded pause occurs during the stroke. Complete solid, force and source-fit acceptance remains pending.' }, null, 2) + '\n', { flag: 'wx' });
console.log({ motionRows: rows.length, events, refinement });
