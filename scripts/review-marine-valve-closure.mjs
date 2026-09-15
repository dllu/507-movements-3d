import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const model = createAuthoredMarineValveGearMovement({id: 171}), data = model.root.userData, g = data.geometry;
const runs = []; let maximumLengthError = 0, maximumDieGuideError = 0, maximumSlotAngle = 0;
try {
  for (const selector of [-1, -.5, 0, .5, 1]) {
    let minimumValve = Infinity, maximumValve = -Infinity, minimumSlide = Infinity, maximumSlide = -Infinity;
    let sine = 0, cosine = 0;
    for (let i = 0; i <= 720; i++) {
      const angle = i * 2 * Math.PI / 720, s = data.stateAtInputAngle(angle, selector);
      const errors = [
        s.aheadEccentricCenter.distanceTo(s.aheadLinkPin) - g.aheadEccentricRodLength,
        s.asternEccentricCenter.distanceTo(s.asternLinkPin) - g.asternEccentricRodLength,
        s.aheadLinkPin.distanceTo(s.asternLinkPin) - g.linkPinSpacing,
        s.diePoint.distanceTo(s.slideEyeWorld) - g.outputRodLength,
        s.followerPinWorld.distanceTo(s.rockshaftPivotWorld) - g.followerArmLength,
        s.followerPinWorld.distanceTo(s.slotCenterWorld) - g.slotRadius,
        s.valveArmPointWorld.distanceTo(s.valveStemPointWorld) - g.valveLinkLength,
      ];
      assert.ok(errors.every(Number.isFinite));
      maximumLengthError = Math.max(maximumLengthError, ...errors.map(Math.abs));
      maximumDieGuideError = Math.max(maximumDieGuideError, Math.abs(s.diePoint.x - g.dieGuideX));
      maximumSlotAngle = Math.max(maximumSlotAngle, Math.abs(s.slotParameterAngle));
      const y = s.valveStemPointLocal.y;
      minimumValve = Math.min(minimumValve, y); maximumValve = Math.max(maximumValve, y);
      minimumSlide = Math.min(minimumSlide, s.slideStroke); maximumSlide = Math.max(maximumSlide, s.slideStroke);
      if (i < 720) { sine += 2 * y * Math.sin(angle) / 720; cosine += 2 * y * Math.cos(angle) / 720; }
    }
    runs.push({selector, minimumValve, maximumValve, valveStroke: maximumValve - minimumValve, minimumSlide, maximumSlide,
      valveFirstHarmonic: {sine, cosine, amplitude: Math.hypot(sine, cosine)}});
  }
  const initial = data.stateAtTime(0), end = data.stateAtTime(g.selectorPeriod);
  const sourcePose = [
    ['aheadLinkPin', g.sourceRasterAheadLinkPin], ['asternLinkPin', g.sourceRasterAsternLinkPin],
    ['diePoint', g.sourceRasterLinkDie], ['slideEyeWorld', g.sourceRasterSlideEye], ['followerPinWorld', g.sourceRasterFollowerPin],
  ].map(([name, point]) => {
    const projected = [132 + initial[name].x / g.sourceUnitsPerPixel, 52 + (g.shaftCenter.y - initial[name].y) / g.sourceUnitsPerPixel];
    return {name, engraving: point.toArray(), projected, pixelError: Math.hypot(projected[0] - point.x, projected[1] - point.y)};
  });
  const sources = ['scripts/review-marine-valve-closure.mjs', 'src/simulation/authored-marine-valve-gears.js', 'public/engravings/mm_171.png']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const report = {movement: 171, status: 'existing-ideal-closure-diagnostic', poses: 3605, maximumLengthError,
    maximumDieGuideError, maximumSlotAngle, runs, sourcePose,
    selectorCycle: {duration: g.selectorPeriod, inputAngleDifference: end.inputAngle - initial.inputAngle,
      valveLocalDifference: end.valveStemPointLocal.y - initial.valveStemPointLocal.y},
    method: 'Recompute distances from exported world positions for five fixed reversing settings over 721 crank phases each. Approximate initial source projection uses the existing source anchors. Centerline consistency is not finite contact, source fidelity or dynamics qualification.', sources};
  fs.writeFileSync('docs/validation/171-existing-closure.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report); assert.ok(maximumLengthError < 1e-9 && maximumDieGuideError < 1e-9);
} finally { disposeObject3D(model.root); }
