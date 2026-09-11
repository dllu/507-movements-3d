import { readFile, writeFile } from 'node:fs/promises';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { firstPinionContact } from './lib/star-mangle-angular-contact.mjs';

const data = JSON.parse(await readFile('artifacts/review/054-candidate-profiles-overtravel.json', 'utf8'));
const reference = JSON.parse(await readFile('artifacts/review/054-candidate-loaded-phase-pilot.json', 'utf8'));
const model = makeStarMangleCandidate(data), parts = model.root.userData.parts;
const report = { method: 'Exact rotating polygon events versus independent triangle-BVH first-crossing bisection.', poses: [] };
for (const entry of reference.poses) {
  const start = performance.now(); model.root.userData.updateTravel(entry.pathTravel); model.root.updateMatrixWorld(true);
  const result = firstPinionContact({ teeth: parts.teeth, pinion: parts.pinion });
  const record = { pathTravel: entry.pathTravel, branch: entry.branch, ...result,
    bvhAdvance: entry.phaseAdvance + reference.phaseBackoff,
    error: result.advance - entry.phaseAdvance - reference.phaseBackoff, seconds: (performance.now() - start) / 1000 };
  report.poses.push(record); console.log(JSON.stringify(record));
}
await writeFile('artifacts/review/054-candidate-angular-contact-check.json', JSON.stringify(report, null, 2) + '\n');
