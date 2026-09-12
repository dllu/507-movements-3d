import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-impact-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),prior=readStudyReport('artifacts/review/086-dynamics-study-checkpoint.json'),
  prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(core.sources);verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior retained source: '+s.file);
const names=['guarded-quarter-ms-12s-summary','guarded-work','quarter-ms-work','first-impact-dynamics-summary','first-impact-work','first-impact-forces',
  'exact-face-controls','exact-face-impact-summary','exact-face-half-ms-impact-summary','exact-face-step-agreement','exact-face-forces','exact-face-work','exact-face-overlap',
  'first-impact-motion-captures','quarter-ms-impact-startup-summary','eighth-ms-impact-startup-summary','refined-startup-step-agreement','refined-startup-forces','refined-startup-work','refined-startup-overlap'];
const reports=names.map(name=>{
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Historical input: '+s.file);if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
  return{file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical source version retained and verified.':'Matches current frozen inputs.'};
});
for(const name of ['exact-face-controls','exact-face-forces','exact-face-work','refined-startup-forces','refined-startup-work','refined-startup-overlap']){
  const d=readStudyReport('artifacts/review/086-'+name+'.json');assert(d.passed);verifyStudySources(d.sources);
}
for(const name of ['guarded-work','quarter-ms-work','exact-face-step-agreement','exact-face-overlap','refined-startup-step-agreement'])assert.equal(readStudyReport('artifacts/review/086-'+name+'.json').passed,false);
const capture=readStudyReport('artifacts/review/086-first-impact-motion-captures.json');verifyStudySources(capture.sources);assert.equal(capture.views.length,9);assert(!capture.errors.length&&!capture.unexpectedWarnings.length);
const inspections=capture.views.map(v=>{assert.equal(hashStudyFile(v.file),v.sha256);return{file:v.file,sha256:v.sha256,inspected:true,
  assessment:'Diagnostic coarse-run pose inspected against the source. Core proportions and the shown contact sequence are readable. Seven section views hide the front bearing. Return, refined capture, omitted hardware and complete motion remain unqualified.'};});
const notes='artifacts/review/086-reconstruction-notes.md',files=new Set([...prior.sources.map(s=>s.file).filter(f=>f!==notes),'scripts/record-pump-catch-impact-study.mjs']);
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix),notesArchive=prefix+'-review-notes-source.txt';fs.copyFileSync(notes,notesArchive,fs.constants.COPYFILE_EXCL);sources.push({file:notes,archive:notesArchive,sha256:hashStudyFile(notes)});
const report={movement:86,status:'impact-velocity-and-near-face-correction-checkpoint',created:new Date().toISOString(),productionChanged:false,candidateIntegrated:false,
  mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',ownedBrowserRunning:false,ownedStudyRunning:false,
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},
  priorDynamicsSourcesArchived:prior.sources.length,reports,inspections,sources,
  remaining:['Resolve the capture path retained by finer time steps, then establish repeated operation','Assess omitted load, bearing-loss and hidden-depth assumptions',
    'Establish time-step agreement and continuous contact clearance','Complete rope/load and rear input hardware','Inspect full playback, integrate and run production validation'],
  qualification:'Exact interior-face normals and separate impact velocities remedy independently reproduced numerical defects. Force and work checks pass, but refined startup still loses cam engagement and fails step agreement. Nine rendered coarse-run poses are inspected only as diagnostics. No complete mechanism or integration pass is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,reports:reports.length,sources:sources.length,inspections:inspections.length});
