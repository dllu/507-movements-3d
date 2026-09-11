import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory='artifacts/review/',json=async name=>JSON.parse(await readFile(directory+name+'.json','utf8'));
const optional=async name=>{try{return await json(name);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const pass=e=>e?.code===0&&e.signal===null;
const hashes=await json('070-verification-source-hashes');
for(const[file,sha]of Object.entries(hashes))if(await digest(file)!==sha)throw new Error('Verification source changed: '+file);
const record=await json('070-reconstruction'),candidate=await json('070-refined-candidate-captures'),inspection=await json('070-capture-inspection');
for(const frame of [...candidate.captures,...(await json('070-integrated-captures')).captures])
  if(!frame.inspected||await digest(frame.file)!==frame.sha256)throw new Error('Changed or uninspected capture');
for(const frame of [...record.baselineCaptures,...inspection.frames,...inspection.uiFrames])
  if(!frame.inspected||await digest(directory+frame.file)!==frame.sha256)throw new Error('Changed or uninspected frame: '+frame.file);
const names=['exact-analytic-motion','refined-hardware','refined-locking','refined-solids','refined-contact-cones','refined-source-fit',
  'refined-candidate-capture','integration','integration-equivalence','integrated-source-capture','display-profile'];
const exits=Object.fromEntries(await Promise.all(names.map(async name=>[name,await json('070-'+name+'-exit-status')])));
const analytic=await json('070-exact-analytic-motion'),hardware=await json('070-refined-hardware'),locking=await json('070-refined-locking');
const forces=await json('070-refined-contact-cones'),solids=await json('070-refined-solids'),source=await json('070-refined-source-fit');
const equivalence=await json('070-integrated-candidate-equivalence');
const mechanics=Object.values(exits).every(pass)&&analytic.failed===0&&analytic.poses===10022&&analytic.maxProjectionError<2e-7
  &&hardware.poses===117&&hardware.pairs.length===65&&hardware.checks===452216700&&hardware.inside===0
  &&locking.poses===20&&locking.issues.length===0&&locking.rows.every(r=>!r.allowed.inside&&r.blocked.inside>0)
  &&forces.activePoses===189&&!forces.failedDrive&&forces.lockingPoses===20&&!forces.failedLock
  &&solids.rows.length===18&&!solids.issues.length&&equivalence.exact&&equivalence.registryChecked&&equivalence.maximumMatrixError===0;
const focused=await json('070-focused-tests-exit-status'),numerical=await optional('070-numerical-exit-status');
const build=await optional('070-build-exit-status'),browser=await optional('070-browser-tests-exit-status');
const focusedPassed=pass(focused)&&/^# pass 8$/m.test(await readFile(directory+'070-focused-tests.log','utf8'));
const numericalPassed=pass(numerical)&&/^# pass 3042$/m.test(await readFile(directory+'070-numerical.log','utf8'));
const browserPassed=pass(browser)&&/\b30 passed\b/.test(await readFile(directory+'070-browser-tests.log','utf8'));
const inspected=inspection.frames.length===10&&inspection.frames.every(f=>f.inspected)&&inspection.uiFrames.length===2&&inspection.uiFrames.every(f=>f.inspected);
const complete=mechanics&&focusedPassed&&numericalPassed&&pass(build)&&browserPassed&&inspected;
record.status=complete?'rebuilt-and-verified':'integrated-validation-in-progress';record.productionChanged=true;record.mechanicsPassed=mechanics;
record.verificationHashes='070-verification-source-hashes.json';record.verifiedFileCount=Object.keys(hashes).length;
record.inspection=inspection;record.candidateInspection=candidate;
record.source.interpretation='One stud sits inside the rim during dwell; adjacent studs bear on the outside. The solid driver circumference is the rim exterior and cover diameter; the dotted circumference is its inner edge. This interpretation nearly reproduces Brown shaft spacing without a large profile alteration.';
record.reconstruction={factory:'src/simulation/open-rim-tappet.js',motion:'src/simulation/open-rim-tappet-motion.js',profile:'src/data/open-rim-tappet-profile.js',
  solids:18,studCount:10,parameters:analytic.parameters,stages:analytic.stages,
  physicalModel:'Loaded quasistatic contact with ideal fixed bearings. Passive bearing resistance holds the short interval between tappet release and rim closure. Engagement impacts are idealized; finite-inertia impacts and unloaded coasting are not certified.',
  sectionView:'The normal source view retains the front cover. Section view hides that cover to expose the actual rim, tappet and studs; it does not alter motion or clearance auditing.'};
record.sourceComparison={report:'070-refined-source-fit.json',samples:source.samples,anchor:source.anchor,scale:source.scale,
  adjustments:source.adjustments,groups:source.groups.map(({rows,...g})=>g),qualification:source.method,overlay:'070-refined-source-overlay.png'};
record.correctedMechanics={
  analytic:{report:'070-exact-analytic-motion.json',poses:analytic.poses,failed:analytic.failed,maxProjectionError:analytic.maxProjectionError,maximumSpeed:analytic.maximumSpeed},
  hardware:{report:'070-refined-hardware.json',poses:hardware.poses,pairs:hardware.pairs.length,checks:hardware.checks,inside:hardware.inside,penetrationTolerance:1e-6},
  locking:{report:'070-refined-locking.json',poses:locking.poses,checks:locking.checks,issues:locking.issues.length,fullAngularPlay:locking.fullAngularPlay,overtravel:locking.overtravel,
    qualification:'Allowed seats clear; intentionally prohibited overtravel must penetrate to establish the stop.'},
  forces:{report:'070-refined-contact-cones.json',activePoses:forces.activePoses,failedDrive:forces.failedDrive,lockingPoses:forces.lockingPoses,failedLock:forces.failedLock,
    gapTolerance:forces.gapTolerance,angleTolerance:forces.angleTolerance,powerTolerance:forces.powerTolerance},
  solids:{report:'070-refined-solids.json',count:solids.rows.length,issues:solids.issues.length},equivalence:'070-integrated-candidate-equivalence.json',exits};
record.profileStudies=[];
for(const name of ['source-tappet-trials','interior-stud-trials','source-ring-trials','source-ring-refinement'])
  record.profileStudies.push({report:'070-'+name+'.json',exit:await json('070-'+name+'-exit-status'),qualification:'A completed diagnostic is not mechanical acceptance. Earlier unsuccessful or partial trajectories are retained in the report.'});
record.preservedFailures=[{report:'070-candidate-1024-studs.json',reason:'The first complete 3D candidate passed topology and clearance, but twelve late-stroke force cases failed. Increasing stud angular resolution from 1024 to 4096 resolved the contact-normal error with unchanged dimensions, motion and tolerances.'}];
record.animationTiming={...equivalence.animationTiming,mainStrokeDisplaySeconds:equivalence.mainStrokeDisplaySeconds,
  internalPauseDisplaySeconds:equivalence.internalPauseDisplaySeconds,closingStrokeDisplaySeconds:equivalence.closingStrokeDisplaySeconds};
record.regression={focused:{passed:focusedPassed?8:null,exit:focused},numerical:{passed:numericalPassed?3042:null,exit:numerical},
  build:{exit:build},browser:{passed:browserPassed?30:null,exit:browser}};
record.remaining=complete?[]:['Complete browser regression and inspect/hash desktop and mobile evidence.'];
await writeFile(directory+'070-reconstruction.json',JSON.stringify(record,null,2)+'\n');
const existing=await readFile(directory+'index.html','utf8'),marker='<div class="grid">';
if(!existing.includes(marker))throw new Error('Missing gallery marker');
const files=(await readdir(directory)).filter(file=>/^(?:\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+|070-integrated-(?:source|section|oblique|rear|entry|first-corner|tip-side|release|rim-entry|locked))\.png$/.test(file)).sort();
await writeFile(directory+'index.html',existing.slice(0,existing.indexOf(marker)+marker.length)+'\n'+files.map(file=>`<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n')+'\n</div></html>\n');
console.log({status:record.status,mechanics,focusedPassed,numericalPassed,browserPassed,inspected,comparisons:files.length});
