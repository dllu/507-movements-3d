import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-continuous-hardware-study',
  frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  prior=readStudyReport('artifacts/review/086-complete-hardware-study-checkpoint.json'),
  core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),
  prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json'),
  prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
for(const study of [core,prior82,prior83])verifyStudySources(study.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained prior source: '+s.file);
const passedNames=['rope-display-source-controls','refined-rope-mesh','complete-sixteenth-ms-summary',
  'sixteenth-ms-agreement','sixteenth-ms-forces','sixteenth-ms-work','seven-pair-primary-controls',
  'refined-hardware-bounds','first-hardware-controls','first-compressed-motion',
  'first-rope-controls-baseline','first-rope-controls','sixteenth-ms-rope-mesh'],
  historicalNames=['first-primary-controls','first-primary-bounds','first-hardware-bounds','first-rope-bounds',
    'first-complete-agreement','first-complete-rope','heel-refined-agreement'],reports=[];
for(const name of [...passedNames,...historicalNames,'refined-complete-motion-captures']){
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const s of data.sources){
    assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained input: '+s.file);
    if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);
  }
  if(passedNames.includes(name)){assert(data.passed,name);verifyStudySources(data.sources);}
  reports.push({file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical sources retained; current differences listed.':'Matches current frozen inputs.'});
}
for(const name of ['first-hardware-bounds','first-complete-agreement','first-complete-rope','heel-refined-agreement']){
  assert.equal(readStudyReport('artifacts/review/086-'+name+'.json').passed,false,'Retain historical failure');
}
const capture=readStudyReport('artifacts/review/086-refined-complete-motion-captures.json');
verifyStudySources(capture.sources);assert.equal(capture.views.length,5);assert(!capture.errors.length&&!capture.unexpectedWarnings.length);
const inspections=capture.views.map(v=>{
  assert.equal(hashStudyFile(v.file),v.sha256);return{file:v.file,sha256:v.sha256,inspected:true,
    assessment:'Initial assembly, first lift, slack, second lift and oblique ending inspected. Three interior frames hide the front bearing.'};
});
const compressed=readStudyReport('artifacts/review/086-first-compressed-motion.json'),
  agreement=readStudyReport('artifacts/review/086-sixteenth-ms-agreement.json'),
  hardware=readStudyReport('artifacts/review/086-refined-hardware-bounds.json'),
  rope=readStudyReport('artifacts/review/086-first-rope-controls-baseline.json'),
  mesh=readStudyReport('artifacts/review/086-sixteenth-ms-rope-mesh.json'),
  combinedErrorPixels=Math.max(...agreement.windows.map(w=>w.maximumPixels))+compressed.maximumErrorPixels;
assert(combinedErrorPixels<.25);assert.equal(compressed.certified.length,compressed.states-1);
assert.equal(hardware.pairs.length,636);assert.equal(hardware.primaryPairs.length,7);
assert.equal(rope.results.length,41);assert(rope.results.every(r=>r.passed));
const files=new Set(prior.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')));
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory)){
  if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
}
const sources=freezeStudySources([...files],prefix);
for(const file of ['artifacts/review/086-reconstruction-notes.md','docs/review-progress.md']){
  const archive=prefix+'-'+(file.startsWith('docs')?'progress':'notes')+'-source.txt';
  fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const report={movement:86,status:'refined-motion-and-continuous-hardware-study-checkpoint',created:new Date().toISOString(),
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,
  priorCompleteSourcesArchived:prior.sources.length,priorStudySourcesUnchanged:{movement82:prior82.sources.length,movement83:prior83.sources.length},
  reports,inspections,sources,combinedErrorPixels,playbackStates:compressed.states,certifiedPlaybackSpans:compressed.certified.length,
  rigidPairs:hardware.pairs.length,ropeHardwarePairs:rope.results.length,ropeMeshErrors:mesh.errors,repeat:compressed.repeat,
  remaining:['Bound display-rope self-clearance and deformation sensitivity',
    'Measure readable playback and performance','Integrate the qualified candidate and validate production'],
  qualification:'Refined full-mass dynamics, all positive reaction checks, work, rigid time-step agreement, display tessellation and continuous hardware bounds pass. Negative fixtures reject known intrusions. Candidate stills are inspected; interactive performance, rope self-clearance and production acceptance remain pending. The error total measures observed rigid-body agreement and compression, not continuum or deforming-rope error.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,reports:reports.length,inspections:inspections.length,sources:sources.length});
