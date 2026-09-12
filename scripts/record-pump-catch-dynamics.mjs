import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-dynamics-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const prior=readStudyReport('artifacts/review/086-first-study-checkpoint.json');verifyStudySources(prior.sources);
const prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
const names=[
  'first-free-dynamics-summary','half-unit-load-dynamics-summary','unit-load-dynamics-summary','first-force-audit','first-energy-formulas',
  'first-slack-dynamics-summary','corrected-slack-dynamics-summary','slack-force-audit','slack-energy-formulas','corrected-slack-energy-formulas',
  'closed-corner-slack-dynamics-summary','half-ms-slack-dynamics-summary','closed-corner-force-audit','final-slack-energy-formulas',
  'local-corner-slack-dynamics-summary','local-corner-force-audit','finite-rope-geometry','finite-rope-dynamics-summary','finite-rope-half-ms-dynamics-summary',
  'finite-rope-force-audit','finite-rope-energy-formulas','finite-rope-surfaces','finite-rope-triangle-overlap','finite-rope-step-agreement',
  'return-penetration-guard','guarded-energy-formulas','guarded-finite-rope-dynamics-summary','guarded-force-audit','guarded-surfaces','guarded-triangle-overlap'
];
const reports=names.map(name=>{
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const source of data.sources){
    assert.equal(hashStudyFile(source.archive??source.file),source.sha256,'Historical evidence: '+source.file);
    if(hashStudyFile(source.file)!==source.sha256)changedCurrentInputs.push(source.file);
  }
  if(data.trajectory)assert(fs.existsSync(data.trajectory.file));
  return{file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical result; retained snapshots verified. Current solver has changed.':'Result matches current frozen inputs.'};
});
for(const name of ['finite-rope-geometry','return-penetration-guard','guarded-energy-formulas','guarded-finite-rope-dynamics-summary','guarded-force-audit','guarded-surfaces']){
  const data=readStudyReport('artifacts/review/086-'+name+'.json');assert(data.passed);verifyStudySources(data.sources);
}
for(const name of ['first-force-audit','closed-corner-force-audit','finite-rope-triangle-overlap','finite-rope-step-agreement','guarded-triangle-overlap'])assert.equal(readStudyReport('artifacts/review/086-'+name+'.json').passed,false);
const interruptedOrFailed=fs.readdirSync('artifacts/review').filter(name=>[
  '086-corner-cone-slack-dynamics-','086-bounded-corner-slack-dynamics-','086-finite-rope-overlap-failed-source'
].some(prefix=>name.startsWith(prefix))||['086-corner-cone-slack-dynamics.log','086-bounded-corner-slack-dynamics.log','086-finite-rope-overlap.log',
  '086-second-study-checkpoint.json','086-second-study-review-notes-source.txt'].includes(name))
  .map(name=>{const file='artifacts/review/'+name;return{file,sha256:hashStudyFile(file)};});
const files=new Set([...prior.sources.map(s=>s.file),'scripts/record-pump-catch-dynamics.mjs','docs/review-progress.md']);
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix),notes='artifacts/review/086-reconstruction-notes.md',notesArchive=prefix+'-review-notes-source.txt';
// Review Markdown is editable, even though it lives under artifacts/. Retain
// its own snapshot instead of classifying it as immutable generated evidence.
fs.copyFileSync(notes,notesArchive,fs.constants.COPYFILE_EXCL);sources.push({file:notes,archive:notesArchive,sha256:hashStudyFile(notes)});
const checkpoint={movement:86,status:'finite-rope-and-contact-dynamics-diagnostic-checkpoint',created:new Date().toISOString(),
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:prior.sources.length,
  priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},reports,interruptedOrFailed,sources,
  remaining:['Resolve guarded return and repeated cycle with justified attachment/load assumptions','Establish time-step agreement and impact energy balance',
    'Eliminate or rigorously bound between-knot contact penetration','Complete rope/load and rear hardware meshes','Inspect full rendered motion, integrate and validate production'],
  qualification:'Current formula, rope, contact-guard, sampled force and core-surface diagnostics pass. The latest midpoint cap-intersection screen fails. Earlier rejected runs and interrupted diagnostics are preserved against their own source snapshots. No continuous-clearance, visual, production or complete-mechanism pass is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});console.log({...checkpoint,reports:reports.length,sources:sources.length,interruptedOrFailed:interruptedOrFailed.length});
