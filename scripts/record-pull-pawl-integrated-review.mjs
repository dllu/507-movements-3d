import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',json=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 frozen=json('078-verification-source-hashes'),previous=json('077-verification-source-hashes');
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,'Changed verification input: '+file);
const allowed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json'];
for(const [file,expected]of Object.entries(previous))if(!allowed.includes(file))assert.equal(hash(file),expected,'Unrelated prior input changed: '+file);
const originalMain=fs.readFileSync(base+'078-preintegration-source-0.txt','utf8'),oldFactory=fs.readFileSync(base+'078-original-factory.txt','utf8'),
 expectedMain="import { makePullPawlDrive } from './pull-pawl.js';\n"+originalMain.replace(oldFactory,'').replace('case 78: return alternatingPullPawlRatchetDrive();','case 78: return makePullPawlDrive();');
assert.equal(fs.readFileSync('src/simulation/authored-intermittent.js','utf8'),expectedMain);
assert.equal(fs.readFileSync('tests/models.test.mjs','utf8'),fs.readFileSync(base+'078-preintegration-source-1.txt','utf8').replace(fs.readFileSync(base+'078-original-test.txt','utf8'),''));
const before=JSON.parse(fs.readFileSync(base+'078-preintegration-source-3.txt')),after=JSON.parse(fs.readFileSync('src/data/display-profiles.json'));
for(const id of Object.keys(before.profiles))if(id!=='78')assert.deepEqual(after.profiles[id],before.profiles[id]);
const selected=['078-production-parity','078-production-surfaces','078-playback-finest-compression-study','078-playback-finest-contact-bounds',
 '078-secondary-complete-clearance-bounds','078-pawl-body-clearance-bounds','078-bound-formulas','078-reaction-cones','078-formula-check','078-finest-convergence'];
for(const name of selected){
 const report=json(name);assert.equal(report.passed,true,name);
 for(const source of report.sources??[])assert.equal(hash(source.file),source.sha256,'Changed check source: '+source.file);
}
const topology=json('078-relieved-topology');assert.equal(topology.issues.length,0);assert.equal(topology.rows.length,23);
const captures=json('078-integrated-captures');assert.equal(captures.visualPassed,true);assert.equal(captures.errors.length,0);
for(const value of Object.values(captures.checks))assert.equal(value,true);
for(const c of captures.captures){assert.equal(c.inspected,true);assert.equal(hash(c.file),c.sha256);}
const required=['integration','playback-finest-build','playback-finest-contact-bounds','secondary-complete-clearance-bounds',
 'pawl-body-clearance-bounds','bound-formulas','reaction-cones-corrected','amplitude-038-finest','amplitude-038-finest-energy',
 'finest-convergence','load-5','load-7','focused-tests-bidirectional','production-parity-corrected','production-surfaces',
 'display-measure','display-finalize','build','numerical','integrated-capture','browser-tests','browser-evidence-restore'],exits={};
for(const name of required){const r=json('078-'+name+'-exit-status');assert.equal(r.code,0,name);assert.equal(r.signal,null,name);exits[name]=r;}
const numerical=fs.readFileSync(base+'078-numerical.log','utf8'),browser=fs.readFileSync(base+'078-browser-tests.log','utf8');
assert.match(numerical,/# tests 3081\b/);assert.match(numerical,/# pass 3081\b/);assert.match(numerical,/# fail 0\b/);
assert.match(browser,/\b34 passed\b/);assert.ok(browser.includes('every 3D family reaches a rendered canvas without runtime errors'));
const priorFrames=json('078-prior-browser-evidence/manifest'),freshFrames=json('078-browser-regression-captures/manifest');
assert.equal(freshFrames.priorEvidenceRestored,true);
for(const c of priorFrames.frames)assert.equal(hash(base+c.file),c.sha256);
for(const c of freshFrames.rows)assert.equal(hash(base+'078-browser-regression-captures/'+c.file),c.sha256);
const parity=json('078-production-parity'),surfaces=json('078-production-surfaces'),primary=json('078-playback-finest-contact-bounds'),
 secondary=json('078-secondary-complete-clearance-bounds'),body=json('078-pawl-body-clearance-bounds'),cache=json('078-playback-finest-candidate'),
 resolution=json('078-finest-convergence'),energy=json('078-amplitude-038-finest-energy'),reactions=json('078-reaction-cones'),
 study=json('078-playback-study-checkpoint');
assert.equal(primary.turns,26);assert.equal(secondary.pairs.length,192);
assert.equal(energy.failures.length,0);
for(const item of [...study.reports,...study.sources.map(s=>({...s,file:s.archive})),...study.captures,...study.plots])assert.equal(hash(item.file),item.sha256,'Changed historical study evidence: '+item.file);

// Every referenced historical source is recovered by its hash, so failed
// implementations remain reproducible even where the working script changed.
const pool=new Map(),scan=directory=>{
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);if(entry.isDirectory())scan(file);
  else if(/\.(mjs|txt|json|html)$/.test(file))pool.set(hash(file),file);
 }
};
for(const entry of fs.readdirSync(base,{withFileTypes:true}))if(entry.name.startsWith('078-')){
 const file=path.join(base,entry.name);if(entry.isDirectory())scan(file);else if(/\.(mjs|txt|json|html)$/.test(file))pool.set(hash(file),file);
}
const archive=base+'078-integrated-review-sources';fs.mkdirSync(archive,{recursive:true});
const sources=new Map(),preserve=s=>{
 if(!s?.file||!s.sha256||sources.has(s.sha256))return;
 let original=pool.get(s.sha256);if(fs.existsSync(s.file)&&hash(s.file)===s.sha256)original=s.file;
 assert.ok(original,'Missing exact source: '+JSON.stringify(s));
 const target=archive+'/'+s.sha256+'-'+path.basename(s.file);
 if(!fs.existsSync(target))fs.copyFileSync(original,target);assert.equal(hash(target),s.sha256);
 sources.set(s.sha256,{file:s.file,archive:target,sha256:s.sha256});
},reports=[];
for(const name of fs.readdirSync(base).filter(n=>n.startsWith('078-')&&n.endsWith('.json')&&n!=='078-integrated-checkpoint.json')){
 const file=base+name,data=JSON.parse(fs.readFileSync(file));reports.push({file,sha256:hash(file)});
 for(const source of [...(data.sources??[]),data.source,data.script,data.prior])preserve(source);
}
for(const file of [...allowed,'src/simulation/pull-pawl.js','src/simulation/pull-pawl-geometry.js','src/simulation/pull-pawl-motion.js','src/data/pull-pawl-profile.js',
 'tests/pull-pawl.test.mjs','tests/e2e/pull-pawl.spec.mjs','scripts/integrate-pull-pawl.mjs','scripts/finalize-pull-pawl-display.mjs',
 'scripts/probe-pull-pawl-production-parity.mjs','scripts/probe-pull-pawl-production-surfaces.mjs','scripts/capture-pull-pawl-integrated.mjs',
 'scripts/preserve-pull-pawl-browser-evidence.mjs','scripts/record-pull-pawl-integrated-review.mjs'])preserve({file,sha256:hash(file)});
const dynamics=study.dynamics.find(r=>r.file.endsWith('078-amplitude-038-finest.json'));
const report={movement:78,status:'verified-integrated-reconstruction',productionChanged:true,mechanicsPassed:true,created:new Date().toISOString(),
 verifiedFiles:Object.keys(frozen).length,verificationHashes:'078-verification-source-hashes.json',unchangedPriorFiles:Object.keys(previous).length-allowed.length,
 geometry:{solids:23,teeth:26,spokes:6,independentPairs:192,source:'Brown page 28, printed page 24, crop [1790,1150,1270,1300]',
 sourceAngularFitRmsPixels:9.3107,sourceRadialFitRmsPixels:3.7828,sourceInnerRimFitRmsPixels:2.3482705333,
 sourceSeatErrorsPixels:{left:6.516966519199863,right:8.179730735427553}},
 mechanics:{physicsPeriod:8,displayPeriod:4,amplitude:.38,dryFrictionLoad:6,damping:[.15,.008,.008],loadRangeChecked:[5,6,7],
 finestStep:.00025,finestSteps:64000,cycles:dynamics.cycles,firstKnots:cache.first.length,periodicKnots:cache.steady.length,
 cacheAngularTolerance:cache.epsilon,observedRefinementDifferencesSourcePixels:resolution.comparisons.map(r=>r.maximumSourcePixels),
 energy:{totals:energy.totals,maximumPositiveStepResidual:energy.maximumPositiveDefect},
 reactions:{counts:reactions.counts,maximumGap:reactions.maximumGap,totals:reactions.totals},
 primaryClearance:{orientations:primary.turns,certifiedIntervals:primary.certified,trianglePairs:primary.trianglePairs,
 minimumLowerBound:primary.minimumLowerBound,tolerance:primary.tolerance},
 secondaryClearance:{classification:secondary.classification,intervals:secondary.intervals,minimumPawlBodyGap:body.minimumLowerBound,
 minimumBearingRadialGap:Math.min(...secondary.pairs.filter(p=>p.kind==='bore').map(p=>p.minimum))},
 sampledAllPairClearance:{pairs:surfaces.pairCount,poses:surfaces.poses,checks:surfaces.checks,inside:surfaces.inside,tolerance:1e-6}},
 parity:{parts:parity.parts,buffers:parity.buffers,poses:parity.poses,maxStateError:parity.maxStateError,maxMatrixError:parity.maxMatrixError},
 timing:captures.timing,views:captures.captures,checks:captures.checks,reports,sources:[...sources.values()],exits,
 regression:{focused:7,numerical:3081,browser:34,all507Rendered:true,historicalFramesRestored:priorFrames.frames.length,freshFramesArchived:freshFrames.rows.length},
 qualifications:[
 'The concentric 26-tooth wheel, repeated spoke openings, covered contours and rear relief under the left hook regularize the engraving. The visible front hook is source traced.',
 'Only the lever is prescribed. Gravity, inertia and finite inelastic contacts determine wheel and pawl motion. Common density, absolute angular damping and bidirectional dry friction are reconstruction assumptions.',
 'The first cycle settles from the drawing pose and retains tiny physical rollback. The steady cycle advances one clockwise tooth and is stopped for about 45.7% of the cycle.',
 'The last two spatial refinement differences are 0.1870 and 0.1881 source pixels. Both pass the 0.25-pixel criterion; spatial error does not decrease monotonically. Positive work residual decreases under refinement.',
 'Complete convex-face bounds cover edge crossings through every linear playback interval and all 26 orientations, within 1e-6. Layer, bore, capsule and filled-frame bounds cover every other independent pair.',
 'Fourteen integrated stills and eight preview stills are inspected. The recorded preview video was not watched.',
 'The build retains its large-bundle warning: the main JavaScript bundle is about 20.46 MB before gzip.'
 ],
 preservedFailures:[...study.preservedFailures,'The first production parity report was incorrectly labelled movement 77; its unaltered result is retained separately.',
 'The first engagement test sampled hook points against the wheel only. The corrected bidirectional test also detects wheel tips entering hook material.'],
 remaining:[],full507GoalStillActive:true};
fs.writeFileSync(base+'078-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({verifiedFiles:report.verifiedFiles,views:report.views.length,regression:report.regression,reports:reports.length,exactSources:sources.size,full507GoalStillActive:true});
