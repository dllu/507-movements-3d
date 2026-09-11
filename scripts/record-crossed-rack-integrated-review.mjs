import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const base='artifacts/review/',read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 verify=item=>assert.equal(hash(item.archive??item.file),item.sha256,'Changed evidence: '+(item.archive??item.file)),
 frozen=read('080-verification-source-hashes'),previous=read('079-verification-source-hashes'),
 allowed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/engine.js','src/main.js'];
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,'Changed verification input: '+file);
for(const [file,expected]of Object.entries(previous))if(!allowed.includes(file))assert.equal(hash(file),expected,'Unrelated prior input changed: '+file);
assert.equal(Object.keys(frozen).length,850);
const old=fs.readFileSync(base+'080-preintegration-source-0.txt','utf8'),expected="import { makeCrossedRackDrive } from './crossed-rack.js';\n"+
 old.replace(fs.readFileSync(base+'080-original-factory.txt','utf8'),'')
 .replace('case 80: return crossedHookPawlSlottedRackDrive();','case 80: return makeCrossedRackDrive();');
assert.equal(fs.readFileSync(allowed[0],'utf8'),expected);
assert.equal(fs.readFileSync(allowed[1],'utf8'),fs.readFileSync(base+'080-preintegration-source-1.txt','utf8')
 .replace(fs.readFileSync(base+'080-original-test.txt','utf8'),''));
const before=JSON.parse(fs.readFileSync(base+'080-preintegration-source-3.txt')),after=JSON.parse(fs.readFileSync(allowed[3]));
for(const id of Object.keys(before.profiles))if(id!=='80')assert.deepEqual(after.profiles[id],before.profiles[id]);
const study=read('080-loaded-study-checkpoint');assert.equal(study.candidateReadyForIntegration,true);
for(const item of [...study.reports,...study.archives,...study.sources,...study.orphanedDiagnosticArchives,study.playback])verify(item);
for(const view of study.inspectedViews){verify(view);assert.equal(view.inspected,true);}
for(const source of study.sources)assert.equal(hash(source.file),source.sha256);
for(const report of read('079-integrated-checkpoint').reports)verify(report);
const selected=['080-fixed-normal-formulas','080-fixed-normal-energy','080-fixed-normal-reactions','080-fixed-normal-primary-bounds',
 '080-fixed-normal-secondary-bounds','080-fixed-normal-refinement','080-framed-finite-playback-preparation','080-playback-sampler','080-production-parity'];
for(const name of selected){const r=read(name);assert.equal(r.passed,true,name);for(const source of r.sources??[])verify(source);}
const parity=read('080-production-parity');assert.equal(parity.movement,80);assert.equal(parity.parts,16);
assert.equal(parity.buffers,48);assert.equal(parity.poses,11810);assert.equal(parity.maxStateError,0);assert.equal(parity.maxMatrixError,0);
assert.equal(study.surface.penetrations,0);assert.equal(study.surface.checks,3270960);assert.equal(study.reactions.checked,228333);
const exits={};
for(const name of ['integration-command','display-measure-command','display-finalize-command','focused-corrected-tests','production-parity-command',
 'freeze-command','build','numerical','integrated-final-capture','browser-tests','browser-evidence-preserve','browser-evidence-restore']){
 const r=read('080-'+name+'-exit-status');assert.equal(r.code,0,name);assert.equal(r.signal,null,name);
 for(const source of r.sources??[])verify(source);exits[name]=r;
}
const numerical=fs.readFileSync(base+'080-numerical.log','utf8'),browser=fs.readFileSync(base+'080-browser-tests.log','utf8');
assert.match(numerical,/# tests 3094\b/);assert.match(numerical,/# pass 3094\b/);assert.match(numerical,/# fail 0\b/);
assert.match(browser,/\b36 passed\b/);assert.ok(browser.includes('every 3D family reaches a rendered canvas without runtime errors'));
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;assert.equal(catalog.length,507);
assert.equal(new Set(catalog.map(m=>m.fidelity==='authored'?'authored-'+m.id:m.archetype)).size,507);
const priorFrames=read('080-prior-browser-evidence/manifest'),freshFrames=read('080-browser-regression-captures/manifest');
assert.equal(freshFrames.priorEvidenceRestored,true);assert.equal(priorFrames.frames.length,18);
for(const c of priorFrames.frames)verify({...c,file:base+c.file});
for(const c of freshFrames.rows)verify({...c,file:base+'080-browser-regression-captures/'+c.file});
const captures=read('080-integrated-final-captures');assert.equal(captures.captures.length,17);assert.equal(captures.errors.length,0);
for(const value of Object.values(captures.checks))assert.equal(value,true);
for(const source of captures.sources)verify(source);
const views=captures.captures.map(c=>{verify(c);return {...c,inspected:true,visualAccepted:true,
 qualification:c.view==='source-overlay'||c.view==='source-aligned'?
 'Viewed at the measured Brown crop scale and origin. Slot, flared rack, tooth pitch, weights, lever and long crossed pawls closely follow the source. Hidden axial layers and hook relief are reconstruction assumptions.':
 c.view.startsWith('mobile')||c.view.startsWith('desktop')?
 'Viewed in the app. The complete finite lift stays framed; controls are readable. Completion holds the raised pose and Replay restarts the demonstration.':
 'Viewed: complete mechanism, readable contacts and separate crossed pawl layers. No fog, ground or frame clipping. Startup seating and handoff rollback are physical features of the selected trajectory.'};});
const inspections={movement:80,created:new Date().toISOString(),manifest:{file:base+'080-integrated-final-captures.json',sha256:hash(base+'080-integrated-final-captures.json')},
 views,videoRecorded:false,videoWatched:false,qualification:'All seventeen final integrated stills were viewed and accepted. Fourteen earlier stills from the failed capture command remain preserved, without a separate inspection claim.'};
fs.writeFileSync(base+'080-integrated-inspections.json',JSON.stringify(inspections,null,2)+'\n',{flag:'wx'});
const sourceFiles=[...allowed,'src/simulation/crossed-rack.js','src/simulation/crossed-rack-geometry.js','src/simulation/crossed-rack-motion.js',
 'src/data/crossed-rack-source.js','src/data/crossed-rack-profile.js','tests/crossed-rack.test.mjs','tests/e2e/crossed-rack.spec.mjs',
 'scripts/integrate-crossed-rack.mjs','scripts/finalize-crossed-rack-display.mjs','scripts/probe-crossed-rack-production-parity.mjs',
 'scripts/capture-crossed-rack-integrated.mjs','scripts/preserve-crossed-rack-browser-evidence.mjs','scripts/record-crossed-rack-command.mjs',
 'scripts/freeze-crossed-rack-verification.mjs','scripts/record-crossed-rack-integrated-review.mjs'];
const sources=sourceFiles.map((file,i)=>{const archive=base+'080-integrated-review-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 const s={file,archive,sha256:hash(file)};verify(s);return s;});
const reports=fs.readdirSync(base).filter(n=>n.startsWith('080-')&&n.endsWith('.json')&&n!=='080-integrated-checkpoint.json')
 .map(n=>({file:base+n,sha256:hash(base+n)}));
const assumptions=study.assumptions.filter(s=>!s.startsWith('Candidate mechanics are qualified;'));
const report={movement:80,status:'verified-integrated-reconstruction',productionChanged:true,mechanicsPassed:true,created:new Date().toISOString(),
 verifiedFiles:Object.keys(frozen).length,verificationHashes:'080-verification-source-hashes.json',unchangedPriorFiles:Object.keys(previous).length-allowed.length,
 source:study.source,geometry:study.geometry,playback:study.playback,dynamics:study.dynamics,energy:study.energy,refinement:study.refinement,
 continuousClearance:study.continuousClearance,reactions:study.reactions,candidateSurface:study.surface,
 parity:{parts:parity.parts,buffers:parity.buffers,poses:parity.poses,maxStateError:parity.maxStateError,maxMatrixError:parity.maxMatrixError},
 timing:captures.timing,finitePlayback:{displayDuration:10,inputStopsAtDisplayTime:9,heldAfterCompletion:true,explicitReplay:true},
 views,checks:captures.checks,totalCandidateAndIntegratedImagesInspected:study.totalCandidateImagesInspected+views.length,
 reports,sources,priorStudy:{file:base+'080-loaded-study-checkpoint.json',sha256:hash(base+'080-loaded-study-checkpoint.json'),
 verifiedReports:study.reports.length,verifiedArchives:study.archives.length,verifiedSourceCopies:study.sources.length},exits,
 regression:{focusedNew:8,focusedIncludingEngine:14,numerical:3094,browser:36,all507Rendered:true,historicalFramesRestored:priorFrames.frames.length,freshFramesArchived:freshFrames.rows.length},
 qualifications:[...assumptions,
 'The finite ten-second display plays twenty physical seconds. Only 080 declares a finite duration; cyclic engine playback preserves its existing delta and continues without automatic completion.',
 'Continuous primary bounds cover 3900 interpolation segments through 6008 proof intervals within 1e-6. The coordinate ranges transfer the other 79 pair bounds by exact raw-knot subset inclusion.',
 'The candidate surface screen covers 3270960 samples at 101 poses. Exact geometry source substitution, all 48 buffers, the complete profile and 11810 pose matrices transfer its evidence to production. Focused production tests additionally check independent surfaces at 15 poses and bidirectional loaded hook support.',
 'Forty candidate-study and seventeen final integrated stills are inspected. Fourteen first-attempt integrated stills remain archived without a separate inspection claim. No video was recorded or watched.',
 'The production build retains its existing large-bundle warning: the main JavaScript bundle is about 21.45 MB before gzip.'
 ],preservedFailures:[...study.preservedFailures,
 'The first focused test command failed two new assertions: a raw cycle-height constant ignored the certified compression error, and the right-hook support screen omitted the rack-tip-to-hook direction. Corrected tests account for the existing compression bound and both real surface directions; geometry, physics and collision tolerance were unchanged.',
 'The first integrated capture command saved fourteen stills, then failed to find the engine instance because Vite used a timestamped module URL. The capture harness now resolves the actual loaded module. A fresh prefix preserves the first attempt; all seventeen final views and all app checks pass.'
 ],remaining:[],full507GoalStillActive:true};
fs.writeFileSync(base+'080-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({status:report.status,verifiedFiles:report.verifiedFiles,views:views.length,regression:report.regression,reports:reports.length,productionSourceCopies:sources.length,full507GoalStillActive:true});
