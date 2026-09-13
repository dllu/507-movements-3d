import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,readStudyReport,hashStudyFile} from './lib/study-report-io.mjs';
const prefix='artifacts/review/089-source-playback-final';
const capture=readStudyReport(prefix+'.json'),check=readStudyReport('artifacts/review/089-source-reconstruction-qualified.json'),
  display=readStudyReport('artifacts/review/089-source-qualified-display.json');
for(const report of [capture,check,display])verifyStudySources(report.sources);
assert(capture.passed&&check.checksPassed&&check.continuous.passed&&display.passed);
assert(check.poses.length===9&&check.poses.every(p=>!p.issues.length&&!p.topologyIssues.length&&p.topology.length===43));
assert(check.maximumJointError<1e-10&&check.continuous.minimumClearance>.0014);
assert(capture.runtime.fog===null&&capture.runtime.hideGround);
assert(capture.runtime.timing.displayCycleDuration===4&&capture.runtime.timeScale===1);
const assessments={
  'source-front':'Reference-aligned view places the circular eccentric, collar, clamp lugs, flange and rod over their measured source coordinates; the added rear support is visible below the source assembly.',
  'source-overlay':'One source mapping aligns the five circular outlines and main castings. The inferred support/output hardware remains distinct from the original drawing.',
  front:'Full completed eccentric and guided output are visible with the revised proportions.',
  'lower-quarter':'The lower eccentric position swings the rigid rod upward into the crosshead.',
  return:'The eccentric moves to the other side of the shaft while the output remains in its guides.',
  'upper-quarter':'Opposite strap swing preserves flange and wrist alignment.',
  oblique:'The strap, stepped sheave, collar and completed output have substantial depth.',
  rear:'Rear retaining flange and bored support are visible, with the output fork retained by its guides.',
  clamp:'The split lug, bolt head and strap casting are visible at the measured scale.',
  wrist:'Side view exposes the rod entering the fork between its two cheeks and the retaining guide channels.',
  flange:'The larger abutting flanges and two side-facing through-bolts follow the engraving arrangement.',
  desktop:'The actual desktop application contains the full mechanism, engraving and playback controls.',
  mobile:'The actual mobile application contains the full model and usable controls.',
};
const inspections=capture.views.map(v=>{assert(assessments[v.name]);assert.equal(hashStudyFile(v.file),v.sha256);
  return{name:v.name,file:v.file,sha256:v.sha256,inspected:true,assessment:assessments[v.name]};});
assert.equal(inspections.length,13);
fs.writeFileSync(prefix+'-inspections.json',JSON.stringify(inspections,null,2)+'\n',{flag:'wx'});
for(const [name,input]of [['tests','/dev/shm/089-source-final-tests.log'],['focused-tests','/dev/shm/089-source-final-focused.log'],['build','/dev/shm/089-source-final-build.log'],
  ['browser','/dev/shm/089-source-playback-final.log'],['ray-edge-failure','/dev/shm/089-source-focused.log'],
  ['reconstruction','/dev/shm/089-source-qualified-reconstruction.log']])fs.copyFileSync(input,prefix+'-'+name+'.log',fs.constants.COPYFILE_EXCL);
const log=fs.readFileSync(prefix+'-tests.log','utf8');assert(log.includes('# pass 173')&&log.includes('# fail 0'));
assert(fs.readFileSync(prefix+'-focused-tests.log','utf8').includes('# pass 6'));
assert(fs.readFileSync(prefix+'-build.log','utf8').includes('built in'));
const previous=readStudyReport('artifacts/review/089-joints-source-hashes.json');
const changed=Object.keys(previous).filter(f=>hashStudyFile(f)!==previous[f]).sort();
assert.deepEqual(changed,['src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/authored-cams.js',
  'src/simulation/eccentric-strap-joints.js','tests/eccentric-strap.test.mjs']);
const additions=['src/simulation/eccentric-strap.js','src/simulation/eccentric-strap-source.js','tests/fixtures/eccentric-strap-ink.json',
  'scripts/trace-eccentric-strap-source.mjs','scripts/check-eccentric-strap-reconstruction.mjs','scripts/lib/eccentric-strap-clearance.mjs',
  'scripts/finalize-eccentric-strap-source-display.mjs','scripts/capture-eccentric-strap-source.mjs','scripts/record-eccentric-strap-source-review.mjs'];
const hashes=Object.fromEntries([...new Set([...Object.keys(previous),...additions])].map(f=>[f,hashStudyFile(f)]));
fs.writeFileSync('artifacts/review/089-source-verified-hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
const priorDisplay=JSON.parse(execFileSync('git',['show','bc0db10:src/data/display-profiles.json'],{encoding:'utf8'}));
const currentDisplay=readStudyReport('src/data/display-profiles.json');
for(const [id,p]of Object.entries(priorDisplay.profiles))if(id!=='89')assert.deepEqual(currentDisplay.profiles[id],p);
const sources=freezeStudySources([...capture.sources.map(s=>s.file),...check.sources.map(s=>s.file),...display.sources.map(s=>s.file),...additions,
  'tests/eccentric-strap.test.mjs','tests/models.test.mjs','tests/camera-catalog.test.mjs',prefix+'.json',prefix+'-inspections.json',
  prefix+'-tests.log',prefix+'-focused-tests.log',prefix+'-build.log',prefix+'-browser.log',prefix+'-ray-edge-failure.log','artifacts/review/089-source-reconstruction-qualified.json',
  'artifacts/review/089-source-qualified-display.json','artifacts/review/089-source-verified-hashes.json',
  'artifacts/review/089-source-reconstruction-notes.md','docs/review-progress.md'],prefix+'-record');verifyStudySources(sources);
const frames=capture.runtime.frames,intervals=frames.slice(1).map(f=>f.intervalMs).sort((a,b)=>a-b),updates=frames.map(f=>f.updateMs).sort((a,b)=>a-b);
const report={movement:89,sources,integrated:true,checksPassed:true,mechanicsPassed:true,status:'verified-kinematic-reconstruction',
  sourceComparison:check.sourceComparison,solidPoses:9,surfaceChecks:check.poses.reduce((s,p)=>s+p.checks,0),continuous:check.continuous,
  maximumJointError:check.maximumJointError,tests:{beforeMaterialRefinement:{passed:173,failed:0},finalFocused:{passed:6,failed:0}},inspectedViews:13,changedExistingInputs:changed,
  sourceSnapshotInputs:Object.keys(hashes).length,otherDisplayProfilesUnchanged:506,
  browser:{duration:frames.at(-1).time,frames:frames.length,fps:(frames.length-1)/frames.at(-1).time,
    p95IntervalMs:intervals[Math.floor(intervals.length*.95)],p95UpdateMs:updates[Math.floor(updates.length*.95)],
    errors:capture.errors,unexpectedWarnings:capture.unexpectedWarnings},
  qualification:'Source-facing geometry, finite solids, ideal linkage closure, continuous running clearances and final rendering are checked. Depths, ideal bearings, press fits and the completed output/support arrangement are explicit reconstruction choices; loads and bearing dynamics are not simulated.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({sources:sources.length,snapshotInputs:report.sourceSnapshotInputs,surfaceChecks:report.surfaceChecks,browser:report.browser});
