import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),verify=s=>assert.equal(hash(s.archive??s.file),s.sha256,s.archive??s.file),
 frozen=read('080-verification-source-hashes'),checkpoint=read('080-integrated-checkpoint'),docs=read('080-integrated-documentation'),baseline=read('081-baseline-checkpoint');
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
assert.equal(checkpoint.mechanicsPassed,true);assert.equal(checkpoint.full507GoalStillActive,true);
for(const item of [...checkpoint.reports,...checkpoint.sources])verify(item);
for(const s of checkpoint.sources)assert.equal(hash(s.file),s.sha256,s.file);
verify(checkpoint.priorStudy);const study=read('080-loaded-study-checkpoint');
for(const item of [...study.reports,...study.archives,...study.sources,...study.orphanedDiagnosticArchives,study.playback])verify(item);
for(const view of [...study.inspectedViews,...checkpoint.views,...baseline.views]){verify(view);assert.equal(view.inspected,true);}
verify(docs.checkpoint);for(const item of [...docs.files,...docs.prior,docs.source])verify(item);
const loadedDocs=read('080-loaded-study-documentation');for(let i=0;i<docs.prior.length;i++)assert.equal(docs.prior[i].sha256,loadedDocs.files[i].sha256);
for(const item of [...baseline.files,...baseline.sources])verify(item);
for(const source of read('081-baseline-surfaces').sources)verify(source);
for(const source of read('081-baseline-captures').sources)verify(source);
const oldFrames=read('080-prior-browser-evidence/manifest'),freshFrames=read('080-browser-regression-captures/manifest');
assert.equal(freshFrames.priorEvidenceRestored,true);for(const row of oldFrames.frames)verify({...row,file:base+row.file});
for(const row of freshFrames.rows)verify({...row,file:base+'080-browser-regression-captures/'+row.file});
let links=0;for(const file of [base+'080-reconstruction-notes.md',base+'081-reconstruction-notes.md']){
 const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1];if(/^https?:/.test(target))continue;assert(fs.existsSync(path.resolve(path.dirname(file),target)),file+' -> '+target);links++;
 }
}
for(const name of ['080-integrated-review-command','080-integrated-documentation-command','081-baseline-capture-command','081-baseline-review-command']){
 const exit=read(name+'-exit-status');assert.equal(exit.code,0,name);assert.equal(exit.signal,null,name);for(const source of exit.sources)verify(source);
}
const file='scripts/validate-crossed-rack-handoff.mjs',archive=base+'080-integrated-handoff-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
const report={movement:80,status:'verified-integration-and-next-baseline-preserved',passed:true,created:new Date().toISOString(),
 frozenInputs:Object.keys(frozen).length,integratedReports:checkpoint.reports.length,integratedSourceCopies:checkpoint.sources.length,
 studyReports:study.reports.length,studyArchives:study.archives.length,studySourceCopies:study.sources.length,
 finalIntegratedViews:checkpoint.views.length,nextBaselineViews:baseline.views.length,currentDocuments:docs.files.length,localDocumentLinks:links,
 historicalFramesRestored:oldFrames.frames.length,freshRegressionFrames:freshFrames.rows.length,
 checkpoints:[base+'080-integrated-checkpoint.json',base+'080-integrated-documentation.json',base+'081-baseline-checkpoint.json'].map(file=>({file,sha256:hash(file)})),
 source:{file,archive,sha256:hash(file)},nextMovement:81,nextWork:baseline.remaining,full507GoalStillActive:true};
fs.writeFileSync(base+'080-integrated-handoff-validation.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(report);
