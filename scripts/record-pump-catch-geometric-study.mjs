import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-geometric-mode-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  prior=readStudyReport('artifacts/review/086-rope-playback-study-checkpoint.json'),
  core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),
  other82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json'),other83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
for(const d of [core,other82,other83])verifyStudySources(d.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained prior source: '+s.file);
const names=['ranked-hybrid-fine-summary','ranked-hybrid-fine-forces','ranked-hybrid-fine-work','ranked-hybrid-repeat',
  'rounded-time-hybrid-repeat','return-contact-event-diagnostic','geometric-contact-event-control','geometric-initial-contact-control','large-row-reader-controls'],
  passed=new Set(['ranked-hybrid-fine-summary','ranked-hybrid-fine-forces','ranked-hybrid-fine-work','rounded-time-hybrid-repeat','large-row-reader-controls']),
  reports=names.map(name=>{
    const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
    for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained report source: '+s.file);
      if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
    if(passed.has(name)){assert(data.passed);verifyStudySources(data.sources);}
    if(name.includes('contact-event-control')||name==='geometric-initial-contact-control'){
      assert.equal(data.limited,false);assert.equal(data.failure,null);assert(Math.abs(data.end-data.start-.003)<1e-12);
    }
    return{file,sha256:hashStudyFile(file),passed:data.passed,archivedInputsVerified:data.sources.length,changedCurrentInputs};
  });
const files=[];
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))
  if(/(?:pump-catch|large-row-study-reader).*\.mjs$/.test(name))files.push(directory+'/'+name);
const syntax=files.map(file=>{const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+result.stderr);return{file,sha256:hashStudyFile(file)};});
const sources=freezeStudySources(files,prefix);
for(const file of ['artifacts/review/086-reconstruction-notes.md','docs/review-progress.md']){
  const archive=prefix+'-'+(file.startsWith('docs')?'progress':'notes')+'-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const observationFile='artifacts/review/086-geometric-process-observation.json',observation=readStudyReport(observationFile),
  interruptionFile='artifacts/review/086-ranked-coarse-interruption.json',interruption=readStudyReport(interruptionFile),
  report={movement:86,status:'completed-fine-hybrid-and-geometric-cam-mode-checkpoint',created:new Date().toISOString(),
    productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,
    frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,
    priorSourcesArchived:prior.sources.length,priorStudySourcesUnchanged:{movement82:other82.sources.length,movement83:other83.sources.length},
    reports,sources,syntax,observationFile,observationSha256:hashStudyFile(observationFile),observation,
    interruptionFile,interruptionSha256:hashStudyFile(interruptionFile),interruption,
    remaining:['Complete the geometric-mode coarse run and compare rigid and full 3D rope motion against the fine run',
      'Compress and renew continuous hardware/rope/deformation bounds for the accepted trajectory','Integrate and validate production'],
    qualification:'The completed fine trajectory passes forces, energy and repeat checks. The repeated-contact diagnostic and its geometric-mode controls are retained. The raw timestamp-interpolation repeat failure remains archived. No new rendered acceptance, production build or full-507 qualification is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,reports:reports.length,sources:sources.length,syntax:syntax.length,observation:undefined,interruption:undefined});
