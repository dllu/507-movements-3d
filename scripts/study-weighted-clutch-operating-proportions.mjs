import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchCandidate} from './lib/weighted-clutch-candidate.mjs';
import {makeWeightedClutchLinkage} from './lib/weighted-clutch-linkage.mjs';
import {makeWeightedClutchLostMotion,makeAdjustedWeightedClutchLinkage} from './lib/weighted-clutch-lost-motion.mjs';
import {weightedClutchStudContacts} from './lib/weighted-clutch-stud-contact.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-operating-proportions',
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const model=makeWeightedClutchCandidate(),coupling=makeWeightedClutchLostMotion(model.root.userData.profiles.slot[0][0]),
 measured=makeWeightedClutchLinkage(),unadjusted=makeAdjustedWeightedClutchLinkage(0),rows=[],sources=freezeStudySources([
 'scripts/study-weighted-clutch-operating-proportions.mjs','scripts/lib/weighted-clutch-candidate.mjs','scripts/lib/weighted-clutch-linkage.mjs',
 'scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-stud-contact.mjs',
 'scripts/lib/study-report-io.mjs','src/simulation/bevel-geometry.js','src/simulation/jaw-clutch-geometry.js',
 'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js'],prefix);
let unadjustedParityError=0;
for(let i=0;i<=360;i++){
 const q=coupling.parameters.leverLeft*i/360,a=measured.atAngle(q),b=unadjusted.atAngle(q);
 for(const k of ['bellAngle','rodAngle','weightAngle'])unadjustedParityError=Math.max(unadjustedParityError,Math.abs(a[k]-b[k]));
 for(const k of ['A','B'])for(let j=0;j<2;j++)unadjustedParityError=Math.max(unadjustedParityError,Math.abs(a[k][j]-b[k][j]));
}
assert(unadjustedParityError<1e-12);
for(let pixels=0;pixels<=90;pixels++){
 const linkage=makeAdjustedWeightedClutchLinkage(pixels),atLeft=weightedClutchStudContacts(linkage,coupling.parameters.leverLeft),
  incoming=atLeft.contacts.filter(c=>c.approachCW),rightIncoming=weightedClutchStudContacts(linkage,0).contacts.filter(c=>c.approachCCW),
  branches=[];
 let minimumCCWTorque=Infinity,minimumCWTorque=Infinity;
 for(const direction of ['CCW','CW'])for(let i=0;i<=128;i++){
  const q=direction==='CCW'?linkage.parameters.overCenterAngle*i/128:
   linkage.parameters.overCenterAngle+(coupling.parameters.leverLeft-linkage.parameters.overCenterAngle)*i/128,
   result=weightedClutchStudContacts(linkage,q),enter=result.contacts.filter(c=>c['approach'+direction]),
   torque=enter.length?Math.min(...enter.map(c=>direction==='CCW'?-c.torqueG:c.torqueG)):-Infinity;
  if(direction==='CCW')minimumCCWTorque=Math.min(minimumCCWTorque,torque);else minimumCWTorque=Math.min(minimumCWTorque,torque);
  if(pixels%10===0||pixels===75)branches.push({direction,q,contacts:enter,torque,radialGap:result.radialGap});
 }
 rows.push({pixels,rodLength:linkage.parameters.rodLength,pins:{A:linkage.parameters.A0,B:linkage.parameters.B0},
  leftRadialGap:atLeft.radialGap,leftIncoming:incoming,rightIncoming,
  minimumCCWTorque:Number.isFinite(minimumCCWTorque)?minimumCCWTorque:null,
  minimumCWTorque:Number.isFinite(minimumCWTorque)?minimumCWTorque:null,
  correctTorqueDirections:minimumCCWTorque>0&&minimumCWTorque>0,branches});
}
verifyStudySources(sources);
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const firstRadial=rows.find(r=>r.leftRadialGap<=0)?.pixels,firstPositiveTorque=rows.find(r=>r.correctTorqueDirections)?.pixels;
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
 sources,unadjustedParityError,coupling:coupling.parameters,firstRadial,firstPositiveTorque,rows,
 qualification:'Planar circle/capsule contact-direction study for an explicit lost-motion interpretation. Only the two crank radii are adjusted equally, retaining their directions and both fulcrums. Force moments refer to unit normal contact force on G; they are not a force, inertia or gravity solution. Radial reach alone does not establish useful return torque. Sampled contact branches do not establish continuous collision-free playback.'},null,2)+'\n',{flag:'wx'});
console.log({unadjustedParityError,freeDegrees:coupling.parameters.freeAngle*180/Math.PI,leverDegrees:coupling.parameters.leverLeft*180/Math.PI,firstRadial,firstPositiveTorque,
 rows:rows.filter(r=>[0,40,50,60,70,75,80,90].includes(r.pixels)).map(({branches,...r})=>r)});
