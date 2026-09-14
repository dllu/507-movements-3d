import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {sectorHandoffStudySources} from './lib/sector-handoff-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-integrated-final-review-a';
const path=name=>'/dev/shm/123-'+name+'.json',read=name=>JSON.parse(fs.readFileSync(path(name)));
const sources=freezeStudySources([...sectorHandoffStudySources('scripts/freeze-sector-handoff-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-123-sector-handoff.md','docs/review-progress.md','docs/mujoco-integration.md',
 'tests/mujoco-sector-handoff.test.mjs','tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs',
 'tests/mujoco-runtime.test.mjs','tests/camera-resize.test.mjs','tests/helpers/solid-surface.mjs',
 'scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('sector-handoff')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const finalStudies=['dynamics-final','dynamics-fine','dynamics-loaded','dynamics-no-cam','dynamics-wrong-phase','poses-final','clearances-final','comparison-final','integrated-views-a'];
const historical=['baseline-a','source-a','fit-a','spur-fit-a','candidate-a','candidate-b','comparison-a',
 ...'abcdefgh'.split('').map(n=>'dynamics-'+n),...'abc'.split('').map(n=>'poses-'+n),'clearances-c'];
for(const name of [...historical,...finalStudies]){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256)differences.push(s.file);
 }
 if(finalStudies.includes(name))verifyStudySources(r.sources);
 add(path(name));evidence.at(-1).historicalSourceDifferences=differences;
}
for(const[name,total,inspected]of [['baseline-a',7,7],['candidate-a',15,3],['candidate-b',15,15],['integrated-views-a',19,19]]){
 const capture=read(name),review=read(name+'-inspection');assert.equal(hashStudyFile(review.capture.file),review.capture.sha256);
 assert.equal(capture.views.length,total);assert.equal(review.views.length,inspected);assert.equal(review.complete,total===inspected);
 for(const view of capture.views){assert.equal(hashStudyFile(view.file),view.sha256);add(view.file);}
 for(const view of review.views){assert(view.inspected&&view.note);assert(capture.views.some(v=>v.file===view.file&&v.sha256===view.sha256));}
 add(path(name+'-inspection'));
}
const sourceReview=read('source-a-inspection');assert(sourceReview.inspected);assert.equal(hashStudyFile(sourceReview.file),sourceReview.sha256);
for(const suffix of ['source-a-inspection.json','source-a-points.png','source-a-points.svg','center-detail.png','primary.html'])add('/dev/shm/123-'+suffix);
for(const name of ['dynamics-final','dynamics-fine','dynamics-loaded']){
 const r=read(name),turns=name==='dynamics-final'?10:2;assert.equal(r.duration,6*turns+.25);assert.equal(r.timeResets,0);assert.equal(r.disableCam,false);
 assert(r.maximumPenetrationPixels<.1);assert(r.maximumRackErrorPixels<1);assert(r.maximumSpurRollingErrorPixels<.15);assert(r.maximumRetreatRadians<.0001);
 assert(Math.abs(r.ranges.center[1]-2*Math.PI*turns)<.004);assert(r.ranges.rack[0]<-1.79&&r.ranges.rack[1]>1.79);
 for(const pair of ['centerSpur/leftSpur','centerSpur/rightSpur','leftSector/rack','rack/rightSector','lowerStop/transferCam','transferCam/upperStop'])assert(r.pairs[pair]>0,pair);
 assert(r.rows.every(row=>[row.time,...Object.values(row.qpos),...Object.values(row.qvel),row.contacts,row.inputForce].every(Number.isFinite)));
}
assert.deepEqual(read('dynamics-final').options,{});assert.equal(read('dynamics-final').maximumRetreatRadians,0);
assert.deepEqual(read('dynamics-fine').options,{timestep:.0005,collisionTolerance:.00025,samples:192,cutterSteps:4096,reliefSteps:2048});
assert.deepEqual(read('dynamics-loaded').options,{friction:.1,load:-.1});
for(const name of ['dynamics-no-cam','dynamics-wrong-phase']){const r=read(name);assert.equal(r.duration,12.25);assert(r.ranges.center[1]<2);assert(r.maximumRackErrorPixels>10);}
assert(read('dynamics-no-cam').disableCam);assert.equal(read('dynamics-wrong-phase').options.camPhase,Math.PI);
assert.deepEqual(read('poses-final').maxima,{});assert.equal(read('poses-final').rows.length,721);
const clearance=read('clearances-final');assert.equal(clearance.rows.length,51);assert.equal(clearance.checks,13060170);assert.equal(clearance.maximumUnintendedPenetrationPixels,0);assert(clearance.maximumPenetrationPixels<.1);assert(clearance.rows.every(r=>!r.issues.length));
for(const g of Object.values(read('comparison-final').groups))assert([g.rms,g.maximum,...g.residuals].every(Number.isFinite));
const capture=read('integrated-views-a');assert(capture.integrated);assert.deepEqual(capture.options,{});assert.deepEqual(capture.errors,[]);assert(read('integrated-views-a-inspection').qualified);assert.equal(capture.runtime.reconstructionStatus,'verified');assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
for(const[suffix,pattern]of [['tests-b.log',/# pass 18\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/39 passed/]]){const file='/dev/shm/123-'+suffix;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);}
for(const suffix of ['playwright.config.mjs','serve-build.mjs','vite-a.log','tests-a.log','tests-a-source.mjs','clearances-a.log','clearances-b.log','cam-control-a.log'])add('/dev/shm/123-'+suffix);
for(const file of fs.readdirSync('/dev/shm').filter(n=>/^123-clearances-[ab]-source-\d+\.txt$/.test(n)))add('/dev/shm/'+file);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/123-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 qualification:'123 is qualified for native double-rack sector handoff with regular equal spur gears, relieved end teeth, raised flanges, a rephased working transfer cam, ideal bearings/guide and inferred depths, mass and input timing. Final studies match current source bytes. Historical failures and partial inspections remain distinct. Sampled clearance is not continuous proof; forces and arbitrary operating speeds/loads are not qualified. The all-507 review remains active.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
