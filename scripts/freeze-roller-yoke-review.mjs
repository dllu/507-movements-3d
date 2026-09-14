import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {rollerYokeStudySources} from './lib/roller-yoke-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/117-integrated-final-review-a';
const read=name=>JSON.parse(fs.readFileSync('/dev/shm/117-'+name+'.json'));
const sources=freezeStudySources([...rollerYokeStudySources('scripts/freeze-roller-yoke-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-117-roller-yoke.md','docs/review-progress.md','tests/mujoco-roller-yoke.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('roller-yoke')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const nativeNames=['comparison-b','dynamics-b','dynamics-c','dynamics-d','dynamics-e','dynamics-f','clearances-b'];
for(const name of ['baseline-a','baseline-a-inspection','candidate-a','candidate-a-inspection',
 'source-a','source-b','fit-a','fit-b','comparison-a','comparison-b',
 ...Array.from({length:6},(_,i)=>'dynamics-'+String.fromCharCode(97+i)),
 'clearances-a','clearances-b','integrated-a','integrated-a-inspection']){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256){
   differences.push(s.file);
   if(nativeNames.includes(name)){
    assert.equal(s.file,'src/simulation/mujoco-roller-yoke/visual.js','Native evidence has changed inputs');
    assert.equal(fs.readFileSync(s.archive,'utf8').replace("reconstructionStatus:'candidate'","reconstructionStatus:'verified'"),fs.readFileSync(s.file,'utf8'));
   }
  }
 }
 add('/dev/shm/117-'+name+'.json');evidence.at(-1).historicalSourceDifferences=differences;
}
for(const name of ['baseline-a','candidate-a','integrated-a']){
 const capture=read(name),inspection=read(name+'-inspection');
 assert.equal(inspection.capture.sha256,hashStudyFile(inspection.capture.file));
 assert.equal(capture.views.length,name==='baseline-a'?7:13);
 for(const view of capture.views){
  assert.equal(hashStudyFile(view.file),view.sha256);
  assert(inspection.views.some(v=>v.file===view.file&&v.sha256===view.sha256&&v.inspected&&v.note));
  add(view.file);
 }
}
const capture=read('integrated-a');verifyStudySources(capture.sources);
assert(capture.integrated);assert.deepEqual(capture.errors,[]);
assert.equal(capture.runtime.reconstructionStatus,'verified');assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
const dynamics=read('dynamics-b'),audit=read('clearances-b');
assert.equal(dynamics.duration,50);assert.equal(dynamics.timeResets,0);
assert(dynamics.maximumPenetrationPixels<.005);assert(dynamics.maximumMotionErrorPixels<.005);
assert(dynamics.ranges.yoke[0]<-.248&&dynamics.ranges.yoke[1]>.248);
for(const name of nativeNames.filter(n=>n.startsWith('dynamics-'))){
 const r=read(name);assert.equal(r.timeResets,0);assert(r.maximumPenetrationPixels<.005);assert(r.maximumMotionErrorPixels<.005);
}
assert.equal(audit.maximumUnintendedPenetrationPixels,0);assert(audit.rows.every(r=>r.issues.length===0));
assert.equal(audit.rows.length,21);assert.equal(audit.checks,1080198);
for(const group of Object.values(read('comparison-b').groups))assert([group.rms,group.maximum,...group.residuals].every(Number.isFinite));
for(const [file,pattern]of [['/dev/shm/117-tests-a.log',/# pass 15\n# fail 0/],['/dev/shm/117-build-a.log',/built in/],['/dev/shm/117-browser-a.log',/33 passed/]]){
 assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);
}
for(const file of ['/dev/shm/117-playwright.config.mjs','/dev/shm/117-serve-build.mjs'])add(file);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};
assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/117-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualification:'117 is qualified for native cam-driven yoke motion with ideal bearings and guide, inferred depth and stem continuation. Lower roller spin and contact forces are not numerically converged or calibrated. Historical preliminary readings and comparisons are retained separately from qualification. This progress does not complete the all-507 review.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
