import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-inspected-baseline',input='artifacts/review/087-before-reconstruction-captures.json',
  captures=readStudyReport(input),frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
verifyStudySources(captures.sources);assert.deepEqual(captures.errors,[]);
assert.deepEqual(captures.views.map(v=>v.name),['default','front','oblique']);
const views=captures.views.map(v=>{assert.equal(hashStudyFile(v.file),v.sha256);return{...v,inspected:true};}),
  sourceFile='artifacts/reference/brown-page-30-6000.png',
  findings=[
    {kind:'driver-axis',status:'reconstruction-required',
      observation:'The engraving shows the central driver as a face-on ring behind B and C. The front production view instead shows an edge-on upper cone with a tall vertical input shaft.',
      evidence:{inputAxis:captures.geometry.inputAxis,eAxis:captures.geometry.eAxis},
      consequence:'Reconstruct the central driver with its axis normal to the source plane; retain the opposed B/C shaft and the weighted lever/bell-crank arrangement in that plane.'},
    {kind:'source-proportions',status:'measurement-required',
      observation:'The central source ring extends above and below the side cones, and is visibly larger than E. The current central and side bevel gears share equal tooth counts and pitch angles. The source silhouette is not recovered in any of the three inspected views.',
      consequence:'Measure the native source contours and pitch geometry before selecting a new tooth ratio; the visible outline alone is not a tooth-count measurement.'},
    {kind:'mechanical-qualification',status:'pending',
      observation:'This baseline captures the initial pose only. Existing implementation-specific tests do not establish source fidelity or physical clutch engagement.',
      consequence:'Review finite bevel contact, jaw engagement, stud/bell-crank contact, over-center gravity actuation and all independent hardware clearances through a full reversal.'}
  ],sources=freezeStudySources([input,sourceFile,'scripts/record-reversing-clutch-baseline.mjs',...captures.sources.map(s=>s.file)],prefix);
verifyStudySources(sources);
const report={movement:87,status:'inspected-baseline-reconstruction-required',created:new Date().toISOString(),
  productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,verifiedProductionInputs:Object.keys(frozen).length,
  source:{file:sourceFile,sha256:hashStudyFile(sourceFile),pdfPage:30,printedPage:26,inspected:true},
  views,findings,sources,qualification:'Three static production renders and the Brown page are inspected. This records visible reconstruction defects; it supplies no new motion, contact, performance, numerical-suite or production-build pass.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({movement:87,status:report.status,views:views.length,verifiedProductionInputs:report.verifiedProductionInputs});
