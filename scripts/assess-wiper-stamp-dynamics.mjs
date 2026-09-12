import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const coarseFile = process.env.PROBE_COARSE ?? 'artifacts/review/085-quarter-ms-corrected-dynamics.json.gz';
const fineFile = process.env.PROBE_FINE ?? 'artifacts/review/085-eighth-ms-corrected-dynamics.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-dynamics-assessment';
const coarse = readStudyReport(coarseFile), fine = readStudyReport(fineFile);
verifyStudySources(coarse.sources); verifyStudySources(fine.sources);
for (const s of coarse.sources) assert(fine.sources.some(t => t.file === s.file && t.sha256 === s.sha256), s.file);
assert.equal(coarse.duration, fine.duration); assert.equal(coarse.gravity, fine.gravity); assert.equal(coarse.angularSpeed, fine.angularSpeed);
const interpolate = (data, time) => {
  const i = Math.min(data.rows.length - 2, Math.floor(time / data.step)), a = data.rows[i], b = data.rows[i + 1], t = (time - a.time) / (b.time - a.time);
  return a.stampY + t * (b.stampY - a.stampY);
};
let worst = {pixels: 0}, cycleWorst = {pixels: 0}, velocityRecurrence = 0;
// Difference of two piecewise-linear translations is linear on their common
// subdivision. Checking the union of knot times bounds the entire comparison.
const times = [...new Set([...coarse.rows, ...fine.rows].map(r => r.time))].sort((a,b) => a-b);
for (const time of times) {
  const a = interpolate(coarse,time), b = interpolate(fine,time), pixels = Math.abs(a-b)*fine.sourcePixelsPerUnit;
  if (pixels>worst.pixels) worst = {time, pixels, coarse:a, fine:b};
}
for (const r of fine.rows) if (r.time>=1 && r.time<=4) {
  const later = fine.rows[Math.round((r.time+4)/fine.step)], pixels = Math.abs(r.stampY-later.stampY)*fine.sourcePixelsPerUnit;
  if (pixels>cycleWorst.pixels) cycleWorst = {time:r.time,pixels,first:r.stampY,second:later.stampY};
  velocityRecurrence = Math.max(velocityRecurrence,Math.abs(r.velocity-later.velocity));
}
const sources = freezeStudySources([coarseFile,fineFile,'scripts/assess-wiper-stamp-dynamics.mjs',...fine.sources.map(s=>s.file)],prefix);
const report = {movement:85,status:'translation-step-agreement-and-recurrence',productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  passed:worst.pixels<=.25,coarseFile,fineFile,coarseStep:coarse.step,fineStep:fine.step,checkedTimes:times.length,
  observedVertexDifference:worst,thresholdPixels:.25,recurrence:{firstInterval:[1,4],secondInterval:[5,8],period:4,maximum:cycleWorst,velocityRecurrence},sources,
  qualification:'The only free geometric coordinate is stamp translation; the prescribed cam angle agrees identically. The union of piecewise-linear knot times therefore bounds every translated vertex difference for these two sampled trajectories. This is observed time-step agreement, not a continuum-error guarantee. Recurrence is checked after startup over the common three-second interval only; it does not establish continuous clearance or a finished playback seam.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
