import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-connected-reversal',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
 baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-connected-reversal.mjs']),paths={
  neutralCoarse:'087-first-key-neutral',neutralFine:'087-quarter-key-neutral',neutralCheck:'087-first-key-neutral-check',
  impact:'087-first-key-jaw-impact',profiles:'087-first-key-seating-profiles',leftReuse:'087-reused-left-key-seating',
  parity:'087-key-engagement-parity',cornerRecovery:'087-key-corner-recovery',
  seatingCoarse:'087-first-key-seating-events',seatingFine:'087-quarter-key-seating-events',seatingCheck:'087-first-key-seating-check',
  followingLift:'087-first-connected-key-lift',followingCCW:'087-connected-key-lift-CCW-check',followingCW:'087-connected-key-lift-CW-check',
  followingRefinement:'087-next-left-lift-refinement',
  hardware:'087-connected-reversal-solids',captures:'087-connected-reversal-rendered-captures',inspections:'087-connected-reversal-rendered-inspections',
 },reports={};
function verifyProduction(){for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);}
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
 const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
 assert.equal(r.mechanicsPassed,false);assert.equal(r.productionChanged,false);
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
 for(const s of r.summaries??[])if(s.file)files.add(s.file);
 for(const s of r.levels??[])if(s.file)files.add(s.file);
 for(const b of r.branches??[])if(b.replayFile)files.add(b.replayFile);
}
const{neutralFine,neutralCheck,impact,profiles,leftReuse,parity,cornerRecovery,seatingFine,seatingCheck,followingLift,hardware,captures,inspections}=reports;
assert.equal(neutralFine.summaries.reduce((s,r)=>s+r.states,0),7850);
for(const r of neutralCheck.branches){
 assert(r.exactStateContinuity&&r.maximumMomentumResidual<1e-9&&r.maximumFrictionConeExcess<1e-10);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6&&r.impactTimeDifference<.0001);
}
for(const r of impact.rows){
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);
 assert(r.maximumDerivativeDifference<1e-5&&Math.max(...Object.values(r.witnessDistances).map(Math.abs))<1e-9);
}
assert.equal(impact.rows.find(r=>r.side==='right').shaftReverses,false);assert.equal(impact.rows.find(r=>r.side==='left').shaftReverses,true);
assert(profiles.profiles.every(p=>p.cuspRefined&&p.knots.length===750));
assert.deepEqual(profiles.profiles.find(p=>p.side==='left').knots,leftReuse.profiles[0].knots);
assert(Object.values(parity.maxima).every(x=>x<1e-8));
assert(cornerRecovery.rows.length===4&&cornerRecovery.maximumEventTimeDifference<1e-10&&cornerRecovery.maximumEventPositionDifference<1e-10);
assert.equal(seatingFine.summaries.reduce((s,r)=>s+r.states,0),72540);
for(const r of seatingCheck.branches){
 assert(r.settled&&r.exactImpactContinuity&&r.maximumMomentumResidual<1e-9&&r.maximumComplementarity<1e-8);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumSelectedPriorityVelocitySpread<1e-7);
 assert(r.minimumNativeJawGap> -1e-6&&r.maximumNativeProfileError<1e-6&&r.seatTimeDifference<.01&&r.native.length===65);
}
const followingChecks=[...reports.followingCCW.branches,...reports.followingCW.branches];assert.equal(followingChecks.length,2);
for(const r of followingChecks){
 assert(r.exactSeatedStateContinuity&&r.maximumMomentumResidual<1e-9&&r.maximumFreeVelocityError<1e-9&&r.maximumFrictionConeExcess<1e-10);
 assert(r.maximumWithdrawal<1e-8&&r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6);
 assert(r.freeChecks.length&&r.freeChecks.every(c=>c.maxAngleError<.0005&&c.maxSpeedError<.0005&&c.maximumEnergyError<1e-9));
 assert(!r.replayError&&r.replayStudTimeDifference<.002);
 if(r.direction==='CCW')assert(Math.max(...r.maximumReplayPositionDifference)<.005);
 else assert(r.maximumReplayPositionDifference[0]>.005,'Preserve the failed coarse CW lever comparison');
}
const refinement=reports.followingRefinement;
assert(refinement.exactSeedContinuity&&refinement.resolved&&refinement.levels.length===2);
assert(Math.max(...refinement.levels.at(-1).maxCoordinateDifference)<.001);
for(const r of refinement.levels){
 assert(!r.error&&r.maximumMomentumResidual<1e-9&&r.maximumFreeVelocityError<1e-9&&r.maximumContactRateResidual<1e-8);
 assert(r.maximumComplementarity<1e-8&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10);
 assert(r.maximumImpulseEnergyResidual<1e-9&&r.maximumWithdrawal<1e-8&&r.minimumNativeJawGap> -1e-6&&r.minimumNativeOtherGap> -1e-6);
}
assert(followingLift.summaries.every(s=>!s.error&&s.nextStud&&s.end.time>=s.nextStud.time+.5));
assert(hardware.topology.length===213&&hardware.poses.length===16&&!hardware.topologyIssues.length&&!hardware.issues.length);
assert(hardware.minimumJawGap> -1e-6&&hardware.minimumStudGap> -1e-9&&hardware.minimumCouplingGap> -1e-9);
for(const p of hardware.poses)assert(p.independentPairs===18971&&p.independentPairs===p.separated+p.reused+p.sampled);
assert(captures.views.length===10&&inspections.views.length===10&&captures.playback.length===4);
assert(!captures.errors.length&&!captures.unexpectedWarnings.length);assert.equal(inspections.capture.sha256,hashStudyFile(inspections.capture.file));
for(const v of captures.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);assert.deepEqual(v.state,hardware.poses[v.pose].state);files.add(v.file);
}
for(const p of captures.playback)assert(p.frames>20&&p.wallDuration>=4*p.duration&&p.fps>10&&p.p95UpdateMs<5);
const retained=[];
for(const stem of ['087-first-left-key-engagement','087-first-key-corner-step-diagnosis']){
 const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);files.add(file);
 for(const s of r.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);files.add(s.file);if(s.archive)files.add(s.archive);}
 for(const s of r.summaries??[])if(s.file)files.add(s.file);
 retained.push({file,sha256:hashStudyFile(file),qualification:stem.endsWith('diagnosis')?'Direct tool observation of the preserved failing state at eleven step sizes.':'Preserved coarse Newton failure at the seated corner; superseded by the event treatment.'});
}
retained.push({file:'artifacts/review/087-connected-key-lift-CW-check.json',
 sha256:hashStudyFile('artifacts/review/087-connected-key-lift-CW-check.json'),exitCode:1,
 qualification:'The checker exited 1 because the coarse following-lift lever discrepancy was 0.011431 radians, exceeding 0.005. Further local refinement is recorded separately; the original failure is retained.'});
const priorStudies={};
for(const[label,file]of [['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],['087','artifacts/review/087-key-friction-checkpoint.json']]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label==='087'&&s.file.endsWith('.md'))archivedMarkdown++;else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}}
 files.add(file);priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const syntax=[];for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-connected-reversal-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checkpoint={movement:87,created:new Date().toISOString(),status:'connected-key-friction-reversal-through-following-lift',
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
 ownedBrowserRunning:false,ownedStudyRunning:false,currentGoalTurnClassification:'Progress: continuous key-friction neutral travel, native opposite-jaw impacts, seated-corner treatment, loaded seating and a connected following lift established.',
 productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},sources,syntax,priorStudies,retained,
 reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
 summary:{neutralFineStates:7850,seatingFineStates:72540,followingStates:followingLift.summaries.reduce((s,r)=>s+r.states,0),
  seats:seatingCheck.branches.map(({direction,side,seat,seatTimeDifference,maxCoordinateDifference})=>({direction,side,seatTime:seat.time,seatTimeDifference,maxCoordinateDifference})),
  following:followingChecks.map(({direction,nextStudTime,nextStudKeyAngle,maximumWithdrawal,freeChecks,replayStudTimeDifference,maximumReplayPositionDifference})=>
   ({direction,nextStudTime,nextStudKeyAngle,maximumWithdrawal,freeChecks,replayStudTimeDifference,maximumReplayPositionDifference})),
  followingLeftRefinement:refinement.levels.map(({h,states,maxCoordinateDifference,nextStudTimeDifference,absolutePhysicalContactWorkDefect})=>
   ({h,states,maxCoordinateDifference,nextStudTimeDifference,absolutePhysicalContactWorkDefect})),
  solids:213,hardwarePoses:16,surfaceSamples:hardware.checks,inspectedViews:10,playback:captures.playback},
 qualification:'Both initialized branches now continue without state resets through reversal, opposite seating, held key-clearance motion and the next lifting stroke. A coarse CW following-lift transient failed the convergence check; finer local continuations from the same held state resolve that discrepancy and supply its preview. This establishes later preload from actual motion under the retained illustrative material hypothesis. Source pin proportions, repeated full cycles, continuous clearance, final speed and production integration remain unresolved. No production build, full numerical suite or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary:checkpoint.summary});
