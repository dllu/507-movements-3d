import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
const names=['081-interval-dynamics','081-interval-fine-dynamics','081-interval-finer-dynamics'],files=names.map(n=>'artifacts/review/'+n+'.json'),
 data=files.map(file=>JSON.parse(fs.readFileSync(file))),candidate=makeSpringRackCandidate(data[0].geometry),u=candidate.root.userData,
 scale=u.geometry.source.scale,issues=[],comparisons=[],runs=[];
// Independently integrate actual rack tetrahedra. Translation makes every
// material point share the same velocity; gravity changes by m*g*dy.
let meshMass=0;
for(const [name,mesh]of Object.entries(u.parts))if(u.families[name]==='rack'){
 const g=mesh.geometry,p=g.attributes.position;
 for(let i=0;i<(g.index?.count??p.count);i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,g.index?g.index.getX(i+j):i+j));
  meshMass+=v[0].dot(v[1].clone().cross(v[2]))/6*data[0].parameters.density;
 }
}
if(Math.abs(meshMass-data[0].parameters.mass)>1e-10)issues.push({kind:'actual-mesh-mass',meshMass});
for(const [index,d]of data.entries()){
 assert.deepEqual(d.geometry,data[0].geometry);assert.deepEqual(d.parameters,data[0].parameters);assert.equal(d.failures.length,0);
 assert.equal(d.rows.length,Math.round(d.duration/d.dt)+1);
 const p=d.parameters,m=meshMass,k=p.stiffness,drag=p.damping[0];
 let maximumMomentumResidual=0,maximumEnergyIdentityResidual=0,positiveEnergyDefect=0,inputWork=0,dampingLoss=0,
  velocityChangeLoss=0,springQuadratureLoss=0,contactVelocityWork=0,maximumStep=0,maximumVelocity=0,maximumStopViolation=0;
 const energy=r=>.5*m*r.v[0]**2+m*p.gravity*r.x[0]+.5*k*(r.x[0]-p.stop+p.preload)**2;
 for(let i=1;i<d.rows.length;i++){
  const a=d.rows[i-1],b=d.rows[i],dt=b.time-a.time,dy=b.x[0]-a.x[0],dv=b.v[0]-a.v[0],v=b.v[0],
   contacts=b.diagnostic.contacts,jv=contacts.reduce((s,c)=>s+c.impulse*c.J[0],0),
   work=-contacts.reduce((s,c)=>s+c.impulse*c.inputNormalVelocity,0),loss=dt*drag*v*v,
   kineticLoss=.5*m*dv*dv,springLoss=.5*k*dy*dy,
   relativeWork=contacts.reduce((s,c)=>s+c.impulse*(c.J[0]*v+c.inputNormalVelocity),0),change=energy(b)-energy(a),
   momentum=m*dv+dt*(m*p.gravity+k*(b.x[0]-p.stop+p.preload)+drag*v)-jv,
   identity=change-work+loss+kineticLoss+springLoss-relativeWork;
  maximumMomentumResidual=Math.max(maximumMomentumResidual,Math.abs(momentum));
  maximumEnergyIdentityResidual=Math.max(maximumEnergyIdentityResidual,Math.abs(identity));
  positiveEnergyDefect+=Math.max(0,change-work+loss);inputWork+=work;dampingLoss+=loss;
  velocityChangeLoss+=kineticLoss;springQuadratureLoss+=springLoss;contactVelocityWork+=relativeWork;
  maximumStep=Math.max(maximumStep,Math.abs(dy));maximumVelocity=Math.max(maximumVelocity,Math.abs(v));
  maximumStopViolation=Math.max(maximumStopViolation,p.stop-b.x[0],b.x[0]-p.upper);
 }
 const run={file:files[index],dt:d.dt,intervals:d.rows.length-1,maximumMomentumResidual,maximumEnergyIdentityResidual,positiveEnergyDefect,
  inputWork,dampingLoss,velocityChangeLoss,springQuadratureLoss,contactVelocityWork,maximumStep,maximumVelocity,maximumStopViolation,
  relativePositiveDefect:positiveEnergyDefect/Math.abs(inputWork)};runs.push(run);
 if(maximumMomentumResidual>1e-7||maximumEnergyIdentityResidual>1e-7||maximumStopViolation>1e-9)issues.push({kind:'discrete-balance',run});
 if(index===0)continue;
 const a=data[index-1],b=d,times=Array.from(new Set([...a.rows.map(r=>r.time),...b.rows.map(r=>r.time)])).sort((x,y)=>x-y),indices=[0,0];
 const sample=(r,j,time)=>{while(indices[j]+1<r.rows.length&&r.rows[indices[j]+1].time<time)indices[j]++;
  const lo=r.rows[indices[j]],hi=r.rows[Math.min(indices[j]+1,r.rows.length-1)],f=lo.time===hi.time?0:(time-lo.time)/(hi.time-lo.time);
  return lo.x[0]+f*(hi.x[0]-lo.x[0]);};
 let maximum={pixels:0};for(const time of times){const x=sample(a,0,time),y=sample(b,1,time),pixels=Math.abs(x-y)*scale;
  if(pixels>maximum.pixels)maximum={time,pixels,coarse:x,fine:y};}
 comparisons.push({dt:[a.dt,b.dt],unionKnots:times.length,maximum,withinQuarterPixel:maximum.pixels<=.25});
}
const energyRefines=runs.slice(1).every((r,i)=>r.positiveEnergyDefect<runs[i].positiveEnergyDefect),last=runs.at(-1);
if(!energyRefines||last.relativePositiveDefect>.001)issues.push({kind:'positive-energy-defect',energyRefines,relative:last.relativePositiveDefect});
if(!comparisons.at(-1).withinQuarterPixel)issues.push({kind:'rack-spatial-refinement',comparison:comparisons.at(-1)});
const prefix='artifacts/review/081-first-dynamics-assessment',sources=['scripts/assess-spring-rack-dynamics.mjs','scripts/lib/spring-rack-candidate.mjs',
 'scripts/lib/spring-rack-source.mjs','scripts/lib/spring-rack-coil.mjs',...files].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:81,status:'isolated-rack-refinement-and-energy-assessment',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 meshMass,sourceScale:scale,comparisons,runs,energyRefines,issues,sources,
 qualification:'Actual tetrahedral rack mass, discrete momentum and full kinetic/gravity/Hookean energy identity are checked. Impact and backward-Euler losses are retained. Positive energy defect must decrease and remain below 0.1% of input work. Union knots bound differences between piecewise-linear rack coordinates; the latest comparison must be within one quarter of a source pixel. This is observed time-step agreement, not a continuum-error guarantee or a bound on deformed spring vertices.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,meshMass,comparisons,runs,issues});
if(!report.passed)process.exitCode=1;
