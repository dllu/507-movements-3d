import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {strokeDoublerStudySources} from './lib/stroke-doubler-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-integrated-final-review-a';
const finalCapture=process.env.FINAL_CAPTURE??'integrated-b',finalBuild=process.env.FINAL_BUILD??'/dev/shm/118-integrated-build-b';
const read=name=>JSON.parse(fs.readFileSync('/dev/shm/118-'+name+'.json'));
const sources=freezeStudySources([...strokeDoublerStudySources('scripts/freeze-stroke-doubler-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-118-stroke-doubler.md','docs/review-progress.md','tests/mujoco-stroke-doubler.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('stroke-doubler')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const nativeNames=['comparison-b','dynamics-d','dynamics-e','dynamics-f','dynamics-g','dynamics-h','clearances-b'];
const normalizeDisplay=text=>text.replace("reconstructionStatus:'candidate'","reconstructionStatus:'verified'").replace(/shadowNormalBias:[\d.e+-]+/g,'shadowNormalBias:DISPLAY').replace(/shadowBias:[\d.e+-]+/g,'shadowBias:DISPLAY');
for(const name of [...new Set(['baseline-a','baseline-a-inspection','candidate-a','candidate-a-inspection','source-a','fit-a',
 'comparison-a','comparison-b','dynamics-b','dynamics-c',...nativeNames,'clearances-a',
 'integrated-a','integrated-a-inspection','shadows-a','shadows-b',finalCapture,finalCapture+'-inspection'])]){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256){
   differences.push(s.file);
   if(nativeNames.includes(name)){
    assert(['src/simulation/mujoco-stroke-doubler/visual.js','src/simulation/mujoco-stroke-doubler/geometry.js'].includes(s.file));
    assert.equal(normalizeDisplay(fs.readFileSync(s.archive,'utf8')),normalizeDisplay(fs.readFileSync(s.file,'utf8')),'Native geometry or physics changed');
   }
  }
 }
 add('/dev/shm/118-'+name+'.json');evidence.at(-1).historicalSourceDifferences=differences;
}
for(const name of [...new Set(['baseline-a','candidate-a','integrated-a',finalCapture])]){
 const capture=read(name),inspection=read(name+'-inspection');
 assert.equal(inspection.capture.sha256,hashStudyFile(inspection.capture.file));
 assert.equal(capture.views.length,name==='baseline-a'?7:13);
 for(const view of capture.views){assert.equal(hashStudyFile(view.file),view.sha256);assert(inspection.views.some(v=>v.file===view.file&&v.sha256===view.sha256&&v.inspected&&v.note));add(view.file);}
}
for(const view of read('shadows-b').views){
 assert.equal(hashStudyFile(view.file),view.sha256);add(view.file);
 evidence.at(-1).note=view.name==='normal-01'?'Selected: clean front face with retained part shadows.':
  view.name==='no-shadows'?'Cached rendering matches the current case; this does not demonstrate disabled shadows.':'Inspected comparison; not selected.';
}
add('/dev/shm/118-browser-b.log');evidence.at(-1).note='Historical invocation matched no tests because of an anchored filter; browser-c is the corrected passing invocation.';
const capture=read(finalCapture);verifyStudySources(capture.sources);
assert(capture.integrated);assert.deepEqual(capture.errors,[]);assert(read(finalCapture+'-inspection').qualified);
assert.equal(capture.runtime.reconstructionStatus,'verified');assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
const dynamics=read('dynamics-d'),audit=read('clearances-b');assert.equal(dynamics.duration,50);
for(const name of nativeNames.filter(n=>n.startsWith('dynamics-'))){const r=read(name);assert.equal(r.timeResets,0);assert(r.maximumPenetrationPixels<.015);assert(r.maximumMotionErrorPixels<.16);assert(r.ranges.rack[0]<-1.79&&r.ranges.rack[1]>1.79);}
assert.equal(audit.maximumUnintendedPenetrationPixels,0);assert(audit.rows.every(r=>r.issues.length===0));assert.equal(audit.rows.length,21);assert.equal(audit.checks,1517922);
for(const group of Object.values(read('comparison-b').groups))assert([group.rms,group.maximum,...group.residuals].every(Number.isFinite));
const logs=[['tests-b.log',/# pass 15\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/34 passed/]];
if(finalBuild.endsWith('-b'))logs.push(['build-b.log',/built in/],['browser-c.log',/1 passed/]);
for(const [name,pattern]of logs){const file='/dev/shm/118-'+name;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);}
for(const file of ['/dev/shm/118-playwright.config.mjs','/dev/shm/118-serve-build.mjs','/dev/shm/118-source-point-review-a.svg','/dev/shm/118-source-point-review-a.png'])add(file);
if(finalBuild.endsWith('-b'))for(const n of ['playwright-b.config.mjs','serve-build-b.mjs'])add('/dev/shm/118-'+n);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk(finalBuild),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualification:'118 is qualified for native doubled-stroke transmission with a regular fourteen-tooth involute pinion and ideal bearing/guide constraints. Depth, fixed support webs, input amplitude and input timing are inferred. Native evidence permits only display-status and shadow-setting differences from final source. Final rendering is separately inspected. This progress does not complete the all-507 review.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
