import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-fixed-orbit-reversal',
  baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',baseline=readStudyReport(baselineFile),
  files=new Set(['scripts/record-weighted-clutch-fixed-orbit-reversal.mjs']),reports={},paths={
    transferCoarse:'087-fixed-orbit-transfer-coarse',transferFine:'087-fixed-orbit-transfer-fine',transfer:'087-fixed-orbit-transfer-check',
    freeFall:'087-fixed-orbit-free-fall',impactCoarse:'087-fixed-orbit-jaw-impact-coarse',impact:'087-fixed-orbit-jaw-impact',
    pruning:'087-native-jaw-pruning',profiles:'087-fixed-orbit-jaw-profiles-pruned',
    seatingCoarse:'087-fixed-orbit-seating-coarse',seatingFine:'087-fixed-orbit-seating-fine',
    seatCW:'087-fixed-orbit-seating-CW-check',seatCCW:'087-fixed-orbit-seating-CCW-check',
    followingCWCoarse:'087-fixed-orbit-following-CW-coarse',followingCWFine:'087-fixed-orbit-following-CW-fine',
    followingCCWCoarse:'087-fixed-orbit-following-CCW-coarse',followingCCWFine:'087-fixed-orbit-following-CCW-fine',
    followingCW:'087-fixed-orbit-following-CW-check',originalFollowingCCW:'087-fixed-orbit-following-CCW-check',
    tightCoarse:'087-fixed-orbit-following-CCW-tight-coarse',tightFine:'087-fixed-orbit-following-CCW-tight-fine',
    followingCCW:'087-fixed-orbit-following-CCW-tight-stud-check',activationParity:'087-tight-stud-activation-parity',
    poses:'087-fixed-orbit-reversal-poses',
    transferCaptures:'087-fixed-orbit-transfer-rendered-captures',transferInspections:'087-fixed-orbit-transfer-rendered-inspections',
    reversalCaptures:'087-fixed-orbit-reversal-rendered-captures',reversalInspections:'087-fixed-orbit-reversal-rendered-inspections',
  };
function verifyProduction(){for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);}
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
  const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
  assert.equal(r.productionChanged,false);assert.equal(r.mechanicsPassed,false);
  if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
  for(const s of r.summaries??[]){assert(!s.error);files.add(s.file);}
}

// Check the recorded numerical evidence without repeating expensive runs.
const qualified=['transfer','seatCW','seatCCW','followingCW','followingCCW'];
for(const name of qualified){
  const r=reports[name];assert(r.branches.length>0&&r.poses.length>0);
  for(const b of r.branches){
    assert(b.maximumMomentumResidual<1e-9&&b.maximumContactRateResidual<1e-8&&b.maximumComplementarity<1e-8,name);
    assert(b.minimumGap> -2e-9&&b.minimumImpulse> -1e-12,name);
    assert(b.maximumFrictionConeExcess<1e-10&&b.maximumSlidingLawError<1e-10&&b.maximumFrictionPower<1e-10,name);
    assert(b.minimumNativeJawGap> -1e-6&&b.minimumNativeOtherGap> -1e-6,name);
    assert(Math.max(...(b.positionDifference??b.maxCoordinateDifference))<.002,name);
    if(name.startsWith('seat'))assert(b.exactImpactContinuity&&b.settled&&b.seatTimeDifference<.005);
    else assert(b.maximumFreeVelocityError<1e-9);
    if(name.startsWith('following')){
      assert(b.nextStudTimeDifference<.005&&b.maximumWithdrawal<2e-5&&b.freeChecks.length>0);
      assert(b.freeChecks.every(c=>c.maximumAngleError<.001&&c.maximumSpeedError<.001&&c.maximumEnergyError<1e-8));
    }
  }
  assert(r.poses.every(p=>!p.issues.length&&!p.topologyIssues.length&&p.topology.length===213));
}
for(const b of reports.freeFall.branches){
  assert(b.checks.length>0&&b.checks.every(c=>c.maximumAngleError<.003&&c.maximumSpeedError<.003&&c.maximumEnergyError<1e-8));
}
for(const r of [reports.impactCoarse,reports.impact])for(const b of r.rows){
  assert(b.maximumDerivativeDifference<1e-6&&Math.max(...b.momentumResidual.map(Math.abs))<1e-9);
  assert(Math.abs(b.impact.impulseEnergyResidual)<1e-9&&Math.abs(b.closingRateAfter)<1e-8);
  assert(Math.max(...Object.values(b.witnessDistances).map(Math.abs))<1e-9&&!b.shaftReverses);
}
assert(reports.pruning.summary.queries===142&&reports.pruning.summary.maximumGapError===0&&reports.pruning.summary.maximumWitnessError===0);
assert(reports.profiles.profiles.length===2&&reports.profiles.profiles.every(p=>p.cuspRefined&&p.maximumCheckedChordError<=2e-7));
assert(reports.profiles.profiles.reduce((n,p)=>n+p.reusedQueries,0)===3829);

// Retain the rejected early activation and distinguish the local refinement
// from the earlier independent coarse/fine hold-step comparison.
assert(reports.originalFollowingCCW.branches[0].maximumComplementarity>1e-8);
const parity=reports.activationParity;
assert(parity.rows.length===30&&parity.rows.every(r=>r.positionError===0&&r.velocityError===0));
assert.deepEqual(parity.event.original.q,parity.event.tight.q);
assert(parity.event.original.active.some(c=>c.kind==='stud'&&c.gap>1e-8&&c.impulse>.7));
assert(!parity.event.tight.active.some(c=>c.kind==='stud'));
for(const name of ['tightCoarse','tightFine']){
  const s=reports[name].summaries[0],r=readStudyReport(s.file),original=readStudyReport(s.refinement.originalFile);
  assert.equal(s.refinement.studVelocityContactTolerance,2e-12);
  assert.equal(s.refinement.unchangedPrefixRows,20983);
  assert.deepEqual(r.rows.slice(0,s.refinement.unchangedPrefixRows),original.rows.slice(0,s.refinement.unchangedPrefixRows));
  assert(r.rows.length===s.states&&s.end.time>=s.nextStud.time+.5-1e-12);
}

let inspectedViews=0,previewExecutions=0;
for(const[label,count,previewCount]of [['transfer',14,2],['reversal',12,4]]){
  const captures=reports[label+'Captures'],inspections=reports[label+'Inspections'];
  assert(captures.views.length===count&&inspections.views.length===count&&!captures.errors.length&&!captures.unexpectedWarnings.length);
  assert.equal(hashStudyFile(inspections.capture.file),inspections.capture.sha256);
  for(const v of captures.views){
    const checked=inspections.views.find(i=>i.file===v.file);assert(checked?.inspected&&checked.assessment);
    assert.equal(hashStudyFile(v.file),v.sha256);assert.equal(checked.sha256,v.sha256);
    assert(v.maximumStateDifference<1e-12);files.add(v.file);inspectedViews++;
  }
  assert(captures.previews.length===previewCount);
  for(const p of captures.previews){
    assert(p.completed&&p.frameCount>30&&p.duration===8000);previewExecutions++;
    for(const s of p.inputs??[p]){assert.equal(hashStudyFile(s.file),s.sha256);files.add(s.file);}
  }
}
const stoppedFile='artifacts/review/087-fixed-orbit-jaw-profiles-reference-stop.json',stopped=readStudyReport(stoppedFile);
assert(!stopped.completed&&!stopped.acceptedProfile&&stopped.exitCode===143&&!stopped.ownedProcessRunning);
assert.equal(hashStudyFile(stopped.journal.file),stopped.journal.sha256);assert.equal(stopped.journal.queries,3829);
files.add(stoppedFile);files.add(stopped.journal.file);
for(const s of stopped.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);files.add(s.archive??s.file);}

const priorStudies={};
for(const[label,file]of [['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
  ['087-connected','artifacts/review/087-connected-reversal-checkpoint.json'],['087-distributed','artifacts/review/087-distributed-source-checkpoint.json'],
  ['087-fixed-orbit','artifacts/review/087-fixed-orbit-checkpoint.json']]){
  const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
  for(const s of r.sources){
    assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
    if(label.startsWith('087')&&s.file.endsWith('.md'))archivedMarkdown++;
    else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
  }
  files.add(file);priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-fixed-orbit-transfer-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const summary={qualifiedStoredStates:qualified.reduce((n,name)=>n+reports[name].branches.reduce((m,b)=>m+b.states,0),0),
  hardwarePoses:qualified.reduce((n,name)=>n+reports[name].poses.length,0),
  hardwareSurfaceSamples:qualified.reduce((n,name)=>n+reports[name].poses.reduce((m,p)=>m+p.checks,0),0),
  inspectedViews,previewExecutions,pruningQueries:142,unaffectedActivationComparisons:parity.rows.length};
assert(summary.qualifiedStoredStates===76004&&summary.hardwarePoses===28&&summary.hardwareSurfaceSamples===43124924);
const checkpoint={movement:87,created:new Date().toISOString(),status:'fixed-orbit-connected-reversal-and-bounded-following-lift',
  productionChanged:false,candidateIntegrated:false,candidateAccepted:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
  boundedChecksPassed:true,ownedBrowserRunning:false,ownedStudyRunning:false,
  currentGoalTurnClassification:'Progress: qualified fixed-orbit transfer, seating and the following lift; resolved premature stud activation and verified exact native-query pruning.',
  sources,syntax,priorStudies,summary,
  productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
  retainedOutcomes:{referenceProfiler:{file:stoppedFile,exitCode:143,accepted:false,completedQueries:3829},
    originalFollowingCCW:{file:'artifacts/review/'+paths.originalFollowingCCW+'.json',exitCode:1,accepted:false,
      reason:'Premature stud velocity impulse at positive gap; retained separately from the stricter locally refined continuation.'}},
  qualification:'Bounded transfer, seating, held rotation and following lift checks pass for this isolated candidate. Stored-state totals include shared segment endpoints and a reused held prefix. Discrete hardware samples and stills do not prove continuous clearance; previews executed without recorded video review. Repeating full transfers, source acceptance, material identity, final rendering/speed and integration remain unresolved.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary});
