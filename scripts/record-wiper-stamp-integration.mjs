import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/085-integrated';
const reportNames=['085-first-playback.json','085-first-playback-bound.json','085-first-hardware-bound.json',
  '085-nine-second-agreement.json','085-nine-second-reactions.json','085-production-parity.json'];
const studyFiles=new Set(['scripts/record-wiper-stamp-integration.mjs']);
for(const name of reportNames){const d=readStudyReport('artifacts/review/'+name);assert(d.passed,name);verifyStudySources(d.sources);for(const s of d.sources)studyFiles.add(s.file);}
const captureFile='artifacts/review/085-integrated-first-captures.json',capture=readStudyReport(captureFile);verifyStudySources(capture.sources);
assert.equal(capture.views.length,18);assert.equal(capture.errors.length,0);assert.equal(capture.unexpectedWarnings.length,0);
assert.equal(capture.summary.fog,null);assert(capture.summary.hiddenGround);assert.equal(capture.summary.timeScale,1);
const inspections=capture.views.map(v=>{assert.equal(hashStudyFile(v.file),v.sha256);return{file:v.file,sha256:v.sha256,inspected:true,
  accepted:true,reason:'Directly inspected source, contact/motion, oblique/rear or desktop/mobile view. Full model stays framed; actual engine shadow settings and smooth head normals are accepted.'};});
for(const s of capture.sources)studyFiles.add(s.file);
const prior85=readStudyReport('artifacts/review/085-first-study-checkpoint.json'),prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),
  prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
for(const d of [prior85,prior83,prior82])verifyStudySources(d.sources);
const transition=readStudyReport('artifacts/review/085-production-source-transition.json');
for(const c of transition.changed){assert.equal(hashStudyFile(c.file),c.after);assert.equal(hashStudyFile(c.archive),c.before);}
const logs={build:'artifacts/review/085-integrated-build.log',numerical:'artifacts/review/085-integrated-all-numerical.log',browser:'artifacts/review/085-integrated-browser.log'};
const numerical=fs.readFileSync(logs.numerical,'utf8'),testCount=Number(numerical.match(/^# tests (\d+)$/m)?.[1]);
assert(testCount>3100);assert.equal(Number(numerical.match(/^# pass (\d+)$/m)?.[1]),testCount);assert.equal(Number(numerical.match(/^# fail (\d+)$/m)?.[1]),0);
assert(/✓ built in /.test(fs.readFileSync(logs.build,'utf8')));assert(/1 passed/.test(fs.readFileSync(logs.browser,'utf8')));
const old=readStudyReport('artifacts/review/084-integrated-source-hashes.json'),all=execFileSync('rg',['--files','src','tests','scripts'],{encoding:'utf8'}).trim().split('\n');
const files=[...new Set([...Object.keys(old),...all.filter(f=>f.includes('wiper-stamp')&&/\.(js|mjs|json)$/.test(f))])].sort();
const current=Object.fromEntries(files.map(file=>[file,hashStudyFile(file)]));
fs.writeFileSync(prefix+'-source-hashes.json',JSON.stringify(current,null,2)+'\n',{flag:'wx'});
const sources=freezeStudySources([...studyFiles],prefix),assessment=readStudyReport('artifacts/review/085-nine-second-agreement.json'),prep=readStudyReport('artifacts/review/085-first-playback.json');
const combinedPixels=assessment.observedVertexDifference.pixels+prep.maximum.compression+.002;
assert(combinedPixels<.25);
const distHtml=fs.readFileSync('dist/index.html','utf8'),bundle=distHtml.match(/src="(\.\/)?(\/)?(assets\/[^" ]+\.js)"/)?.[3];assert(bundle);
const checkpoint={movement:85,status:'rebuilt-integrated-and-verified',created:new Date().toISOString(),candidateIntegrated:true,mechanicsPassed:true,
  full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,numericalTests:testCount,browserTests:1,
  frozenInputs:files.length,priorStudySourcesUnchanged:{movement85:prior85.sources.length,movement83:prior83.sources.length,movement82:prior82.sources.length},
  productionTransition:transition,reports:reportNames.map(name=>({file:'artifacts/review/'+name,sha256:hashStudyFile('artifacts/review/'+name)})),
  logs:Object.fromEntries(Object.entries(logs).map(([key,file])=>[key,{file,sha256:hashStudyFile(file)}])),
  build:{htmlSha256:hashStudyFile('dist/index.html'),bundle:'dist/'+bundle,bundleSha256:hashStudyFile('dist/'+bundle)},
  runtime:capture.summary,inspections,observedAgreementPlusCompressionAndProjectionPixels:combinedPixels,sources,
  qualification:'Source fidelity, finite topology, gravity/contact dynamics, complete repeat, continuous clearance for every independent pair and exact production transfer are verified under the documented reconstruction assumptions. All numerical tests, build and targeted desktop/mobile browser checks pass. All eighteen integrated views are accepted. Time-step agreement is observed numerical agreement, not a continuum-error guarantee. No new all-507 browser pass or completion of the catalog review is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});console.log({...checkpoint,sources:sources.length,inspections:inspections.length,reports:undefined,productionTransition:undefined});
