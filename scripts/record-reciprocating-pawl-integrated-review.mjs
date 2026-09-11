import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='artifacts/review/',json=async name=>JSON.parse(await readFile(base+name+'.json','utf8')),
  hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const frozen=await json('075-verification-source-hashes');
for(const[file,expected]of Object.entries(frozen))if(await hash(file)!==expected)throw new Error('Frozen source changed: '+file);
const topology=await json('075-clean-candidate-topology'),surfaces=await json('075-clean-candidate-solids'),
  contact=await json('075-clean-candidate-contact-gaps'),parity=await json('075-production-parity'),
  fit=await json('075-contact-fit-study'),captures=await json('075-integrated-captures');
if(topology.issues.length||surfaces.inside||surfaces.forces.failures.length||contact.failures.length||contact.maximumGap>1e-6
  ||contact.minimumReaction<0||contact.minimumDissipation<0||parity.issues.length||parity.matrixError||parity.stateError)
  throw new Error('Mechanical acceptance failed');
for(const proof of [topology,contact])if(proof.source.sha256!==await hash(base+'075-clean-candidate-source.txt'))
  throw new Error('Audited candidate archive changed');
if(captures.captures.length!==13||Object.values(captures.checks).some(x=>x!==true))throw new Error('Integrated views failed');
for(const frame of captures.captures)if(!frame.inspected||await hash(frame.file)!==frame.sha256)throw new Error('Uninspected or changed frame');
const exits={};
for(const name of ['clean-candidate-topology','clean-candidate-solids','clean-candidate-contact-gaps','production-parity',
  'focused-tests','display-measurement','numerical','build','integrated-capture','browser-tests']){
  exits[name]=await json('075-'+name+'-exit-status');if(exits[name].code!==0||exits[name].signal!==null)throw new Error('Failed check: '+name);
}
for(const[name,count]of [['focused-tests',7],['numerical',3062]]){
  const log=await readFile(base+'075-'+name+'.log','utf8');
  if(!new RegExp('^# pass '+count+'$','m').test(log)||!/^# fail 0$/m.test(log))throw new Error('Incomplete numerical check');
}
if(!/\b31 passed\b/.test(await readFile(base+'075-browser-tests.log','utf8')))throw new Error('Incomplete browser check');
const prior=await json('075-prior-browser-evidence/manifest'),regression=await json('075-browser-regression-captures/manifest');
if(!regression.priorEvidenceRestored||regression.rows.length!==18)throw new Error('Historical screenshots not restored');
for(const frame of prior.frames)if(await hash(base+frame.file)!==frame.sha256)throw new Error('Historical evidence changed');
const reports={};
for(const name of ['075-reviewed-source-tips','075-contact-fit-study','075-dense-friction-contact-study','075-clean-candidate-topology',
  '075-clean-candidate-solids','075-clean-candidate-contact-gaps','075-production-parity','075-integrated-captures'])
  reports[name+'.json']=await hash(base+name+'.json');
const sources=[];
for(const file of ['scripts/lib/reciprocating-pawl-contact-study.mjs','scripts/lib/reciprocating-pawl-friction-study.mjs',
  'scripts/lib/reciprocating-pawl-candidate.mjs','scripts/export-reciprocating-pawl-profile.mjs','scripts/export-reciprocating-pawl-motion.mjs',
  'scripts/probe-reciprocating-pawl-topology.mjs','scripts/probe-reciprocating-pawl-candidate.mjs',
  'scripts/probe-reciprocating-pawl-contact-gaps.mjs','scripts/probe-reciprocating-pawl-production-parity.mjs',
  'scripts/capture-reciprocating-pawl-integrated.mjs','scripts/record-reciprocating-pawl-integrated-review.mjs']){
  const archive=base+'075-integrated-review-source-'+sources.length+'.txt';await writeFile(archive,await readFile(file),{flag:'wx'});
  sources.push({file,archive,sha256:await hash(file)});
}
const fitted=fit.rows.find(x=>x.teeth===34),report={movement:75,status:'rebuilt-and-verified',productionChanged:true,
  verifiedFiles:Object.keys(frozen).length,verificationHashes:'075-verification-source-hashes.json',
  geometry:{parts:14,parameters:surfaces.parameters,sourceFit:{tipRms:fitted.tipRms,tipMaximum:fitted.tipMaximum,
    noseErrorB:fitted.noseErrorB,noseErrorH:fitted.noseErrorH,qualification:fit.qualification}},
  mechanics:{hardwarePoses:surfaces.poses,hardwareChecks:surfaces.checks,hardwareInside:surfaces.inside,
    forcePoses:surfaces.forces.poses,forceLoadRange:[surfaces.forces.low,surfaces.forces.high],mu:.2,load:2.2,
    finiteContactPoses:contact.poses,finiteContactChecks:contact.checks,maximumContactGap:contact.maximumGap,
    maximumForceResidual:contact.maximumResidual,minimumReaction:contact.minimumReaction,minimumDissipation:contact.minimumDissipation},
  parity:{parts:parity.parts,buffers:parity.buffers.length,poses:parity.poses,matrixError:parity.matrixError,stateError:parity.stateError},
  timing:{...captures.timing,maximumSampledPawlSpeed:contact.maximumPawlSpeed,maximumSampledRodSpeed:contact.maximumRodSpeed},
  physicalModel:'Regularized 34-tooth ratchet, two gravity-loaded pawls, finite radial slot and bored joints. Quasistatic contact uses Coulomb coefficient 0.2 and steady opposing torque 2.2 with moving-pawl mass normalized to one. No inertia is included. Finite clearance checks are sampled, not a continuous mathematical certificate.',
  views:captures.captures,checks:captures.checks,reports,sources,exits,
  regression:{focused:7,numerical:3062,browser:31,all507Rendered:true},
  preservedFailures:[
    {report:'075-initial-contact-force-study.json',reason:'Frictionless initial geometry has no feasible constant loaded equilibrium.'},
    {report:'075-face-angle-force-study.json',reason:'Frictionless tooth-face and root-radius trials fail full-cycle equilibrium or lose the intended seat.'},
    {report:'075-initial-candidate-captures.json',reason:'First finite holding-pawl body leaves a detached tip island.'},
    {report:'075-connected-candidate-topology.json',reason:'Two near-zero-area Float32 cap triangles remain at the moving nose join.'},
    {report:'075-clean-candidate-captures.json',reason:'Its source-aligned frame was overwritten by the engine render callback. Corrected in 075-aligned-candidate-captures.json and integrated captures.'}
  ],remaining:[]};
await writeFile(base+'075-integrated-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const reconstruction=await json('075-reconstruction');Object.assign(reconstruction,{status:report.status,productionChanged:true,mechanicsPassed:true,
  integration:'075-integrated-checkpoint.json',verificationHashes:report.verificationHashes,remaining:[]});delete reconstruction.integrationPending;
await writeFile(base+'075-reconstruction.json',JSON.stringify(reconstruction,null,2)+'\n');
const gallery=base+'index.html',html=await readFile(gallery,'utf8'),marker='<div class="grid">';
if(!html.includes(marker))throw new Error('Review gallery marker missing');
if(!html.includes('075-integrated-source.png'))await writeFile(gallery,html.replace(marker,marker+'\n'+captures.captures.map(({file})=>{
  const name=file.split('/').at(-1);return `<a href="${name}"><img src="${name}" loading="lazy" alt="${name}"><span>${name}</span></a>`;
}).join('\n')));
console.log({status:report.status,files:report.verifiedFiles,views:report.views.length,regression:report.regression});
