import { writeFile } from 'node:fs/promises';
import { makeOpenRimTappetStudy, projectOpenRimTappet } from './lib/open-rim-tappet-study.mjs';

const trials = [];
for (const shortening of [0, .05, .1, .15, .2]) for (const openingHalfAngle of [.55, .65, .75, .85, .95, 1.05]) {
  const study = makeOpenRimTappetStudy({ shortening, openingHalfAngle });
  const result = projectOpenRimTappet(study, { steps: 260 });
  trials.push({ ...result, tappet: study.tappet });
  console.log({ shortening, openingHalfAngle, poses: result.poses, advance: result.actualAdvance,
    peak: result.maximumSpeed, failure: result.failed[0]?.reason });
}
await writeFile('artifacts/review/070-source-tappet-trials.json', JSON.stringify({ movement: 70,
  status: 'isolated-profile-diagnosis', productionChanged: false,
  method: 'Own four-corner source tappet trace and an analytic open annular rim against all ten finite circular studs. First permitted forward output under passive resistance, with a conservative stud-orbit Lipschitz bound. This is an exact 2D disk/segment/arc diagnosis; Float32 solids, force cones, dynamics, entry/exit refinement and source fitting remain separate checks.', trials }, null, 2) + '\n', { flag: 'wx' });
