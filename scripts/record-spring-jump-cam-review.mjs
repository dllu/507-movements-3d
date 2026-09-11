import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const directory='artifacts/review/', json=async file=>JSON.parse(await readFile(directory+file,'utf8'));
const optional=async file=>json(file).catch(()=>null),log=async file=>readFile(directory+file,'utf8').catch(()=>'');
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),model=createMovementModel(catalog.movements[63]);
const hardware=await json('064-candidate-hardware-full.json'),worm=await json('064-candidate-worm-full.json');
const solids=await json('064-candidate-solids.json'),contacts=await json('064-candidate-working-contacts.json');
const dynamics=await json('064-candidate-dynamics.json'),alignment=await json('064-candidate-source-outline.json');
const convergence=await json('064-cylindrical-hob-convergence.json');
const probeExits=await json('064-probe-exit-statuses.json');
const numerical=await optional('064-numerical-exit-status.json'),browser=await optional('064-browser-exit-status.json');
const build=await optional('064-build-exit-status.json'),inspection=await optional('064-capture-inspection.json');
const ui=await optional('064-ui-check.json');
const numericalLog=await log('064-numerical.log'),browserLog=await log('064-browser-tests.log');
const numericalPassed=Number(numericalLog.match(/# pass (\d+)/)?.[1])||null;
const browserPassed=Number(browserLog.match(/(\d+) passed[^\n]*/)?.[1])||null;
const source=await readFile('src/simulation/authored-intermittent.js','utf8'),tests=await readFile('tests/models.test.mjs','utf8');
const archives=[];
for(const name of ['factory','makeOverCenterCam','makeRollerFollower','test']){
  const file=`064-original-${name}.txt`,text=await readFile(directory+file,'utf8');
  if((name==='test'?tests:source).includes(text.trim()))throw new Error('Obsolete 064 source is still present: '+name);
  archives.push({file,removedFromProduction:true,sha256:createHash('sha256').update(text).digest('hex')});
}
const hashes={};
for(const name of ['src/simulation/engine.js','src/simulation/spring-jump-cam.js','src/simulation/spring-jump-cam-contact.js',
  'src/simulation/spring-jump-cam-motion.js','src/data/spring-jump-cam-motion.js','src/data/spring-jump-worm-profile.js']){
  hashes[name]=createHash('sha256').update(await readFile(name)).digest('hex');
}
const mechanics=hardware.poses===104&&hardware.pairs.length===165&&!hardware.inside
  &&worm.summary.poses===65&&!worm.summary.inside&&worm.summary.maximumPowerResidual<0.02
  &&worm.summary.minimumGap>1e-6&&worm.summary.maximumGap<0.00008&&worm.summary.minimumOutputTorque>0
  &&solids.rows.length===25&&!solids.issues.length
  &&contacts.summary.every(row=>row.minimumGap>1e-6&&row.minimumForce>0&&row.maximumRelativeNormalResidual<0.02)
  &&contacts.summary[0].maximumRelativeTotalResidual<0.01
  &&dynamics.summary.maximumLengthError<1e-10&&dynamics.summary.maximumFixedRootMotion===0
  &&dynamics.summary.maximumActualEnergyResidual<1e-4&&dynamics.summary.actualWorkBalanceResidual<1e-4
  &&dynamics.summary.minimumPinTorque>0&&dynamics.summary.minimumLeafForce>0
  &&dynamics.convergence.every(row=>row.angleError<0.001&&row.speedError<0.01)
  &&convergence.summary.maximumDifference<1e-10&&probeExits.length===5&&probeExits.every(row=>row.exitCode===0);
const complete=mechanics&&build?.code===0&&!build.signal&&numerical?.code===0&&!numerical.signal
  &&numericalPassed===2992&&browser?.code===0&&!browser.signal&&browserPassed===23
  &&ui?.checks?.mobileFramed&&ui?.checks?.resetStable&&Object.values(ui.checks).every(value=>value===true)
  &&inspection?.integratedFrames?.length===10&&inspection?.sourceOverlayInspected&&inspection?.desktopAndMobileInspected;
const record={movement:64,status:complete?'rebuilt-and-verified':'rebuilt-verification-pending',
  source:'https://507movements.com/mm_064.html',reference:'../reference/brown-064-detail.png',notes:'064-reconstruction-notes.md',
  interpretation:'A bottom worm drives the wheel and its solid shaft continuously. A finite radial pin drives a separate bored cam sleeve through one edge of a half-cut collar. The spring presses on a pivoted roller follower; after over-center its torque drives the cam ahead. Inertia and viscous resistance let the cam settle before the shaft pin catches it. The half-cut limits relative travel; it does not prescribe an exact half-turn jump.',
  sourceChoices:'The cam and curved spring follow the unchanged Brown enlargement. Twenty-four regularized wheel teeth are a construction choice: visible boundary harmonics favor 23 and 24 nearly equally. A cylindrical worm hob generates the wheel flanks. The circular return and tooth outlines regularize an irregular engraving; hidden shaft depth, bearings, stiffness, inertia and damping are inferred.',
  sourceLimits:'Measurements cover 86 manually marked or scan-derived visible boundary points and three centers. They are scoped outline comparisons, not a whole-image registration or a claim that the historical tooth count and hidden dimensions are known.',
  geometry:model.root.userData.geometry,timing:model.root.userData.animationTiming,idealConstraints:model.root.userData.idealConstraints,
  rendering:{groundHidden:model.root.userData.hideGround,sourceCamera:model.cameraDirection.toArray(),fullCamera:model.root.userData.fullCameraDirection.toArray(),
    shadowBias:model.root.userData.shadowBias,shadowNormalBias:model.root.userData.shadowNormalBias,
    symmetricRoller:'The unmarked annular roller keeps its physical no-slip spin. Since axial spin leaves its visible surface unchanged, it does not limit visible playback speed. A regression test checks the surface-of-revolution geometry and absence of markers.'},
  baseline:{record:'064-baseline-review-record.json',notes:'064-isolated-study-notes.md',archives,
    checks:7690790,inside:411993,qualification:'The baseline probe confirmed defects; its zero exit indicated successful diagnosis, not passing mechanics.'},
  evidence:{hardware:{report:'064-candidate-hardware-full.json',poses:hardware.poses,pairs:hardware.pairs.length,checks:hardware.checks,inside:hardware.inside},
    probeExits:{report:'064-probe-exit-statuses.json',rows:probeExits},
    worm:{report:'064-candidate-worm-full.json',...worm.summary},
    combinedSurfaceChecks:hardware.checks+worm.summary.checks,
    solids:{report:'064-candidate-solids.json',rows:solids.rows.length,issues:solids.issues},
    workingContacts:{report:'064-candidate-working-contacts.json',summary:contacts.summary},
    dynamics:{report:'064-candidate-dynamics.json',summary:dynamics.summary,convergence:dynamics.convergence.map(({name,angleError,speedError,parameters})=>({name,angleError,speedError,releaseTime:parameters.releaseTime,catchTime:parameters.catchTime}))},
    hobConvergence:{report:'064-cylindrical-hob-convergence.json',...convergence.summary},
    sourceAlignment:{report:'064-candidate-source-outline.json',overlay:'064-candidate-source-overlay.html',groups:alignment.groups.map(({name,maximumResidual,rmsResidual,rows})=>({name,points:rows.length,maximumResidual,rmsResidual})),centers:alignment.centers},
    inspection,ui,build,numerical:{passed:numericalPassed,exit:numerical,log:'064-numerical.log'},
    browser:{passed:browserPassed,exit:browser,log:'064-browser-tests.log'},focusedTests:{passed:7,log:'064-focused-tests.log'},
    precomputedMotion:{generator:'scripts/bake-spring-jump-cam-motion.mjs',log:'064-baked-motion.log',validation:'Source-hash provenance and exact sampled equivalence to fresh integration are checked by the numerical suite.'}},
  corrections:[
    'The first assembled cam intersected the worm; the cam, follower and sleeve stack was moved forward with actual bore and bearing clearance.',
    'The first leaf bent inside its clamp. The fitted clamp now ends within a fixed neutral-axis prefix.',
    'An eroded coarse tooth profile cleared the worm but failed contact-normal power by up to 40.7 percent.',
    'Continuous hob refinement initially inherited a spherical ray bound. A worm cylinder is independent of its axial X coordinate: the corrected bound is (centerDistance ± sqrt(tipRadius²-z²))/cos(theta), with finite-length clipping. Doubling phase/radial search resolution changes the corrected profile only at floating-point roundoff.',
    'The roller originally inherited extra follower rotation. Its local angle now subtracts the follower angle from the absolute no-slip angle.',
    'The first contact table and work quadrature were too coarse at fast transitions. Denser contact sampling and independent work quadrature are checked against time/contact refinement.',
    'A coarse 1e-7 edge bin falsely merged narrow valid worm-cap triangles; the actual Float32 surface closes at a finer 1e-9 merge tolerance.',
    'The spring middle curve was refitted to actual scan strokes, then its mechanics, contacts and full hardware were checked again.',
    'Final mobile inspection caught a shared camera bug: resize changed aspect but not fit distance, and reset retained drag inertia. Resizing now preserves orbit, pan and relative zoom at the new fit distance; reset refits the selected view and consumes pending inertia. Narrow-field views allow more zoom-out room. Actual-vertex and rendered-foreground regression checks cover this failure.'
  ],regressionCorrection:'The first full numerical run passed 2989/2990. A new visibility assertion incorrectly required no vertex-color attribute; the turned roller has uniform white colors. The test now checks uniformity. Its initial log and exit record are retained separately. The complete numerical suite passes after that test correction.',
  hashes,followup:'031-worm-generator-followup.md',
  remaining:complete?[]:['Finish build, numerical/browser regression and final visual inspection against this integrated state.']};
await writeFile(directory+'064-reconstruction.json',JSON.stringify(record,null,2)+'\n');
const gallery=directory+'index.html',existing=await readFile(gallery,'utf8'),marker='<div class="grid">';
if(!existing.includes(marker))throw new Error('Review gallery marker is absent');
const files=(await readdir(directory)).filter(file=>/^\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(file)).sort();
await writeFile(gallery,existing.slice(0,existing.indexOf(marker)+marker.length)+'\n'+files.map(file=>`<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n')+'\n</div></html>\n');
console.log({status:record.status,mechanics,numericalPassed,browserPassed,comparisons:files.length});
