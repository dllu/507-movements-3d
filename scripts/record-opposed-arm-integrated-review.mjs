import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const base='artifacts/review/',read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 verify=item=>assert.equal(hash(item.archive??item.file),item.sha256,'Changed evidence: '+(item.archive??item.file)),
 frozen=read('079-verification-source-hashes'),previous=read('078-verification-source-hashes'),
 allowed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json'];
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,'Changed verification input: '+file);
for(const [file,expected]of Object.entries(previous))if(!allowed.includes(file))assert.equal(hash(file),expected,'Unrelated prior input changed: '+file);
const originalMain=fs.readFileSync(base+'079-preintegration-source-0.txt','utf8'),
 expectedMain="import { makeOpposedArmDrive } from './opposed-arm.js';\n"+
 originalMain.replace(fs.readFileSync(base+'079-original-factory.txt','utf8'),'')
 .replace('case 79: return sliderDrivenOpposedArmInternalRatchet();','case 79: return makeOpposedArmDrive();');
assert.equal(fs.readFileSync(allowed[0],'utf8'),expectedMain);
assert.equal(fs.readFileSync(allowed[1],'utf8'),fs.readFileSync(base+'079-preintegration-source-1.txt','utf8')
 .replace(fs.readFileSync(base+'079-original-test.txt','utf8'),''));
const before=JSON.parse(fs.readFileSync(base+'079-preintegration-source-3.txt')),after=JSON.parse(fs.readFileSync(allowed[3]));
for(const id of Object.keys(before.profiles))if(id!=='79')assert.deepEqual(after.profiles[id],before.profiles[id]);

const study=read('079-playback-study-checkpoint');assert.equal(study.candidateReady,true);
for(const item of [...study.reports,...study.archives,...study.sources])verify(item);
verify(study.playback);for(const view of study.preview.views)verify(view);
const selected=['079-projected-finest-bounds','079-projected-secondary-bounds','079-resolved-reactions',
 '079-projected-fidelity','079-projected-sampler','079-final-refinement','079-production-parity','079-view-bounds'];
for(const name of selected){const r=read(name);assert.equal(r.passed,true,name);for(const s of r.sources??[])verify(s);}
const surfaces=read('079-projected-surfaces'),primary=read('079-projected-finest-bounds'),
 secondary=read('079-projected-secondary-bounds'),reactions=read('079-resolved-reactions'),parity=read('079-production-parity');
assert.equal(surfaces.penetrations,0);assert.equal(surfaces.issues.length,0);assert.equal(surfaces.states.length,97);
for(const s of surfaces.sources)verify(s);
assert.equal(primary.firstKnots+primary.steadyKnots-2,9004);assert.equal(primary.failures.length,0);
assert.equal(secondary.pairs.filter(p=>p.kind!=='primary-contact').length,536);
assert.equal(reactions.checked,113064);assert.equal(reactions.originalPassedCount+reactions.resolvedCount,reactions.checked);
assert.equal(parity.movement,79);assert.equal(parity.buffers,110);assert.equal(parity.poses,31256);
assert.equal(read('079-smoothed-candidate-topology').issues.length,0);

const required=['integration-command','display-measure-command','display-finalize-command','focused-tests',
 'production-parity-final-command','build','numerical','integrated-capture','browser-tests','browser-evidence-preserve','browser-evidence-restore',
 'finest-join-command','final-refinement-command','finest-energy16-command','finest-steady-energy-command',
 'projected-finest-command','projected-secondary-bounds-command','projected-fidelity-command','projected-sampler-command',
 'projected-surfaces-command','reaction-edge-support-command','reaction-edge-support-second-command','loop-preview-capture-command'],exits={};
for(const name of required){const r=read('079-'+name+'-exit-status');assert.equal(r.code,0,name);assert.equal(r.signal,null,name);
 for(const s of r.sources??[])verify(s);exits[name]=r;}
const numerical=fs.readFileSync(base+'079-numerical.log','utf8'),browser=fs.readFileSync(base+'079-browser-tests.log','utf8');
assert.match(numerical,/# tests 3087\b/);assert.match(numerical,/# pass 3087\b/);assert.match(numerical,/# fail 0\b/);
assert.match(browser,/\b35 passed\b/);assert.ok(browser.includes('every 3D family reaches a rendered canvas without runtime errors'));
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
assert.equal(catalog.length,507);assert.equal(new Set(catalog.map(m=>m.fidelity==='authored'?'authored-'+m.id:m.archetype)).size,507);
const priorFrames=read('079-prior-browser-evidence/manifest'),freshFrames=read('079-browser-regression-captures/manifest');
assert.equal(freshFrames.priorEvidenceRestored,true);assert.equal(priorFrames.frames.length,18);
for(const c of priorFrames.frames)verify({...c,file:base+c.file});
for(const c of freshFrames.rows)verify({...c,file:base+'079-browser-regression-captures/'+c.file});

const captures=read('079-integrated-captures');assert.equal(captures.captures.length,14);assert.equal(captures.errors.length,0);
for(const value of Object.values(captures.checks))assert.equal(value,true);
const views=captures.captures.map(c=>{
 verify(c);return{...c,inspected:true,visualAccepted:true,qualification:c.view==='source-aligned'?
  'Viewed at the Brown crop scale and origin. Wheel circles, measured joints, arms, rods and pawl silhouettes closely follow the source; repeated tooth divisions are regularized.':
  c.view==='rear'?'Viewed: the dark rear surface is the solid wheel back, with readable layered journals and linkage. No ground, fog or scene clipping.':
  'Viewed: complete mechanism, distinct axial layers and readable pawl contact. Desktop and mobile controls and framing are accepted. Hub crescents are genuine cast shadows, checked against a refreshed unshadowed control.'};
});
const inspections={movement:79,created:new Date().toISOString(),manifest:{file:base+'079-integrated-captures.json',sha256:hash(base+'079-integrated-captures.json')},
 views,videoRecorded:false,videoWatched:false};
fs.writeFileSync(base+'079-integrated-inspections.json',JSON.stringify(inspections,null,2)+'\n',{flag:'wx'});

const productionSources=[...allowed,'src/simulation/opposed-arm.js','src/simulation/opposed-arm-geometry.js',
 'src/simulation/opposed-arm-motion.js','src/data/opposed-arm-profile.js','tests/opposed-arm.test.mjs','tests/e2e/opposed-arm.spec.mjs',
 'scripts/integrate-opposed-arm.mjs','scripts/finalize-opposed-arm-display.mjs','scripts/probe-opposed-arm-production-parity.mjs',
 'scripts/capture-opposed-arm-integrated.mjs','scripts/preserve-opposed-arm-browser-evidence.mjs','scripts/record-opposed-arm-integrated-review.mjs'];
const sources=productionSources.map((file,i)=>{
 const archive=base+'079-integrated-review-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 const s={file,archive,sha256:hash(file)};verify(s);return s;
});
const reports=fs.readdirSync(base).filter(n=>n.startsWith('079-')&&n.endsWith('.json')&&n!=='079-integrated-checkpoint.json')
 .map(n=>({file:base+n,sha256:hash(base+n)}));
const report={movement:79,status:'verified-integrated-reconstruction',productionChanged:true,mechanicsPassed:true,created:new Date().toISOString(),
 verifiedFiles:Object.keys(frozen).length,verificationHashes:'079-verification-source-hashes.json',unchangedPriorFiles:Object.keys(previous).length-allowed.length,
 geometry:{solids:37,teeth:33,source:'Brown page 28, printed page 24, crop [3055,1150,1430,1380]',
 sourceScalePixels:400.22693572590316,outerRimFitRmsPixels:1.16298,innerRimFitRmsPixels:1.8656,
 angularDivisionFitRmsPixels:22.3379,visibleDivisions:31,inferredOccludedDivisions:2},
 playback:study.playback,dynamics:study.dynamics,refinement:study.refinement,fidelity:study.fidelity,
 continuousClearance:study.continuousClearance,reactions:study.reactions,
 candidateSurface:study.surface,
 parity:{parts:parity.parts,buffers:parity.buffers,poses:parity.poses,maxStateError:parity.maxStateError,maxMatrixError:parity.maxMatrixError},
 timing:captures.timing,views,checks:captures.checks,totalCandidateAndIntegratedImagesInspected:study.totalCandidateImagesInspected+views.length,
 reports,sources,priorStudy:{file:base+'079-playback-study-checkpoint.json',sha256:hash(base+'079-playback-study-checkpoint.json'),
 verifiedReports:study.reports.length,verifiedArchives:study.archives.length,verifiedSourceCopies:study.sources.length},exits,
 regression:{focused:7,numerical:3087,browser:35,all507Rendered:true,historicalFramesRestored:priorFrames.frames.length,freshFramesArchived:freshFrames.rows.length},
 qualifications:[study.assumptions,
  'The physical input period is eight seconds, displayed in four. Startup settling is retained; the steady cycle advances four clockwise teeth without stopping. Output resistance 6 is selected, with sustained motion also checked at 5 and 7.',
  'The final time-step comparison differs by at most 0.103462483 source pixels. Dense-output compression and one interior lower-pawl correction add at most 0.000391529 pixels. Their combined 0.103854011-pixel bound describes observed numerical agreement, not a formal continuum error.',
  'Continuous primary bounds cover all 9,004 interpolation intervals and all 33 tooth orientations within 1e-6. Independent layer, bore, capsule and common-axis bounds cover the other 536 pairs.',
  'All 113,064 reactions pass actual-boundary, normal-cone and moment checks. Two nonunique edge contacts require their valid support midpoint instead of the nearest-point algorithm’s arbitrary endpoint. The original flagged report remains preserved; dynamics and tolerances are unchanged.',
  'The 15,195,512-sample surface screen used the candidate at 97 poses. All 110 rendered production buffers and all matrices at 31,256 poses match that candidate exactly. Focused production tests additionally check actual surfaces at 13 poses.',
  'Seventy-two candidate-study stills, including rejected diagnostic views, and fourteen integrated stills are inspected. The final ten-image candidate preview and fourteen integrated views are accepted. No video was recorded or watched.',
  'The production build retains its large-bundle warning: the main JavaScript bundle is about 21.15 MB before gzip.'
 ],
 preservedFailures:[
  'The original prescribed production model has 15,970 sampled penetrations and is replaced.',
  'Coarser dynamics interpolations and the finest profile without the interior contact projection fail continuous primary clearance. A finite witness sample finding no intrusion does not override the failed continuous bound.',
  'Explicit checks of all 33 orientations also reject the problematic unprojected finest interval; no clearance tolerance was increased.',
  'The full original reaction checker flags two moment-arm comparisons. Each is resolved independently at a valid coincident support midpoint.',
  'The first production parity command used a missing import path; a corrected run passed but was mislabeled movement 78. Both artifacts remain preserved, and the final movement-79 report passes.'
 ],remaining:[],full507GoalStillActive:true};
fs.writeFileSync(base+'079-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({status:report.status,verifiedFiles:report.verifiedFiles,views:views.length,regression:report.regression,
 reports:reports.length,productionSourceCopies:sources.length,priorArchives:study.archives.length,full507GoalStillActive:true});
