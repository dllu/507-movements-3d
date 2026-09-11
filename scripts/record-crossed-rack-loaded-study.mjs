import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',read=n=>JSON.parse(fs.readFileSync(base+n+'.json')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
 verify=s=>assert.equal(hash(s.archive??s.file),s.sha256,s.archive??s.file),frozen=read('079-verification-source-hashes');
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
assert(fs.readFileSync('src/simulation/authored-intermittent.js','utf8').includes(fs.readFileSync(base+'080-original-factory.txt','utf8')));
assert(fs.readFileSync('tests/models.test.mjs','utf8').includes(fs.readFileSync(base+'080-original-test.txt','utf8')));
const prior=read('080-geometry-study-checkpoint');for(const r of prior.reports)verify(r);for(const s of prior.sources)verify(s);
const required=['080-fixed-normal-formulas','080-fixed-normal-energy','080-fixed-normal-reactions','080-fixed-normal-primary-bounds',
 '080-fixed-normal-secondary-bounds','080-fixed-normal-refinement','080-framed-finite-playback-preparation','080-playback-sampler'];
for(const name of required){const r=read(name);assert(r.passed,name);for(const s of r.sources)verify(s);}
const fine=read('080-fixed-normal-finer-dynamics'),finest=read('080-fixed-normal-finest-dynamics'),energy=read('080-fixed-normal-energy'),
 reactions=read('080-fixed-normal-reactions'),primary=read('080-fixed-normal-primary-bounds'),secondary=read('080-fixed-normal-secondary-bounds'),
 refinement=read('080-fixed-normal-refinement'),preparation=read('080-framed-finite-playback-preparation'),sampler=read('080-playback-sampler'),
 surfaces=read('080-fixed-normal-finest-surfaces-geometry');
for(const r of [fine,finest]){assert.equal(r.failures.length,0);assert.equal(r.rows.length,Math.round(r.duration/r.dt)+1);for(const s of r.sources)verify(s);}
assert(surfaces.geometryPassed);assert.equal(surfaces.penetrations,0);assert.equal(surfaces.topologyIssues.length,0);for(const s of surfaces.sources)verify(s);
verify(preparation.profile);assert.equal(reactions.checked,228333);assert.equal(primary.failedIntervals,0);assert.equal(secondary.secondaryPairs,79);
const inspectedViews=[];
for(const prefix of ['080-amplitude016','080-fixed-normal-finest']){
 const manifest=read(prefix+'-captures');assert.equal(manifest.errors.length,0);assert.equal(manifest.captures.length,12);
 for(const s of manifest.sources)verify(s);
 for(const c of manifest.captures){verify(c);inspectedViews.push({...c,inspected:true,visualAccepted:true,
  qualification:prefix==='080-amplitude016'?'Viewed as an exploratory loaded study. Whole rack travel, crossing order and framing are acceptable; this coarser startup is superseded by the refined path.':
  'Viewed: source proportions and crossing order remain intact throughout the finite lift. The 18- and 20-second poses hold the raised bar. Front, oblique and rear views show complete geometry without fog, ground or scene clipping. These are selected stills; UI playback remains pending.'});}
}
const reportFiles=fs.readdirSync(base).filter(n=>n.startsWith('080-')&&n.endsWith('.json')),
 reports=reportFiles.map(n=>({file:base+n,sha256:hash(base+n)})),archiveMap=new Map();
for(const name of reportFiles){const r=JSON.parse(fs.readFileSync(base+name));for(const s of r.sources??[]){verify(s);archiveMap.set(s.archive??s.file,s);}}
const orphanedDiagnosticArchives=fs.readdirSync(base).filter(n=>/^080-finest-momentum-diagnostic-source-\d+\.txt$/.test(n)).map(n=>({file:base+n,sha256:hash(base+n)}));
const currentSources=[
 'scripts/lib/crossed-rack-source.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-contact-study.mjs',
 'scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-energy-study.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',
 'scripts/lib/crossed-rack-triangle-bounds.mjs','scripts/lib/crossed-rack-playback-study.mjs','scripts/study-crossed-rack-dynamics.mjs',
 'scripts/diagnose-crossed-rack-corner.mjs','scripts/check-crossed-rack-formulas.mjs','scripts/assess-crossed-rack-refinement.mjs',
 'scripts/check-crossed-rack-reactions.mjs','scripts/check-crossed-rack-energy.mjs','scripts/diagnose-crossed-rack-momentum.mjs',
 'scripts/bound-crossed-rack-primary.mjs','scripts/bound-crossed-rack-secondary.mjs','scripts/prepare-crossed-rack-playback.mjs',
 'scripts/check-crossed-rack-playback.mjs','scripts/probe-crossed-rack-candidate.mjs','scripts/capture-crossed-rack-candidate.mjs',
 'scripts/record-crossed-rack-loaded-study.mjs'].map((file,i)=>{
  const archive=base+'080-loaded-study-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
 });
const sampleIndex=t=>Math.round(t/finest.dt),pitch=prior.source.pitchPixels/prior.source.scale,
 operating=finest.rows.slice(sampleIndex(8),sampleIndex(16)+1),rollback=operating.slice(1).reduce((s,r,i)=>s+Math.max(0,operating[i].x[0]-r.x[0]),0)/pitch,
 checkpoint={movement:80,status:'isolated-loaded-mechanics-qualified',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 candidateMechanicsPassed:true,candidateReadyForIntegration:true,frozenInputsMatched:Object.keys(frozen).length,
 priorStudy:{file:base+'080-geometry-study-checkpoint.json',sha256:hash(base+'080-geometry-study-checkpoint.json')},
 source:prior.source,geometry:prior.geometry,
 dynamics:{input:base+'080-fixed-normal-finest-dynamics.json',dt:finest.dt,rows:finest.rows.length,parameters:finest.parameters,
  maximumIterations:finest.maximumIterations,minimumGap:finest.minimumGap,finalPitches:finest.rows.at(-1).x[0]/pitch,
  operatingCyclePitches:(finest.rows[sampleIndex(16)].x[0]-finest.rows[sampleIndex(8)].x[0])/pitch,operatingRollbackPitches:rollback},
 energy:{formulas:energy.formulas,final:energy.runs.at(-1),previous:energy.runs.at(-2)},
 refinement:{observedPixels:refinement.comparisons.at(-1).maximumPixels,compressionPixels:preparation.largestAcceptedError,combinedPixels:sampler.combinedPixels,limitPixels:.25},
 continuousClearance:{independentPairs:81,primaryPairs:2,secondaryPairs:79,rawIntervals:primary.intervalCount,
  rawProofIntervals:primary.checkedIntervals,playbackKnots:preparation.selectedKnots,playbackProofIntervals:preparation.acceptedProofIntervals,
  tolerance:primary.tolerance,minimumSecondaryLowerBound:Math.min(...secondary.pairs.filter(p=>!p.primary).map(p=>p.lower)),
  secondaryBoundsTransferredBySubset:sampler.secondaryBoundsTransferredBySubset},
 reactions:{checked:reactions.checked,maximumSeparation:reactions.maximumSeparation,maximumBoundaryDistance:reactions.maximumBoundaryDistance,
  maximumConeError:reactions.maximumConeError,maximumJacobianError:reactions.maximumJacobianError},
 surface:{solids:surfaces.topology.length,poses:surfaces.poses,checks:surfaces.checks,penetrations:surfaces.penetrations},
 playback:preparation.profile,proposedPlayback:{period:4,duration:10,inputStopsAt:9,meshFramingChecks:sampler.meshChecks,cameraViews:sampler.cameraChecks.length,
  qualification:'Timing is prepared and numerically checked; app stop/replay behavior and rendered playback still require integration review.'},
 inspectedViews,totalCandidateImagesInspected:prior.inspectedViews.length+inspectedViews.length,videoRecorded:false,videoWatched:false,
 reports,archives:[...archiveMap.values()],sources:currentSources,
 preservedFailures:[
  'Original production proportions, 232128 sampled penetrations and whole-rack pitch jumps remain rejected.',
  'The first full-depth hook webs have 91 source-pose penetrations; concealed relief preserves all visible contours.',
  'The first vertex/edge contact law cycles at a convex rack tip in a concave hook corner. The archived failure is reproduced and resolved using the two real corner facets.',
  'The initial .002-to-.001 second trajectories differ by 6.417 source pixels during startup. Those coarser results are superseded.',
  'The first energy audit flags reconstructed momentum residuals up to 2.53e-6. Exact step replay identifies normal-direction roundoff from near-zero gaps; fixed interior-face normals reduce the final residual below 9.15e-11 without geometry, load or tolerance changes.',
  'The first momentum-diagnostic runner stopped at a serialization-only assertion: the generic stepper has an unused undefined pin property, omitted in JSON. The serialized comparison is corrected and its subsequent four-event replay succeeds.',
  'The first compressed profile has an unnecessarily conservative 0.1600 camera allowance across the drive stop. Retaining its bracketing original knots reduces that allowance to 0.0000731 without modifying physical coordinates.'
 ],orphanedDiagnosticArchives,
 assumptions:[
  'Axial layers, concealed toe relief, pin construction and regular tooth pitch reconstruct details absent or irregular in the engraving.',
  'The rack has an ideal prismatic constraint imposing the source-described rectilinear path. The drawn shaft/slot alone is not claimed to implement a complete physical linear guide; no extra guide is rendered.',
  'Only the lever is prescribed. Common density, gravity, absolute-coordinate viscous drag, frictionless unilateral contact, zero extra payload, eight-second physical input period and 0.16-radian amplitude are reconstruction assumptions.',
  'The physical startup, finite whole-bar translation and handoff rollback are retained. Input stops at a zero-speed reversal after 18 physical seconds; the demonstration ends at 20 seconds while the hooks support the raised bar.',
  'The 0.237843-source-pixel combined value bounds observed time-step agreement and compression, not the unknown continuum error.',
  'Candidate mechanics are qualified; production 080 is still the original unverified model. No new production regression claim is made.'
 ],remaining:['Integrate the qualified geometry and finite sampler','Add app completion and explicit replay behavior without changing Reset view',
  'Measure display timing and check final desktop/mobile playback','Verify production parity and run the complete numerical/browser regression'],full507GoalStillActive:true};
fs.writeFileSync(base+'080-loaded-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,candidateReadyForIntegration:true,frozenInputs:checkpoint.frozenInputsMatched,
 reports:reports.length,archives:archiveMap.size,sourceCopies:currentSources.length,loadedViews:inspectedViews.length,full507GoalStillActive:true});
