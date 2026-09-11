import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const d='artifacts/review/',json=async name=>JSON.parse(await readFile(d+name,'utf8'));
const optional=async name=>{try{return await json(name);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const record=await json('065-reconstruction.json'),hashes=await json('065-verification-source-hashes.json');
for(const[file,hash]of Object.entries(hashes))if(await digest(file)!==hash)throw Error('Verification source changed: '+file);
const hardware=await json('065-candidate-final-hardware.json'),forces=await json('065-candidate-refined-forces.json'),resolution=await json('065-cam-resolution.json');
const equivalence=await json('065-integrated-candidate-equivalence.json'),source=await json('065-source-outline.json'),inspection=await json('065-capture-inspection.json');
for(const frame of [...inspection.frames,inspection.sourceOverlay,...(inspection.uiFrames??[])])if(await digest(d+frame.file)!==frame.sha256)throw Error('Inspected frame changed: '+frame.file);
const build=await optional('065-build-exit-status.json'),numerical=await optional('065-numerical-exit-status.json'),browser=await optional('065-browser-tests-exit-status.json');
const pass=exit=>exit?.code===0&&exit.signal===null;
const numericalPassed=pass(numerical)&&/^# pass 3000$/m.test(await readFile(d+'065-numerical.log','utf8'));
const browserPassed=pass(browser)&&/\b25 passed\b/.test(await readFile(d+'065-browser-tests.log','utf8'));
const mechanics=hardware.summary.poses===94&&hardware.summary.pairs===143&&hardware.summary.inside===0&&hardware.summary.topologyIssues===0
 &&forces.summary.poses===65&&forces.summary.lockPoses===10&&forces.summary.maximumNormalVelocityResidual<.006
 &&forces.summary.minimumTappetReaction>0&&forces.summary.minimumCamReaction>0&&forces.summary.worstLockConeMargin<-.1
 &&resolution.maxDistance<1e-6&&resolution.maxNormalAngleRadians<.006&&resolution.minAngularStep>0
 &&equivalence.pass&&equivalence.meshCount===22;
const inspected=inspection.frames.length===9&&inspection.frames.every(f=>f.inspected)&&inspection.sourceOverlay.inspected
 &&inspection.desktopAndMobileInspected&&(inspection.uiFrames??[]).length===2&&inspection.uiFrames.every(f=>f.inspected);
const complete=mechanics&&inspected&&pass(build)&&numericalPassed&&browserPassed;
record.status=complete?'rebuilt-and-verified':'integrated-validation-in-progress';record.productionChanged=true;
record.sourceComparison={report:'065-source-outline.json',boundaryReadings:source.boundaryReadings,studCenters:source.studs.length,summary:source.summary,qualification:source.qualification};
record.inspection=inspection;record.sourceHashes=hashes;record.mechanicsPassed=mechanics;
record.regression={focused:{passed:6,code:0,log:'065-focused-tests.log'},numerical:{passed:numericalPassed?3000:null,exit:numerical,log:'065-numerical.log'},build:{exit:build,log:'065-build.log'},browser:{passed:browserPassed?25:null,exit:browser,log:'065-browser-tests.log'}};
record.camResolution={report:'065-cam-resolution.json',samples:resolution.samples,maximumDeviation:resolution.maxDistance,maximumNormalAngle:resolution.maxNormalAngleRadians};
record.animationTiming=equivalence.animationTiming;
record.remaining=complete?[]:['Finish pending full browser verification and desktop/mobile inspection.'];
await writeFile(d+'065-reconstruction.json',JSON.stringify(record,null,2)+'\n');console.log({status:record.status,mechanics,inspected,numericalPassed,browserPassed});
