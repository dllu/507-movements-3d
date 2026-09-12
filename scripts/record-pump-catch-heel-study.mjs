import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-heel-reset-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const core=readStudyReport('artifacts/review/086-first-study-checkpoint.json'),prior=readStudyReport('artifacts/review/086-rear-drive-study-checkpoint.json'),
  prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(core.sources);verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
for(const s of prior.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Prior retained source: '+s.file);
const names=['first-heel-controls','current-heel-controls','heel-energy','first-heel-captures','second-heel-captures','first-heel-trial-summary',
  'damped-heel-trial-summary','damped-heel-forces','damped-heel-work','damped-heel-surfaces','damped-heel-overlap','damped-heel-motion-captures',
  'second-bounds-controls','current-bounds-controls','heel-near-face-controls','heel-quarter-ms-summary','heel-quarter-forces','heel-quarter-work','bounded-summary-controls'];
const reports=names.map(name=>{
  const file='artifacts/review/086-'+name+'.json',data=readStudyReport(file),changedCurrentInputs=[];
  for(const s of data.sources){assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained input: '+s.file);if(hashStudyFile(s.file)!==s.sha256)changedCurrentInputs.push(s.file);}
  return{file,sha256:hashStudyFile(file),passed:data.passed??null,archivedInputsVerified:data.sources.length,changedCurrentInputs,
    qualification:changedCurrentInputs.length?'Historical source version retained and verified.':'Matches current frozen inputs.'};
});
for(const name of ['current-heel-controls','heel-energy','current-bounds-controls','heel-near-face-controls','heel-quarter-ms-summary','heel-quarter-forces','heel-quarter-work','bounded-summary-controls']){
  const d=readStudyReport('artifacts/review/086-'+name+'.json');assert(d.passed);verifyPumpCatchStudySources(d.sources);
}
for(const name of ['damped-heel-forces','damped-heel-work','damped-heel-surfaces','damped-heel-overlap'])assert(readStudyReport('artifacts/review/086-'+name+'.json').passed);
const data=readStudyReport('artifacts/review/086-damped-heel-trial.json.gz'),period=2*Math.PI/Math.abs(data.angularSpeed),offset=Math.round(period/data.step),
  repeat={start:.5,period,coordinateError:[0,0,0],velocityError:[0,0,0],samples:0};
assert.equal(data.actualEnd,2*period);assert.equal(data.subdivisions,0);
for(let i=Math.round(repeat.start/data.step);i+offset<data.rows.length;i++){
  repeat.samples++;for(const[key,error]of [['q',repeat.coordinateError],['v',repeat.velocityError]])for(let k=0;k<3;k++)error[k]=Math.max(error[k],Math.abs(data.rows[i][key][k]-data.rows[i+offset][key][k]));
}
const cycles=[0,1].map(index=>{
  const rows=data.rows.filter(r=>r.time>=index*period&&r.time<=(index+1)*period),minimum=Math.min(...rows.map(r=>r.q[2])),maximum=Math.max(...rows.map(r=>r.q[2]));
  return{cycle:index+1,lift:maximum-minimum,peakTime:rows.find(r=>r.q[2]===maximum).time};
});
assert([...repeat.coordinateError,...repeat.velocityError].every(v=>v<1e-8));assert(cycles.every(c=>c.lift>2.5));
const inspections=[];
for(const[name,count]of [['first-heel',8],['second-heel',3],['damped-heel-motion',8]]){
  const capture=readStudyReport('artifacts/review/086-'+name+'-captures.json');assert.equal(capture.views.length,count);assert(!capture.errors.length&&!capture.unexpectedWarnings.length);
  for(const v of capture.views){assert.equal(hashStudyFile(v.file),v.sha256);inspections.push({file:v.file,sha256:v.sha256,inspected:true,
    assessment:name==='damped-heel-motion'?'Both solved lifts, trips and return poses inspected; rope/pump meshes and combined rear assembly remain absent.'
      :name==='second-heel'?'Oblique details show the physical lug opening and seating on the wheel stop. Wheel and frame are hidden for inspection.'
      :'Source contour, overlay and hidden heel geometry inspected. Straight-on heel details have poor lug contrast; later oblique details resolve this.'});}
}
const failures=['artifacts/review/086-first-bounds-controls.log','artifacts/review/086-first-bounds-failed-script.txt','artifacts/review/086-first-bounds-failed-normal.txt',
  'artifacts/review/086-heel-eighth-ms.log','artifacts/review/086-heel-eighth-failed-summary-script.txt']
  .map(file=>({file,sha256:hashStudyFile(file)})),observationFile=process.env.PROBE_OBSERVATION??'artifacts/review/086-heel-refinement-retry-observation.json',processObservation=readStudyReport(observationFile);
assert(processObservation.observations.every(o=>o.result.exit_code===0||o.result.session_id===o.session_id));
const notes='artifacts/review/086-reconstruction-notes.md',files=new Set(prior.sources.map(s=>s.file).filter(f=>f!==notes));files.add(observationFile);
for(const directory of ['scripts','scripts/lib'])for(const name of fs.readdirSync(directory))if(name.includes('pump-catch')&&name.endsWith('.mjs'))files.add(directory+'/'+name);
const sources=freezeStudySources([...files],prefix),notesArchive=prefix+'-review-notes-source.txt';
fs.copyFileSync(notes,notesArchive,fs.constants.COPYFILE_EXCL);sources.push({file:notes,archive:notesArchive,sha256:hashStudyFile(notes)});verifyStudySources(sources);
const report={movement:86,status:'finite-heel-reset-and-repeated-coarse-motion-checkpoint',created:new Date().toISOString(),productionChanged:false,candidateIntegrated:false,
  mechanicsPassed:false,full507GoalStillActive:true,previousGoalTurn:'progress',ownedBrowserRunning:false,processObservation,
  frozenProductionInputsMatched:Object.keys(frozen).length,originalCoreSourcesUnchanged:core.sources.length,
  priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},priorRearDriveSourcesArchived:prior.sources.length,
  reports,inspections,failures,repeat,cycles,sources,
  remaining:['Poll the retained 0.125 ms study handle; do not restart solely because observation takes time',
    'Compare the completed 0.25/0.125 ms trajectories and independently audit the refined motion',
    'Complete rope attachment, winding surface, pump/load and physical stroke-limit hardware, and combine the rear drive',
    'Recompute mass for added free-body hardware, establish continuous clearance and readable playback, integrate and validate production'],
  qualification:'The finite heel and relative pin damping restore observed repetition over two coarse cycles. Spatial, moment, work and sampled clearance checks pass for the retained coarse source version. Current bounds and interior-cap regressions pass. Refinement and complete mechanism qualification remain pending; process states are observations at the recorded time.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,reports:reports.length,inspections:inspections.length,sources:sources.length,processObservation:processObservation.verifiedAt});
