import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics} from './lib/crossed-rack-dynamics-study.mjs';
import {makeCrossedRackEnergyStudy} from './lib/crossed-rack-energy-study.mjs';
const names=JSON.parse(process.env.PROBE_INPUTS??'["080-amplitude016-dynamics","080-amplitude016-fine-dynamics","080-amplitude016-finer-dynamics","080-amplitude016-finest-dynamics"]'),
 files=names.map(n=>'artifacts/review/'+n+'.json'),prefix=process.env.PROBE_PREFIX??'artifacts/review/080-first-energy',first=JSON.parse(fs.readFileSync(files[0])),
 candidate=makeCrossedRackCandidate(first.geometry),u=candidate.root.userData,physics=makeCrossedRackDynamics(candidate,first.parameters),
 energy=makeCrossedRackEnergyStudy(physics),tetra=[],issues=[],sources=[
 'scripts/check-crossed-rack-energy.mjs','scripts/lib/crossed-rack-energy-study.mjs','scripts/lib/crossed-rack-dynamics-study.mjs',
 'scripts/lib/crossed-rack-contact-study.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',...files
 ].map((file,i)=>{const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
  return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};});
for(const [name,mesh]of Object.entries(u.parts))if(['rack','left','right'].includes(u.families[name])){
 const g=mesh.geometry,p=g.attributes.position,index=g.index;
 for(let i=0;i<(index?.count??p.count);i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j)),mass=v[0].dot(v[1].clone().cross(v[2]))/6*physics.parameters.density;
  tetra.push({family:u.families[name],mesh,points:[new THREE.Vector3(),...v],mass});
 }
}
const formulas={checks:0,maximumKineticError:0,maximumPotentialError:0,maximumMomentumError:0};
for(let i=0;i<31;i++){
 const row={time:(i+.17)*20/31,x:[.025*i,.1*Math.sin(i),.12*Math.cos(i)],v:[.12*Math.cos(i),.3*Math.sin(i+.1),-.4*Math.cos(i+.2)]},
  expected=energy.state(row),k=physics.input(row.time),momentum={left:0,right:0};let kinetic=0,potential=0;
 u.setState({q:k.q,rackY:row.x[0],leftAngle:row.x[1],rightAngle:row.x[2]});
 for(const t of tetra){
  const key=t.family,P=key==='rack'?null:new THREE.Vector3(...k.pawls[key].pivot,0),w=row.v[key==='left'?1:2],
   direction=P?new THREE.Vector3(-P.y,P.x,0):new THREE.Vector3(),V=P?new THREE.Vector3(...k.pawls[key].velocity,0):new THREE.Vector3(0,row.v[0],0),
   q=t.points.map(p=>{const H=p.clone().applyMatrix4(t.mesh.matrixWorld),d=P?H.clone().sub(P):new THREE.Vector3(),
    velocity=V.clone().add(new THREE.Vector3(-d.y,d.x,0).multiplyScalar(P?w:0));return{H,velocity};}),
   sum=q.reduce((s,r)=>s.add(r.velocity),new THREE.Vector3());
  kinetic+=t.mass*(sum.lengthSq()+q.reduce((s,r)=>s+r.velocity.lengthSq(),0))/40;
  potential+=t.mass*9.81*q.reduce((s,r)=>s+r.H.y,0)/4;
  if(P)momentum[key]+=t.mass*sum.dot(direction)/4;
 }
 kinetic+=.5*physics.parameters.payload*row.v[0]**2;potential+=9.81*physics.parameters.payload*row.x[0];
 formulas.checks++;formulas.maximumKineticError=Math.max(formulas.maximumKineticError,Math.abs(kinetic-expected.kinetic));
 formulas.maximumPotentialError=Math.max(formulas.maximumPotentialError,Math.abs(potential-expected.potential));
 formulas.maximumMomentumError=Math.max(formulas.maximumMomentumError,...['left','right'].map(k=>Math.abs(momentum[k]-expected.pawls[k].momentumQ)));
}
if(Math.max(formulas.maximumKineticError,formulas.maximumPotentialError,formulas.maximumMomentumError)>1e-10)issues.push({kind:'mesh-energy-formulas',formulas});
const runs=[];
for(const file of files){
 const data=JSON.parse(fs.readFileSync(file));assert.deepEqual(data.parameters,first.parameters);assert.deepEqual(data.geometry,first.geometry);assert.equal(data.failures.length,0);
 const totals=Object.fromEntries(['change','inputWork','dampingWork','velocityChangeLoss','contactVelocityWork','residual','correctedResidual'].map(k=>[k,0]));
 let maximumMomentumResidual=0,maximumAbsoluteCorrectedResidual=0,cumulativeCorrectedResidual=0,maximumCumulativeCorrectedResidual=0,missing=0;
 for(let i=1;i<data.rows.length;i++){
  const before=data.rows[i-1],after=data.rows[i],rows=new Map(physics.constraints(after.x,after.time).rows.map(r=>[r.id,r])),contacts=[];
  for(const r of after.contacts){const actual=rows.get(r.id);if(actual)contacts.push({...actual,impulse:r.impulse});else missing++;}
  const result=energy.interval(before,after,contacts),F=physics.forces(after.x,after.time),dt=after.time-before.time;
  for(const key of Object.keys(totals))totals[key]+=result[key];
  maximumAbsoluteCorrectedResidual=Math.max(maximumAbsoluteCorrectedResidual,Math.abs(result.correctedResidual));
  cumulativeCorrectedResidual+=result.correctedResidual;maximumCumulativeCorrectedResidual=Math.max(maximumCumulativeCorrectedResidual,Math.abs(cumulativeCorrectedResidual));
  for(let j=0;j<3;j++){
   const error=Math.abs(physics.parameters.inertia[j]*(after.v[j]-before.v[j])+dt*physics.parameters.damping[j]*after.v[j]-dt*F[j]-contacts.reduce((s,r)=>s+r.impulse*r.J[j],0));
   maximumMomentumResidual=Math.max(maximumMomentumResidual,error);
  }
 }
 const run={file,dt:data.dt,intervals:data.rows.length-1,totals,maximumMomentumResidual,maximumAbsoluteCorrectedResidual,maximumCumulativeCorrectedResidual,missing,
  normalizedCorrectedResidual:maximumCumulativeCorrectedResidual/(Math.abs(totals.inputWork)+totals.dampingWork+totals.velocityChangeLoss)};
 runs.push(run);console.log({run});if(missing||maximumMomentumResidual>1e-7)issues.push({kind:'momentum-balance',run});
}
const last=runs.at(-1),previous=runs.at(-2),refines=last.maximumCumulativeCorrectedResidual<previous.maximumCumulativeCorrectedResidual,
 relativeLimit=.001;
if(!refines||last.normalizedCorrectedResidual>relativeLimit)issues.push({kind:'energy-refinement',refines,relativeLimit,normalized:last.normalizedCorrectedResidual});
const report={movement:80,status:'inertial-energy-and-input-work-study',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 formulas,runs,relativeLimit,refines,issues,sources,
 qualification:'Energy includes rack/pawl gravity and complete prescribed-pivot kinetic terms; direct actual-mesh tetrahedral quadrature checks formulas and prescribed-angle momentum. Input work follows the q momentum balance, including contact reactions and kinetic/potential q derivatives. Positive diagonal drag dissipates energy. The backward-Euler balance includes full-mass velocity-change loss and endpoint contact velocity work; the remaining corrected defect must refine below 0.1% of work plus dissipation. Energy of the prescribed lever is outside this free-body subsystem. This is a discrete consistency check, not a conservation claim for impacts.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({formulas,passed:report.passed,issues});if(!report.passed)process.exitCode=1;
