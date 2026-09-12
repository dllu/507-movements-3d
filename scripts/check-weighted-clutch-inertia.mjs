import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate,THREE} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {familyMass} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-inertia-check',
 parent=readStudyReport('artifacts/review/087-native-contact-checkpoint.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
  'scripts/check-weighted-clutch-inertia.mjs','scripts/lib/weighted-clutch-inertia.mjs'],prefix),
 model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,inertia=makeWeightedClutchInertia(model),
 parts=Object.entries(u.parts).filter(([name])=>['lever','bell','rod'].includes(u.families[name])),components=parts.map(([name,mesh])=>{
  const dummy=new THREE.Mesh(mesh.geometry),raw=familyMass({component:dummy},{component:'body'},'body');
  return{name,mesh,raw,mass:raw.volume*inertia.parameters.density,centralInertia:raw.centralPolar*inertia.parameters.density};
 }),rows=[];
const sample=q=>{
 model.setState({leverAngle:q});let potential=0;
 const states=components.map(c=>{
  const center=new THREE.Vector3(...c.raw.centroid).applyMatrix4(c.mesh.matrixWorld),m=c.mesh.matrixWorld.elements;
  potential+=c.mass*inertia.parameters.gravity*center.y;
  return{center:center.toArray(),angle:Math.atan2(m[1],m[0])};
 });
 return{potential,states};
};
let maximumPotentialError=0,maximumInertiaError=0,maximumGravityError=0;
for(let i=0;i<=128;i++){
 const q=.001+(u.lostMotion.parameters.leverLeft-.002)*i/128,h=1e-5,
  center=sample(q),before=sample(q-h),after=sample(q+h),expected=inertia.linkage(q);
 let measuredInertia=0;
 for(let j=0;j<components.length;j++){
  const a=before.states[j],b=after.states[j],v=b.center.map((x,k)=>(x-a.center[k])/(2*h)),omega=(b.angle-a.angle)/(2*h),c=components[j];
  measuredInertia+=c.mass*v.reduce((s,x)=>s+x*x,0)+c.centralInertia*omega*omega;
 }
 const potentialError=Math.abs(center.potential-expected.potential),inertiaError=Math.abs(measuredInertia-expected.inertia),
  gravityError=Math.abs((after.potential-before.potential)/(2*h)-expected.potentialDerivative);
 maximumPotentialError=Math.max(maximumPotentialError,potentialError);maximumInertiaError=Math.max(maximumInertiaError,inertiaError);
 maximumGravityError=Math.max(maximumGravityError,gravityError);
 rows.push({q,potential:center.potential,expectedPotential:expected.potential,potentialError,measuredInertia,expectedInertia:expected.inertia,inertiaError,gravityError});
}
verifyStudySources(sources);
const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const result={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
 components:components.map(({mesh,...c})=>c),rows,maximumPotentialError,maximumInertiaError,maximumGravityError,
 qualification:'Independent per-component local geometry mass integrals and finite differences of actual rendered world transforms verify the aggregated F/G/rod gravitational potential and effective inertia. Uses the same declared additive-component mass hypothesis, not a physical union-volume or historical mass claim.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({components:components.length,poses:rows.length,maximumPotentialError,maximumInertiaError,maximumGravityError});
assert(maximumPotentialError<1e-8&&maximumInertiaError<1e-7&&maximumGravityError<1e-7);
