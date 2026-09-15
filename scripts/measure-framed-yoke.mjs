import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

// Manual raster landmarks; uncertainty is a few pixels in the hand engraving.
const source = { image: 'public/engravings/mm_146.png', diskCenter: [267,307],
  diskRadius: 119, wristCenter: [259,214], wristRadius: 11,
  yokeOuterBounds: { left: 113, right: 440, top: 174, bottom: 332 },
  upperStem: { top: 50, bottom: 174 }, lowerStem: { top: 332, bottom: 484 } };
const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[145]);
try {
  const g = model.root.userData.geometry;
  const measuredCrankPixels = Math.hypot(source.wristCenter[0]-source.diskCenter[0], source.diskCenter[1]-source.wristCenter[1]);
  const measuredCrankRatio = measuredCrankPixels/source.diskRadius;
  const measuredWidthRatio = (source.yokeOuterBounds.right-source.yokeOuterBounds.left)/(2*source.diskRadius);
  const correctedCrank = measuredCrankRatio*g.diskRadius;
  const report = { movement:146, status:'source-proportion-discrepancies-confirmed', source,
    comparison: {
      crankToDiskRadius: { measured:measuredCrankRatio, current:g.crankRadius/g.diskRadius },
      yokeToDiskWidth: { measured:measuredWidthRatio, current:g.yokeOuterHalfWidth/g.diskRadius },
      strokeInEngravingPixels: { measured:2*measuredCrankPixels, current:g.outputStroke/g.diskRadius*source.diskRadius },
      poseAngle: { measured:Math.atan2(source.diskCenter[1]-source.wristCenter[1],source.wristCenter[0]-source.diskCenter[0]), current:g.sourcePoseAngle },
    },
    upperGuideAtCorrectedStroke: {
      currentGuideTop:g.upperGuideY+g.guideCheekHeight/2,
      lowestCurrentStemTip:g.upperStemMaximumY-correctedCrank,
      missingLength:g.upperGuideY+g.guideCheekHeight/2-(g.upperStemMaximumY-correctedCrank),
    },
    sourceStemSpanVersusStrokePixels: {
      drawnUpperSpan:source.upperStem.bottom-source.upperStem.top,
      requiredStroke:2*measuredCrankPixels,
      note:'Even a zero-height fixed guide cannot remain on the drawn upper stem through this stroke. Stem extension or a different inferred support is needed; the engraving does not specify guides.'
    },
    inputs:['scripts/measure-framed-yoke.mjs','src/simulation/authored-cranks.js',source.image].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})) };
  fs.writeFileSync('docs/validation/146-source-measurements.json',JSON.stringify(report,null,2)+'\n');
  console.log(report.comparison,report.upperGuideAtCorrectedStroke);
} finally { disposeObject3D(model.root); }
