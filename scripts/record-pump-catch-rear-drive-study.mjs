import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-rear-drive-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),prior=readStudyReport('artifacts/review/086-impact-study-checkpoint.json'),
  prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(core.sources);verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior retained source: '+s.file);
const names=['corner-seed-controls','current-corner-seed-controls','period-eight-capture-summary','period-sixteen-capture-summary',
  'period-eight-fine-capture-summary','period-eight-capture-agreement','period-eight-three-cycles-summary','first-rear-drive-surfaces',
  'first-rear-drive-captures','relative-loss-controls','weighted-head-energy','loaded-pump-trial-summary','loaded-pump-trial-forces',
  'loaded-pump-trial-work','loaded-pump-trial-surfaces','loaded-pump-trial-overlap','loaded-pump-motion-captures'];
const reports=names.map(name=>{
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const s of data.sources){
    assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained input: '+s.file);
    if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);
  }
  return{file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical source version retained and verified.':'Matches current frozen inputs.'};
});
for(const name of ['current-corner-seed-controls','first-rear-drive-surfaces','relative-loss-controls','weighted-head-energy',
  'loaded-pump-trial-summary','loaded-pump-trial-forces','loaded-pump-trial-work','loaded-pump-trial-surfaces','loaded-pump-trial-overlap']){
  const d=readStudyReport('artifacts/review/086-'+name+'.json');assert(d.passed);verifyStudySources(d.sources);
}
assert.equal(readStudyReport('artifacts/review/086-period-eight-capture-agreement.json').passed,false);
const loaded=readStudyReport('artifacts/review/086-loaded-pump-trial.json.gz'),period=2*Math.PI/Math.abs(loaded.angularSpeed);
verifyStudySources(loaded.sources);assert.equal(loaded.actualEnd,2*period);
const cycles=[0,1].map(index=>{
  const rows=loaded.rows.filter(r=>r.time>=index*period&&r.time<=(index+1)*period),
    minimum=Math.min(...rows.map(r=>r.q[2])),maximum=Math.max(...rows.map(r=>r.q[2]));
  return{cycle:index+1,minimum,maximum,lift:maximum-minimum,peakTime:rows.find(r=>r.q[2]===maximum).time};
});
assert(cycles[1].lift<cycles[0].lift*.001,'The retained trial must still exhibit the rejected missing second lift');
const inspections=[];
for(const name of ['first-rear-drive','loaded-pump-motion']){
  const capture=readStudyReport('artifacts/review/086-'+name+'-captures.json');assert.equal(capture.views.length,8);
  assert(!capture.errors.length&&!capture.unexpectedWarnings.length);
  for(const v of capture.views){
    assert.equal(hashStudyFile(v.file),v.sha256);
    inspections.push({file:v.file,sha256:v.sha256,inspected:true,assessment:name==='first-rear-drive'
      ?'Rear assembly, full pulleys, source overlay and contact details inspected. Hidden geometry and ideal band drive are assumptions; complete loaded mechanism remains unqualified.'
      :'Weighted core pose inspected. First capture/trip and the failed catch reset are visible. Six views hide the front bearing. This rejected motion lacks rope/pump meshes and the rear assembly.'});
  }
}
const notes='artifacts/review/086-reconstruction-notes.md',files=new Set(prior.sources.map(s=>s.file).filter(f=>f!==notes));
files.add('docs/review-progress.md');
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix),notesArchive=prefix+'-review-notes-source.txt';
fs.copyFileSync(notes,notesArchive,fs.constants.COPYFILE_EXCL);sources.push({file:notes,archive:notesArchive,sha256:hashStudyFile(notes)});
verifyStudySources(sources);
const report={movement:86,status:'rear-drive-and-loaded-return-diagnostic-checkpoint',created:new Date().toISOString(),productionChanged:false,
  candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',ownedBrowserRunning:false,ownedStudyRunning:false,
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,
  priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},priorImpactSourcesArchived:prior.sources.length,
  reports,inspections,loadedCycles:{period,cycles,accepted:false,reason:'The catch does not reset for the second shaft revolution; second lift is below one thousandth of the first.'},sources,
  remaining:['Resolve the catch reset with finite source-consistent geometry and justified hidden assumptions',
    'Complete rope attachment, winding surface, pump/load and stroke-limit hardware; combine rear input assembly',
    'Recompute mass for any new free-body hardware and establish repeated motion, time-step agreement and continuous clearance',
    'Inspect full playback, integrate the qualified candidate and validate production'],
  qualification:'Rear input geometry and sampled clearances pass; weighted mass, relative losses, impact forces and sampled loaded clearances also pass. These are bounded diagnostic results. Slower startup still misses the step-agreement target, and the loaded trial fails repeated operation. No full mechanism, production build, full-suite or integration pass is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,reports:reports.length,sources:sources.length,inspections:inspections.length});
