import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base='artifacts/review/',json=async file=>JSON.parse(await readFile(base+file,'utf8')),
  hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const production=await json('072-verification-source-hashes.json'),mismatches=[];
for(const [file,expected]of Object.entries(production))if(await hash(file)!==expected)mismatches.push(file);
if(mismatches.length)throw new Error('Production snapshot changed: '+mismatches.join(', '));
const views=[];
for(const file of ['074-initial-candidate-captures.json','074-contact-candidate-captures.json','074-fitted-candidate-captures.json']){
  const report=await json(file);
  for(const capture of report.captures){
    if(await hash(capture.file)!==capture.sha256)throw new Error('Inspected capture changed: '+capture.file);
    capture.inspected=true;views.push(capture);
  }
  await writeFile(base+file,JSON.stringify(report,null,2)+'\n');
}
for(const name of ['074-source-left-rim-strip.png','074-source-driver-rim-strip.png','074-source-pitch-markers.png','074-source-rim-fit.png','074-selected-rim-fit.png'])
  views.push({file:base+name,sha256:await hash(base+name),inspected:true,qualification:'Source measurement diagram or crop; not mechanical acceptance.'});
const files=[
  'scripts/lib/mutilated-bevel-candidate.mjs','scripts/lib/mutilated-bevel-tooth-relief.mjs','scripts/lib/bevel-working-surfaces.mjs',
  'scripts/lib/bevel-angular-overlap.mjs','scripts/probe-mutilated-bevel-timing.mjs','scripts/study-mutilated-bevel-relief.mjs',
  'scripts/probe-mutilated-bevel-contact.mjs','scripts/probe-mutilated-bevel-loaded-phase.mjs','scripts/study-mutilated-bevel-contact-motion.mjs',
  'scripts/probe-mutilated-bevel-solids.mjs','scripts/study-mutilated-bevel-source-pitch.mjs','scripts/fit-mutilated-bevel-rims.mjs',
  'scripts/probe-mutilated-bevel-contact-forces.mjs','scripts/probe-mutilated-bevel-candidate-hardware.mjs',
  'scripts/capture-mutilated-bevel-candidate.mjs','scripts/capture-mutilated-bevel-contact-candidate.mjs',
  'scripts/record-mutilated-bevel-candidate-review.mjs'];
const sources=[];
for(const file of files){const archive=base+'074-candidate-checkpoint-source-'+sources.length+'.txt';
  await writeFile(archive,await readFile(file),{flag:'wx'});sources.push({file,archive,sha256:await hash(file)});}
const checks=[];
for(const file of (await readdir(base)).filter(n=>n.startsWith('074-')&&n.endsWith('-exit-status.json')))
  checks.push({file,sha256:await hash(base+file),exit:await json(file)});
const motion=await json('074-fitted-contact-motion-1440.json'),solids=await json('074-fitted-relieved-solids.json'),
  hardware=await json('074-fitted-hardware.json'),forces=await json('074-fitted-contact-forces.json'),rim=await json('074-source-rim-fit.json');
if(motion.failure||motion.rows.length!==4321||solids.issues.length||solids.detached.length||hardware.inside||forces.issues.length)
  throw new Error('Candidate diagnostic requirements are incomplete');
const reports=[];
for(const file of ['074-source-pitch-study.json','074-source-rim-fit.json','074-fitted-candidate-parameters.json',
  '074-fitted-continuous-relief.json','074-fitted-contact-motion-1440.json','074-fitted-relieved-solids.json','074-fitted-hardware.json','074-fitted-contact-forces.json'])
  reports.push({file,sha256:await hash(base+file)});
const fit=rim.fits.find(r=>r.driverTeeth===40&&r.mode==='separate');
const record={movement:74,status:'fitted-contact-candidate-runtime-pending',productionChanged:false,
  productionSnapshot:{file:'072-verification-source-hashes.json',verifiedFiles:Object.keys(production).length,mismatches},
  parameters:motion.parameters,sources,checks,reports,views,
  sourceFit:{report:'074-source-rim-fit.json',landmarks:fit.rows.length,rms:fit.rms,maximumError:fit.maximumError,
    counts:'32 output / 40 full driver count is a reconstruction choice. Local ink spacing best fits approximately 32/36, while full rim proportions prefer a larger driver. The caption supplies no counts or ratio.',
    comparison:'The 42/32 option has lower landmark RMS but worse visible driver-pitch agreement. The retained 40/32 option balances both readings. Conical tooth ends and end-tooth relief remain physical departures from simplified engraving lines.'},
  mechanics:{motionPoses:motion.rows.length,cycles:motion.cycles,stepsPerCycle:motion.steps,repeatError:motion.finalCycleRepeatError,
    peakRatio:motion.peakRatio,releaseExtrema:motion.releaseExtrema.filter(r=>r.coordinate>2.25),
    solids:solids.rows.length,uniqueGeometries:solids.uniqueGeometries,commonSphere:solids.commonSphere,
    hardwarePoses:hardware.poses,hardwareChecks:hardware.checks,penetratingSamples:hardware.inside,minimumSampledGap:hardware.minimumGap,
    forcePoses:forces.rows.length,maximumContactDistance:forces.maximumSkinDistance,maximumRatioError:forces.maximumRatioError,
    minimumDrivingMoment:forces.minimumDrivingMoment},
  preservedFailures:[
    {file:'074-initial-relief-study.log',reason:'Repeated nearly coincident Boolean cuts failed ring assembly; chart quantization corrected the numerical failure.'},
    {file:'074-snapped-relief-study.json',reason:'Relieving one end tooth left adjacent-tooth collisions.'},
    {file:'074-two-end-teeth-relief-study.json',reason:'Sampled cuts left collisions between cut samples.'},
    {file:'074-contact-motion-study.json',reason:'Expanding the root bracket skipped a narrow clear interval and falsely lost the contact branch.'},
    {file:'074-relieved-solids.json',reason:'Tiny Boolean edges collapsed after Float32 conversion. The cleaned polygon is now shared by the rendered mesh and contact solver.'},
    {file:'074-contact-forces.json',reason:'Input-step sampling missed a local release maximum and returned a receding contact boundary.'},
    {file:'074-release-refined-contact-forces.json',reason:'Coarse interior maximum sampling still missed a peak close to the input-step endpoint.'}],
  remaining:[
    'Build a deterministic runtime contact law or adaptively checked interpolation, including the small release extrema and arbitrary seek times.',
    'Verify between-knot contact, clearance and motion-step convergence against the final runtime law.',
    'Integrate the factory, correction notes, timing and meaningful tests only after runtime acceptance.',
    'Run focused tests, the complete numerical suite, build and one-worker browser suite against the final production snapshot; inspect final UI and playback.'],
  qualification:'The isolated reconstruction has source measurements, inspected 3D views and an overlay, a closed Float32 boundary, three-cycle contact continuation, sampled compressive-force checks and sampled complete hardware clearance. Ideal bearing friction holds an unforced output during dwell; no positive lock or inertial dynamics is claimed. This is not production or continuous-time acceptance.'};
await writeFile(base+'074-candidate-checkpoint.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
const reconstruction=await json('074-reconstruction.json');
reconstruction.status=record.status;reconstruction.candidate={report:'074-candidate-checkpoint.json',status:record.status,productionChanged:false};
reconstruction.source.teeth=record.sourceFit.counts;reconstruction.remaining=record.remaining;
await writeFile(base+'074-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({status:record.status,productionFiles:Object.keys(production).length,views:views.length,sources:sources.length,checks:checks.length,mechanics:record.mechanics});
