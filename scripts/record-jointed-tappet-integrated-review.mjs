import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='artifacts/review/',json=async name=>JSON.parse(await readFile(base+name+'.json','utf8')),
 hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const frozen=await json('076-verification-source-hashes');
for(const[file,expected]of Object.entries(frozen))if(await hash(file)!==expected)throw new Error('Verification input changed: '+file);
const parity=await json('076-production-parity'),surfaces=await json('076-production-surfaces'),bounds=await json('076-playback-contact-bounds'),
 captures=await json('076-integrated-captures'),finite=await json('076-finite-dynamics-checkpoint');
for(const report of [parity,surfaces,bounds]){
 if(!report.passed)throw new Error('Mechanical check failed');
 for(const source of report.sources)if(await hash(source.file)!==source.sha256)throw new Error('Evidence source changed: '+source.file);
}
if(Object.values(captures.checks).some(v=>v!==true)||captures.errors.length)throw new Error('Integrated browser check failed');
for(const c of captures.captures)if(!c.inspected||await hash(c.file)!==c.sha256)throw new Error('Unreviewed or altered capture: '+c.file);
const exits={};
for(const name of ['integration','playback-compression-study','playback-contact-bounds','playback-browser-fixed','focused-tests-finite-sections','production-parity-check','production-surfaces-check','display-measurement','build','numerical-tests','integrated-capture-controls','browser-tests']){
 const r=await json('076-'+name+'-exit-status');if(r.code!==0||r.signal!==null)throw new Error('Failed execution: '+name);exits[name]=r;
}
const numerical=await readFile(base+'076-numerical-tests.log','utf8');
if(!/# tests 3069\b/.test(numerical)||!/# pass 3069\b/.test(numerical)||!/# fail 0\b/.test(numerical))throw new Error('Incomplete numerical suite');
if(!/\b32 passed\b/.test(await readFile(base+'076-browser-tests.log','utf8')))throw new Error('Incomplete browser suite');
const prior=await json('076-prior-browser-evidence/manifest'),regression=await json('076-browser-regression-captures/manifest');
if(!regression.priorEvidenceRestored)throw new Error('Browser evidence not restored');
for(const c of prior.frames)if(await hash(base+c.file)!==c.sha256)throw new Error('Historical image not restored');
for(const c of regression.rows)if(await hash(base+'076-browser-regression-captures/'+c.file)!==c.sha256)throw new Error('Fresh regression image changed');
const reports={};
for(const name of ['076-finite-dynamics-checkpoint','076-preintegration-checkpoint','076-playback-compression-study','076-playback-contact-bounds','076-playback-browser-fixed','076-spatial-step-resolution','076-production-parity','076-production-surfaces','076-integrated-captures','076-verification-source-hashes'])reports[base+name+'.json']=await hash(base+name+'.json');
const sources=[];
for(const file of ['src/simulation/jointed-tappet.js','src/simulation/jointed-tappet-motion.js','src/simulation/jointed-tappet-contact.js','src/simulation/finite-plate-geometry.js','src/simulation/extruded-section-caps.js','src/data/jointed-tappet-profile.js','tests/jointed-tappet.test.mjs','tests/e2e/jointed-tappet.spec.mjs','scripts/integrate-jointed-tappet.mjs','scripts/probe-jointed-tappet-production-parity.mjs','scripts/probe-jointed-tappet-production-surfaces.mjs','scripts/capture-jointed-tappet-integrated.mjs','scripts/record-jointed-tappet-integrated-review.mjs']){
 const archive=base+'076-integrated-review-source-'+sources.length+'.txt';await writeFile(archive,await readFile(file),{flag:'wx'});sources.push({file,archive,sha256:await hash(file)});
}
const report={movement:76,status:'verified-integrated-reconstruction',productionChanged:true,mechanicsPassed:true,time:new Date().toISOString(),verifiedFiles:Object.keys(frozen).length,verificationHashes:'076-verification-source-hashes.json',
 geometry:{solids:24,teeth:20,independentPairs:228,source:'Brown page 26, crop [3070,3860,1425,1320]',orderedTipErrorPixels:{rms:28.8543514853,maximum:54.6116628409},holdingNoseDisplacementFromOriginalPixels:11.9405146853},
 mechanics:{physicsPeriod:24,displayPeriod:12,load:3,damping:[3,.008,100,.003],threeStrikeFinalTeeth:finite.dynamics.finalTeeth,loadRangeChecked:[2,3,4,5],firstKnots:14035,periodicKnots:13007,cacheAngularTolerance:5e-8,observedFinestTrajectoryDifferenceSourcePixels:finite.stepResolution.maximumSourcePixelBound,
  continuousPrimaryContacts:{paths:bounds.rows.length,queries:bounds.queries,certified:bounds.certified,minimumLowerBound:bounds.minimumLowerBound,tolerance:bounds.tolerance},
  sampledAllPairClearance:{poses:surfaces.poses,checks:surfaces.checks,inside:surfaces.inside,tolerance:1e-6}},
 parity:{parts:parity.parts,buffers:parity.buffers,poses:parity.poses,maxStateError:parity.maxStateError,maxMatrixError:parity.maxMatrixError},
 timing:captures.timing,views:captures.captures,checks:captures.checks,reports,sources,exits,
 regression:{focused:8,numerical:3069,browser:32,all507Rendered:true,historicalFramesRestored:prior.frames.length,freshFramesArchived:regression.rows.length},
 qualifications:['Common density, opposing load and viscous bearing resistance are reconstruction assumptions. Contacts use frictionless normal inelastic impacts.',
 'The engraving has irregular tooth spacing; the regular contact-compatible 20-tooth reconstruction has the source errors recorded above.',
 'The wheel advances approximately 1.583 pitches under inertia before rolling back to one. The source pose is released only once; later cycles begin at the physical rest stop.',
 'Two componentwise convergence checks failed near impacts and remain failed. The separate subpixel displacement assessment supports the selected step as observed numerical stability, not an exact dynamics proof.',
 'Continuous clearance is certified for five primary contacts. Other independent pairs have sampled actual-surface evidence.',
 'The preview video was recorded but not watched. Integrated inspection covers the individual saved views and controls.'],
 preservedFailures:['076-directed-step-convergence.json','076-refined-step-convergence.json','076-playback-browser.json','076-focused-tests.log','076-focused-tests-corrected.log','076-integrated-capture.log'],remaining:[]};
await writeFile(base+'076-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const reconstruction=await json('076-reconstruction');Object.assign(reconstruction,{status:report.status,productionChanged:true,mechanicsPassed:true,integration:'076-integrated-checkpoint.json',remaining:[]});await writeFile(base+'076-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({verifiedFiles:report.verifiedFiles,views:report.views.length,regression:report.regression});
