import { readFile, writeFile } from 'node:fs/promises';
import { makeOpenRimTappetStudy } from './lib/open-rim-tappet-study.mjs';
import { makeOpenRimTappetMotion } from './lib/open-rim-tappet-motion.mjs';
const source = JSON.parse(await readFile('artifacts/review/070-source-ring-trials.json', 'utf8'));
const study = makeOpenRimTappetStudy({ shortening: .005, openingHalfAngle: .5,
  centerDistance: source.centerDistance, rimWidth: source.rimWidth, interiorStud: true, seated: true });
const profile = { parameters: study.parameters, tappet: study.tappet };
const motion = makeOpenRimTappetMotion(profile), p = motion.parameters, rows = [];
const angles = Array.from({length:10001}, (_,i) => 2 * Math.PI * i / 10000);
for (const event of [p.entryAngle,p.firstCornerAngle,p.tipSideAngle,p.lastCornerAngle,p.releaseAngle,p.rimEntryAngle,p.exitAngle])
  for (const delta of [-1e-7,0,1e-7]) angles.push(event + delta);
for (const angle of angles) {
  const state = motion.atAngle(angle), check = study.atAngle(angle)(state.advance, true);
  const active = state.outputSpeed < -1e-7;
  const contacts = study.contactsAtAngle(angle,state.advance,1e-7);
  const contact = state.contact, drive = active && contact?.inputMoment > 0 && contact?.outputMoment < 0;
  const gap = contact ? Math.min(...contacts.map(c => Math.hypot(c.point[0] - contact.point[0], c.point[1] - contact.point[1]))) : null;
  rows.push({ ...state, check, active, drive, gap, accepted: check.depth < 1e-7 && (!active || drive && gap < 1e-6) && state.outputSpeed < 1e-6 });
}
const failures = rows.filter(r => !r.accepted);
const reference = JSON.parse(await readFile('artifacts/review/070-source-ring-refinement.json','utf8')).trials
  .find(t => t.summary.openingHalfAngle === .5 && t.summary.steps === 8320).projection;
const maxProjectionError = Math.max(...reference.rows.map(row => Math.abs(motion.atAngle(row.angle).advance - row.advance)));
const report = { movement:70, status:'isolated-exact-analytic-motion', productionChanged:false,
  method:'Closed-form finite stud contact with source tappet sides and corners, and the closing rim outer corner. Entry, changes between side and corner contact, maximum tappet reach, rim engagement and circular lock are geometric events. Positive motor and clockwise output moments and actual analytic surface proximity are checked through a full turn. A passive resisting load and bearing resistance during the brief internal pause are assumed. Float32 3D audit remains pending.',
  parameters:p, stages:motion.stages, poses:rows.length, failed:failures.length, maxProjectionError,
  maximumSpeed:Math.max(...rows.map(r => -r.outputSpeed)), failures, rows };
await writeFile('artifacts/review/070-exact-analytic-motion.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile('scripts/lib/open-rim-tappet-profile.mjs',`// Source measurements and isolated candidate dimensions. See the 070 review artifacts.\nexport default ${JSON.stringify({ ...profile, parameters:p },null,2)};\n`,{flag:'wx'});
console.log({ parameters:p, poses:rows.length, failed:failures.length, maxProjectionError, maximumSpeed:report.maximumSpeed, failures:failures.slice(0,5) });
if(failures.length) process.exitCode=1;
