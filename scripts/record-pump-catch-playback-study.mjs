import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-rope-playback-study',prior=readStudyReport('artifacts/review/086-continuous-hardware-study-checkpoint.json'),
  frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),
  other82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json'),other83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
for(const d of [core,other82,other83])verifyStudySources(d.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior archived source: '+s.file);
const names=['first-rope-self-bounds','complete-rope-self-bounds','first-rope-agreement','projected-rope-agreement','first-live-rope','first-indexed-hardware',
  'first-playback','live-playback','indexed-live-playback','first-hybrid-summary','quarter-ms-hybrid-summary','first-hybrid-agreement',
  'first-hybrid-rope-agreement','quarter-ms-hybrid-forces','quarter-ms-hybrid-work','smooth-reduction-controls','stage-guard-control','contact-mode-controls'],
  currentPassed=new Set(['complete-rope-self-bounds','first-live-rope','first-indexed-hardware','indexed-live-playback','smooth-reduction-controls','contact-mode-controls']),
  reports=names.map(name=>{
    const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
    for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained report source: '+s.file);
      if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
    if(currentPassed.has(name)){assert(data.passed);verifyStudySources(data.sources);}
    return{file,sha256:hashStudyFile(file),passed:data.passed,archivedInputsVerified:data.sources.length,changedCurrentInputs};
  }),inspections=[];
for(const name of ['first-playback','indexed-live-playback']){
  const capture=readStudyReport('artifacts/review/086-'+name+'.json');assert.equal(capture.views.length,5);assert(capture.passed);
  for(const v of capture.views){assert.equal(hashStudyFile(v.file),v.sha256);inspections.push({file:v.file,sha256:v.sha256,inspected:true,
    assessment:'Complete source, lift, oblique slack and both sides of the loop seam inspected. All apparatus remains framed.'});}
}
const files=new Set(prior.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')));
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix);
for(const file of ['artifacts/review/086-reconstruction-notes.md','docs/review-progress.md']){
  const archive=prefix+'-'+(file.startsWith('docs')?'progress':'notes')+'-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);const observationFile=process.env.PROBE_OBSERVATION??'artifacts/review/086-playback-process-observation.json',observation=readStudyReport(observationFile),
  report={movement:86,status:'rope-self-clearance-rendering-and-hybrid-trial-checkpoint',created:new Date().toISOString(),productionChanged:false,candidateIntegrated:false,
    mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',frozenProductionInputsMatched:Object.keys(frozen).length,
    originalCoreSourcesUnchanged:core.sources.length,priorSourcesArchived:prior.sources.length,priorStudySourcesUnchanged:{movement82:other82.sources.length,movement83:other83.sources.length},
    reports,inspections,sources,observationFile,observationSha256:hashStudyFile(observationFile),observation,
    remaining:['Complete and independently audit the corrected full hybrid trials','Resolve full 3D rope agreement and bound interpolation/deformation error',
      'Renew geometry and clearance checks for the accepted trajectory','Integrate and validate production'],
    qualification:'Self-clearance and exact rendering-buffer optimizations pass. The isolated preview and software-renderer measurements are retained. Initial hybrid force/convergence failures remain explicit; corrected trials are separate unfinished work. No production or full-507 acceptance is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,reports:reports.length,inspections:inspections.length,sources:sources.length});
