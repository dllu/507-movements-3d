import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {segmentClampStudySources} from './lib/segment-clamp-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-integrated-final-review-a';
const read=name=>JSON.parse(fs.readFileSync('/dev/shm/120-'+name+'.json'));
const sources=freezeStudySources([...segmentClampStudySources('scripts/freeze-segment-clamp-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-120-segment-clamp.md','docs/review-progress.md','tests/mujoco-segment-clamp.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('segment-clamp')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const finalStudies=['dynamics-f','dynamics-g','dynamics-h','dynamics-i','dynamics-j','dynamics-k','clearances-c','comparison-b','integrated-a'];
const historical=['baseline-a','candidate-a','candidate-b','candidate-c','source-a','source-b','source-c',
 'fit-a','assembly-fit-a','assembly-fit-b','assembly-fit-c','edge-fit-a','comparison-a',
 'dynamics-a','dynamics-b','dynamics-c','dynamics-d','dynamics-e','stall-a','stall-b','clearances-a','clearances-b'];
for(const name of [...historical,...finalStudies]){
 const report=read(name),differences=[];
 for(const source of report.sources??[]){
  if(source.archive)assert.equal(hashStudyFile(source.archive),source.sha256,source.archive);
  if(hashStudyFile(source.file)!==source.sha256)differences.push(source.file);
 }
 // Final studies must match every current input byte. Earlier constructions
 // are retained as historical evidence, with no normalized compatibility claim.
 if(finalStudies.includes(name))verifyStudySources(report.sources);
 add('/dev/shm/120-'+name+'.json');evidence.at(-1).historicalSourceDifferences=differences;
}
for(const [name,count]of [['baseline-a',7],['candidate-a',14],['candidate-b',14],['candidate-c',14],['integrated-a',14]]){
 const capture=read(name),inspection=read(name+'-inspection');
 assert.equal(inspection.capture.sha256,hashStudyFile(inspection.capture.file));
 assert.equal(capture.views.length,count);assert.equal(inspection.views.length,count);
 for(const view of capture.views){
  assert.equal(hashStudyFile(view.file),view.sha256);
  assert(inspection.views.some(v=>v.file===view.file&&v.sha256===view.sha256&&v.inspected&&v.note));add(view.file);
 }
 add('/dev/shm/120-'+name+'-inspection.json');
}
const sourceInspection=read('source-c-inspection');assert(sourceInspection.inspected);
assert.equal(hashStudyFile(sourceInspection.file),sourceInspection.sha256);
for(const suffix of ['source-c-inspection.json','source-c-points.png','source-c-points.svg'])add('/dev/shm/120-'+suffix);

for(const name of finalStudies.filter(n=>n.startsWith('dynamics-'))){
 const r=read(name);assert.equal(r.duration,name==='dynamics-f'?50:10);assert.equal(r.timeResets,0);
 assert(r.maximumRollingErrorPixels<.15);assert(r.maximumPenetrationPixels<.05);
 for(const pair of ['externalTeeth/smallPinion','internalTeeth/largePinion','leftJaw/rightJaw'])assert(r.pairs[pair]>0);
 for(let cycle=0;cycle<r.duration/5;cycle++){
  const near=time=>r.rows.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);
  const closed=near(5*cycle+2.5),opened=near(5*cycle+5);
  assert(closed.qpos[0]>1.68&&closed.qpos[0]<1.72);assert(closed.torque>7.9);
  assert(Math.abs(opened.qpos[0])<.01);assert(Math.abs(opened.qpos[1])<.004);assert(Math.abs(opened.qpos[2])<.004);
 }
 assert(r.rows.every(row=>[row.time,...row.qpos,...row.qvel,row.contacts,row.torque].every(Number.isFinite)));
}
assert.deepEqual(read('dynamics-f').options,{});
const audit=read('clearances-c');assert.deepEqual(audit.options,{});assert.equal(audit.rows.length,21);
assert.equal(audit.checks,4219514);assert.equal(audit.maximumUnintendedPenetrationPixels,0);
assert(audit.maximumPenetrationPixels<.05);assert(audit.rows.every(r=>!r.issues.length));
for(const group of Object.values(read('comparison-b').groups))assert([group.rms,group.maximum,...group.residuals].every(Number.isFinite));
const capture=read('integrated-a');assert(capture.integrated);assert.deepEqual(capture.options,{});
assert.deepEqual(capture.errors,[]);assert(read('integrated-a-inspection').qualified);
assert.equal(capture.runtime.reconstructionStatus,'verified');assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
for(const [suffix,pattern]of [['tests-b.log',/# pass 15\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/36 passed/]]){
 const file='/dev/shm/120-'+suffix;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);
}
for(const suffix of ['playwright.config.mjs','serve-build.mjs'])add('/dev/shm/120-'+suffix);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};
assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/120-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 qualification:'120 is qualified for contact-driven closure and reopening with ideal shaft bearings, an inferred reversing drive, recessed frame arms and widened jaw edges. Regularized tooth counts and local source differences are documented. Collision outlines have a bounded approximation; all hardware is separately sampled for clearance. Final studies match current source bytes. Forces are not calibrated and sampled clearance is not a continuous proof. The all-507 review remains active.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
