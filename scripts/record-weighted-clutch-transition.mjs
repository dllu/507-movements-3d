import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-clutch-transition',
 baseline='artifacts/review/086-integrated-verified-source-hashes.json',frozen=readStudyReport(baseline),
 verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);},
 files=new Set(['scripts/record-weighted-clutch-transition.mjs']),reports={},paths={
  couplings:'artifacts/review/087-first-native-couplings.json',jaws:'artifacts/review/087-first-native-jaws.json',
  mass:'artifacts/review/087-first-shift-mass-check.json',gravity:'artifacts/review/087-first-output-gravity-check.json',
  shift:'artifacts/review/087-first-gravity-shift-check.json',impact:'artifacts/review/087-first-gravity-jaw-impact.json',
  hardware:'artifacts/review/087-first-gravity-shift-solids.json',capture:'artifacts/review/087-gravity-shift-rendered-captures.json',
  inspections:'artifacts/review/087-gravity-shift-rendered-inspections.json',
 };
verify();
for(const[name,file]of Object.entries(paths)){
 const r=readStudyReport(file);reports[name]=r;assert.equal(r.mechanicsPassed,false);files.add(file);
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
}
const{couplings,jaws,mass,gravity,shift,impact,hardware,capture,inspections}=reports;
assert.equal(couplings.maximumParityError,0);assert.equal(couplings.parity.length,130);assert.equal(couplings.parameters.events.length,406);
assert.equal(couplings.slotWitnesses.length,6);assert.equal(couplings.forkWitnesses.length,516);
assert(couplings.maximumWitnessResidual<1e-10&&couplings.maximumForkGradientError<1e-6);
assert.equal(jaws.rows.length,66);assert(jaws.maximumWitnessResidual<1e-9&&jaws.minimumInitialGap>0);
assert(jaws.maximumAnalyticError>.0002&&jaws.maximumAnalyticError<.00021);
assert.equal(mass.components.length,94);assert.equal(mass.rows.length,3);assert(mass.maximumError<1e-7);
assert.equal(gravity.rows.length,257);assert(gravity.maximumPotentialError<1e-9&&gravity.maximumDerivativeError<1e-7);
assert(Math.abs(gravity.parameters.waves.find(w=>w.group==='E').sine)>2);
assert.equal(shift.branches.reduce((s,b)=>s+b.states,0),31155);assert.equal(shift.jawSamples.length,32);
for(const b of shift.branches){
 assert(b.maximumMomentumResidual<1e-9&&b.maximumClosingRate<1e-9&&b.maximumComplementarity<1e-9&&b.minimumGap> -2e-9&&b.minimumImpulse>=0);
 assert(b.relativeAbsoluteDefect<.0001&&b.endpoint.oppositeJawImpact&&Math.abs(b.endpoint.jaw.gap)<1e-9);
 assert(b.comparisons.at(-1).endpointTimeDifference<2e-5&&b.comparisons.at(-1).endpointVelocityDifference<1e-4);
 assert(b.comparisons.every(c=>c.absoluteEnergyDefectRatio<.4));
}
for(const j of shift.jawSamples)assert(Math.abs(j.error)<=j.bound);
assert.equal(impact.rows.length,2);
for(const r of impact.rows){
 assert(r.shaftReverses&&r.maximumDerivativeDifference<1e-5&&r.active.length===3&&r.active.every(c=>c.impulse>=0));
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.energyResidual)<1e-9&&Math.abs(r.closingRateAfter)<1e-9);
 assert(Math.max(...Object.values(r.witnessDistances).map(Math.abs))<1e-9&&r.directionalChecks.at(-1).gap> -1e-8);
 assert.equal(r.outputInertia,mass.outputInertia);
}
assert.equal(hardware.topology.length,213);assert.deepEqual(hardware.topologyIssues,[]);assert.deepEqual(hardware.issues,[]);
assert.equal(hardware.poses.length,12);assert.equal(hardware.checks,18237132);assert(hardware.minimumJawGap> -1e-9&&hardware.minimumCouplingGap> -1e-9);
for(const p of hardware.poses){assert.equal(p.independentPairs,18971);assert.equal(p.independentPairs,p.separated+p.reused+p.sampled);}
assert.equal(capture.views.length,12);assert.equal(inspections.views.length,12);assert.equal(capture.playback.length,2);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);
assert.equal(inspections.capture.file,paths.capture);assert.equal(inspections.capture.sha256,hashStudyFile(paths.capture));
for(const v of capture.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);assert.deepEqual(v.state,hardware.poses[v.pose].state);
}
for(const p of capture.playback){assert(p.frames>20&&p.duration>.2&&p.duration<.3&&p.wallDuration>8*p.duration&&p.p95UpdateMs<5);}

const retained=[];
for(const file of ['artifacts/review/087-first-neutral-check.json','artifacts/review/087-first-shift-solids.json','artifacts/review/087-confirmed-first-jaw-impact.json']){
 const r=readStudyReport(file);verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);files.add(file);
 retained.push({file,sha256:hashStudyFile(file),qualification:'Constant-output-speed control, superseded for physical neutral travel because it omits eccentric output gravity.'});
}
const failed='artifacts/review/087-first-jaw-impact.json',failure=readStudyReport(failed);
for(const s of failure.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Failed impact source '+s.file);
assert.equal(failure.rows.find(r=>r.direction==='CW').shaftReverses,false);
retained.push({file:failed,sha256:hashStudyFile(failed),qualification:'Retained failed expectation that both first impacts in the constant-speed control must reverse. Exact sources preserved; the control also omits output gravity.'});
const priorStudies={};
for(const[label,file]of [
 ['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
 ['087-measured','artifacts/review/087-source-geometry-checkpoint.json'],['087-lost-motion','artifacts/review/087-lost-motion-checkpoint.json'],
 ['087-native-contact','artifacts/review/087-native-contact-checkpoint.json'],['087-first-flight','artifacts/review/087-first-flight-checkpoint.json'],
]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label.startsWith('087')&&s.file.endsWith('.md'))archivedMarkdown++;
  else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
 }
 priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.includes('weighted-clutch')&&file.endsWith('.mjs')){
 execFileSync(process.execPath,['--check',file]);syntax.push(file);
}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-clutch-transition-notes.md','artifacts/review/087-first-flight-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verify();
const checkpoint={movement:87,status:'isolated-native-clutch-shift-and-first-jaw-impact-study',created:new Date().toISOString(),
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,
 full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
 productionBaseline:{file:baseline,sha256:hashStudyFile(baseline),unchangedInputs:Object.keys(frozen).length},sources,syntax,priorStudies,retained,
 reports:Object.fromEntries(Object.entries(paths).map(([name,file])=>[name,{file,sha256:hashStudyFile(file)}])),
 summary:{nativeSlotLimits:[couplings.parameters.lower.angle,couplings.parameters.upper.angle],nativeSlotEvents:406,
  slotWitnesses:6,forkWitnesses:516,nativeJawPoses:66,maximumNativeJawApproximationError:jaws.maximumAnalyticError,
  outputInertia:mass.outputInertia,outputGravity:gravity.parameters.waves,finestStates:31155,
  shifts:shift.branches.map(b=>({direction:b.direction,timeToJaw:b.endpoint.time,endCoordinates:b.endpoint.q,
   relativeDefect:b.relativeDefect,relativeAbsoluteDefect:b.relativeAbsoluteDefect})),
  impacts:impact.rows.map(r=>({direction:r.direction,before:r.velocityBefore,after:r.velocityAfter,shaftReverses:r.shaftReverses,
   motorImpulseWork:r.motorImpulseWork,plasticLoss:r.plasticLoss})),solids:213,hardwarePoses:12,surfaceSamples:hardware.checks,inspectedViews:12,
  playback:capture.playback.map(({direction,duration,wallDuration,fps,p95UpdateMs})=>({direction,duration,wallDuration,fps,p95UpdateMs}))},
 qualification:'Exact native slot/fork limits and jaw-front clearance, independent four-coordinate inertia/output gravity, refined neutral travel, compressive first-jaw impacts that reverse both incoming shaft velocities, sampled surrounding hardware and inspected partial previews. Loaded seating, initial engaged-jaw preload, a continuous repeating reversal, the 75-pixel source-proportion departure, full-motion clearance, final speed and production integration remain unresolved. No new production build, full-suite test or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,unchangedInputs:Object.keys(frozen).length,sources:sources.length,syntax:syntax.length,summary:checkpoint.summary});
