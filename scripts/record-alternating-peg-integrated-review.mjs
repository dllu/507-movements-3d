import fs from 'node:fs';
import crypto from 'node:crypto';
const base='artifacts/review/',json=name=>JSON.parse(fs.readFileSync(base+name+'.json')),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const frozen=json('077-verification-source-hashes');
for(const [file,expected]of Object.entries(frozen))if(hash(file)!==expected)throw Error('Verification input changed: '+file);
const parity=json('077-production-parity'),surfaces=json('077-production-surfaces'),bounds=json('077-playback-contact-bounds'),secondary=json('077-secondary-clearance-bounds'),captures=json('077-integrated-captures'),cache=json('077-playback-candidate'),resolution=json('077-long-lip-clock-final-convergence'),energy=json('077-long-lip-clock-finest-energy');
for(const report of [parity,surfaces,bounds,secondary]){
 if(!report.passed)throw Error('Mechanical check failed');
 for(const source of report.sources)if(hash(source.file)!==source.sha256)throw Error('Evidence source changed: '+source.file);
}
if(!captures.visualPassed||Object.values(captures.checks).some(v=>v!==true)||captures.errors.length)throw Error('Integrated visual check failed');
for(const c of captures.captures)if(!c.inspected||hash(c.file)!==c.sha256)throw Error('Unreviewed or altered capture: '+c.file);
const exits={};
for(const name of ['integration-corrected','playback-compression-study','playback-contact-bounds','long-lip-playback-vertices','focused-tests','production-parity','production-surfaces','measure-display','build','numerical','integrated-capture','browser-tests']){
 const r=json('077-'+name+'-exit-status');if(r.code!==0||r.signal!==null)throw Error('Failed execution: '+name);exits[name]=r;
}
const numerical=fs.readFileSync(base+'077-numerical.log','utf8'),browser=fs.readFileSync(base+'077-browser-tests.log','utf8');
if(!/# tests 3075\b/.test(numerical)||!/# pass 3075\b/.test(numerical)||!/# fail 0\b/.test(numerical))throw Error('Incomplete numerical suite');
if(!/\b33 passed\b/.test(browser)||!browser.includes('every 3D family reaches a rendered canvas without runtime errors'))throw Error('Incomplete browser suite');
const prior=json('077-prior-browser-evidence/manifest'),regression=json('077-browser-regression-captures/manifest');
if(!regression.priorEvidenceRestored)throw Error('Historical frames not restored');
for(const c of prior.frames)if(hash(base+c.file)!==c.sha256)throw Error('Historical image changed');
for(const c of regression.rows)if(hash(base+'077-browser-regression-captures/'+c.file)!==c.sha256)throw Error('Fresh regression image changed');
const previousHashes=json('076-verification-source-hashes'),allowed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json'];
for(const [file,expected]of Object.entries(previousHashes))if(!allowed.includes(file)&&hash(file)!==expected)throw Error('Unrelated verified file changed: '+file);
const before=JSON.parse(fs.readFileSync(base+'077-preintegration-source-3.txt')),after=JSON.parse(fs.readFileSync('src/data/display-profiles.json'));
for(const key of Object.keys(before.profiles))if(key!=='77'&&JSON.stringify(before.profiles[key])!==JSON.stringify(after.profiles[key]))throw Error('Unrelated display profile changed');
const reports={};
for(const name of ['077-long-lip-study-checkpoint','077-preintegration-checkpoint','077-playback-compression-study','077-playback-contact-bounds','077-secondary-clearance-bounds','077-long-lip-clock-final-convergence','077-long-lip-clock-finest-energy','077-long-lip-clock-formula-refined','077-production-parity','077-production-surfaces','077-integrated-captures','077-verification-source-hashes'])reports[base+name+'.json']=hash(base+name+'.json');
const sources=[];
for(const file of ['src/simulation/alternating-peg-pawl.js','src/simulation/alternating-peg-geometry.js','src/simulation/alternating-peg-motion.js','src/data/alternating-peg-profile.js','tests/alternating-peg.test.mjs','tests/e2e/alternating-peg.spec.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/alternating-peg-playback-study.mjs','scripts/integrate-alternating-peg.mjs','scripts/probe-alternating-peg-production-parity.mjs','scripts/probe-alternating-peg-production-surfaces.mjs','scripts/capture-alternating-peg-integrated.mjs','scripts/record-alternating-peg-integrated-review.mjs']){
 const archive=base+'077-integrated-review-source-'+sources.length+'.txt';fs.writeFileSync(archive,fs.readFileSync(file),{flag:'wx'});sources.push({file,archive,sha256:hash(file)});
}
const report={movement:77,status:'verified-integrated-reconstruction',productionChanged:true,mechanicsPassed:true,time:new Date().toISOString(),verifiedFiles:Object.keys(frozen).length,verificationHashes:'077-verification-source-hashes.json',
 geometry:{solids:62,pins:24,independentPairs:600,source:'Brown page 28, printed page 24, crop [415,1150,1300,1300]',engagedPinSourceErrorsPixels:[1.4450082739,2.4218318352],allPinSourceErrorsPixels:{rms:12.1458372862,maximum:24.2588959668}},
 mechanics:{physicsPeriod:8,displayPeriod:4,dryFrictionLoad:15,constantTorqueLoad:0,damping:[4,.006,.006],loadRangeChecked:[13,15,17],finestStep:.00025,finestSteps:64000,initialCyclePitches:1.3142523143407498,steadyCyclePitches:1,steadyReversePitches:-.000026280047684033875,steadyStoppedFraction:.18093184587981626,
 firstKnots:cache.first.length,periodicKnots:cache.steady.length,cacheAngularTolerance:cache.epsilon,observedFinestTrajectoryDifferenceSourcePixels:resolution.comparisons.at(-1).maximumSourcePixelDisplacement,
 energy:{positiveWorkResidual:energy.totals.positiveDefect,maximumPositiveStepResidual:energy.maximumPositiveDefect},
 continuousPrimaryContacts:{queries:bounds.queries,certified:bounds.certified,minimumLowerBound:bounds.minimumLowerBound,tolerance:bounds.tolerance},
 secondarySeparation:secondary.lower,minimumBearingRadialGap:Math.min(...secondary.bearings.map(b=>b.gap)),
 sampledAllPairClearance:{pairs:surfaces.pairCount,poses:surfaces.poses,checks:surfaces.checks,inside:surfaces.inside,tolerance:1e-6}},
 parity:{parts:parity.parts,buffers:parity.buffers,poses:parity.poses,maxStateError:parity.maxStateError,maxMatrixError:parity.maxMatrixError},
 timing:captures.timing,views:captures.captures,checks:captures.checks,reports,sources,exits,
 regression:{focused:7,numerical:3075,browser:33,all507Rendered:true,historicalFramesRestored:prior.frames.length,freshFramesArchived:regression.rows.length},
 qualifications:['The 24 evenly spaced pins regularize the drawing. Phase is fitted to the engaged pair, improving those contacts while increasing the overall pin-position residual.',
 'Common density, absolute angular damping and bidirectional dry-friction output resistance are explicit reconstruction assumptions. No one-way wheel lock or output-angle projection is imposed.',
 'The C2 input phase clock acts only on the prescribed lever. Wheel and pawl motion was reintegrated with gravity, inertia and finite inelastic contacts.',
 'The first cycle starts from the drawing pose and includes settling impacts. Later cycles advance one pin pitch. Small physical backlash is retained.',
 'Step refinement gives an observed subpixel displacement difference, not an exact proof of continuous-time dynamics. Positive energy-work residuals decrease under refinement.',
 'Primary contacts have continuous geometric bounds within tolerance. Secondary capsule/bearing/layer bounds supplement the sampled all-pair mesh screen.',
 'Fourteen integrated stills are inspected. The separate preview video was recorded but was not watched.',
 'The build retains the existing large-bundle warning; the main bundle is about 19.6 MB before gzip.'],
 preservedFailures:['077-long-lip-clock-formula-check.json','077-long-lip-playback-browser-exit-status.json','077-integration-exit-status.json','077-secondary-clearance-first-failure.json'],remaining:[]};
fs.writeFileSync(base+'077-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const reconstruction=json('077-reconstruction');Object.assign(reconstruction,{status:report.status,productionChanged:true,mechanicsPassed:true,integration:'077-integrated-checkpoint.json',remaining:[]});fs.writeFileSync(base+'077-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({verifiedFiles:report.verifiedFiles,views:report.views.length,regression:report.regression,full507GoalStillActive:true});
