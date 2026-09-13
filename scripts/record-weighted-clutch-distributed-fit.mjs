import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-distributed-source',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-weighted-clutch-distributed-fit.mjs']),reports={},paths={
    fit:'087-first-distributed-source-fit',geometry:'087-first-distributed-geometry',contacts:'087-first-distributed-contacts',
    gradients:'087-distributed-feature-gradients',tradeoffs:'087-distributed-source-tradeoffs',
    captures:'087-distributed-fit-rendered-v2-captures',inspections:'087-distributed-fit-rendered-v2-inspections',
  };
const verifyProduction=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);};
verifyProduction();
for(const[name,stem]of Object.entries(paths)){
  const file='artifacts/review/'+stem+'.json',r=readStudyReport(file);reports[name]=r;files.add(file);
  assert.equal(r.productionChanged,false);assert.equal(r.mechanicsPassed,false);
  if(r.sources){verifyStudySources(r.sources);for(const s of r.sources)files.add(s.file);}
}
const {fit,geometry,contacts,gradients,tradeoffs,captures,inspections}=reports;
assert(fit.parity<1e-12&&fit.derivativeError<1e-8&&fit.parameters.maximumDisplacement<=24+1e-9);
assert(fit.margins.forward>=fit.baselineMargin.forward&&fit.margins.returning>=fit.baselineMargin.returning);
assert(geometry.topology.length===213&&!geometry.topologyIssues.length&&!geometry.issues.length);
assert(geometry.independentPairs===18971&&geometry.checks===1466392&&geometry.maximumProjectedDisplacement<27);
assert(geometry.pinionCoaxialWithOutput&&geometry.initialStud.gap>=0&&geometry.couplings.every(c=>c.gap> -1e-9));
assert(contacts.rows.length===258&&contacts.minimumForward>0&&contacts.minimumReturn>0&&contacts.maximumGapResidual<1e-11);
assert(contacts.maximumWitnessDistance<1e-9&&contacts.minimumCutDistance>.2);
assert(contacts.maximumDerivativeError>1e-5,'Retain the broad-stencil failure');
assert(gradients.rows.length===258&&gradients.broadStencilChanges.length===4&&gradients.maximumError<2e-6&&gradients.maximumRootDifference===0);
assert.equal(tradeoffs.candidateAccepted,false);
assert(tradeoffs.rows[1].maximum<tradeoffs.rows[0].maximum&&tradeoffs.rows[1].rms<tradeoffs.rows[0].rms);
assert(tradeoffs.rows[1].mean>tradeoffs.rows[0].mean&&tradeoffs.rows[1].studOverhang>15&&tradeoffs.measuredStudInsideMargin>32);
assert(captures.views.length===9&&inspections.views.length===9&&!captures.errors.length&&!captures.unexpectedWarnings.length);
assert.equal(hashStudyFile(inspections.capture.file),inspections.capture.sha256);
for(const v of captures.views){
  const inspected=inspections.views.find(i=>i.file===v.file);assert(inspected?.inspected&&inspected.assessment);
  assert.equal(hashStudyFile(v.file),v.sha256);assert.equal(inspected.sha256,v.sha256);files.add(v.file);
  if(!v.previous)assert(v.maximumStateDifference<1e-12);
}
const failedFile='artifacts/review/087-distributed-fit-rendered-failed-capture.json',failed=readStudyReport(failedFile);
assert.equal(failed.exitCode,1);assert.equal(failed.ownedBrowserRunning,false);files.add(failedFile);files.add(failed.image.file);
assert.equal(hashStudyFile(failed.image.file),failed.image.sha256);
for(const s of failed.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);files.add(s.archive??s.file);}
const priorStudies={};
for(const[label,file]of [['082','artifacts/review/082-bounded-writer-checkpoint.json'],['083','artifacts/review/083-thirtysecond-complete-checkpoint.json'],
  ['087','artifacts/review/087-connected-reversal-checkpoint.json']]){
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
for(const[i,file]of ['artifacts/review/087-distributed-source-fit-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);verifyProduction();
const checkpoint={movement:87,created:new Date().toISOString(),status:'distributed-source-fit-with-rim-mismatch',
  productionChanged:false,candidateIntegrated:false,candidateAccepted:false,mechanicsPassed:false,sourceFidelityResolved:false,full507GoalStillActive:true,
  ownedBrowserRunning:false,ownedStudyRunning:false,currentGoalTurnClassification:'Progress: a distributed source-fit candidate and native qualification expose a stud/rim contour constraint missing from landmark-only fitting.',
  sources,syntax,priorStudies,productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  reports:Object.fromEntries(Object.entries(paths).map(([name,stem])=>[name,{file:'artifacts/review/'+stem+'.json',sha256:hashStudyFile('artifacts/review/'+stem+'.json')}])),
  retainedCaptureFailure:{file:failedFile,sha256:hashStudyFile(failedFile)},summary:{maximumSourceDisplacement:geometry.maximumProjectedDisplacement,
    solids:213,staticHardwarePairs:18971,surfaceSamples:geometry.checks,nativeContacts:contacts.rows.length,
    nativeForwardMoment:contacts.minimumForward,nativeReturnMoment:contacts.minimumReturn,gradientError:gradients.maximumError,
    views:9,tradeoffs:tradeoffs.rows.map(({projection,...r})=>r)},
  qualification:'Maximum/RMS landmark displacement is lower, but mean displacement and the stud/rim contour are worse. The new candidate is retained for comparison and is not accepted. Further fitting must constrain the depicted stud inside E, then requalify native clearance and the changed inertia/gravity/contact motion. The older connected dynamics and all production inputs remain unchanged.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,sources:sources.length,syntax:syntax.length,priorStudies,summary:checkpoint.summary});
