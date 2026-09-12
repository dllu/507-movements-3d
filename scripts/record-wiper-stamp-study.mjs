import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {readStudyReport, hashStudyFile, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-study';
const production = readStudyReport('artifacts/review/084-integrated-source-hashes.json');
for (const [file, sha] of Object.entries(production)) assert.equal(hashStudyFile(file), sha, file);
const prior083 = readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'), prior082 = readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(prior083.sources); verifyStudySources(prior082.sources);

const inspections = [];
for (const [file, verdict] of [
  ['085-baseline-single-three-captures.json', 'Rejected baseline: wrong cam, projection and frame geometry.'],
  ['085-first-candidate-captures.json', 'Source-shaped geometry accepted for study; banded head shading subsequently corrected. The second-fall label shows the bed dwell in this first capture.'],
  ['085-refined-candidate-captures.json', 'Source overlay and ten motion/detail views inspected. Smooth head shading accepted; small hub/standard shadow stair steps remain for final rendering review.'],
]) {
  const report = readStudyReport('artifacts/review/'+file); assert.equal(report.views.length,10); assert.equal(report.errors.length,0); assert.equal(report.unexpectedWarnings.length,0);
  for (const view of report.views) {
    assert.equal(hashStudyFile(view.file),view.sha256); inspections.push({file:view.file,sha256:view.sha256,inspected:true,verdict});
  }
}
const measurement = readStudyReport('artifacts/review/085-first-source-measurements.json');
assert.equal(hashStudyFile(measurement.image.file),measurement.image.sha256);
inspections.push({...measurement.image,inspected:true,verdict:'Circle fits and manual outlines inspected. The adopted common axis uses the hub fit; lower guide contour was then traced separately.'});

const currentReports = ['085-quarter-ms-corrected-dynamics-summary.json','085-eighth-ms-corrected-dynamics-summary.json',
  '085-corrected-reactions.json','085-refined-candidate-surfaces.json','085-refined-candidate-captures.json','085-first-dynamics-assessment.json'];
const files = new Set(['scripts/record-wiper-stamp-study.mjs','scripts/measure-wiper-stamp-source.mjs','scripts/capture-wiper-stamp-baseline.mjs',
  'scripts/probe-wiper-stamp-baseline.mjs','scripts/lib/source-circle-fit.mjs']);
for (const file of currentReports) {
  const report = readStudyReport('artifacts/review/'+file); verifyStudySources(report.sources);
  if ('passed' in report) assert.equal(report.passed,true,file);
  for(const source of report.sources) files.add(source.file);
}
const historical = ['085-baseline-captures.json','085-baseline-single-three-captures.json','085-baseline-surfaces.json',
  '085-first-source-measurements.json','085-first-dynamics-summary.json','085-half-ms-dynamics-summary.json','085-quarter-ms-dynamics-summary.json',
  '085-first-reactions.json','085-first-candidate-captures.json','085-first-candidate-surfaces.json'];
let preservedHistoricalInputs=0;
for(const file of historical) for(const source of readStudyReport('artifacts/review/'+file).sources) {
  assert.equal(hashStudyFile(source.archive ?? source.file),source.sha256,source.archive ?? source.file);preservedHistoricalInputs++;
}
const before = readStudyReport('artifacts/review/085-before-normal-polish-buffers.json'), model = makeWiperStampCandidate();
const hashArray = a => crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const head = model.root.userData.parts.flaredStampHead.geometry;
assert.equal(hashArray(head.attributes.position.array),before.parts.flaredStampHead.position);
assert.notEqual(hashArray(head.attributes.normal.array),before.parts.flaredStampHead.normal);
const sources = freezeStudySources([...files],prefix);
const report = {movement:85,status:'source-shaped-finite-contact-study',created:new Date().toISOString(),productionChanged:false,
  candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
  unchanged:{productionInputs:Object.keys(production).length,movement083:prior083.sources.length,movement082:prior082.sources.length},
  sources,currentReports:currentReports.map(file=>({file:'artifacts/review/'+file,sha256:hashStudyFile('artifacts/review/'+file)})),
  historicalReports:historical,preservedHistoricalInputs,inspections,
  headShading:{positionsUnchanged:true,normalsChanged:true},
  pending:['continuous bounds for all 68 independent pairs','complete startup and repeat seam','compact playback and interpolation clearance',
    'hub and standard shadow cleanup','production integration and final numerical/build/browser checks'],
  qualification:'Inspections are recorded after direct viewing; input hashes verify their identity. Sampled clearance, spatial reactions and observed step agreement pass, but full mechanical qualification and integration remain pending. Failed baseline, first capture, first normal/impact-limit audit and coarser comparisons are retained.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,sources:sources.length,inspections:inspections.length,currentReports:undefined,historicalReports:undefined});
