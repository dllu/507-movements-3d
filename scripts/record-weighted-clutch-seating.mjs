import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-loaded-seating',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
 baseline=readStudyReport(baselineFile),verifyProduction=()=>{
  for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
 },files=new Set(['scripts/record-weighted-clutch-seating.mjs']),paths={
  cusps:'087-refined-seating-cusps',coarse:'087-refined-first-seating',fine:'087-refined-quarter-seating',
  seating:'087-refined-seating-check',holding:'087-refined-seated-hold',impact:'087-refined-next-stud-impact',
  outgoing:'087-refined-next-lift',retention:'087-refined-retention-check',hardware:'087-first-loaded-seating-solids',
  captures:'087-loaded-seating-rendered-captures',inspections:'087-loaded-seating-rendered-inspections',
 },reports={};
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
 const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
 assert.equal(r.mechanicsPassed,false);assert.equal(r.productionChanged,false);
 if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
 if(r.summaries)for(const s of r.summaries){const path='artifacts/review/'+stem+'-'+s.direction+'.json.gz';if(fs.existsSync(path))files.add(path);}
}
const{cusps,coarse,fine,seating,holding,impact,outgoing,retention,hardware,captures,inspections}=reports;
assert.equal(cusps.rows.length,2);
for(const r of cusps.rows){
 assert(r.slopes.left>.31&&r.slopes.right<-.31);
 assert(r.checks.every(c=>Math.abs(c.left-r.slopes.left)<1e-4&&Math.abs(c.right-r.slopes.right)<1e-4));
}
assert.equal(fine.summaries.reduce((s,r)=>s+r.states,0),136700);
for(const r of [...coarse.summaries,...fine.summaries])assert(!r.error&&r.seat&&Math.abs(r.ledgerResidual)<1e-8);
for(const r of seating.branches){
 assert(r.maximumMomentumResidual<1e-9&&r.maximumClosingRate<1e-8&&r.minimumImpulse>=0&&r.minimumGap> -2e-9);
 assert(r.maximumWorkResidual<1e-9&&r.maximumEnergyLedgerResidual<1e-8&&r.maximumComplementarity<1e-8);
 assert(r.nativeSamples.length===129&&r.minimumNativeGap> -1e-6&&r.maximumProfileError<1e-6&&r.absoluteDefectRatio<.3);
 // Preserve the unresolved final settling clock explicitly; passing geometry
 // and balance checks must not silently upgrade it to a timing certificate.
 assert.equal(r.settlingTimeResolvedToFiveMilliseconds,false);
}
for(const r of holding.branches)assert(!r.firstLoss&&r.rows.length===1025&&r.minimumReaction>1&&r.maximumAcceleration<1e-9&&r.maximumPowerResidual<1e-9);
for(const r of impact.rows){
 assert(r.axialWithdrawalSpeed>.02&&Math.abs(r.outputSpeedDeparture)>.05&&r.active.every(c=>c.impulse>=0));
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.energyResidual)<1e-9);
 assert(r.directionalChecks.at(-1).nativeGap> -1e-8);
}
for(const r of outgoing.summaries)assert(!r.error&&r.maximumWithdrawal>.01&&r.maximumOutputSpeedDeparture>.05);
assert.equal(retention.branches.reduce((s,r)=>s+r.states,0),16004);
for(const r of retention.branches)assert(r.maximumMomentumResidual<1e-9&&r.minimumImpulse>=0&&r.minimumGap> -2e-9&&r.maximumClosingRate<1e-8&&r.minimumNativeGap> -1e-6&&r.native.length===33);
assert.equal(hardware.topology.length,213);assert.equal(hardware.poses.length,14);assert.equal(hardware.checks,21135730);
assert.deepEqual(hardware.topologyIssues,[]);assert.deepEqual(hardware.issues,[]);
assert(hardware.minimumJawGap> -1e-6&&hardware.minimumStudGap> -1e-9&&hardware.minimumCouplingGap> -1e-9);
for(const p of hardware.poses)assert(p.independentPairs===18971&&p.independentPairs===p.separated+p.reused+p.sampled);
assert.equal(captures.views.length,10);assert.equal(inspections.views.length,10);assert.equal(captures.playback.length,2);
assert.deepEqual(captures.errors,[]);assert.deepEqual(captures.unexpectedWarnings,[]);
assert.equal(inspections.capture.sha256,hashStudyFile(inspections.capture.file));
for(const v of captures.views){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.assessment);
 assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);
 assert.deepEqual(v.state,hardware.poses[v.pose].state);
}
for(const p of captures.playback)assert(p.frames>300&&p.wallDuration>=4*p.duration&&p.fps>15&&p.p95UpdateMs<5);

const retained=[];
for(const stem of [
 '087-first-seating-profile','087-reused-forward-seating-profile','087-reused-return-seating-profile','087-wide-return-seating-profile',
 '087-first-forward-loaded-seating','087-first-return-loaded-seating','087-extended-forward-loaded-seating',
 '087-quarter-forward-loaded-seating','087-sixteenth-forward-loaded-seating','087-extended-return-loaded-seating',
 '087-quarter-return-loaded-seating','087-sixteenth-return-loaded-seating','087-first-forward-seating-events',
 '087-quarter-forward-seating-events','087-first-return-seating-events','087-quarter-return-seating-events',
 '087-continued-return-seating','087-continued-quarter-return-seating','087-forward-seated-hold',
 '087-forward-next-stud-impact','087-forward-next-lift','087-return-seated-hold','087-return-holding-release',
 '087-first-loaded-seating-check','087-assembled-seating','087-extended-forward-seating-profile-interrupted',
]){
 const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);files.add(file);
 for(const s of r.sources??[]){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained source '+s.file);files.add(s.file);if(s.archive)files.add(s.archive);}
 if(r.summaries)for(const s of r.summaries){const path='artifacts/review/'+stem+'-'+s.direction+'.json.gz';if(fs.existsSync(path))files.add(path);}
 retained.push({file,sha256:hashStudyFile(file),qualification:stem==='087-return-seated-hold'||stem==='087-return-holding-release'
  ?'Superseded normal-cone diagnosis from the unrefined cusp, not physical loss of holding.'
  :'Retained pre-refinement control, range/horizon limitation, or interrupted query-reuse preparation; not final retention evidence.'});
}
const priorStudies={};
for(const[label,file]of [
 ['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
 ['087','artifacts/review/087-clutch-transition-checkpoint.json'],
]){
 const r=readStudyReport(file);let currentInputs=0,archivedMarkdown=0;
 for(const s of r.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archive '+s.file);
  if(label==='087'&&s.file.endsWith('.md'))archivedMarkdown++;
  else{assert.equal(hashStudyFile(s.file),s.sha256,'Prior input '+s.file);currentInputs++;}
 }
 priorStudies[label]={file,sha256:hashStudyFile(file),currentInputs,archivedMarkdown};
}
const syntax=[];
for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
const sources=freezeStudySources([...files],prefix+'-record');
for(const[i,file]of ['artifacts/review/087-loaded-seating-notes.md','artifacts/review/087-clutch-transition-notes.md','docs/review-progress.md'].entries()){
 const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checkpoint={movement:87,created:new Date().toISOString(),status:'loaded-seating-study-rejects-current-retention-hypothesis',
 productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
 ownedBrowserRunning:false,ownedStudyRunning:false,previousGoalTurnClassification:'No progress: Git configuration/status and existing 075 regression checks did not advance an unresolved movement.',
 currentGoalTurnClassification:'Progress: native seated-corner normals corrected; both held configurations and subsequent cam-out counterexamples established.',
 productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
 sources,syntax,priorStudies,retained,reports:Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,{file:'artifacts/review/'+v+'.json',sha256:hashStudyFile('artifacts/review/'+v+'.json')}])),
 summary:{seatingStates:136700,outgoingStates:16004,holdingSamples:2050,nativeSeatingSamples:258,nativeOutgoingSamples:66,
  seating:seating.branches.map(({direction,seat,seatTimeDifference,settlingTimeResolvedToFiveMilliseconds,maximumCommonClockError,maximumProfileError,relativeAbsoluteDefect,absoluteContactWorkDefect})=>
   ({direction,seat,seatTimeDifference,settlingTimeResolvedToFiveMilliseconds,maximumCommonClockError,maximumProfileError,relativeAbsoluteDefect,absoluteContactWorkDefect})),
  failures:retention.branches.map(({direction,impactWithdrawalSpeed,impactOutputSpeed,maximumWithdrawal,end})=>({direction,impactWithdrawalSpeed,impactOutputSpeed,maximumWithdrawal,end})),
  solids:213,hardwarePoses:14,surfaceSamples:21135730,inspectedViews:10,playback:captures.playback},
 qualification:'Both refined native seated states hold under gravity, but both clutches withdraw and lose the intended gear speed when the next stud contact starts lifting. This rejects the current frictionless triangular-jaw/lost-motion interpretation as a complete reversal. Settling clocks, source proportions, a source-supported retention model, consistent initial preload, continuous clearance, final speed and production integration remain unresolved. No production build, full numerical suite or all-507 browser pass.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary:{...checkpoint.summary,playback:captures.playback.map(({direction,frames,fps,p95UpdateMs})=>({direction,frames,fps,p95UpdateMs}))}});
