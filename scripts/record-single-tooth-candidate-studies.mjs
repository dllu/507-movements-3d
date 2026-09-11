import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory='artifacts/review/';
const json=async name=>JSON.parse(await readFile(directory+name,'utf8'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const productionHashes=await json('067-verification-source-hashes.json');
for(const [file,expected] of Object.entries(productionHashes)) {
  if(await hash(file)!==expected)throw new Error(`Verified production source changed: ${file}`);
}
const captures=[];
for(const name of ['068-candidate-captures.json','068-source-candidate-captures.json','068-trimmed-candidate-captures.json']) {
  const record=await json(name);
  for(const row of record.captures) {
    if(!row.inspected||await hash(row.file)!==row.sha256)throw new Error(`Uninspected or changed capture: ${row.file}`);
  }
  captures.push({record:name,count:record.captures.length,review:record.review});
}
const files=await readdir(directory);
const trials=[];
for(const name of files.filter(f=>/^068-(?:constrained-(?:bounded|distance|relief)|trimmed-relief|distributed-relief|seated-relief|corner-projection)-[\d_]+\.json$/.test(f)).sort()) {
  const data=await json(name),exit=await json(name.replace('.json','-exit-status.json'));
  if(exit.code!==0||exit.signal!==null)throw new Error(`Incomplete diagnostic: ${name}`);
  trials.push({report:name,parameters:data.parameters,poses:data.poses,actualAdvance:data.actualAdvance,
    expectedAdvance:data.expectedAdvance,maximumStep:data.maximumStep,maximumSpeed:data.maximumSpeed,
    failed:data.failed,exit});
}
const contact=await json('068-source-envelope-contact.json');
const build=await json('068-isolated-tools-build-exit-status.json');
if(build.code!==0||build.signal!==null)throw new Error('Isolated tooling build failed');
const tools=['scripts/generate-single-tooth-envelope.mjs','scripts/generate-single-tooth-source-envelope.mjs',
  'scripts/lib/single-tooth-index-motion.mjs','scripts/lib/single-tooth-source-driver.mjs',
  'scripts/lib/single-tooth-envelope-profile.mjs','scripts/lib/single-tooth-source-envelope-profile.mjs',
  'scripts/lib/single-tooth-index-candidate.mjs','scripts/capture-single-tooth-index-candidate.mjs',
  'scripts/probe-single-tooth-envelope-contact.mjs','scripts/study-single-tooth-constrained-motion.mjs',
  'scripts/measure-single-tooth-source.mjs','scripts/record-single-tooth-candidate-studies.mjs',
  'scripts/generate-single-tooth-trimmed-profile.mjs','scripts/lib/single-tooth-trimmed-source-profile.mjs',
  'scripts/probe-single-tooth-trimmed-solids.mjs','scripts/probe-single-tooth-trimmed-hardware.mjs',
  'scripts/lib/single-tooth-star-solid.mjs','scripts/lib/single-tooth-corner-source-profile.mjs',
  'scripts/probe-single-tooth-contact-cones.mjs','package.json','package-lock.json'];
const currentToolSnapshot={};for(const file of tools)currentToolSnapshot[file]=await hash(file);
const report={movement:68,status:'candidate-contact-studies-in-progress',productionChanged:false,
  productionCheckpoint:'067-verification-source-hashes.json',productionHashesMatch:true,captures,
  roundHeadCandidate:{report:'068-envelope-candidate.json',disposition:'Rejected for source fidelity; force acceptance not claimed.'},
  tracedConstantRatioCandidate:{report:'068-source-envelope.json',sourceFit:'068-source-envelope-source-fit.json',
    poses:contact.poses,missingDriveCount:contact.missingDriveCount,maximumOverlapArea:contact.maximumOverlapArea,
    disposition:'Rejected for source fidelity and incomplete contact evidence. Edge-normal screening did not establish valid driving witnesses in 58 indexed poses. Corner normal cones were not checked; this is not proof that all 58 poses are mechanically impossible.'},
  trimmedCandidate:{profile:'068-trimmed-source-profile.json',sourceFit:await json('068-trimmed-source-source-fit.json'),
    refinement:await json('068-seated-refinement.json'),solids:await json('068-trimmed-solids.json'),
    hardware:await json('068-trimmed-hardware.json'),
    solidsExit:await json('068-trimmed-solids-exit-status.json'),hardwareExit:await json('068-trimmed-hardware-exit-status.json'),
    disposition:'Superseded one-direction motion table: the full solid audit found 62 penetrating samples despite an apparently permitted outline path. Geometry is retained for the corner-aware candidate.'},
  cornerAwareCandidate:{profile:'068-corner-source-profile.json',geometryEquivalence:await json('068-corner-geometry-equivalence.json'),
    refinement:await json('068-corner-refinement.json'),hardware:await json('068-corner-hardware.json'),
    hardwareExit:await json('068-corner-hardware-exit-status.json'),
    forceCones:await json('068-corner-contact-cones.json'),forceExit:await json('068-corner-contact-cones-exit-status.json'),
    disposition:'Not integrated. All nine moving-pair clearance checks pass and the refined peak speed converges. Three force/contact checks still fail: two at entry and one with a 1.956% power residual near low mechanical advantage. Resolve exact event timing and contact derivatives before acceptance; inertia and load assumptions must be stated explicitly.'},
  quasistaticTrials:trials,
  qualification:'All successful diagnostic exits mean the study finished, not mechanical acceptance. The bounded projection uses dense source-curve points against implicit U notches and locking circles; a permitted path is not full bidirectional Float32 solid, force, inertia or repeated-cycle certification. A source-traced relief bulge beyond the nominal rim was diagnosed separately. Distributed relief variants still require source-fit assessment.',
  jamWitness:'068-constrained-jam-witness.json',build,currentToolSnapshot,
  regression:'Production/data/tests remain identical to the verified 067 checkpoint (3019 numerical, 27 browser tests). Those suites were not repeated for isolated study scripts; a fresh build passes after adding the offline polygon Boolean dependency.'};
await writeFile(directory+'068-candidate-studies.json',JSON.stringify(report,null,2)+'\n');
const reconstruction=await json('068-reconstruction.json');
reconstruction.status='candidate-contact-studies-in-progress';
reconstruction.candidateStudies={report:'068-candidate-studies.json',inspectedCaptures:captures.reduce((n,r)=>n+r.count,0),
  completedQuasistaticTrials:trials.length,permittedPaths:trials.filter(t=>t.failed.length===0).map(t=>t.report),
  productionChanged:false,mechanicalAcceptance:false};
await writeFile(directory+'068-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
console.log({status:report.status,productionHashesMatch:true,inspectedCaptures:reconstruction.candidateStudies.inspectedCaptures,
  trials:trials.length,permittedPaths:reconstruction.candidateStudies.permittedPaths,buildCode:build.code});
