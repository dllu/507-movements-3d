import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-lost-motion',
 baseline='artifacts/review/086-integrated-verified-source-hashes.json',frozen=readStudyReport(baseline),
 files=new Set(['scripts/record-weighted-clutch-lost-motion.mjs']),reports={},
 verifyBaseline=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);},
 paths={
  proportions:'artifacts/review/087-first-operating-proportions.json',
  solids:'artifacts/review/087-cleared-lost-motion-solids.json',
  capture:'artifacts/review/087-cleared-lost-motion-captures.json',
  inspections:'artifacts/review/087-cleared-lost-motion-inspections.json',
 };
verifyBaseline();
for(const[name,file]of Object.entries(paths)){
 const r=readStudyReport(file);reports[name]=r;
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
 assert.equal(r.candidateIntegrated,false);assert.equal(r.mechanicsPassed,false);
}
const{proportions,solids,capture,inspections}=reports;
assert.equal(proportions.rows.length,91);assert.equal(proportions.unadjustedParityError,0);
assert.equal(proportions.firstRadial,51);assert.equal(proportions.firstPositiveTorque,70);
assert(!proportions.rows[60].correctTorqueDirections);
const chosen=proportions.rows[75];assert(chosen.correctTorqueDirections);
assert(chosen.minimumCCWTorque>1.15&&chosen.minimumCWTorque>.318);
assert.equal(solids.pinAdjustmentPixels,75);assert.equal(solids.topology.length,213);
assert.deepEqual(solids.topologyIssues,[]);assert.deepEqual(solids.issues,[]);
assert.equal(solids.poses.length,26);assert.equal(solids.checks,7120408);
assert(solids.minimumSlotClearance>9.99e-7);assert(solids.maximumRodError<1e-12);
for(const p of solids.poses){
 assert.equal(p.independentPairs,18971);assert.equal(p.issues,0);
 assert.equal(p.state.inputAngle,0);assert.equal(p.state.outputAngle,0);
 assert.equal(p.independentPairs,p.separated+p.reused+p.sampled);
}
assert.equal(capture.geometry.parts,213);assert.equal(capture.geometry.sourceAdjustments.pinAdjustmentPixels,75);
assert.equal(capture.geometry.sourceAdjustments.weightDepth,1.59);
assert.deepEqual(capture.geometry.sourceAdjustments.quadrantSpacerAnglesDegrees,[-120,-70]);
assert.equal(capture.views.length,15);assert.equal(inspections.views.length,15);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);
assert.equal(inspections.capture.file,paths.capture);assert.equal(inspections.capture.sha256,hashStudyFile(paths.capture));
for(const v of capture.views){
 const i=inspections.views.find(i=>i.file===v.file);
 assert(i?.inspected&&i.assessment);assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);
}
for(const r of inspections.references){assert(r.inspected&&r.assessment);assert.equal(hashStudyFile(r.file),r.sha256);}

// The earlier measured reconstruction stays immutable. Its two documentation
// files have subsequent additions, so compare their preserved snapshots.
const measuredFile='artifacts/review/087-source-geometry-checkpoint.json',measured=readStudyReport(measuredFile);
for(const s of measured.sources){
 assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Measured archive '+s.file);
 if(!s.file.endsWith('.md'))assert.equal(hashStudyFile(s.file),s.sha256,'Measured input '+s.file);
}
const priorStudies={};
for(const[movement,file]of [[82,'artifacts/review/082-bounded-writer-checkpoint.json'],[83,'artifacts/review/083-thirtysecond-complete-checkpoint.json']]){
 const r=readStudyReport(file);verifyStudySources(r.sources);
 priorStudies[movement]={file,sha256:hashStudyFile(file),unchangedSources:r.sources.length};
}
const retained=[];
for(const file of ['artifacts/review/087-first-lost-motion-captures.json',
 'artifacts/review/087-return-torque-candidate-captures.json','artifacts/review/087-first-lost-motion-solids.json']){
 const r=readStudyReport(file);
 for(const s of r.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Earlier input '+s.file);
 if(r.issues)assert(r.issues.length>0);
 retained.push({file,sha256:hashStudyFile(file),archivedSources:r.sources.length,
  qualification:r.issues?'Retained failed hardware screen.':'Superseded diagnostic captures; no full inspection claim.'});
}
const construction='artifacts/review/087-lost-motion-first-construction-source.txt';
retained.push({file:construction,sha256:hashStudyFile(construction),qualification:'Initial factory with duplicate G pivot cut; construction failed before a complete geometry report.'});
const references=[
 ['artifacts/reference/087-analogue-US158175A.html','https://patents.google.com/patent/US158175A/en'],
 ['artifacts/reference/087-analogue-US158175.pdf','https://patentimages.storage.googleapis.com/ba/72/f9/3aa42767f8cf7c/US158175.pdf'],
].map(([file,url])=>({file,url,sha256:hashStudyFile(file)}));

const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.includes('weighted-clutch')&&file.endsWith('.mjs')){
 execFileSync(process.execPath,['--check',file]);syntax.push(file);
}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-lost-motion-notes.md','artifacts/review/087-reconstruction-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyBaseline();
const checkpoint={movement:87,status:'isolated-lost-motion-and-return-torque-hypothesis',created:new Date().toISOString(),
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,
 ownedBrowserRunning:false,ownedStudyRunning:false,
 productionBaseline:{file:baseline,sha256:hashStudyFile(baseline),unchangedInputs:Object.keys(frozen).length},
 measuredCandidate:{file:measuredFile,sha256:hashStudyFile(measuredFile),sources:measured.sources.length,
  qualification:'Original measured geometry unchanged; earlier Markdown verified against its archives.'},
 priorStudies,sources,syntax,references,retained,
 reports:Object.fromEntries(Object.entries(paths).map(([name,file])=>[name,{file,sha256:hashStudyFile(file)}])),
 summary:{solids:solids.topology.length,diagnosticPoses:solids.poses.length,independentPairsPerPose:18971,
  surfaceSamples:solids.checks,minimumSlotClearance:solids.minimumSlotClearance,maximumRodError:solids.maximumRodError,
  freeDegrees:proportions.coupling.freeAngle*180/Math.PI,leverSwingDegrees:proportions.coupling.leverLeft*180/Math.PI,
  testedProportions:proportions.rows.length,firstRadialAdjustment:proportions.firstRadial,firstUsefulTorqueAdjustment:proportions.firstPositiveTorque,
  chosenPinAdjustment:75,minimumCCWTorque:chosen.minimumCCWTorque,minimumCWTorque:chosen.minimumCWTorque,
  inspectedViews:inspections.views.length,inspectedReferencePages:inspections.references.length},
 qualification:'Separate operating hypothesis with explicit 75-source-pixel rod-pin changes. Finite slot limits, planar analytic contact directions and sampled diagnostic hardware clearances only. No accepted source-fidelity result, native stud-driven trajectory, gravity/inertia solution, loaded clutch engagement, continuous clearance, performance qualification or production integration. No new production build, full-suite or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,unchangedInputs:Object.keys(frozen).length,sources:sources.length,syntax:syntax.length,summary:checkpoint.summary});
