import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import display from '../src/data/display-profiles.js';
import profile from '../src/data/pump-catch-profile.js';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-integrated-verified',qualifiedFile='artifacts/review/086-qualified-motion-checkpoint.json',qualified=readStudyReport(qualifiedFile),
  exported=readStudyReport('artifacts/review/086-production-export.json'),old=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  reports=[...profile.provenance,{file:'artifacts/review/086-production-parity.json'},{file:'artifacts/review/086-production-display.json'}],
  studyFiles=new Set(['scripts/record-pump-catch-integration.mjs','scripts/capture-pump-catch-integrated.mjs','scripts/capture-pump-catch-trip.mjs','scripts/integrate-pump-catch.mjs',
    'scripts/finalize-pump-catch-display.mjs',...exported.exportedFiles,'tests/pump-catch.test.mjs','tests/e2e/pump-catch.spec.mjs',
    'src/simulation/authored-intermittent.js','src/data/display-profiles.js','src/data/display-profiles.json','tests/models.test.mjs',
    'docs/review-progress.md','artifacts/review/086-reconstruction-notes.md']);
assert(qualified.mechanicsPassed&&!qualified.candidateIntegrated);
for(const s of qualified.sources){
 assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained qualification input '+s.file);
 if(!s.file.endsWith('.md'))assert.equal(hashStudyFile(s.file),s.sha256,'Unchanged qualification code '+s.file);
}
for(const r of qualified.reports)assert.equal(hashStudyFile(r.file),r.sha256,'Retained report '+r.file);
for(const r of reports){
 if(r.sha256)assert.equal(hashStudyFile(r.file),r.sha256);r.sha256=hashStudyFile(r.file);
 const d=readStudyReport(r.file);assert(d.passed,r.file);verifyStudySources(d.sources);for(const s of d.sources)studyFiles.add(s.file);
}
const archived=new Map(exported.sources.filter(s=>s.archive).map(s=>[s.file,s])),changed=[];
for(const [file,before]of Object.entries(old)){
 const after=hashStudyFile(file);if(after===before)continue;
 const s=archived.get(file);assert(s,'Unexpected changed production input '+file);assert.equal(s.sha256,before);assert.equal(hashStudyFile(s.archive),before);
 changed.push({file,before,after,archive:s.archive});
}
assert.deepEqual(changed.map(c=>c.file).sort(),['src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/authored-intermittent.js','tests/models.test.mjs']);
const before=file=>fs.readFileSync(archived.get(file).archive,'utf8'),read=file=>fs.readFileSync(file,'utf8'),
  factory=read('artifacts/review/086-production-export-original-factory.txt'),test=read('artifacts/review/086-production-export-original-test.txt');
assert.equal(read('src/simulation/authored-intermittent.js'),"import { makePumpCatchDrive } from './pump-catch.js';\n"+
 before('src/simulation/authored-intermittent.js').replace(factory,'').replace('case 86: return camLatchedLoosePumpWheel();','case 86: return makePumpCatchDrive();'));
assert.equal(read('tests/models.test.mjs'),before('tests/models.test.mjs').replace(test,
 '// Movement 086 source geometry, finite-contact motion and complete rope are covered in pump-catch.test.mjs.\n'));
assert.deepEqual(display,readStudyReport('src/data/display-profiles.json'));
for(const [id,value]of Object.entries(JSON.parse(before('src/data/display-profiles.json')).profiles))if(id!=='86')assert.deepEqual(display.profiles[id],value);
const captureFile='artifacts/review/086-integrated-final-captures.json',capture=readStudyReport(captureFile),inspectionFile='artifacts/review/086-integrated-final-inspections.json',
  inspections=readStudyReport(inspectionFile),tripFile='artifacts/review/086-integrated-trip-captures.json',trip=readStudyReport(tripFile);
verifyStudySources(capture.sources);verifyStudySources(trip.sources);assert(capture.passed);assert(trip.passed);
assert.equal(capture.views.length,19);assert.equal(trip.views.length,4);assert.equal(inspections.views.length,23);
for(const v of [...capture.views,...trip.views]){
 const i=inspections.views.find(i=>i.file===v.file);assert(i?.inspected&&i.accepted,v.file);assert.equal(i.sha256,v.sha256);assert.equal(hashStudyFile(v.file),v.sha256);
 if(v.name==='trip-detail')assert(/pivot/.test(i.assessment),'The first detail crop shows the pivot, not the overhead trip corner');
}
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.unexpectedWarnings,[]);assert.equal(capture.summary.fog,null);
assert(capture.summary.hiddenGround);assert.equal(capture.summary.timeScale,1);assert.equal(capture.summary.displayCycleDuration,4);assert(capture.summary.repeatsIndefinitely);
assert.deepEqual(capture.summary.motionBounds,profile.motionBounds);for(const s of [...capture.sources,...trip.sources])studyFiles.add(s.file);
const prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json'),prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),
  core=readStudyReport('artifacts/review/086-first-study-checkpoint.json');for(const d of [prior82,prior83])verifyStudySources(d.sources);
const coreTransition=[];
for(const s of core.sources){
 assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained original core input '+s.file);
 if(hashStudyFile(s.file)===s.sha256)continue;
 // The original baseline included the production factory being replaced.
 // Its exact isolated edit was checked above; no study code may change here.
 assert.equal(s.file,'src/simulation/authored-intermittent.js');
 const transition=changed.find(c=>c.file===s.file);assert.equal(transition.before,s.sha256);coreTransition.push(transition);
}
assert.equal(coreTransition.length,1);
const logs={build:'artifacts/review/086-integrated-build.log',numerical:'artifacts/review/086-integrated-all-numerical.log',browser:'artifacts/review/086-integrated-browser.log'},
  numerical=read(logs.numerical),testCount=Number(numerical.match(/^# tests (\d+)$/m)?.[1]);
assert(testCount>3100);assert.equal(Number(numerical.match(/^# pass (\d+)$/m)?.[1]),testCount);
for(const key of ['fail','cancelled','skipped'])assert.equal(Number(numerical.match(new RegExp('^# '+key+' (\\d+)$','m'))?.[1]),0);
assert(/✓ built in /.test(read(logs.build)));assert(/1 passed/.test(read(logs.browser)));assert(!/\d+ failed/.test(read(logs.browser)));
const observationFile='artifacts/review/086-integrated-process-observation.json',observation=readStudyReport(observationFile);
assert.equal(observation.ownedBrowserRunning,false);assert.deepEqual(observation.running,[]);
const firstCaptureFile='artifacts/review/086-integrated-first-captures.json',firstCapture=readStudyReport(firstCaptureFile),
 firstCaptureLog='artifacts/review/086-integrated-first-capture.log';
assert(/Infinity !== 4/.test(read(firstCaptureLog)));
for(const s of firstCapture.sources)assert.equal(hashStudyFile(s.archive??s.file),s.sha256);
const all=execFileSync('rg',['--files','src','tests','scripts'],{encoding:'utf8'}).trim().split('\n'),
  files=[...new Set([...Object.keys(old),...all.filter(f=>f.includes('pump-catch')&&/\.(js|mjs|json)$/.test(f))])].sort(),
  current=Object.fromEntries(files.map(file=>[file,hashStudyFile(file)]));
fs.writeFileSync(prefix+'-source-hashes.json',JSON.stringify(current,null,2)+'\n',{flag:'wx'});
const transitionFile='artifacts/review/086-production-source-transition.json',transitionReport={movement:86,oldInputs:Object.keys(old).length,
 unchanged:Object.keys(old).length-changed.length,changed,otherDisplayProfilesUnchanged:506};
if(fs.existsSync(transitionFile))assert.deepEqual(readStudyReport(transitionFile),transitionReport);
else fs.writeFileSync(transitionFile,JSON.stringify(transitionReport,null,2)+'\n',{flag:'wx'});
// Markdown is editable narrative; retain bytes rather than treating its path
// as an immutable generated artifact.
const markdown=[...studyFiles].filter(f=>f.endsWith('.md'));
const sources=freezeStudySources([...studyFiles].filter(f=>!f.endsWith('.md')),prefix);
for(const [i,file]of markdown.entries()){
 const archive=prefix+'-markdown-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hashStudyFile(file)});
}
verifyStudySources(sources);
const bundle=read('dist/index.html').match(/src="(?:\.\/|\/)?(assets\/[^" ]+\.js)"/)?.[1];assert(bundle);
const checkpoint={movement:86,status:'rebuilt-integrated-and-verified',created:new Date().toISOString(),candidateIntegrated:true,mechanicsPassed:true,
 full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,numericalTests:testCount,browserTests:1,
 frozenInputs:files.length,previousProductionInputsUnchanged:Object.keys(old).length-changed.length,
 priorStudySourcesUnchanged:{movement82:prior82.sources.length,movement83:prior83.sources.length,original86:core.sources.length-coreTransition.length},
 originalCoreInputsArchived:core.sources.length,originalCoreProductionTransition:coreTransition,
 qualifiedCandidate:{file:qualifiedFile,sha256:hashStudyFile(qualifiedFile)},reports,productionTransition:changed,
 capture:{file:captureFile,sha256:hashStudyFile(captureFile)},tripCapture:{file:tripFile,sha256:hashStudyFile(tripFile)},
 inspections:{file:inspectionFile,sha256:hashStudyFile(inspectionFile),views:inspections.views},
 logs:Object.fromEntries(Object.entries(logs).map(([key,file])=>[key,{file,sha256:hashStudyFile(file)}])),
 build:{htmlSha256:hashStudyFile('dist/index.html'),bundle:'dist/'+bundle,bundleSha256:hashStudyFile('dist/'+bundle)},
 runtime:capture.summary,rendererInfo:capture.rendererInfo,observationFile,observationSha256:hashStudyFile(observationFile),sources,
 supersedes:{file:'artifacts/review/086-integrated-checkpoint.json',sha256:hashStudyFile('artifacts/review/086-integrated-checkpoint.json'),
  reason:'The final inspection manifest corrects one filename-based caption: trip-detail shows the catch pivot. Four supplemental views establish overhead contact. Geometry, motion, images and test results are unchanged.'},
 retainedCaptureReviewFailure:{file:firstCaptureFile,sha256:hashStudyFile(firstCaptureFile),log:firstCaptureLog,logSha256:hashStudyFile(firstCaptureLog),
  archivedSourcesVerified:firstCapture.sources.length,reason:'The first capture asserted that the total playback limit was four seconds. This repeating engine correctly has an infinite limit; the corrected capture checks the four-second cycle duration separately. Production geometry and motion are unchanged.'},
 qualification:'The qualified 42-part source reconstruction and finite-contact trajectory now run in production with exact transfer parity. Continuous bounds cover all independent rigid and rope pairs. All numerical tests, build and targeted desktop/mobile browser checks pass; all twenty-three integrated views are inspected. Startup is retained and the input revolution takes four display seconds. Hidden depths, rear input, normalized guided load, winding apparatus, bearing losses and massless slack-rope display remain explicit assumptions. Numerical agreement is not a continuum-error guarantee. No new all-507 browser pass or completion of the catalog review is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({...checkpoint,sources:sources.length,reports:reports.length,inspections:23,productionTransition:changed.length});
