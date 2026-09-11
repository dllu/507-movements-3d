import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics} from './lib/crossed-rack-dynamics-study.mjs';
import {rotate} from '../src/simulation/finite-plate-geometry.js';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/080-force-contact-formulas',input=process.env.PROBE_INPUT??'artifacts/review/080-amplitude016-dynamics.json',data=JSON.parse(fs.readFileSync(input)),
 physics=makeCrossedRackDynamics(makeCrossedRackCandidate(data.geometry),data.parameters),issues=[],mass=physics.parameters.mass;
const energy=(x,v,time)=>{
 const k=physics.input(time);let kinetic=.5*physics.parameters.inertia[0]*v[0]**2,potential=physics.parameters.inertia[0]*9.81*x[0];
 for(const [i,key]of ['left','right'].entries()){
  const m=mass[key],r=rotate(m.c,x[i+1]),P=k.pawls[key].pivot,V=k.pawls[key].velocity,w=v[i+1];
  kinetic+=.5*m.m*(V[0]**2+V[1]**2)+m.m*w*(-V[0]*r[1]+V[1]*r[0])+.5*m.I*w*w;
  potential+=m.m*9.81*(P[1]+r[1]);
 }
 return{kinetic,potential};
};
const derivative=(fn,x,i,h=1e-4)=>{const a=[...x],b=[...x];a[i]-=h;b[i]+=h;return(fn(b)-fn(a))/(2*h);};
let forceChecks=0,maxForceError=0,contactChecks=0,maxJacobianError=0,inputChecks=0,maxInputError=0,featureSwitches=0;
for(let sample=0;sample<80;sample++){
 const time=(sample+.37)*17.9/80,row=data.rows[Math.round(time/data.dt)],x=[row.x[0]+.0013*Math.sin(sample),row.x[1]+.0027,row.x[2]-.0019],
  v=[.12*Math.cos(sample),.21*Math.sin(sample+.3),-.17*Math.cos(sample*.7)],expected=physics.forces(x,time),h=1e-4;
 for(let i=0;i<3;i++){
  const Talpha=derivative(a=>energy(a,v,time).kinetic,x,i),Ualpha=derivative(a=>energy(a,v,time).potential,x,i),
   momentum=(t,position)=>derivative(velocity=>energy(position,velocity,t).kinetic,v,i),
   earlier=x.map((a,j)=>a-h*v[j]),later=x.map((a,j)=>a+h*v[j]),
   actual=Talpha-Ualpha-(momentum(time+h,later)-momentum(time-h,earlier))/(2*h),error=Math.abs(actual-expected[i]);
  maxForceError=Math.max(maxForceError,error);forceChecks++;if(error>2e-5)issues.push({kind:'lagrangian-force',sample,i,actual,expected:expected[i],error});
 }
 const rows=physics.constraints(x,time,.01).rows,epsilon=1e-7;
 for(const r of rows){
  if(Math.abs(r.gap)<1e-8)continue;
  for(let i=0;i<4;i++){
   const a=[...x],b=[...x];let ta=time,tb=time;
   if(i===3){ta-=epsilon;tb+=epsilon;}else{a[i]-=epsilon;b[i]+=epsilon;}
   const before=physics.constraints(a,ta,.01).rows.find(f=>f.id===r.id),after=physics.constraints(b,tb,.01).rows.find(f=>f.id===r.id);
   if(!before||!after){featureSwitches++;continue;}
   const actual=(after.gap-before.gap)/(2*epsilon),expected=i===3?r.inputNormalVelocity:r.J[i],error=Math.abs(actual-expected);
   if(i===3){inputChecks++;maxInputError=Math.max(maxInputError,error);}else{contactChecks++;maxJacobianError=Math.max(maxJacobianError,error);}
   if(error>2e-6)issues.push({kind:'contact-derivative',sample,id:r.id,i,actual,expected,error});
  }
 }
}
if(contactChecks<200||inputChecks<50)issues.push({kind:'insufficient-stable-feature-checks',contactChecks,inputChecks});
const files=['scripts/check-crossed-rack-formulas.mjs','scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-contact-study.mjs',
 'scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',input],sources=files.map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:80,status:'independent-force-and-contact-derivatives',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 forceChecks,maxForceError,contactChecks,maxJacobianError,inputChecks,maxInputError,featureSwitches,issues,sources,
 qualification:'Central differentiation of the complete inertial-frame Lagrangian checks gravity and moving-pivot generalized forces. Stable contact-feature gap derivatives check all three free coordinates and the driven input velocity. Nonsmooth feature switches are counted separately; normal cones, physical boundary reactions and complete collision bounds are not established by this check.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
