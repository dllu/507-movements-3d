import{readFile,writeFile,readdir}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),read=async name=>JSON.parse(await readFile('artifacts/review/'+name,'utf8')),
  frozen=await read('075-verification-source-hashes.json'),mismatches=[];let matched=0;
for(const[file,expected]of Object.entries(frozen)){if(hash(await readFile(file))===expected)matched++;else mismatches.push(file);}
if(mismatches.length)throw new Error('Frozen production changed: '+mismatches.join(','));
const names=['076-coaxial-rim-fit.json','076-tracked-holding-seat-study.json','076-compatible-holding-drive-study.json',
 '076-compatible-holding-drive-expanded.json','076-positive-face-drive-direction-diagnostic.json','076-initial-candidate-topology.json',
 '076-initial-finite-masses.json','076-positive-face-candidate-topology.json','076-finite-candidate-captures.json','076-initial-dynamics-study.json',
 '076-dynamics-formula-check.json','076-dynamics-nose-range.json','076-directed-seats-study.json','076-directed-holding-range.json',
 '076-directed-slow-dynamics.json','076-directed-smooth-candidate-topology.json','076-directed-smooth-formula-check.json',
 '076-directed-smooth-candidate-captures.json','076-bearing-damping-range.json','076-tappet-damping-range.json',
 '076-directed-three-cycle-dynamics.json','076-directed-load-range.json','076-directed-candidate-surfaces.json',
 '076-directed-quarter-step-dynamics.json','076-dynamic-candidate-captures.json','076-directed-step-convergence.json',
 '076-refined-step-convergence.json','076-directed-dense-first-count.json','076-refined-dense-first-count.json','076-spatial-step-resolution.json'];
const artifacts=[];for(const name of names){const bytes=await readFile('artifacts/review/'+name);artifacts.push({file:name,sha256:hash(bytes),bytes:bytes.length});}
const exits={};for(const file of await readdir('artifacts/review'))if(file.startsWith('076-')&&file.endsWith('-exit-status.json')){const record=await read(file);if(record.started>='2026-09-11T09:10:00Z')exits[file]=record;}
const sources=[];for(const dir of ['scripts','scripts/lib'])for(const file of await readdir(dir))if(file.endsWith('.mjs')&&(/jointed-tappet|finite-plate-study|extruded-section-caps/.test(file))){
 const path=dir+'/'+file,bytes=await readFile(path),archive='artifacts/review/076-finite-checkpoint-source-'+sources.length+'.txt';await writeFile(archive,bytes,{flag:'wx'});sources.push({source:path,archive,sha256:hash(bytes)});
}
const candidate=makeJointedTappetCandidate(),u=candidate.root.userData,p=u.geometry,tipStudy=await read('076-source-tooth-study.json'),tipErrors=tipStudy.tips.map((point,i)=>{
 const angle=p.wheelStart+p.faceAngle-i*p.pitch,predicted=[p.center[0]+p.scale*Math.cos(angle),p.center[1]-p.scale*Math.sin(angle)];return{source:point,predicted,error:Math.hypot(point[0]-predicted[0],point[1]-predicted[1])};
}),holdingPixels=[p.center[0]+p.scale*(p.PH[0]+p.holdingNose[0]),p.center[1]-p.scale*(p.PH[1]+p.holdingNose[1])],
 topology=await read('076-directed-smooth-candidate-topology.json'),formula=await read('076-directed-smooth-formula-check.json'),surfaces=await read('076-directed-candidate-surfaces.json'),dynamics=await read('076-directed-three-cycle-dynamics.json'),loads=await read('076-directed-load-range.json'),resolution=await read('076-spatial-step-resolution.json');
const captures=[];for(const file of ['076-directed-smooth-candidate-captures.json','076-dynamic-candidate-captures.json']){
 const m=await read(file);for(const c of m.captures){if(!c.inspected||hash(await readFile(c.file))!==c.sha256)throw new Error('Uninspected or changed image');captures.push({file:c.file,sha256:c.sha256,inspected:true});}
}
const report={movement:76,status:'finite-contact-candidate-under-verification',productionChanged:false,mechanicsPassed:false,created:new Date().toISOString(),
 prior:{file:'076-tracked-contact-checkpoint.json',sha256:hash(await readFile('artifacts/review/076-tracked-contact-checkpoint.json'))},productionUnchangedFiles:matched,
 geometry:{...p,holdingSourcePixels:holdingPixels,holdingDisplacementFromOriginal:Math.hypot(holdingPixels[0]-173,holdingPixels[1]-352),
  dogDisplacementFromProvisional:Math.hypot(p.nosePixels[0]-805,p.nosePixels[1]-711),sourcePoseTipFit:{rms:Math.sqrt(tipErrors.reduce((s,r)=>s+r.error*r.error,0)/tipErrors.length),maximum:Math.max(...tipErrors.map(r=>r.error)),rows:tipErrors}},
 topology:{parts:topology.rows.length,issues:topology.issues},formula:{passed:formula.passed,counts:formula.counts,errors:formula.errors},
 surfaces:{passed:surfaces.passed,poses:surfaces.poses,pairs:surfaces.pairCount,checks:surfaces.checks,inside:surfaces.inside},
 dynamics:{period:dynamics.parameters.period,load:dynamics.parameters.load,damping:dynamics.parameters.damping,steps:dynamics.steps,finalTime:dynamics.final.time,finalTeeth:dynamics.finalTeeth,failures:dynamics.failures.length,maximumResidual:dynamics.maximumResidual,minimumGap:dynamics.minimumGap},
 loads:loads.rows.map(r=>({load:r.parameters.load,finalTeeth:r.finalTeeth,final:r.final,stop:r.stop})),
 stepResolution:{passed:resolution.passed,selectedStep:resolution.selectedStep,maximumSourcePixelBound:resolution.maximumSourcePixelBound,stateDifferenceRatio:resolution.stateDifferenceRatio,energyRatios:resolution.energyRatios,
  priorComponentwiseConvergenceChecks:'Both remain failed and are preserved. The separate spatial assessment uses observed maximum-state and body-displacement differences at successive finest steps.'},
 artifacts,exits,sources,captures,
 remaining:['Build compact initial and periodic playback trajectories from the finest raw dynamics; preserve true impacts and rest stops.',
  'Check interpolation contact gaps and all twenty tooth orientations, then audit the final rendered surfaces through motion.',
  'Review the actual regularized tooth fit and choose readable default playback speed.',
  'Integrate the replacement and independent tests, verify production parity, then complete focused, numerical, build and browser regressions.'],
 qualification:'The isolated candidate has finite-body, formula, sampled-contact, repeated-count and load-range evidence. Bearing damping and resisting load are specified reconstruction assumptions. The source pose is a released initial state; repeated rest is q=0.30. This checkpoint is not production acceptance or continuous interpolation certification.'};
await writeFile('artifacts/review/076-finite-dynamics-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const reconstruction=await read('076-reconstruction.json');reconstruction.contactCheckpoint='076-finite-dynamics-checkpoint.json';reconstruction.remaining=report.remaining;reconstruction.productionUnchangedFiles=matched;reconstruction.sourceGeometry.currentCandidate={rootRadius:p.rootRadius,faceAngle:p.faceAngle,nosePixels:p.nosePixels,holdingNosePixels:p.holdingNosePixels,holdingSourcePixels:holdingPixels,sourcePoseTipFit:report.geometry.sourcePoseTipFit};
reconstruction.sourceGeometry.qualification='The current finite candidate uses the shared source-hub axis with independently refitted rim radii. Twenty tips are paired in order. Pawl endpoints remain reconstruction choices near partly obscured source contours; their displacement and current regularized tooth error are recorded in the finite checkpoint.';
await writeFile('artifacts/review/076-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({status:report.status,productionUnchangedFiles:matched,artifacts:artifacts.length,sources:sources.length,exits:Object.keys(exits).length,captures:captures.length,
 sourceTipRms:report.geometry.sourcePoseTipFit.rms,sourceTipMaximum:report.geometry.sourcePoseTipFit.maximum,holdingSourceDisplacement:report.geometry.holdingDisplacementFromOriginal,surfaces:report.surfaces,stepResolution:report.stepResolution});
