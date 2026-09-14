import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {reversibleClickStudySources} from './lib/reversible-click-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/121-integrated-final-review-a';
const path=name=>'/dev/shm/121-'+name+'.json',read=name=>JSON.parse(fs.readFileSync(path(name)));
const sources=freezeStudySources([...reversibleClickStudySources('scripts/freeze-reversible-click-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-121-reversible-click.md','docs/review-progress.md','tests/mujoco-reversible-click.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('reversible-click')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
const finalStudies=['dynamics-ao','dynamics-ap','dynamics-aq','dynamics-ar','dynamics-as','dynamics-at',
 'clearances-c','clearances-d','comparison-d','integrated-b'];
const historical=['baseline-a','candidate-a','candidate-b','source-a','source-b','fit-a','fit-b','fit-d','center-fit-a',
 'comparison-a','comparison-b','comparison-c','clearances-a','clearances-b',
 ...Array.from({length:26},(_,i)=>'dynamics-'+String.fromCharCode(97+i)),
 ...Array.from({length:14},(_,i)=>'dynamics-a'+String.fromCharCode(97+i))];
for(const name of [...historical,...finalStudies]){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256)differences.push(s.file);
 }
 if(finalStudies.includes(name))verifyStudySources(r.sources);
 add(path(name));evidence.at(-1).historicalSourceDifferences=differences;
}
for(const [name,count,inspected]of [['baseline-a',7,7],['candidate-a',14,3],['candidate-b',18,8],['integrated-b',18,18]]){
 const capture=read(name),review=read(name+'-inspection');
 assert.equal(hashStudyFile(review.capture.file),review.capture.sha256);
 assert.equal(capture.views.length,count);assert.equal(review.views.length,inspected);
 for(const view of capture.views){assert.equal(hashStudyFile(view.file),view.sha256);add(view.file);}
 for(const view of review.views){assert(view.inspected&&view.note);assert(capture.views.some(v=>v.file===view.file&&v.sha256===view.sha256));}
 add(path(name+'-inspection'));
}
const sourceReview=read('source-b-inspection');assert(sourceReview.inspected);
assert.equal(hashStudyFile(sourceReview.file),sourceReview.sha256);
for(const suffix of ['source-b-inspection.json','source-b-points.png','source-b-points.svg','fit-d-options.json','storage-relocation.json'])add('/dev/shm/121-'+suffix);

for(const name of finalStudies.filter(n=>n.startsWith('dynamics-'))){
 const r=read(name),duration=['dynamics-ao','dynamics-ap'].includes(name)?30:6,sign=r.options.mode==='reverse'?1:-1;
 assert.equal(r.duration,duration);assert.equal(r.timeResets,0);assert.equal(r.cycleEnds.length,duration/3);
 assert(r.maximumRetreatTeeth<.02);assert(r.maximumPenetrationPixels<.1);assert(r.maximumLinkageErrorPixels<.001);
 for(let i=1;i<r.cycleEnds.length;i++)assert(Math.abs(r.cycleEnds[i].teeth-r.cycleEnds[i-1].teeth-sign)<.001);
 assert(r.rows.every(row=>[row.time,...Object.values(row.qpos),...Object.values(row.qvel),row.contacts,row.torque].every(Number.isFinite)));
}
assert.deepEqual(read('dynamics-ao').options,{});assert.deepEqual(read('dynamics-ap').options,{mode:'reverse'});
for(const name of ['clearances-c','clearances-d']){
 const r=read(name);assert.equal(r.rows.length,21);assert.equal(r.checks,646350);
 assert.equal(r.maximumUnintendedPenetrationPixels,0);assert(r.maximumPenetrationPixels<.01);assert(r.rows.every(r=>!r.issues.length));
}
for(const g of Object.values(read('comparison-d').groups))assert([g.rms,g.maximum,...g.residuals].every(Number.isFinite));
const capture=read('integrated-b');assert(capture.integrated);assert.deepEqual(capture.options,{});assert.deepEqual(capture.errors,[]);
assert(read('integrated-b-inspection').qualified);assert.equal(capture.runtime.reconstructionStatus,'verified');
assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
for(const[suffix,pattern]of [['tests-b.log',/# pass 14\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/37 passed/]]){
 const file='/dev/shm/121-'+suffix;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);
}
for(const suffix of ['playwright.config.mjs','serve-build.mjs','vite-a.log','integrated-a.log'])add('/dev/shm/121-'+suffix);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/121-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 qualification:'121 is qualified for native contact-driven indexing in either click position, after initial seating, with ideal pins and guide, gravity seating, inferred hinge damping and resisting shaft load. The radial cog and narrowed click end are documented source interpretations. Final studies match current source bytes. Sampled clearance is not continuous proof and forces are not calibrated. The all-507 review remains active.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
