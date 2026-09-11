import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';

const base='artifacts/review/',read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 frozen=read('079-verification-source-hashes');
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,'Verified input changed: '+file);
assert.ok(fs.readFileSync('src/simulation/authored-intermittent.js','utf8').includes(fs.readFileSync(base+'080-original-factory.txt','utf8')));
assert.ok(fs.readFileSync('tests/models.test.mjs','utf8').includes(fs.readFileSync(base+'080-original-test.txt','utf8')));
const old=read('080-first-candidate-geometry'),current=read('080-relieved-candidate-geometry'),source=read('080-source-measurements');
assert.equal(old.penetrations,91);assert.equal(current.geometryPassed,true);assert.equal(current.pairs.length,81);
const inspections=[];
for(const prefix of ['080-first-candidate','080-relieved-candidate']){
 const r=read(prefix+'-captures');assert.equal(r.errors.length,0);assert.equal(r.captures.length,8);
 for(const s of r.sources)assert.equal(hash(s.archive),s.sha256);
 for(const c of r.captures){assert.equal(hash(c.file),c.sha256);
  inspections.push({...c,inspected:true,visualAccepted:prefix==='080-relieved-candidate',mechanicsPassed:false,
   qualification:prefix==='080-first-candidate'?
    'Viewed: source proportions and crossing order follow the engraving, but both unrelieved hook webs penetrate the rack. Preserved and rejected as the final geometry.':
    'Viewed: source alignment, crossing order, real bores, slot and concealed toe relief are acceptable for further study. This source pose passes the sampled clearance screen; loaded motion and continuous clearance remain unverified.'});
 }
}
const a=makeCrossedRackCandidate({hookRelief:null}).root.userData,b=makeCrossedRackCandidate().root.userData;let unchangedParts=0,unchangedBuffers=0;
for(const name of Object.keys(a.parts))if(!name.endsWith('HookWeb')){
 unchangedParts++;for(const attribute of ['position','normal']){assert.deepEqual(a.parts[name].geometry.attributes[attribute].array,b.parts[name].geometry.attributes[attribute].array);unchangedBuffers++;}
}
const files=['scripts/lib/crossed-rack-source.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/measure-crossed-rack-source.mjs',
 'scripts/prepare-crossed-rack-source.mjs','scripts/probe-crossed-rack-candidate.mjs','scripts/capture-crossed-rack-candidate.mjs',
 'scripts/record-crossed-rack-geometry-study.mjs'],sources=files.map((file,i)=>{
 const archive=base+'080-geometry-study-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const reports=fs.readdirSync(base).filter(n=>n.startsWith('080-')&&n.endsWith('.json'))
 .map(n=>({file:base+n,sha256:hash(base+n)}));
for(const name of ['080-source-measurements','080-first-candidate-geometry','080-relieved-candidate-geometry'])
 for(const s of read(name).sources)assert.equal(hash(s.archive),s.sha256);
const checkpoint={movement:80,status:'isolated-source-geometry-reviewed',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 frozenInputsMatched:Object.keys(frozen).length,priorVerified:'079-integrated-checkpoint.json',sourceCropInspected:true,sourceMeasurementsAdopted:true,
 source:{center:source.sourceCenter,scale:source.sourceScale,teethPerSide:16,measuredToothStrokes:25,inferredToothStrokes:7,
 pitchPixels:source.commonPitch,pitchRmsPixels:{left:source.teeth.left.commonPitchRms,right:source.teeth.right.commonPitchRms},
 maximumSlotSideResidual:source.slot.maximumSideResidual},
 geometry:{solids:current.topology.length,independentPairs:current.pairs.length,closedOrientedSurfaces:true,
 hookReliefSourceCoordinates:b.geometry.hookRelief,sourcePoseChecks:current.checks,sourcePosePenetrations:current.penetrations,
 unchangedNonWebParts:unchangedParts,unchangedPositionNormalBuffers:unchangedBuffers},
 inspectedViews:inspections,sourceMeasurementView:source.image,videoRecorded:false,videoWatched:false,reports,sources,
 preservedFailures:{baselinePenetrations:read('080-baseline-surfaces').penetrations,baselinePairs:read('080-baseline-surfaces').pairs,
 firstCandidatePenetrations:old.penetrations,firstCandidateMaximumDepth:old.maximumDepth},
 qualifications:[
  'Axial thickness, concealed toe relief, pin construction and uniform tooth pitch reconstruct details absent or irregular in the engraving.',
  'Only the traced source pose has been checked. The pawls and rack are still prescribed geometry-study coordinates, with no solved loaded trajectory.',
  'The finite bar must not wrap by a tooth pitch. Its remaining toothed length limits useful lift before the slot end reaches the fixed fulcrum. A finite-travel demonstration and explicit replay behavior remain to be designed.',
  'The front outlines of the pawls and the other fourteen meshes are unchanged by the back relief. The step behind each toe is visible when orbiting and is an explicit reconstruction assumption.'
 ],remaining:['Derive and check finite hook/rack contact and gravity-driven pawl return',
  'Solve loaded finite rack travel and choose readable playback and explicit replay behavior',
  'Verify convergence, energy, reactions, continuous full-assembly clearance and rendered motion',
  'Integrate only after qualification and run final production validation'],full507GoalStillActive:true};
fs.writeFileSync(base+'080-geometry-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({status:checkpoint.status,frozenInputs:checkpoint.frozenInputsMatched,views:inspections.length,
 sourcePosePassed:true,productionChanged:false,mechanicsPassed:false,reports:reports.length});
