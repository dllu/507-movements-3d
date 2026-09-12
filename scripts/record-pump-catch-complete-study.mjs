import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-complete-hardware-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),prior=readStudyReport('artifacts/review/086-heel-reset-final-study-checkpoint.json'),
  prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(core.sources);verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior retained source: '+s.file);
const names=['heel-eighth-ms-retry-summary','heel-refined-agreement','heel-refined-forces','heel-refined-work','heel-refined-overlap',
  'first-complete-surfaces','first-complete-captures','textured-complete-surfaces','textured-complete-captures','first-complete-energy',
  'first-complete-dynamics-summary','first-complete-forces','first-complete-work','first-complete-rope','loaded-complete-surfaces',
  'extreme-complete-surfaces','first-complete-motion-captures'];
for(const name of ['complete-eighth-ms-summary','first-complete-agreement','complete-refined-forces','complete-refined-work'])if(fs.existsSync('artifacts/review/086-'+name+'.json'))names.push(name);
const reports=names.map(name=>{
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained input: '+s.file);if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
  return{file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical input snapshots retained; changed current files are listed.':'Matches current frozen inputs.'};
});
for(const name of ['first-complete-energy','first-complete-dynamics-summary','first-complete-forces','first-complete-work','extreme-complete-surfaces']){
  const data=readStudyReport('artifacts/review/086-'+name+'.json');assert(data.passed);verifyStudySources(data.sources);
}
assert.equal(readStudyReport('artifacts/review/086-heel-refined-agreement.json').passed,false);
assert.equal(readStudyReport('artifacts/review/086-first-complete-rope.json').passed,false);
const inspections=[];
for(const[name,count]of [['first-complete',9],['textured-complete',10],['first-complete-motion',12]]){
  const capture=readStudyReport('artifacts/review/086-'+name+'-captures.json');assert.equal(capture.views.length,count);assert(!capture.errors.length&&!capture.unexpectedWarnings.length);
  for(const v of capture.views){assert.equal(hashStudyFile(v.file),v.sha256);inspections.push({file:v.file,sha256:v.sha256,inspected:true,
    assessment:name==='first-complete-motion'?'Both solved lifts, releases, guided returns and slack phases inspected; ten frames hide the front bearing.'
      :name==='textured-complete'?'Textured rope, source overlay, full front/rear assembly, winding groove, clamp and load termination inspected. Two sections hide the rear drive.'
      :'Initial hardware and source views inspected. The first anchor detail is occluded by the rear drive; the later section resolves the attachment.'});}
}
const data=readStudyReport('artifacts/review/086-first-complete-dynamics.json.gz'),period=2*Math.PI/Math.abs(data.angularSpeed),offset=Math.round(period/data.step),
  repeat={start:.5,period,coordinateError:[0,0,0],velocityError:[0,0,0],samples:0},cycles=[0,1].map(index=>({cycle:index+1,minimum:Infinity,maximum:-Infinity,peakTime:null}));
assert.equal(data.actualEnd,2*period);assert.equal(data.subdivisions,0);
for(let i=0;i<data.rows.length;i++){
  const r=data.rows[i],cycle=cycles[Math.min(1,Math.floor(r.time/period))];cycle.minimum=Math.min(cycle.minimum,r.q[2]);
  if(r.q[2]>cycle.maximum){cycle.maximum=r.q[2];cycle.peakTime=r.time;}
  if(r.time<repeat.start||i+offset>=data.rows.length)continue;repeat.samples++;
  for(const[key,error]of [['q',repeat.coordinateError],['v',repeat.velocityError]])for(let k=0;k<3;k++)error[k]=Math.max(error[k],Math.abs(r[key][k]-data.rows[i+offset][key][k]));
}
for(const c of cycles){c.lift=c.maximum-c.minimum;assert(c.lift>2.5);}
const files=new Set(prior.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')));
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix);
for(const file of ['artifacts/review/086-reconstruction-notes.md','docs/review-progress.md']){
  const archive=prefix+'-'+(file.startsWith('docs')?'progress':'notes')+'-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const processObservation=readStudyReport(process.env.PROBE_OBSERVATION??'artifacts/review/086-complete-process-observation.json'),report={movement:86,status:'complete-hardware-and-loaded-motion-study-checkpoint',created:new Date().toISOString(),
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',ownedBrowserRunning:false,processObservation,
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,priorHeelSourcesArchived:prior.sources.length,
  priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},reports,inspections,cycles,repeat,sources,
  remaining:['Resolve time-step disagreement using the complete free-body masses',
    'Refine rope tessellation to satisfy the independent centerline-length screen while retaining its exact analytic length',
    'Establish continuous primary and complete-hardware clearances, including deforming rope and guide travel',
    'Check readable playback and performance, integrate the qualified candidate, and validate production'],
  qualification:'The 42-part candidate combines the input drive, winding rim, attached rope and guided pump rod. Mass integration, loaded coarse forces/work and sampled hardware screens pass. Failed rope tessellation and earlier core convergence checks remain retained. Motion refinement and complete mechanical qualification remain pending.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,reports:reports.length,inspections:inspections.length,sources:sources.length});
