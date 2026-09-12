import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-flight',
 baseline='artifacts/review/086-integrated-verified-source-hashes.json',frozen=readStudyReport(baseline),
 verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);},
 files=new Set(['scripts/record-weighted-clutch-first-flight.mjs','src/simulation/finite-plate-geometry.js']),reports={},paths={
  inertia:'artifacts/review/087-first-inertia-check.json',forces:'artifacts/review/087-first-release-forces.json',
  fast:'artifacts/review/087-corrected-fast-stud.json',flight:'artifacts/review/087-first-flight-check.json',
  recontact:'artifacts/review/087-first-recontact-refinement.json',hardware:'artifacts/review/087-first-flight-solids.json',
  capture:'artifacts/review/087-first-flight-rendered-captures.json',inspections:'artifacts/review/087-first-flight-rendered-inspections.json',
 };
verify();
for(const[name,file]of Object.entries(paths)){
 const r=readStudyReport(file);reports[name]=r;assert.equal(r.mechanicsPassed,false);files.add(file);
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
}
const{inertia,forces,fast,flight,recontact,hardware,capture,inspections}=reports;
assert.equal(inertia.rows.length,129);assert.equal(inertia.components.length,9);
assert(inertia.maximumPotentialError<1e-8&&inertia.maximumInertiaError<1e-7&&inertia.maximumGravityError<1e-7);
assert.equal(forces.branches.length,2);assert(forces.maximumHessianError<1e-3);
assert(forces.equilibrium>0&&forces.equilibrium<forces.weightVertical);
for(const b of forces.branches){assert.equal(b.contacts.length,129);assert.equal(b.speeds.length,5);assert(b.speeds.every(s=>s.firstNegative));}
assert.equal(fast.rows.length,1024);assert.equal(fast.maximumGapError,0);assert(fast.maximumGradientError<1e-6);assert.equal(fast.ambiguous,0);
assert.equal(flight.branches.reduce((s,b)=>s+b.states,0),175251);
for(const b of flight.branches){
 assert(b.minimumGap> -2e-9&&b.maximumGapError===0&&b.minimumCutDistance>.2&&b.minimumImpulse>=0);
 assert(b.maximumMomentumResidual<1e-10&&b.maximumClosingVelocity<1e-10&&b.maximumComplementarity<1e-10);
 assert(b.relativeAbsoluteDefect<.001&&b.freeEnergyDrift<1e-9);
 assert(b.comparisons.at(-1).maximumWeightErrorPixels<.25&&b.comparisons.at(-1).endpointVelocityError<.001);
 assert(b.maximumFreeAngleError<.001&&b.maximumFreeVelocityError<.002);
 assert(b.comparisons.every(c=>c.absoluteDefectRatio<.65));
}
assert.equal(recontact.summaries.length,5);
for(const s of recontact.summaries)assert(s.events.length===2&&s.events[0].kind==='release'&&s.events[1].kind==='contact');
const last=recontact.summaries.at(-1),previous=recontact.summaries.at(-2);
assert(last.maximumAngleError<1e-5&&last.integratedVelocityError<3e-5);
assert(Math.abs(last.events[1].time-previous.events[1].time)<5e-5);
assert.equal(hardware.topology.length,213);assert.deepEqual(hardware.topologyIssues,[]);assert.deepEqual(hardware.issues,[]);
assert.equal(hardware.poses.length,16);assert.equal(hardware.checks,24409000);assert(hardware.minimumStudGap> -2e-9&&hardware.maximumShifterError<1e-12);
for(const p of hardware.poses){
 assert.equal(p.independentPairs,18971);assert.equal(p.independentPairs,p.separated+p.reused+p.sampled);
 assert(Math.abs(p.state.outputAngle-(p.direction==='CCW'?-1:1)*1.4*p.state.inputAngle)<1e-12);
}
assert.equal(capture.views.length,12);assert.equal(inspections.views.length,12);assert.equal(capture.playback.length,2);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);
assert.equal(inspections.capture.file,paths.capture);assert.equal(inspections.capture.sha256,hashStudyFile(paths.capture));
for(const v of capture.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);assert.deepEqual(v.state,hardware.poses[v.pose].state);
}
for(const p of capture.playback){assert(p.frames>30&&p.duration>5&&p.duration<6&&p.p95UpdateMs<5);}

const priorStudies={};
for(const[label,file]of [
 ['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
 ['087-measured','artifacts/review/087-source-geometry-checkpoint.json'],['087-lost-motion','artifacts/review/087-lost-motion-checkpoint.json'],
 ['087-native-contact','artifacts/review/087-native-contact-checkpoint.json'],
]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label.startsWith('087')&&s.file.endsWith('.md'))archivedMarkdown++;
  else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
 }
 priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const failed='artifacts/review/087-first-fast-stud.json',failedResult=readStudyReport(failed);
for(const s of failedResult.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Failed query source '+s.file);
assert.equal(failedResult.maximumGapError,0);assert(failedResult.maximumGradientError>.004);
files.add('artifacts/review/087-first-recontact-refinement-trajectories.json.gz');
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.includes('weighted-clutch')&&file.endsWith('.mjs')){
 execFileSync(process.execPath,['--check',file]);syntax.push(file);
}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-first-flight-notes.md','artifacts/review/087-native-contact-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verify();
const checkpoint={movement:87,status:'isolated-unilateral-lift-and-first-flight-study',created:new Date().toISOString(),
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,
 full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
 productionBaseline:{file:baseline,sha256:hashStudyFile(baseline),unchangedInputs:Object.keys(frozen).length},sources,syntax,priorStudies,
 retained:[{file:failed,sha256:hashStudyFile(failed),qualification:'Failed initial fast-query derivative check; exact source snapshots retained. Corrected by tracking which body owns the separating axis.'}],
 reports:Object.fromEntries(Object.entries(paths).map(([name,file])=>[name,{file,sha256:hashStudyFile(file)}])),
 summary:{balanceDegrees:forces.equilibrium*180/Math.PI,weightVerticalDegrees:forces.weightVertical*180/Math.PI,
  finestStates:flight.branches.reduce((s,b)=>s+b.states,0),nativeSamples:flight.branches.reduce((s,b)=>s+b.nativeSamples,0),
  trajectories:flight.branches.map(b=>({direction:b.direction,endpointTime:b.endpointTime,endpointVelocity:b.endpointVelocity,
   relativeDefect:b.relativeDefect,relativeAbsoluteDefect:b.relativeAbsoluteDefect,
   lastComparisonWeightErrorPixels:b.comparisons.at(-1).maximumWeightErrorPixels})),
  firstRecontactRefinedTime:last.events[1].time,firstRecontactTimeDifference:Math.abs(last.events[1].time-previous.events[1].time),
  solids:213,hardwarePoses:16,surfaceSamples:hardware.checks,inspectedViews:12,
  playback:capture.playback.map(({direction,duration,fps,p95UpdateMs})=>({direction,duration,fps,p95UpdateMs}))},
 qualification:'Illustrative additive-component inertia; compressive native contact, release and gravity flight with prescribed E speed and a fixed shifter, ending just before opposite slot-end impact. Five-step convergence, separate initial-event refinement, momentum/energy checks, sampled hardware clearances and inspected partial-motion previews. The 75-pixel source-proportion departure, actual slot/fork impacts, loaded jaw contact, complete reversal, continuous clearance, final cycle speed and production integration remain pending. No new production build, full-suite test or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,unchangedInputs:Object.keys(frozen).length,sources:sources.length,syntax:syntax.length,summary:checkpoint.summary});
