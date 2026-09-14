import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {variableTraverseStudySources} from './lib/variable-traverse-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-integrated-final-review-a';
const path=name=>'/dev/shm/122-'+name+'.json',read=name=>JSON.parse(fs.readFileSync(path(name)));
const sources=freezeStudySources([...variableTraverseStudySources('scripts/freeze-variable-traverse-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-122-variable-traverse.md','docs/review-progress.md','tests/mujoco-variable-traverse.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('variable-traverse')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const finalStudies=['dynamics-d','dynamics-e','dynamics-f','dynamics-g','clearances-b','comparison-b','integrated-a'];
const historical=['baseline-a','source-a','fit-a','center-fit-a','mesh-fit-a','reach-b','reach-c','reach-d',
 'candidate-b','dynamics-a','dynamics-b','dynamics-c','comparison-a','clearances-a'];
for(const name of [...historical,...finalStudies]){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256)differences.push(s.file);
 }
 if(finalStudies.includes(name))verifyStudySources(r.sources);
 add(path(name));evidence.at(-1).historicalSourceDifferences=differences;
}
for(const[name,count]of [['baseline-a',7],['candidate-b',4],['integrated-a',19]]){
 const capture=read(name),review=read(name+'-inspection');
 assert.equal(hashStudyFile(review.capture.file),review.capture.sha256);
 assert.equal(capture.views.length,count);assert.equal(review.views.length,count);
 for(const view of capture.views){assert.equal(hashStudyFile(view.file),view.sha256);add(view.file);}
 for(const view of review.views){assert(view.inspected&&view.note);assert(capture.views.some(v=>v.file===view.file&&v.sha256===view.sha256));}
 add(path(name+'-inspection'));
}
const sourceReview=read('source-a-inspection');assert(sourceReview.inspected);
assert.equal(hashStudyFile(sourceReview.file),sourceReview.sha256);
for(const suffix of ['source-a-inspection.json','source-a-points.png','source-a-points.svg'])add('/dev/shm/122-'+suffix);
for(const name of finalStudies.filter(n=>n.startsWith('dynamics-'))){
 const r=read(name),patterns=name==='dynamics-d'?2:1;
 assert.equal(r.duration,116*patterns+.25);assert.equal(r.timeResets,0);
 assert(r.maximumPenetrationPixels<.02);assert(r.maximumLinkageErrorPixels<.001);assert(r.maximumRollingErrorPixels<.2);
 assert(Math.abs(r.ranges.lower[1]-58*Math.PI*patterns)<.005);
 assert(Math.abs(r.ranges.upper[0]+46*Math.PI*patterns)<.005);
 assert(r.ranges.slider[0]<-.65&&r.ranges.slider[1]>.43);
 assert(r.rows.every(row=>[row.time,...Object.values(row.qpos),...Object.values(row.qvel),row.contacts,row.inputTorque].every(Number.isFinite)));
}
assert.deepEqual(read('dynamics-d').options,{});
assert.deepEqual(read('dynamics-e').options,{timestep:.0005,collisionTolerance:.00025});
assert.deepEqual(read('dynamics-f').options,{friction:.1,load:5});assert.deepEqual(read('dynamics-g').options,{friction:.1,load:-5});
const clearance=read('clearances-b');assert.equal(clearance.rows.length,466);assert.equal(clearance.checks,46332516);
assert.equal(clearance.maximumUnintendedPenetrationPixels,0);assert(clearance.maximumPenetrationPixels<.1);assert(clearance.rows.every(r=>!r.issues.length));
for(const g of Object.values(read('comparison-b').groups))assert([g.rms,g.maximum,...g.residuals].every(Number.isFinite));
const reach=read('reach-d').rows.find(r=>r.options.crankScale===.85&&r.options.guideDegrees===0);
assert(reach.complete&&reach.minimumDeterminant>.25&&reach.maximumSourcePinCorrectionPixels<10.05);
const capture=read('integrated-a');assert(capture.integrated);assert.deepEqual(capture.options,{});assert.deepEqual(capture.errors,[]);
assert(read('integrated-a-inspection').qualified);assert.equal(capture.runtime.reconstructionStatus,'verified');
assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
for(const[suffix,pattern]of [['tests-b.log',/# pass 15\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/38 passed/]]){
 const file='/dev/shm/122-'+suffix;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);
}
for(const suffix of ['playwright.config.mjs','serve-build.mjs','vite-a.log','tests-a.log','reach-a.log','candidate-a.log'])add('/dev/shm/122-'+suffix);
for(const file of fs.readdirSync('/dev/shm').filter(n=>/^122-reach-a-source-\d+\.txt$/.test(n)))add('/dev/shm/'+file);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/122-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 qualification:'122 is qualified for native variable traverse through the complete 29:23 pattern with 15 percent reduced cranks, ideal pins and bar guide, regularized shifted involutes and inferred depths, density and drive timing. Final studies match current source bytes. Sampled clearance is not continuous proof and forces are not calibrated. Failed and historical studies remain distinct. The all-507 review remains active.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
