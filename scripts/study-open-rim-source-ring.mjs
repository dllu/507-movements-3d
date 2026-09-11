import { readFile, writeFile } from 'node:fs/promises';
import { makeOpenRimTappetStudy, projectOpenRimTappet } from './lib/open-rim-tappet-study.mjs';

const source = JSON.parse(await readFile('artifacts/review/070-source-layout-study.json', 'utf8'));
const scale = source.output.radius / 1.28, radius = source.driver.radius / scale;
const orbit = source.studOrbit.radius / scale, pinRadius = .075, pitch = 2 * Math.PI / 10, clearance = .00015;
const centerDistance = orbit * Math.cos(pitch) + Math.sqrt((radius + pinRadius + clearance) ** 2 - (orbit * Math.sin(pitch)) ** 2);
const rimWidth = radius - source.rim.radius / scale;
const trials = [];
for (const shortening of [0, .005, .01, .02, .03, .04]) for (const openingHalfAngle of [.45, .5, .55, .6, .65]) {
  const study = makeOpenRimTappetStudy({ shortening, openingHalfAngle, centerDistance, rimWidth, interiorStud: true, seated: true });
  const result = projectOpenRimTappet(study, { steps: 1040 });
  trials.push({ ...result, tappet: study.tappet });
  console.log({ shortening, openingHalfAngle, poses: result.poses, advance: result.actualAdvance,
    peak: result.maximumSpeed, failure: result.failed[0]?.reason });
}
await writeFile('artifacts/review/070-source-ring-trials.json', JSON.stringify({ movement: 70,
  status: 'isolated-profile-diagnosis', productionChanged: false,
  method: 'Source interpretation: the visible outer driver circle is the working rim exterior, and the dotted circle is its inner edge. One stud sits inside; neighboring studs bear against the exterior at plus/minus one pitch. Circle geometry sets shaft spacing and a seated initial output. The traced tappet is tested with small tip shortening and opening variants. Complete 3D and force acceptance remain pending.',
  scale, centerDistance, sourceCenterDistance: source.centerDistance / scale,
  spacingDifferencePixels: centerDistance * scale - source.centerDistance, rimWidth, trials }, null, 2) + '\n', { flag: 'wx' });
