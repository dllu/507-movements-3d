import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-four-transfers',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-four-transfers.mjs',baselineFile]),checks=[],profiles=[],branches=[];
function read(file){const r=readStudyReport(file);files.add(file);if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}return r;}
for(const direction of ['CW','CCW'])for(const segment of [1,2]){
  const stem='artifacts/review/087-sequence-'+direction,
    check=read(stem+'-segment-'+segment+'-check.json'),shaft=read(stem+'-segment-'+segment+'-free-shaft.json'),b=check.branches[0],
    fineFile=stem+(direction==='CCW'&&segment===2?'-resumed-fine':'-fine')+'-segment-'+segment+'.json.gz',fine=read(fineFile),
    coarseFile=stem+'-coarse-segment-'+segment+'.json.gz',coarse=read(coarseFile);
  for(const r of [check,shaft,fine,coarse])assert(r.productionChanged===false&&r.mechanicsPassed===false);
  for(const r of [fine,coarse])assert(r.settled&&!r.error&&r.end.time>=r.seat.time+.25-1e-12);
  if(segment===2){
    assert.deepEqual(fine.start,read(stem+'-fine-segment-1.json.gz').end);
    assert.deepEqual(coarse.start,read(stem+'-coarse-segment-1.json.gz').end);
  }else assert.deepEqual(fine.start,coarse.start);
  if(fine.continuation){assert.equal(hashStudyFile(fine.continuation.input),fine.continuation.sha256);assert.deepEqual(fine.start,read(fine.continuation.input).end);}
  assert(b.maximumMomentumResidual<1e-9&&b.maximumFreeVelocityError<1e-9&&b.maximumContactRateResidual<1e-8&&b.maximumInactiveClosingRate<1e-8&&b.maximumComplementarity<1e-8);
  assert(b.minimumGap> -2e-9&&b.minimumImpulse> -1e-12&&b.maximumFrictionConeExcess<1e-10&&b.maximumSlidingLawError<1e-10&&b.maximumFrictionPower<1e-10&&b.maximumImpulseEnergyResidual<1e-9);
  assert(Math.max(...b.positionDifference)<.002&&b.eventDifferences.every(e=>e.difference<.005)&&b.seatTimeDifference<.005&&b.preSlotWithdrawal<2e-5);
  assert(b.minimumNativeJawGap> -1e-6&&b.minimumNativeStudGap> -1e-6&&b.minimumNativeOtherGap> -1e-6&&b.maximumFastStudDifference<1e-10&&b.maximumNativeProfileError<1e-6&&b.maximumNativeBoundExcess<0);
  assert(b.freeChecks.length&&b.freeChecks.every(c=>c.maximumAngleError<.003&&c.maximumSpeedError<.003&&c.maximumEnergyError<1e-8));
  assert(shaft.passed&&shaft.checks.length&&shaft.checks.every(c=>c.maximumAngleError<.001&&c.maximumSpeedError<.001&&c.maximumEnergyError<1e-8));
  assert(check.poses.length===8&&check.poses.every(p=>!p.issues.length&&!p.topologyIssues.length&&p.topology.length===213));
  const side=(direction==='CW')===(segment===1)?'right':'left',profile=read(stem+'-coarse-native-'+segment+'-'+side+'.json'),p=profile.profiles[0];
  assert(p.cuspRefined&&p.maximumCheckedChordError<=2e-7&&p.cuspSlopes.left>0&&p.cuspSlopes.right<0);
  assert.equal(hashStudyFile(profile.journal.file),profile.journal.sha256);files.add(profile.journal.file);profiles.push(p);checks.push(check);
  branches.push({direction,reversal:segment+2,fineFile,states:b.states,seatTime:b.seatTime,positionDifference:b.positionDifference,
    eventDifferences:b.eventDifferences,maximumComplementarity:b.maximumComplementarity,freeShaftChecks:shaft.checks});
}
const poses=read(prefix+'-poses.json'),captures=read(prefix+'-rendered-captures.json'),inspections=read(prefix+'-rendered-inspections.json');
assert(poses.poses.length===24&&captures.views.length===24&&inspections.views.length===24&&captures.previews.length===2);
assert(!captures.errors.length&&!captures.unexpectedWarnings.length);assert.equal(hashStudyFile(inspections.capture.file),inspections.capture.sha256);
for(const v of captures.views){
  const inspected=inspections.views.find(p=>p.file===v.file);assert(inspected?.inspected&&inspected.assessment&&v.maximumStateDifference<1e-12);
  assert.equal(inspected.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);files.add(v.file);
}
for(const p of captures.previews){assert(p.completed&&p.frameCount>30&&p.duration===8000);for(const input of p.inputs){assert.equal(hashStudyFile(input.file),input.sha256);files.add(input.file);}}
const priorStudies=[];
for(const file of ['082-bounded-writer-checkpoint','083-thirtysecond-complete-checkpoint','087-connected-reversal-checkpoint',
  '087-distributed-source-checkpoint','087-fixed-orbit-checkpoint','087-fixed-orbit-reversal-checkpoint','087-second-transfers-checkpoint','088-production-review-checkpoint']){
  const path='artifacts/review/'+file+'.json',r=readStudyReport(path);let currentInputs=0,archivedMarkdown=0;
  for(const s of r.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);if(s.file.endsWith('.md'))archivedMarkdown++;else{assert.equal(hashStudyFile(s.file),s.sha256);currentInputs++;}}
  files.add(path);priorStudies.push({file:path,sha256:hashStudyFile(path),currentInputs,archivedMarkdown});
}
const interrupted=[
  {handle:98232,pid:2643724,prefix:'087-sequence-CCW-coarse',lastPublishedSegment:2},
  {handle:6907,pid:2674273,prefix:'087-sequence-CCW-fine',lastPublishedSegment:1},
  {handle:88251,pid:2674248,prefix:'087-sequence-CW-fine',lastPublishedSegment:2},
].map(r=>{
  const file='artifacts/review/'+r.prefix+'-progress.jsonl';files.add(file);
  return{...r,exitCode:143,journal:{file,sha256:hashStudyFile(file)},reason:'The tool returned signal termination without a solver error report. Published segments remain immutable; unfinished in-memory work is not accepted as evidence.'};
});
files.add('scripts/study-weighted-clutch-sequence-continuation.mjs');
const syntax=[];for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-four-transfer-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const ownedProcesses=[
  {handle:47650,pid:2643717,description:'CW coarse continuation toward six reversals'},
  {handle:2864,pid:2725020,description:'CCW resumed fine fourth reversal'},
  {handle:11280,pid:2725417,description:'CW resumed fine fifth reversal'},
  {handle:9176,pid:2725441,description:'CCW resumed coarse fifth reversal'},
  {handle:90652,pid:2744449,description:'CCW fine fifth reversal'},
  {handle:66116,pid:2745192,description:'CW fine sixth reversal'},
  {handle:87070,pid:2746470,description:'CCW coarse sixth reversal'},
  {handle:8269,pid:2745181,description:'Independent CW fifth-reversal check outside this checkpoint'},
].map(p=>({...p,running:fs.existsSync('/proc/'+p.pid+'/cmdline')&&fs.readFileSync('/proc/'+p.pid+'/cmdline','utf8').includes('weighted-clutch-')}));
const summary={fineStates:checks.reduce((n,r)=>n+r.branches[0].states,0),hardwarePoses:32,
  hardwareSurfaceSamples:checks.reduce((n,r)=>n+r.poses.reduce((m,p)=>m+p.checks,0),0),newNativeQueries:profiles.reduce((n,p)=>n+p.queries,0),
  nativeContactSamples:396,inspectedViews:24,previewExecutions:2,maximumPositionDifference:Math.max(...branches.flatMap(b=>b.positionDifference)),
  maximumEventDifference:Math.max(...branches.flatMap(b=>b.eventDifferences.map(e=>e.difference)))};
const checkpoint={movement:87,created:new Date().toISOString(),status:'four-connected-fixed-orbit-transfers',
  productionChanged:false,candidateIntegrated:false,candidateAccepted:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
  boundedChecksPassed:true,sources,syntax,priorStudies,branches,summary,interrupted,ownedProcesses,
  ownedBrowserRunning:false,ownedStudyRunning:ownedProcesses.some(p=>p.running),
  productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  currentGoalTurnClassification:'Progress: diagnose 088 source mismatch and qualify the third and fourth connected 087 transfers; further bounded continuations remain separate.',
  qualification:'Four successive reversals per independently initialized branch are now connected through integrated states and motor clock. This checkpoint qualifies only the two newly completed reversals per branch. Longer workers and signal-terminated unpublished work are explicitly outside the qualified prefix. Source acceptance, periodic closure, material identity, continuous clearance, final playback and production integration remain unresolved. Previews executed without recorded video review; all twenty-four stills were opened.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,summary,ownedProcesses});
