import { readFile, writeFile } from 'node:fs/promises';
import { makeOpenRimTappetStudy, projectOpenRimTappet } from './lib/open-rim-tappet-study.mjs';

const source = JSON.parse(await readFile('artifacts/review/070-source-ring-trials.json', 'utf8'));
const trials = [];
for (const openingHalfAngle of [.5, .55]) for (const steps of [1040, 4160, 8320]) {
  const study = makeOpenRimTappetStudy({ shortening: .005, openingHalfAngle,
    centerDistance: source.centerDistance, rimWidth: source.rimWidth, interiorStud: true, seated: true });
  const projection = projectOpenRimTappet(study, { steps });
  const active = [], intervals = [];
  for (let i = 1; i < projection.rows.length - 1; i++) {
    const a = projection.rows[i-1], row = projection.rows[i], b = projection.rows[i+1];
    if (row.speed < 1e-4) continue;
    const speed = (b.advance - a.advance) / (b.angle - a.angle);
    const contacts = study.contactsAtAngle(row.angle, row.advance).map(contact => ({ ...contact,
      relativePower: Math.abs(contact.inputMoment + speed * contact.outputMoment)
        / Math.max(1e-8, Math.abs(contact.inputMoment), Math.abs(speed * contact.outputMoment)) }));
    const drive = contacts.filter(c => c.outputMoment < -.01 && c.inputMoment > 0).sort((a,b) => a.relativePower - b.relativePower)[0];
    const accepted = Boolean(drive && drive.relativePower < .02);
    active.push({ ...row, centeredSpeed: speed, contacts, drive, accepted });
    if (!intervals.length || row.angle - intervals.at(-1).end > 1.5 * (projection.end - projection.begin) / steps) intervals.push({ begin: row.angle, end: row.angle });
    else intervals.at(-1).end = row.angle;
  }
  const summary = { openingHalfAngle, steps, poses: projection.poses, finalAdvance: projection.actualAdvance,
    closureError: projection.actualAdvance - projection.expectedAdvance, peakSpeed: projection.maximumSpeed,
    failedProjection: projection.failed.length, activePoses: active.length, missingForces: active.filter(r => !r.accepted).length, intervals };
  console.log(summary);
  trials.push({ summary, projection, tappet: study.tappet, active });
}
await writeFile('artifacts/review/070-source-ring-refinement.json', JSON.stringify({ movement: 70,
  status: 'isolated-analytic-refinement', productionChanged: false,
  method: 'Finite circular studs against straight tappet sides and exact annular-sector arcs and ends. Passive-load monotone projection. Contact normals point from the driver surface into each stud; their moments check clockwise output drive and positive counterclockwise motor work. Centered numerical speed is checked away from, and reported at, discontinuous engagement and exit. This does not certify the actual tessellated 3D parts.', trials }, null, 2) + '\n', { flag: 'wx' });
