import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-review',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),files=new Set(['scripts/record-eccentric-two-stop-production-review.mjs',baselineFile]),reports={},
  names=['contact-audit','contact-normals','edge-contact','source-fit','rendered-captures','rendered-isolated-captures','rendered-framed-captures','rendered-inspections'];
for(const name of names){
  const file='artifacts/review/088-production-'+name+'.json',report=readStudyReport(file);reports[name]=report;files.add(file);
  assert.equal(report.productionChanged,false);assert.equal(report.mechanicsPassed,false);
  if(report.sources){verifyStudySources(report.sources);for(const s of report.sources)files.add(s.file);}
  for(const v of [...(report.views??[]),...(report.sourceOverlay?[report.sourceOverlay]:[])]){assert.equal(hashStudyFile(v.file),v.sha256);files.add(v.file);}
}
files.add('artifacts/review/088-production-source-fit.svg');
files.add('scripts/capture-eccentric-two-stop-single-three.mjs');
const captures=reports['rendered-framed-captures'],inspections=reports['rendered-inspections'];
assert(captures.views.length===4&&!captures.errors.length&&!captures.unexpectedWarnings.length);
for(const view of [...captures.views,captures.sourceOverlay]){
  const inspected=inspections.views.find(v=>v.file===view.file);assert(inspected?.inspected&&inspected.acceptedAsDiagnostic&&inspected.assessment);
  assert.equal(inspected.sha256,view.sha256);
}
assert(captures.views.every(v=>v.maximumStateDifference<1e-12));
assert.equal(inspections.capture.sha256,hashStudyFile(inspections.capture.file));
assert.equal(reports['contact-audit'].summary.sampledDrivenStates,258);
assert(reports['source-fit'].summary.maximumRimResidual<reports['source-fit'].uncertaintyPixels);
assert(reports['source-fit'].summary.meanContourDistance>20);
const syntax=[];for(const file of files)if(file.startsWith('scripts/')&&file.endsWith('.mjs')){execFileSync(process.execPath,['--check',file]);syntax.push(file);}
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const priorFile='artifacts/review/087-second-transfers-checkpoint.json',prior=readStudyReport(priorFile);
for(const s of prior.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256);if(!s.file.endsWith('.md'))assert.equal(hashStudyFile(s.file),s.sha256);}
files.add(priorFile);
const sources=freezeStudySources([...files],prefix);
for(const[i,file]of ['artifacts/review/088-production-review-notes.md','docs/review-progress.md'].entries()){
  const archive=prefix+'-markdown-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const result={movement:88,status:'production-diagnosis-source-reconstruction-required',created:new Date().toISOString(),
  productionChanged:false,mechanicsPassed:false,full507GoalStillActive:true,sources,syntax,
  productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},
  sourceMeasurements:reports['source-fit'].summary,inspectedFinalViews:5,ownedBrowserRunning:false,
  retainedAttempts:[
    {script:'scripts/check-eccentric-two-stop-contact-normals.mjs',exitCode:1,reason:'The axial-only normal hypothesis is false. Native edge normals include an in-plane driving component.'},
    {script:'scripts/capture-eccentric-two-stop-production.mjs',exitCode:1,reason:'Direct Three.js import duplicated the engine module. Four stills remain diagnostic only.'},
    {script:'scripts/capture-eccentric-two-stop-single-three.mjs',exitCode:1,reason:'page.goto timed out after 30000 ms before capture; the browser closed.'},
    {script:'scripts/capture-eccentric-two-stop-isolated.mjs',exitCode:0,acceptedAsDiagnostic:false,reason:'Manual inspection rejected all four frames: missing canvas CSS enlarged and cropped the renderer.'},
  ],
  qualification:'Read-only production diagnosis. Actual cone tips approach a native cam edge with driving torque; an initial missing-contact suspicion was rejected. One disk registration exposes substantial cam and landmark mismatch. Finite stop construction and prescribed speed jumps need reconstruction and mechanical review. Four correctly framed stills and one overlay were opened; earlier failed or rejected attempts remain explicit. No corrected movement is integrated.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({status:result.status,sources:sources.length,syntax:syntax.length,unchangedProductionInputs:Object.keys(baseline).length});
