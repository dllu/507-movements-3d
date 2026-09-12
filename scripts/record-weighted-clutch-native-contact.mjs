import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-native-contact',
 baseline='artifacts/review/086-integrated-verified-source-hashes.json',frozen=readStudyReport(baseline),
 verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);},
 files=new Set(['scripts/record-weighted-clutch-native-contact.mjs']),reports={},paths={
  pinFit:'artifacts/review/087-first-free-pin-placement.json',
  native:'artifacts/review/087-first-native-stud.json',
  gradients:'artifacts/review/087-first-stud-gradients.json',
  witnesses:'artifacts/review/087-confirmed-stud-witnesses.json',
  hardware:'artifacts/review/087-first-stud-lifts.json',
  capture:'artifacts/review/087-native-lifting-captures.json',
  inspections:'artifacts/review/087-native-lifting-inspections.json',
 };
verify();
for(const[name,file]of Object.entries(paths)){
 const r=readStudyReport(file);reports[name]=r;assert.equal(r.mechanicsPassed,false);
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
}
const{pinFit,native,gradients,witnesses,hardware,capture,inspections}=reports;
assert.equal(pinFit.parityError,0);assert.equal(pinFit.evaluations,30096);assert.equal(pinFit.selected.radius,73.5);
assert(pinFit.minimumForward>0&&pinFit.minimumReturn>=pinFit.targetReturnMoment&&pinFit.maximumBellIncrement<0);
assert.equal(native.rows.length,258);assert(native.initial.gap< -.005);
assert(native.maximumResidual<1e-11&&native.minimumForward>1.15&&native.minimumReturn>.28&&native.minimumCutDistance>.55);
for(const r of native.rows){
 assert(r.beforeGap>0&&r.afterGap<0&&r.usefulMoment>0);assert(Math.abs(r.gap)<1e-11);
}
assert.equal(gradients.rows.length,258);assert(gradients.maximumWheelError<1e-7&&gradients.maximumLeverError<1e-7);
assert(gradients.minimumUsefulLeverMoment>.063);
assert.equal(witnesses.rows.length,258);assert(witnesses.maximumSurfaceResidual<1e-11);
assert.equal(witnesses.measuredSourcePose.solids,207);assert(witnesses.measuredSourcePose.contact.gap< -.005);
for(const w of Object.values(witnesses.measuredSourcePose.witnesses))assert(w.signedDistance< -.005);
assert(witnesses.initial.distances.GPointToE.signedDistance< -.005&&witnesses.initial.distances.EPointToG.signedDistance< -.005);
assert.equal(hardware.topology.length,213);assert.deepEqual(hardware.topologyIssues,[]);assert.deepEqual(hardware.issues,[]);
assert.equal(hardware.poses.length,18);assert.equal(hardware.checks,26588934);assert(hardware.maximumContactResidual<1e-11);
for(const p of hardware.poses){
 assert.equal(p.independentPairs,18971);assert.equal(p.independentPairs,p.separated+p.reused+p.sampled);
 const sign=p.direction==='CCW'?-1:1;
 assert(Math.abs(p.state.outputAngle-sign*1.4*p.state.inputAngle)<1e-12);
 assert(Math.abs(p.state.clutchShift-(p.direction==='CCW'?0:-74/300))<1e-12);
}
assert.equal(capture.views.length,13);assert.equal(inspections.views.length,13);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);
assert.equal(inspections.capture.file,paths.capture);assert.equal(inspections.capture.sha256,hashStudyFile(paths.capture));
for(const v of capture.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);
 assert.deepEqual(v.state,hardware.poses[v.pose].state);
}

const priorStudies={};
for(const[label,file]of [
 ['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
 ['087-measured','artifacts/review/087-source-geometry-checkpoint.json'],['087-lost-motion','artifacts/review/087-lost-motion-checkpoint.json'],
]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label.startsWith('087')&&s.file.endsWith('.md'))archivedMarkdown++;
  else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
 }
 priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const priorWitness='artifacts/review/087-first-stud-witnesses.json',r=readStudyReport(priorWitness);
for(const s of r.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Earlier witness source '+s.file);
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.includes('weighted-clutch')&&file.endsWith('.mjs')){
 execFileSync(process.execPath,['--check',file]);syntax.push(file);
}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-native-contact-notes.md','artifacts/review/087-lost-motion-notes.md',
 'artifacts/review/087-reconstruction-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verify();
const checkpoint={movement:87,status:'isolated-native-stud-lifting-contact-study',created:new Date().toISOString(),
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,sourcePoseQualified:false,
 full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
 productionBaseline:{file:baseline,sha256:hashStudyFile(baseline),unchangedInputs:Object.keys(frozen).length},
 sources,syntax,priorStudies,retained:[{file:priorWitness,sha256:hashStudyFile(priorWitness),qualification:'Earlier passing candidate-only witness check; extended by the measured-candidate confirmation.'}],
 reports:Object.fromEntries(Object.entries(paths).map(([name,file])=>[name,{file,sha256:hashStudyFile(file)}])),
 summary:{pinSearchEvaluations:pinFit.evaluations,alternativePinDisplacement:pinFit.selected.radius,geometryStillUsesPinDisplacement:75,
  candidateSourcePenetration:native.initial.gap,measuredSourcePenetration:witnesses.measuredSourcePose.contact.gap,
  correctedFirstWheelAngle:native.rows[0].wheelAngle,nativeContacts:native.rows.length,maximumContactResidual:native.maximumResidual,
  maximumWitnessResidual:witnesses.maximumSurfaceResidual,minimumForwardMoment:native.minimumForward,minimumReturnMoment:native.minimumReturn,
  minimumUsefulLeverMoment:gradients.minimumUsefulLeverMoment,maximumWheelGradientError:gradients.maximumWheelError,
  maximumLeverGradientError:gradients.maximumLeverError,solids:213,hardwarePoses:18,surfaceSamples:hardware.checks,inspectedViews:13},
 qualification:'Exact native stud contacts and local force transmission on sampled lifting branches, full-solid contact witnesses, rotating-hardware samples and inspected stills. The default source pose has a confirmed edge overlap; solved lifting phases correct it. The 75-pixel geometry remains a source-fidelity departure. Gravity, inertia, impacts/contact release, loaded clutch reversal, continuous clearance, timing and production integration remain pending. No new production build, full-suite test or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,unchangedInputs:Object.keys(frozen).length,sources:sources.length,syntax:syntax.length,summary:checkpoint.summary});
