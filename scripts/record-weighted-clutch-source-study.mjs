import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-source-geometry',
  baseline='artifacts/review/086-integrated-verified-source-hashes.json',frozen=readStudyReport(baseline),
  files=new Set(['scripts/record-weighted-clutch-source-study.mjs']),reports={};
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const paths={
 provenance:'artifacts/review/087-source-provenance.json',measurement:'artifacts/review/087-first-source-measurements.json',
 geometry:'artifacts/review/087-corrected-key-geometry.json',bevels:'artifacts/review/087-corrected-key-bevels.json',
 staticClearance:'artifacts/review/087-corrected-key-clearance.json',capture:'artifacts/review/087-refined-static-candidate-captures.json',
 inspections:'artifacts/review/087-refined-static-inspections.json',
};
for(const[name,file]of Object.entries(paths)){
 const report=readStudyReport(file);reports[name]=report;
 if(report.sources){verifyStudySources(report.sources);for(const s of report.sources)files.add(s.file);}
}
const{geometry,bevels,staticClearance,capture,inspections}=reports;
assert(geometry.topology.passed);assert.equal(geometry.topology.solids,207);assert.deepEqual(geometry.topology.issues,[]);
assert.equal(bevels.checks,2362308);assert.deepEqual(bevels.intrusions,[]);
assert.equal(staticClearance.independentPairs,17740);assert.deepEqual(staticClearance.issues,[]);
assert.equal(staticClearance.checks,1259886);
assert(geometry.studReach.reachLimit.leverDegrees>47.4&&geometry.studReach.reachLimit.leverDegrees<47.5);
assert(geometry.studReach.reachRows.at(-1).excludedAtEveryWheelAngle);
assert.equal(capture.views.length,10);assert.equal(inspections.views.length,10);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);
for(const v of capture.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);
}
assert(inspections.sourceMeasurement.image.inspected);
assert.equal(hashStudyFile(reports.measurement.image.file),reports.measurement.image.sha256);
const priorStudies={};
for(const[movement,file]of [[82,'artifacts/review/082-bounded-writer-checkpoint.json'],[83,'artifacts/review/083-thirtysecond-complete-checkpoint.json']]){
 const r=readStudyReport(file);verifyStudySources(r.sources);priorStudies[movement]={file,sha256:hashStudyFile(file),unchangedSources:r.sources.length};
}
const retainedFailures=[];
for(const file of ['artifacts/review/087-open-rim-geometry.json','artifacts/review/087-first-static-clearance.json','artifacts/review/087-refined-static-clearance.json']){
 const r=readStudyReport(file);for(const s of r.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained failure input '+s.file);
 assert((r.topology?.issues??r.issues).length>0);retainedFailures.push({file,sha256:hashStudyFile(file),archivedSources:r.sources.length});
}
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.includes('weighted-clutch')&&file.endsWith('.mjs')){
 execFileSync(process.execPath,['--check',file]);syntax.push(file);
}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-reconstruction-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const checkpoint={movement:87,status:'isolated-source-geometry-and-reach-study',created:new Date().toISOString(),
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,
 ownedBrowserRunning:false,ownedStudyRunning:false,productionBaseline:{file:baseline,sha256:hashStudyFile(baseline),unchangedInputs:Object.keys(frozen).length},
 priorStudies,syntax,sources,retainedFailures,reports:Object.fromEntries(Object.entries(paths).map(([name,file])=>[name,{file,sha256:hashStudyFile(file)}])),
 summary:{solids:geometry.topology.solids,uniqueGeometries:geometry.topology.uniqueGeometries,
  rodLengthError:geometry.linkage.maximumRodLengthError,pinCenterError:geometry.linkage.maximumPinCenterError,
  bevelSamples:bevels.checks,minimumBevelGap:bevels.minimumGap,staticIndependentPairs:staticClearance.independentPairs,
  staticBoundsSeparated:staticClearance.boxSeparated,staticSurfaceSamples:staticClearance.checks,
  reachLimit:geometry.studReach.reachLimit,inspectedViews:inspections.views.length},
 qualification:'Measured source geometry and static finite-mesh screens only. The symmetric weighted-lever flip is excluded by stud reach for the current four-bar. Quadrant/shifter coupling, gravity, loaded bevel/jaw contact, stud-driven reversal, continuous clearance and runtime integration remain pending. No new production build, full test suite, performance qualification or all-507 browser pass is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({...checkpoint,sources:sources.length,reports:Object.keys(paths),syntax:syntax.length});
