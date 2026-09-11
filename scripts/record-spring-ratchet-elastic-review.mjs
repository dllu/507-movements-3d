import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base='artifacts/review/',json=async file=>JSON.parse(await readFile(base+file,'utf8'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const production=await json('072-verification-source-hashes.json'),mismatches=[];
for(const [file,expected]of Object.entries(production))if(await hash(file)!==expected)mismatches.push(file);
if(mismatches.length)throw new Error('Production snapshot changed: '+mismatches.join(', '));
const studies=[];
for(const name of (await readdir(base)).filter(name=>/^073-.*study\.json$/.test(name))){
  const data=await json(name);if(data.status!=='isolated-elastic-driven-study')continue;
  const last=data.rows.at(-1);
  studies.push({file:name,sha256:await hash(base+name),parameters:data.parameters,
    poses:data.rows.length,requestedSteps:data.steps,failureStep:data.failure?.step??null,
    lastInput:last?.input,lastOutput:last?.q,maximumPenetration:last?.maximumPenetration,
    maximumGradient:last?.maximumGradient,fullCycleCompleted:!data.failure&&data.rows.length===data.steps+1});
}
const views=[];
for(const name of ['073-clamped-elastic-driven-study','073-refined-elastic-driven-study',
  '073-multiple-tooth-contacts-12-study','073-full-memory-elastic-study','073-fitted-taper-study']){
  const file=base+name+'-views.png';views.push({file,sha256:await hash(file),inspected:true,
    qualification:'Inspected planar diagnostic diagram; not 3D hardware or rendered-clearance acceptance.'});
}
const sources=[];
for(const file of ['scripts/lib/spring-pressed-ratchet-source.mjs','scripts/lib/spring-pressed-ratchet-elastic.mjs',
  'scripts/lib/ratchet-feature-distance.mjs','scripts/lib/tapered-spring-contact.mjs',
  'scripts/lib/elastic-ratchet-minimizer.mjs','scripts/lib/refine-elastic-equilibrium.mjs','scripts/probe-spring-ratchet-driving.mjs',
  'scripts/probe-ratchet-feature-gradients.mjs','scripts/probe-tapered-spring-contact.mjs',
  'scripts/fit-strong-spring-taper.mjs','scripts/probe-spring-ratchet-release-holding.mjs',
  'scripts/render-spring-ratchet-elastic-study.mjs','scripts/record-spring-ratchet-elastic-review.mjs']){
  const archive=base+'073-elastic-checkpoint-source-'+sources.length+'.txt';
  await writeFile(archive,await readFile(file),{flag:'wx'});sources.push({file,archive,sha256:await hash(file)});
}
const holding=await json('073-release-holding-polished-check.json'),holdingExit=await json('073-release-holding-polished-check-exit-status.json');
if(holdingExit.code!==0)throw new Error('Release diagnosis has not passed');
const checks=[];
for(const name of ['073-multiple-feature-gradients','073-tapered-contact-check','073-linear-taper-fit','073-release-holding-polished-check'])
  checks.push({file:name+'.json',sha256:await hash(base+name+'.json'),exit:await json(name+'-exit-status.json')});
const record={movement:73,status:'elastic-study-layout-unresolved',productionChanged:false,
  verifiedProductionFiles:Object.keys(production).length,verifiedProductionSnapshot:'072-verification-source-hashes.json',
  sources,studies,views,checks,
  cancelledComparisons:['073-superseded-solver-cancellations.json','073-superseded-taper-cancellations.json'],
  preservedFailedChecks:['073-release-holding-check.json','073-release-holding-refined-check.json'],
  correctedNumerics:['Clamp C at the source support top.',
    'Verify equilibrium after each multiplier update.',
    'Resolve both arc and face contacts in a tooth seat.',
    'Use continuous tapered-segment clearance with endpoint reactions.',
    'Report floating-point line-search stagnation instead of exhausting the iteration budget.'],
  findings:holding.rows.map(r=>({source:r.source,input:r.input,strongStiffness:r.parameters.strongStiffness,
    maximumBeamGradient:r.maximumBeamGradient,maximumPenetration:r.maximumPenetration,
    tipClearanceBeyondWheelCircumcircle:r.tipClearanceBeyondWheelCircumcircle,wheelGradient:r.wheelGradient})),
  qualification:'The fitted source-based planar leaves with wheel-contact tabs lose all wheel restraint on the selected equilibrium branch near release. Holding the wheel externally is only a diagnostic. No complete 3D candidate, dynamics, runtime or production replacement is accepted. A 3D arrangement that permits the catch spring to pass beneath C while C recovers its stop contact remains unresolved.'};
await writeFile(base+'073-elastic-checkpoint.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
const reconstruction=await json('073-reconstruction.json');
reconstruction.status=record.status;
reconstruction.elasticStudy={report:'073-elastic-checkpoint.json',status:record.status,sourceFittedTaper:'073-linear-taper-fit.json',
  releaseDiagnosis:'073-release-holding-polished-check.json',productionChanged:false};
reconstruction.remaining=[
  'Resolve a physical 3D spring arrangement that presses B inward and lets C recover its stop contact before B releases.',
  'Verify full-cycle equilibrium/dynamics, release, holding, repeatability and energy balance.',
  'Construct and audit complete 3D hardware, source fit and actual rendered working surfaces.',
  'Integrate only after candidate acceptance, then run production regression.'
];
await writeFile(base+'073-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({studies:studies.length,views:views.length,checks:checks.length,productionFiles:Object.keys(production).length,findings:record.findings});
