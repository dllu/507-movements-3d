import { writeFile } from 'node:fs/promises';
import { makeOpenRimTappetStudy, projectOpenRimTappet } from './lib/open-rim-tappet-study.mjs';

const trials = [];
for (const shortening of [0, .05, .1, .15, .2, .25, .3]) for (const openingHalfAngle of [.45, .55, .65, .75, .85]) {
  const study = makeOpenRimTappetStudy({ shortening, openingHalfAngle, centerDistance: 2.03, interiorStud: true });
  const result = projectOpenRimTappet(study, { steps: 520 });
  trials.push({ ...result, tappet: study.tappet });
  console.log({ shortening, openingHalfAngle, poses: result.poses, advance: result.actualAdvance,
    peak: result.maximumSpeed, failure: result.failed[0]?.reason });
}
await writeFile('artifacts/review/070-interior-stud-trials.json', JSON.stringify({ movement: 70,
  status: 'isolated-profile-diagnosis', productionChanged: false,
  method: 'Alternative source interpretation: one stud sits inside the open rim during dwell; its two neighboring studs touch the exterior rim at plus/minus one stud pitch. The finite tappet drives the interior stud to the next outer seat. Actual 2D circular studs are projected forward against the whole source-traced tappet and open annular rim. No Float32, force or final acceptance is implied.', trials }, null, 2) + '\n', { flag: 'wx' });
