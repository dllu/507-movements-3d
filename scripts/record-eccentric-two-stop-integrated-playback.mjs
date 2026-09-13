import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import profile from '../src/data/eccentric-two-stop-profile.js';
import display from '../src/data/display-profiles.js';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-integrated-playback',captureFile=prefix+'-captures.json',capture=readStudyReport(captureFile),
  checkFile='artifacts/review/088-centered-reconstruction-check.json',check=readStudyReport(checkFile),
  exportFile='artifacts/review/088-centered-production-export.json',exported=readStudyReport(exportFile),
  displayFile='artifacts/review/088-centered-production-display.json',measured=readStudyReport(displayFile);
for(const r of [capture,check,exported,measured])verifyStudySources(r.sources);
assert(capture.passed&&check.checksPassed&&exported.passed&&measured.passed);
assert(check.poses.length===7&&check.poses.every(p=>!p.issues.length&&!p.topologyIssues.length&&p.topology.length===12));
assert(check.stoppedIncrements.every(x=>Math.abs(x+Math.PI)<1e-10));
assert(Math.abs(check.closure.outputError)<1e-10&&check.closure.speedError===0&&profile.repeat.endpointReplaced===false);
const assessments={
  source:'The full cam, disk and square stop faces are framed; the offset face has the drawn proportions.',
  'source-overlay':'Cam, shaft and stops follow the tracing closely. The explicit rear-rim center shift remains visible and under review.',
  'C-driven':'The first foot is carried by the finite offset face; the opposite stop is clear.',
  'C-release':'The first stop leaves the offset at its finite outer corner.',
  'first-rest':'The wheel has settled while the cam moves ahead of the released stop.',
  'D-driven':'The opposite stop engages and the wheel advances again.',
  'D-release':'The opposite release repeats the same visible geometry after half a wheel turn.',
  'second-rest':'The opposite settled state matches the first after a half-turn index.',
  'oblique-drive':'The cam and disk have separate axial layers, and the stepped stops are visible as substantial blocks.',
  'stop-detail':'The broad rear foot meets the offset edge beneath its square cap; the cap has axial clearance above the cam.',
  'loop-before':'Settled wheel and continuously rotating cam immediately before the repeat seam.',
  'loop-after':'Matches the preceding seam image without a visible motor or wheel reset.',
  desktop:'Actual desktop route contains the full assembly, engraving and playback controls.',
  mobile:'Actual narrow route contains the full assembly and usable playback controls.',
};
assert(capture.views.length===14);
const views=capture.views.map(v=>{assert(assessments[v.name]);assert.equal(hashStudyFile(v.file),v.sha256);
  return {name:v.name,file:v.file,sha256:v.sha256,inspected:true,assessment:assessments[v.name]};});
fs.writeFileSync(prefix+'-inspections.json',JSON.stringify({capture:{file:captureFile,sha256:hashStudyFile(captureFile)},views,
  qualification:'Fourteen opened stills and recorded full-cycle execution. Stills do not establish continuous whole-solid clearance.'},null,2)+'\n',{flag:'wx'});
for(const [name,input]of [['tests','/dev/shm/088-centered-production-final-tests.log'],['final-display-tests','/dev/shm/088-centered-display-final-tests.log'],
  ['build','/dev/shm/088-centered-production-build.log'],['browser','/dev/shm/088-centered-production-browser.log'],
  ['reconstruction','/dev/shm/088-centered-reconstruction-check.log'],['initial-contact-failure','/dev/shm/088-source-motion-v2.log']])
  fs.copyFileSync(input,prefix+'-'+name+'.log',fs.constants.COPYFILE_EXCL);
for(const [name,count]of [['tests',178],['final-display-tests',168]]){
  const text=fs.readFileSync(prefix+'-'+name+'.log','utf8');assert(text.includes('# tests '+count)&&text.includes('# pass '+count)&&text.includes('# fail 0'));
}
const buildDir='/dev/shm/507movements-088-centered-build/assets',bundleFile=buildDir+'/'+fs.readdirSync(buildDir).find(f=>f.endsWith('.js')),
  bundle=fs.readFileSync(bundleFile,'utf8'),values=[display.profiles[88].peakAngularSpeed,...display.profiles[88].motionBounds.min,...display.profiles[88].motionBounds.max];
assert(values.every(x=>bundle.includes(String(x))||bundle.includes(String(x).replace(/^(-?)0\./,'$1.'))));
const previous=JSON.parse(execFileSync('git',['show','282a848:src/data/display-profiles.json'],{encoding:'utf8'}));
for(const [id,p]of Object.entries(previous.profiles))if(id!=='88')assert.deepEqual(display.profiles[id],p);
const baselineFile='artifacts/review/087-integrated-source-hashes.json',baseline=readStudyReport(baselineFile),
  changed=Object.keys(baseline).filter(f=>hashStudyFile(f)!==baseline[f]);
assert.deepEqual(changed.sort(),['src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/authored-intermittent.js','tests/models.test.mjs'].sort());
const production=['src/data/eccentric-two-stop-profile.js','src/simulation/eccentric-two-stop.js','src/simulation/eccentric-two-stop-motion.js',
  ...fs.readdirSync('src/simulation/eccentric-two-stop').map(f=>'src/simulation/eccentric-two-stop/'+f),'tests/eccentric-two-stop.test.mjs'];
const hashes=Object.fromEntries([...Object.keys(baseline),...production].map(f=>[f,hashStudyFile(f)]));
fs.writeFileSync('artifacts/review/088-integrated-source-hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
const scripts=execFileSync('git',['ls-files','--others','--exclude-standard','scripts'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.mjs'));
for(const f of [...production,...scripts])execFileSync(process.execPath,['--check',f]);
const files=[...capture.sources.map(s=>s.file),...check.sources.map(s=>s.file),...production,...scripts,captureFile,checkFile,exportFile,displayFile,
  baselineFile,'artifacts/review/088-integrated-source-hashes.json',prefix+'-inspections.json',prefix+'-tests.log',prefix+'-final-display-tests.log',
  prefix+'-build.log',prefix+'-browser.log','artifacts/review/088-integrated-playback-notes.md','docs/review-progress.md'];
const sources=freezeStudySources(files,prefix+'-record');verifyStudySources(sources);
const report={movement:88,candidateIntegrated:true,productionChanged:true,integrationChecksPassed:true,mechanicsPassed:false,reconstructionStatus:'under-review',sources,
  fineStates:check.states,maximumCoordinateDifference:check.maximumCoordinateDifference,maximumMomentumResidual:check.maximumMomentumResidual,
  maximumImpulseEnergyResidual:check.maximumImpulseEnergyResidual,closureError:check.closure.outputError,stoppedIncrements:check.stoppedIncrements,
  solidPoses:check.poses.length,surfaceChecks:check.poses.reduce((n,p)=>n+p.checks,0),reduction:profile.reduction,source:check.source,
  tests:{passed:178,failed:0,finalDisplayRecheckPassed:168},browser:capture.summary,inspectedViews:views.length,
  build:{file:bundleFile,sha256:hashStudyFile(bundleFile),finalDisplayValuesPresent:true},otherDisplayProfilesUnchanged:506,
  changedExistingInputs:changed,sourceSnapshotInputs:Object.keys(hashes).length,
  qualification:'The new finite-stop reconstruction is integrated and checked. Hidden-axis inference, rim shift and stepped-foot fidelity remain open. Earlier source hypotheses and failed contact assumptions retain their separate evidence. The full 507-movement review remains active.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,tests:report.tests,views:views.length,sourceSnapshotInputs:report.sourceSnapshotInputs,surfaceChecks:report.surfaceChecks});
