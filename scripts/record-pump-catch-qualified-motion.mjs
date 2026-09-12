import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-qualified-motion',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  prior=readStudyReport('artifacts/review/086-geometric-mode-study-checkpoint.json'),
  core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),
  other82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json'),other83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
for(const d of [core,other82,other83])verifyStudySources(d.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained prior source: '+s.file);
const names=['geometric-hybrid-coarse-summary','ranked-hybrid-fine-summary','ranked-hybrid-fine-forces','ranked-hybrid-fine-work',
  'rounded-time-hybrid-repeat','geometric-hybrid-agreement','geometric-hybrid-rope-agreement','first-hybrid-compressed-motion',
  'hybrid-hardware-bounds','hybrid-rope-bounds','hybrid-rope-self-bounds','hybrid-rope-mesh','hybrid-compression-rope-agreement',
  'tighter-hybrid-compressed-motion','tighter-hybrid-hardware-bounds','tighter-hybrid-rope-bounds','tighter-hybrid-rope-self-bounds','tighter-hybrid-rope-mesh',
  'rope-displacement-controls','sharp-rope-displacement-controls','continuous-tighter-compression-rope-agreement','sharp-continuous-compression-rope-agreement',
  'combined-continuous-rope-agreement','combined-continuous-rigid-agreement','tighter-hybrid-playback','tighter-hybrid-final-playback',
  'first-live-rope','first-indexed-hardware'],
  historicalOnly=new Set(['rope-displacement-controls','continuous-tighter-compression-rope-agreement','sharp-continuous-compression-rope-agreement']),
  byName=new Map(),reports=names.map(name=>{
    const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];byName.set(name,data);
    for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained source: '+s.file);
      if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
    if(!historicalOnly.has(name)){assert(data.passed,name);verifyStudySources(data.sources);}
    return{file,sha256:hashStudyFile(file),passed:data.passed,archivedInputsVerified:data.sources.length,changedCurrentInputs};
  });
const inspections=[];
for(const name of ['tighter-hybrid-playback','tighter-hybrid-final-playback']){
  const d=byName.get(name);assert.equal(d.views.length,5);assert.deepEqual(d.errors,[]);assert.deepEqual(d.unexpectedWarnings,[]);
  for(const v of d.views){assert.equal(hashStudyFile(v.file),v.sha256);inspections.push({...v,inspected:true,
    assessment:'Source assembly, lift, oblique slack and both sides of the loop seam are inspected. Complete apparatus stays in frame.'});}
}
const playback=byName.get('tighter-hybrid-compressed-motion'),hardware=byName.get('tighter-hybrid-hardware-bounds'),
  rope=byName.get('tighter-hybrid-rope-bounds'),combined=byName.get('combined-continuous-rope-agreement'),rigid=byName.get('combined-continuous-rigid-agreement');
assert.equal(playback.certified.length,playback.rows.length-1);assert.equal(hardware.pairs.length,636);
assert.equal(hardware.pairs.filter(p=>p.method==='primary-contact').length,7);assert.equal(rope.results.length,41);
assert.equal(combined.verifiedThrough,16);assert.equal(combined.stats.unionIntervals,rigid.intervals);
assert(combined.stats.maximumPixels<.25&&rigid.maximum.combined<.25);
const files=[];for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))
  if(/(?:pump-catch|large-row-study-reader).*\.mjs$/.test(name))files.push(directory+'/'+name);
const syntax=files.map(file=>{const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+result.stderr);return{file,sha256:hashStudyFile(file)};});
const sources=freezeStudySources(files,prefix);
for(const file of ['artifacts/review/086-reconstruction-notes.md','docs/review-progress.md']){
  const archive=prefix+'-'+(file.startsWith('docs')?'progress':'notes')+'-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const observationFile='artifacts/review/086-qualified-motion-process-observation.json',observation=readStudyReport(observationFile);
assert.deepEqual(observation.running,[]);assert.equal(observation.ownedBrowserRunning,false);
const report={movement:86,status:'qualified-complete-candidate-pending-production-integration',created:new Date().toISOString(),
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:true,full507GoalStillActive:true,previousGoalTurn:'progress',
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,
  priorSourcesArchived:prior.sources.length,priorStudySourcesUnchanged:{movement82:other82.sources.length,movement83:other83.sources.length},
  geometry:{parts:42,independentRigidPairs:636,primaryPairs:7,ropeHardwarePairs:41},
  motion:{fineStates:byName.get('ranked-hybrid-fine-summary').states,coarseStates:byName.get('geometric-hybrid-coarse-summary').states,
    displayStates:playback.states,displayPeriod:4,repeat:playback.repeat,primaryIntervals:playback.certified.length,
    commonIntervals:rigid.intervals,ropeProofIntervals:combined.stats.certified,maximumCombinedRigidPixels:rigid.maximum.combined,
    maximumCombinedRopePixels:combined.stats.maximumPixels},
  forces:byName.get('ranked-hybrid-fine-forces').counts,
  work:{signed:byName.get('ranked-hybrid-fine-work').relativeResidual,absolute:byName.get('ranked-hybrid-fine-work').relativeAbsoluteResidual},
  finalPlayback:byName.get('tighter-hybrid-final-playback').summary,reports,inspections,sources,syntax,
  observationFile,observationSha256:hashStudyFile(observationFile),observation,
  remaining:['Integrate the qualified geometry and display profile','Establish exact production geometry/motion parity',
    'Run focused and regression checks and inspect integrated desktop/mobile rendering','Continue the full 507-movement review'],
  qualification:'Qualification applies to the reconstructed candidate and its explicit massless-rope, hidden-depth, load, guide and rear-input assumptions. Continuous bounds compare supplied numerical/display trajectories, not exact continuum dynamics. Two failed tighter compression allocations remain archived. No production integration, new production build or full-suite acceptance is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,reports:reports.length,inspections:inspections.length,sources:sources.length,syntax:syntax.length,observation:undefined});
