import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-second-transfers',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-second-transfers.mjs']),reports={},paths={
    stopCW:'087-fixed-orbit-next-transfer-CW-coarse',stopCCW:'087-fixed-orbit-next-transfer-CCW-coarse',
    profileCW:'087-next-jaw-profile-CW',profileCCW:'087-next-jaw-profile-CCW',
    coarseCW:'087-fixed-orbit-next-measured-CW-coarse',coarseCCW:'087-fixed-orbit-next-measured-CCW-coarse',
    fineCW:'087-fixed-orbit-next-measured-CW-fine',fineCCW:'087-fixed-orbit-next-measured-CCW-fine',
    checkCW:'087-next-transfer-CW-check',checkCCW:'087-next-transfer-CCW-check',
    poses:'087-next-transfer-poses',captures:'087-next-transfer-rendered-captures',inspections:'087-next-transfer-rendered-inspections',
  };
function verifyProduction(){for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);}
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
  const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
  assert.equal(r.productionChanged,false);assert.equal(r.mechanicsPassed,false);
  if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
  for(const s of r.summaries??[])files.add(s.file);
}
for(const direction of ['CW','CCW']){
  const stopped=reports['stop'+direction].summaries[0],profile=reports['profile'+direction].profiles[0],
    coarse=reports['coarse'+direction].summaries[0],fine=reports['fine'+direction].summaries[0],check=reports['check'+direction],b=check.branches[0];
  assert(stopped.error.message.startsWith('Unmeasured potentially contacting')&&!stopped.settled);
  assert(profile.side===stopped.side&&profile.cuspRefined&&profile.maximumCheckedChordError<=2e-7);
  files.add('artifacts/review/087-next-jaw-profile-'+direction+'-queries.jsonl');
  for(const s of [coarse,fine])assert(!s.error&&s.settled&&s.end.time>=s.seat.time+.25-1e-12);
  assert.equal(coarse.resume.unchangedPrefixRows,stopped.states);
  assert.deepEqual(readStudyReport(coarse.file).rows.slice(0,stopped.states),readStudyReport(stopped.file).rows);
  assert.deepEqual(coarse.start,fine.start);
  assert(b.maximumMomentumResidual<1e-9&&b.maximumFreeVelocityError<1e-9&&b.maximumContactRateResidual<1e-8&&b.maximumInactiveClosingRate<1e-8&&b.maximumComplementarity<1e-8);
  assert(b.minimumGap> -2e-9&&b.minimumImpulse> -1e-12&&b.maximumFrictionConeExcess<1e-10&&b.maximumSlidingLawError<1e-10&&b.maximumFrictionPower<1e-10&&b.maximumImpulseEnergyResidual<1e-9);
  assert(Math.max(...b.positionDifference)<.002&&b.eventDifferences.every(e=>e.difference<.005)&&b.seatTimeDifference<.005&&b.preSlotWithdrawal<2e-5);
  assert(b.minimumNativeJawGap> -1e-6&&b.minimumNativeStudGap> -1e-6&&b.minimumNativeOtherGap> -1e-6&&b.maximumFastStudDifference<1e-10&&b.maximumNativeProfileError<1e-6&&b.maximumNativeBoundExcess<0);
  assert(b.freeChecks.length>0&&b.freeChecks.every(c=>c.maximumAngleError<.003&&c.maximumSpeedError<.003&&c.maximumEnergyError<1e-8));
  assert(check.poses.length===6&&check.poses.every(p=>!p.issues.length&&!p.topologyIssues.length&&p.topology.length===213));
}
const {captures,inspections}=reports;
assert(captures.views.length===12&&inspections.views.length===12&&captures.previews.length===2&&!captures.errors.length&&!captures.unexpectedWarnings.length);
assert.equal(hashStudyFile(inspections.capture.file),inspections.capture.sha256);
for(const v of captures.views){
  const checked=inspections.views.find(i=>i.file===v.file);assert(checked?.inspected&&checked.assessment&&v.maximumStateDifference<1e-12);
  assert.equal(hashStudyFile(v.file),v.sha256);assert.equal(checked.sha256,v.sha256);files.add(v.file);
}
for(const p of captures.previews){
  assert(p.completed&&p.frameCount>30&&p.duration===8000);
  for(const s of p.inputs){assert.equal(hashStudyFile(s.file),s.sha256);files.add(s.file);}
}
const priorStudies={};
for(const[label,file]of [['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
  ['087-connected','artifacts/review/087-connected-reversal-checkpoint.json'],['087-distributed','artifacts/review/087-distributed-source-checkpoint.json'],
  ['087-fixed-orbit','artifacts/review/087-fixed-orbit-checkpoint.json'],['087-fixed-reversal','artifacts/review/087-fixed-orbit-reversal-checkpoint.json']]){
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
for(const[i,file]of ['artifacts/review/087-second-transfer-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checks=[reports.checkCW,reports.checkCCW],summary={fineStates:checks.reduce((n,r)=>n+r.branches[0].states,0),
  hardwarePoses:12,hardwareSurfaceSamples:checks.reduce((n,r)=>n+r.poses.reduce((m,p)=>m+p.checks,0),0),
  newNativeQueries:reports.profileCW.profiles[0].queries+reports.profileCCW.profiles[0].queries,
  inspectedViews:12,previewExecutions:2,seatTimes:checks.map(r=>({direction:r.branches[0].direction,time:r.branches[0].seatTime}))};
const checkpoint={movement:87,created:new Date().toISOString(),status:'second-connected-fixed-orbit-transfers',
  productionChanged:false,candidateIntegrated:false,candidateAccepted:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
  boundedChecksPassed:true,ownedBrowserRunning:false,ownedStudyRunning:false,
  previousGoalTurnClassification:'Progress: first fixed-orbit reversal and following-lift validation committed and pushed as 35dcad4.',
  currentGoalTurnClassification:'Progress: measured newly approached native teeth and completed and checked both second connected transfers.',
  sources,syntax,priorStudies,summary,productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
  retainedStops:['CW','CCW'].map(direction=>({direction,file:'artifacts/review/'+paths['stop'+direction]+'.json',exitCode:1,acceptedAsComplete:false,
    reason:'Measured profile coverage ended before the next native jaw contact. The coarse prefix is preserved exactly in its measured continuation.'})),
  qualification:'Two successive reversals are now connected on each initialized branch. This does not establish long-term repeat behavior, continuous hardware clearance, source acceptance, historical material identity, final rendering/speed or production integration. Previews executed without recorded video review; all twelve stills were opened.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary});
