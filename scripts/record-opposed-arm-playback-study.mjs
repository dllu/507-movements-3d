import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=name=>JSON.parse(fs.readFileSync('artifacts/review/'+name+'.json')),
 freeze=read('078-verification-source-hashes'),prior=read('079-loaded-study-checkpoint');
for(const [file,sha]of Object.entries(freeze))if(hash(fs.readFileSync(file))!==sha)throw Error('Verified production changed: '+file);
for(const s of [...prior.reports,...prior.archives])if(hash(fs.readFileSync(s.file))!==s.sha256)throw Error('Earlier evidence changed: '+s.file);
const names=['079-final-refinement','079-projected-finest-bounds','079-projected-secondary-bounds','079-projected-sampler','079-projected-fidelity','079-resolved-reactions'];
for(const name of names)if(!read(name).passed)throw Error('Required check failed: '+name);
const raw=read('079-load6-finest'),energy=read('079-finest-energy16'),steadyEnergy=read('079-finest-steady-energy'),surface=read('079-projected-surfaces'),
 profile=read('079-projected-finest-candidate'),bounds=read('079-projected-finest-bounds'),hardware=read('079-projected-secondary-bounds'),views=read('079-final-preview-inspections');
if(raw.failures.length||energy.issues.length||steadyEnergy.issues.length||surface.issues.length||views.views.some(v=>!v.inspected||!v.visualAccepted))throw Error('Incomplete candidate');
if(bounds.proofs.length!==profile.first.length+profile.steady.length-2||hardware.intervals!==bounds.proofs.length)throw Error('Incomplete playback bounds');
const sourceFiles=fs.readdirSync('scripts').filter(n=>n.includes('opposed-arm')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)
 .concat(fs.readdirSync('scripts/lib').filter(n=>n.includes('opposed-arm')&&n.endsWith('.mjs')).map(n=>'scripts/lib/'+n)),sources=[];
for(const file of sourceFiles){const bytes=fs.readFileSync(file),archive=`artifacts/review/079-playback-study-source-${sources.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});}
const files=fs.readdirSync('artifacts/review').filter(n=>n.startsWith('079-')).map(n=>'artifacts/review/'+n),
 reports=files.filter(f=>f.endsWith('.json')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 archives=files.filter(f=>f.endsWith('.txt')||f.endsWith('.mjs')).map(file=>({file,sha256:hash(fs.readFileSync(file))})),
 checkpoint={movement:79,status:'isolated-bounded-face-ratchet-ready',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,candidateReady:true,
 prior:'079-loaded-study-checkpoint.json',priorVerified:'078-integrated-checkpoint.json',frozenInputsMatched:Object.keys(freeze).length,
 playback:{file:'artifacts/review/079-projected-finest-candidate.json',sha256:hash(fs.readFileSync('artifacts/review/079-projected-finest-candidate.json')),
  firstKnots:profile.first.length,steadyKnots:profile.steady.length,physicalPeriod:8,displayPeriod:4,teethPerCycle:4,projections:bounds.projections},
 dynamics:{states:raw.rows.length,dt:raw.dt,duration:raw.duration,minimumGap:raw.minimumGap,energy:energy.summary,steady:steadyEnergy.summary},
 refinement:read('079-final-refinement').comparisons,fidelity:read('079-projected-fidelity'),
 continuousClearance:{tolerance:1e-6,intervals:bounds.proofs.length,primaryPairs:2,primary:bounds.counts,minimumPrimary:bounds.minimum.lowerBound,
  secondaryPairs:536,classification:hardware.classification,minimumSecondary:Math.min(...hardware.pairs.filter(p=>p.kind!=='primary-contact').map(p=>p.minimum))},
 reactions:read('079-resolved-reactions'),surface:{poses:surface.states.length,pairs:surface.pairs.length,checks:surface.checks,penetrations:surface.penetrations},
 preview:views,prototypeInspections:'079-loop-study-inspections.json',totalCandidateImagesInspected:72,
 assumptions:views.reconstructionAssumptions,
 remaining:['Integrate unchanged candidate geometry and bounded playback','Add focused production regression checks','Run focused/full numerical/build/browser validation against final production sources','Inspect integrated captures and record verified production checkpoint'],
 reports,archives,sources,full507GoalStillActive:true};
fs.writeFileSync('artifacts/review/079-playback-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,candidateReady:true,reports:reports.length,archives:archives.length,sources:sources.length,frozenInputs:checkpoint.frozenInputsMatched});
