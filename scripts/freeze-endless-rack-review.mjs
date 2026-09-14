import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {endlessRackStudySources} from './lib/endless-rack-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-integrated-final-review-a';
const read=name=>JSON.parse(fs.readFileSync('/dev/shm/119-'+name+'.json'));
const sources=freezeStudySources([...endlessRackStudySources('scripts/freeze-endless-rack-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-119-endless-rack.md','docs/review-progress.md','tests/mujoco-endless-rack.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('endless-rack')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);

// These exact substitutions describe the reviewed differences between the
// native studies and registration. Study options explicitly set retention;
// no physical geometry or executed force law may otherwise change.
const replacements=[
 ['retention=0,retentionDamping=100','retention=10000,retentionDamping=100'],
 ['// Diagnostic ideal mesh retention, disabled by default. This conservative','// Ideal mesh retention represents unpictured engagement support. Its'],
 ["assumptions:'Candidate: uniform pinion input, passive rack and shaft slides, ideal horizontal guide and finite vertical slot end limits. Optional diagnostic normal retention is an additional unpictured ideal guide, not native tooth contact. Cap transfer remains unqualified.'",
  "assumptions:'Uniform pinion input with native tooth-driven rack travel and shaft lift. Horizontal bearings and finite vertical slot limits are ideal. A geometric normal spring represents additional unpictured engagement support; it applies no tangential force and does not prescribe output phase. Hidden depths and the flattened rear rod attachment are reconstructed.'"],
 ["reconstructionStatus:'candidate'","reconstructionStatus:'verified'"],
 ["reconstructionNote:'Section view outlines the front guide to reveal the pinion. A uniformly rotating pinion works around an endless rack while its shaft slides vertically. End transfer and the additional guide needed to retain engagement remain under review.'",
  "reconstructionNote:'Section view outlines the front guide to reveal the pinion. Tooth contact drives the rack and lifts the shaft around each end. Additional support keeping the teeth engaged is idealized; hidden depths and the rear rod attachment are reconstructed.'"],
 ['new THREE.LineBasicMaterial({color:PALETTE.frame})','new THREE.LineBasicMaterial({color:PALETTE.ink})'],
 ['// Junction teeth still require a rolling-envelope/contact qualification.',
  '// The generated circular teeth join straight rack teeth at the end tangencies.\n// Their finite running clearance is checked in native contact studies.'],
];
const normalize=text=>replacements.reduce((s,[a,b])=>s.replace(a,b),text);
const nativeNames=['dynamics-c','dynamics-d','dynamics-e','dynamics-f','dynamics-g','dynamics-h','dynamics-i','clearances-a','comparison-a'];
const compatibleFiles=['geometry','physics','profile','visual'].map(n=>'src/simulation/mujoco-endless-rack/'+n+'.js');
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
for(const name of ['baseline-a','candidate-a','candidate-b','integrated-a','source-a','source-b','fit-a','assembly-fit-a',
 'dynamics-a','dynamics-b',...nativeNames]){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){
  if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);
  if(hashStudyFile(s.file)!==s.sha256){
   differences.push(s.file);
   if(nativeNames.includes(name)){
    assert(compatibleFiles.includes(s.file),s.file);
    assert.equal(normalize(fs.readFileSync(s.archive,'utf8')),normalize(fs.readFileSync(s.file,'utf8')),'Changed physical study input: '+s.file);
   }
  }
 }
 add('/dev/shm/119-'+name+'.json');evidence.at(-1).historicalSourceDifferences=differences;
}
for(const [name,count]of [['baseline-a',7],['candidate-a',14],['candidate-b',15],['integrated-a',15]]){
 const capture=read(name),inspection=read(name+'-inspection');
 assert.equal(inspection.capture.sha256,hashStudyFile(inspection.capture.file));
 assert.equal(capture.views.length,count);assert.equal(inspection.views.length,count);
 for(const v of capture.views){assert.equal(hashStudyFile(v.file),v.sha256);assert(inspection.views.some(i=>i.file===v.file&&i.sha256===v.sha256&&i.inspected&&i.note));add(v.file);}
 add('/dev/shm/119-'+name+'-inspection.json');
}
const sourceInspection=read('source-b-inspection');assert(sourceInspection.inspected);assert.equal(hashStudyFile(sourceInspection.file),sourceInspection.sha256);
for(const file of ['source-b-inspection.json','source-b-points.png','source-b-points.svg'])add('/dev/shm/119-'+file);

const capture=read('integrated-a');verifyStudySources(capture.sources);
assert(capture.integrated);assert.deepEqual(capture.options,{});assert.deepEqual(capture.errors,[]);assert(read('integrated-a-inspection').qualified);
assert.equal(capture.runtime.reconstructionStatus,'verified');assert.equal(capture.runtime.fog,null);assert(capture.runtime.hideGround);
verifyStudySources(read('comparison-a').sources);verifyStudySources(read('dynamics-i').sources);
for(const n of ['c','d','e','f','g','i']){
 const r=read('dynamics-'+n);assert.equal(r.duration,n==='c'?80:16);assert.equal(r.options.retention,n==='i'?20000:10000);
 assert.equal(r.timeResets,0);assert(r.maximumPenetrationPixels<.03);assert(r.maximumPathErrorPixels<.15);assert(r.maximumTransmissionErrorPixels<.6);
 assert(r.range.rack[0]<-1.96&&r.range.rack[1]>1.96);assert(Math.abs(r.circuits+(n==='c'?10:2))<.002);
 assert(r.rows.every(row=>Object.values(row).every(Number.isFinite)));
}
const bare=read('dynamics-h');assert.equal(bare.options.retention,0);assert(bare.maximumPathErrorPixels>1000);assert(bare.range.rack[0]<-16);
const audit=read('clearances-a');assert.equal(audit.options.retention,10000);assert.equal(audit.maximumUnintendedPenetrationPixels,0);
assert(audit.rows.every(r=>r.issues.length===0));assert.equal(audit.rows.length,33);assert.equal(audit.checks,1583474);
for(const g of Object.values(read('comparison-a').groups))assert([g.rms,g.maximum,...g.residuals].every(Number.isFinite));
for(const [name,pattern]of [['tests-b.log',/# pass 13\n# fail 0/],['build-a.log',/built in/],['browser-a.log',/35 passed/]]){
 const file='/dev/shm/119-'+name;assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);
}
for(const name of ['playwright.config.mjs','serve-build.mjs'])add('/dev/shm/119-'+name);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const runtime={fps:capture.runtime.frames.length/capture.runtime.wallSeconds,physicalSpeedPercent:100*capture.runtime.simulationTime/capture.runtime.wallSeconds};assert(runtime.physicalSpeedPercent>99);
const report={sources,evidence,runtime,build:walk('/dev/shm/119-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 qualification:'119 is qualified for contact-driven endless-rack circulation with additional ideal normal engagement support. The bare slot-and-tooth reconstruction loses engagement. Tooth count regularization, hidden depth, flattened rear rod attachment, bearings and guides are stated assumptions. Native evidence differs only by the exact documented default, display and comment changes; each historical native study explicitly selects its retention value. Final rendering is separately inspected. This progress does not complete the all-507 review.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length,...runtime});
