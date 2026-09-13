import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-fixed-orbit',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-fixed-orbit.mjs']),reports={},paths={
    fit:'087-first-fixed-orbit-fit',geometry:'087-first-fixed-orbit-geometry',contacts:'087-first-fixed-orbit-contacts',
    impact:'087-fixed-orbit-impact-v2',coarse:'087-fixed-orbit-lift-coarse',fine:'087-fixed-orbit-lift-fine',checks:'087-fixed-orbit-lift-check',
    sourceCaptures:'087-fixed-orbit-rendered-captures',sourceInspections:'087-fixed-orbit-rendered-inspections',
    liftCaptures:'087-fixed-orbit-lift-rendered-captures',liftInspections:'087-fixed-orbit-lift-rendered-inspections',
  };
const verifyProduction=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);};
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
  const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
  assert.equal(r.productionChanged,false);assert.equal(r.mechanicsPassed,false);
  if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
}
const {fit,geometry,contacts,impact,coarse,fine,checks}=reports,comparison=geometry.comparisons.at(-1);
assert(fit.parameters.maximumDisplacement<=32+1e-8&&fit.studInsideMargin>32&&fit.margins.forward>0&&fit.margins.returning>0);
assert(geometry.topology.length===213&&!geometry.topologyIssues.length&&!geometry.issues.length&&geometry.checks===1467444);
assert(comparison.projection.studInsideMargin>32&&comparison.projection.pinionAxisOffset===0&&geometry.contourMeanDifference<.01);
assert(comparison.contours.rms<geometry.comparisons[0].contours.rms&&comparison.contours.mean>geometry.comparisons[0].contours.mean);
assert(contacts.rows.length===258&&contacts.minimumForward>0&&contacts.minimumReturn>0&&contacts.maximumGapResidual<1e-11);
assert(contacts.maximumDerivativeError<2e-6&&contacts.maximumWitnessDistance<1e-9&&contacts.minimumCutDistance>.2);
assert(Object.values(impact.maxima).every(v=>v<1e-7)&&Object.values(impact.gravityMaxima).every(v=>v<1e-7));
for(const r of impact.rows){
  assert(r.incomingGapVelocity<0&&r.direction!==r.arrivalDirection&&r.impact.v[0]*(r.direction==='CCW'?1:-1)>0);
  assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);
}
assert(coarse.summaries.length===4&&fine.summaries.length===2);
for(const report of [coarse,fine])for(const summary of report.summaries){
  assert(!summary.error&&Math.abs(summary.end.time-.5)<1e-10);files.add(summary.file);
  if(summary.staticCoefficient===.78)assert(summary.maximumWithdrawal<1e-8);
  else assert(summary.maximumWithdrawal>.01);
}
assert(checks.branches.length===2&&checks.poses.length===4);
for(const r of checks.branches){
  assert(r.maximumMomentumResidual<1e-9&&r.maximumFreeVelocityError<1e-9&&r.maximumContactRateResidual<1e-8&&r.maximumComplementarity<1e-8);
  assert(r.minimumGap> -2e-9&&r.minimumImpulse> -1e-12&&r.maximumFrictionConeExcess<1e-10&&r.maximumSlidingLawError<1e-10&&r.maximumFrictionPower<1e-10);
  assert(Math.max(...r.positionDifference)<.001&&r.minimumNativeJawGap> -1e-6&&r.minimumNativeStudGap> -1e-6&&r.maximumFastStudDifference<1e-10);
}
assert(checks.poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
let inspectedViews=0;
for(const[label,count]of [['source',9],['lift',8]]){
  const captures=reports[label+'Captures'],inspections=reports[label+'Inspections'];
  assert(captures.views.length===count&&inspections.views.length===count&&!captures.errors.length&&!captures.unexpectedWarnings.length);
  assert.equal(hashStudyFile(inspections.capture.file),inspections.capture.sha256);
  for(const v of captures.views){
    const checked=inspections.views.find(i=>i.file===v.file);assert(checked?.inspected&&checked.assessment);
    assert.equal(hashStudyFile(v.file),v.sha256);assert.equal(checked.sha256,v.sha256);files.add(v.file);inspectedViews++;
    if(!v.previous)assert(v.maximumStateDifference<1e-12);
  }
}
const rejectedFile='artifacts/review/087-first-fixed-orbit-impact.json',rejected=readStudyReport(rejectedFile);
assert(rejected.rows.every(r=>r.impact.v[0]===0));files.add(rejectedFile);
for(const s of rejected.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);files.add(s.archive??s.file);}
const priorStudies={};
for(const[label,file]of [['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
  ['087-connected','artifacts/review/087-connected-reversal-checkpoint.json'],['087-distributed','artifacts/review/087-distributed-source-checkpoint.json']]){
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
for(const[i,file]of ['artifacts/review/087-fixed-orbit-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checkpoint={movement:87,created:new Date().toISOString(),status:'fixed-orbit-fit-and-bounded-initial-lifts',
  productionChanged:false,candidateIntegrated:false,candidateAccepted:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
  ownedBrowserRunning:false,ownedStudyRunning:false,currentGoalTurnClassification:'Progress: restored measured stud orbit, registered contour comparisons, fresh mass/gravity and initial-lift qualification for the new fit.',
  sources,syntax,priorStudies,productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
  rejectedInitialization:{file:rejectedFile,sha256:hashStudyFile(rejectedFile),originalExitCode:0,accepted:false,
    reason:'The original setup used the preceding stroke label for the next stud approach. The stud receded and lever velocity stayed zero. Version 2 explicitly checks approach and outgoing direction.'},
  summary:{maximumSourceDisplacement:comparison.projection.maximum,studInsideMargin:comparison.projection.studInsideMargin,
    contourMean:comparison.contours.mean,contourRms:comparison.contours.rms,solids:213,sourceSurfaceSamples:geometry.checks,nativeContacts:contacts.rows.length,
    fineStates:fine.summaries.reduce((n,r)=>n+r.states,0),liftHardwarePoses:checks.poses.length,liftSurfaceSamples:checks.poses.reduce((n,r)=>n+r.checks,0),inspectedViews},
  qualification:'The fixed orbit restores the depicted rim relationship, with smaller maximum landmark error than the earlier 75-pixel candidate. Source contour metrics still have tradeoffs. New mass/gravity and two bounded initial lifts pass, but full lift, release, connected reversal, repeated cycles, continuous clearance, material identity, rendering polish, final speed and integration remain unresolved. Production and earlier candidate studies remain unchanged.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary:checkpoint.summary});
