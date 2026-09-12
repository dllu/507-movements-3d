import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-key-friction',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
 baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-key-friction.mjs']),paths={
  native:'087-first-native-key',bores:'087-both-key-bores',projector:'087-first-key-friction-projector',impact:'087-first-key-impact',
  earlyCoarse:'087-first-key-lift',earlyFine:'087-quarter-key-lift',earlyCheck:'087-first-key-lift-check',
  releaseCoarse:'087-first-key-release',releaseFine:'087-quarter-key-release',releaseCheck:'087-first-key-release-check',
  hardware:'087-first-key-release-solids',captures:'087-key-release-rendered-captures',inspections:'087-key-release-rendered-inspections',
 },reports={};
function verifyProduction(){for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);}
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
 const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
 if(name!=='projector'){assert.equal(r.mechanicsPassed,false);assert.equal(r.productionChanged,false);}
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
 for(const s of r.summaries??[])if(s.file)files.add(s.file);
}
const{native,projector,impact,earlyFine,earlyCheck,releaseFine,releaseCheck,hardware,captures,inspections}=reports;
assert(native.maximumParityError===0&&native.maximumGradientError<1e-7&&native.maximumWitnessError<1e-9&&native.witnesses.length===36);
for(const r of reports.bores.rows)assert(r.samples.every(s=>s.inside)&&Math.max(...r.boundDifferences.map(Math.abs))<1e-12);
assert(projector.passed&&projector.rows.length===11);
assert(impact.rows.length===14&&impact.gravityChecks.length===65);
for(const r of impact.rows){assert(Math.max(...r.holding.v.map(Math.abs))<1e-8);
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);}
for(const r of earlyFine.summaries)assert(!r.error&&r.states===8001&&r.maximumWithdrawal<1e-9);
for(const r of releaseFine.summaries)assert(!r.error&&r.reachedWithdrawalThreshold&&r.withdrawal>=.002);
for(const r of [...earlyCheck.branches,...releaseCheck.branches]){
 assert(r.maximumMomentumResidual<1e-9&&r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12&&r.maximumContactVelocityResidual<1e-8);
 assert(r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10&&r.maximumKeyGapWithFriction<2e-8);
 assert(r.minimumNativeJawGap> -1e-6&&r.minimumNativeOffstepGap> -1e-6&&r.native.length===33);
}
for(const r of releaseCheck.branches)assert(r.releaseTimeDifference<.01&&Math.max(...r.maxCoordinateDifference)<.01);
assert.equal(hardware.topology.length,213);assert.equal(hardware.poses.length,12);
assert.deepEqual(hardware.topologyIssues,[]);assert.deepEqual(hardware.issues,[]);
assert(hardware.minimumJawGap> -1e-6&&hardware.minimumStudGap> -1e-9&&hardware.minimumCouplingGap> -1e-9);
for(const p of hardware.poses)assert(p.independentPairs===18971&&p.independentPairs===p.separated+p.reused+p.sampled);
assert.equal(captures.views.length,10);assert.equal(inspections.views.length,10);assert.equal(captures.playback.length,2);
assert.deepEqual(captures.errors,[]);assert.deepEqual(captures.unexpectedWarnings,[]);
assert.equal(inspections.capture.sha256,hashStudyFile(inspections.capture.file));
for(const v of captures.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);assert.deepEqual(v.state,hardware.poses[v.pose].state);
 files.add(v.file);
}
for(const p of captures.playback)assert(p.frames>100&&p.wallDuration>=1.5*p.duration&&p.fps>10&&p.p95UpdateMs<5);
const priorStudies={};
for(const[label,file]of [
 ['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
 ['087','artifacts/review/087-loaded-seating-checkpoint.json'],
]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label==='087'&&s.file.endsWith('.md'))archivedMarkdown++;
  else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
 }
 files.add(file);priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-key-friction-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checkpoint={movement:87,created:new Date().toISOString(),status:'native-key-friction-retains-and-releases-bounded-candidate',
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
 ownedBrowserRunning:false,ownedStudyRunning:false,
 currentGoalTurnClassification:'Progress: actual feather clearance, independent D/shaft spin, Coulomb contact, two loaded lifts and subsequent withdrawal established under an explicit material hypothesis.',
 productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},sources,syntax,priorStudies,
 reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
 summary:{nativeKeyLimits:[native.parameters.lower.angle,native.parameters.upper.angle],analyticCases:projector.rows.length,
  initialImpactHypotheses:impact.rows.length,earlyFineStates:earlyFine.summaries.reduce((s,r)=>s+r.states,0),
  releaseFineStates:releaseFine.summaries.reduce((s,r)=>s+r.states,0),
  release:releaseCheck.branches.map(({direction,releaseEvent,releaseTimeDifference,maxCoordinateDifference,absolutePhysicalContactWorkDefect})=>
   ({direction,releaseEvent,releaseTimeDifference,maxCoordinateDifference,absolutePhysicalContactWorkDefect})),
  solids:213,hardwarePoses:12,surfaceSamples:hardware.checks,inspectedViews:10,playback:captures.playback},
 qualification:'Illustrative dry key friction resolves the earlier cam-out within these independently initialized loaded lifting/withdrawal branches. This is not a connected reversal or historical material identification. Initial preload, neutral travel, opposite-jaw seating, source proportions, continuous clearance, final speed and production integration remain unresolved. No production build, full numerical suite or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary:checkpoint.summary});
