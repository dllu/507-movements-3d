import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 check=item=>assert.equal(hash(item.archive??item.file),item.sha256,item.archive??item.file),
 study=read('081-loaded-study-checkpoint'),docs=read('081-loaded-study-documentation'),frozen=read('080-verification-source-hashes'),
 baseline=read('081-baseline-checkpoint'),oldDocs=read('080-integrated-documentation');
for(const [file,sha]of Object.entries(frozen))assert.equal(hash(file),sha,file);
assert.equal(study.productionChanged,false);assert.equal(study.mechanicsPassed,false);assert.equal(study.full507GoalStillActive,true);
for(const item of study.artifacts)check(item);
for(const item of study.sources){check(item);assert.equal(hash(item.file),item.sha256,item.file);}
for(const item of study.priorDocuments)check(item);
for(const item of [docs.checkpoint,docs.source,...docs.files,...docs.prior])check(item);
for(const item of baseline.files){const prior=study.priorDocuments.find(r=>r.file===item.file);check(prior??item);if(prior)assert.equal(item.sha256,prior.sha256);}
for(const item of oldDocs.files){const prior=study.priorDocuments.find(r=>r.file===item.file);check(prior??item);if(prior)assert.equal(item.sha256,prior.sha256);}
for(const view of [...baseline.views,...study.views]){check(view);assert.equal(view.inspected,true);}
for(const name of ['081-finer-reactions','081-first-dynamics-assessment','081-refined-hardware-bounds','081-indexed-coil-check','081-contact-representation','081-seamed-playback'])
 assert.equal(read(name).passed,true,name);
assert.equal(read('081-indexed-loaded-geometry').geometryPassed,true);
const commands=['081-loaded-study-command','081-loaded-study-documentation-command','081-loaded-study-documentation-v2-command',
 '081-seamed-playback-preview-command','081-indexed-loaded-probe-command'].map(name=>{
 const report=read(name+'-exit-status');assert.equal(report.code,name==='081-loaded-study-documentation-command'?1:0,name);assert.equal(report.signal,null,name);
 for(const source of report.sources)check(source);
 return{name,code:report.code,file:base+name+'-exit-status.json',sha256:hash(base+name+'-exit-status.json'),
  log:{file:base+name+'.log',sha256:hash(base+name+'.log')},sources:report.sources};
});
let localLinks=0;const notes=base+'081-reconstruction-notes.md';
for(const match of fs.readFileSync(notes,'utf8').matchAll(/\]\(([^)]+)\)/g)){
 if(/^https?:/.test(match[1]))continue;assert(fs.existsSync(path.resolve(path.dirname(notes),match[1])),match[1]);localLinks++;
}
const sourceFile='scripts/validate-spring-rack-loaded-handoff.mjs',archive=base+'081-loaded-handoff-source.txt';fs.copyFileSync(sourceFile,archive,fs.constants.COPYFILE_EXCL);
const report={movement:81,status:'isolated-study-and-current-documentation-preserved',passed:true,created:new Date().toISOString(),
 productionChanged:false,mechanicsPassed:false,frozenInputs:Object.keys(frozen).length,studyReports:study.reports.length,
 studyArtifacts:study.artifacts.length,currentStudySources:study.sources.length,candidateViewsInspected:study.views.length,baselineViewsInspected:baseline.views.length,
 currentDocuments:docs.files.length,localLinks,commands,
 documentationCorrection:'The first documentation command failed to parse because two Markdown backticks terminated a JavaScript template. No documents changed in that failed run. Its exact source and failure remain preserved; the corrected command completed successfully.',
 checkpoints:['081-loaded-study-checkpoint','081-loaded-study-documentation'].map(name=>({file:base+name+'.json',sha256:hash(base+name+'.json')})),
 source:{file:sourceFile,archive,sha256:hash(sourceFile)},remaining:study.remaining,full507GoalStillActive:true};
fs.writeFileSync(base+'081-loaded-handoff-validation.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:true,frozenInputs:report.frozenInputs,studyArtifacts:report.studyArtifacts,currentStudySources:report.currentStudySources,
 candidateViewsInspected:report.candidateViewsInspected,baselineViewsInspected:report.baselineViewsInspected,localLinks,productionChanged:false,mechanicsPassed:false});
