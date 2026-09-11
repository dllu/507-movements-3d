import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {makePullPawlDynamics} from './lib/pull-pawl-dynamics-study.mjs';
import {polygonContact} from './lib/jointed-tappet-contact-study.mjs';
import {add,rotate} from '../src/simulation/finite-plate-geometry.js';

const trajectoryFile='artifacts/review/078-amplitude-038.json',data=JSON.parse(fs.readFileSync(trajectoryFile)),
 candidate=makePullPawlCandidate(data.geometry),physics=makePullPawlDynamics(candidate,data.parameters),issues=[],
 h=2e-7,lagrangeH=1e-5,counts={profile:0,jacobian:0,timeDerivative:0,force:0,featureChanges:0},
 maximum={profile:0,jacobian:0,timeDerivative:0,force:0},limits={profile:1e-11,jacobian:1e-6,timeDerivative:1e-7,force:1e-7};
const assess=(kind,error,detail)=>{counts[kind]++;maximum[kind]=Math.max(maximum[kind],error);if(error>limits[kind])issues.push({kind,error,detail});},
 sameNormal=(a,b)=>a&&b&&a.normal[0]*b.normal[0]+a.normal[1]*b.normal[1]>1-1e-6;
let seed=1729;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(const [key,profile]of Object.entries(physics.contact.profiles)){
 const reference=polygonContact(profile.points);
 for(let i=0;i<200;i++){
  const point=profile.center.map(v=>v+(2*random()-1)*profile.radius*1.3),a=profile.closest(point),b=reference.closest(point);
  assess('profile',Math.abs(a.gap-b.signedDistance),{key,point});
 }
}
for(let sample=0;sample<97;sample++){
 const state=data.rows[Math.round(sample*8000/96)],{x,time}=state,base=physics.constraints(x,time),k=physics.input(time);
 for(let coordinate=0;coordinate<4;coordinate++){
  const plus=[...x],minus=[...x];let tplus=time,tminus=time;
  if(coordinate<3){plus[coordinate]+=h;minus[coordinate]-=h;}else{tplus+=h;tminus-=h;}
  const before=new Map(physics.constraints(minus,tminus).rows.map(r=>[r.id,r])),after=new Map(physics.constraints(plus,tplus).rows.map(r=>[r.id,r]));
  for(const row of base.rows){const a=before.get(row.id),b=after.get(row.id);
   if(!sameNormal(row,a)||!sameNormal(row,b)){counts.featureChanges++;continue;}
   const numerical=(b.gap-a.gap)/(2*h),expected=coordinate<3?row.J[coordinate]:row.inputNormalVelocity;
   assess(coordinate<3?'jacobian':'timeDerivative',Math.abs(numerical-expected),{sample,id:row.id,coordinate,numerical,expected});
  }
 }
 const F=physics.forces(x,time);
 for(const [i,key]of ['left','right'].entries()){
  const m=physics.parameters.mass[key],alpha=x[i+1],velocity=state.v[i+1],
   L=(a,t)=>{const input=physics.input(t).pawls[key],r=rotate(m.c,a),v=add(input.velocity,[-r[1]*velocity,r[0]*velocity]),position=add(input.pivot,r);
    return .5*m.m*(v[0]**2+v[1]**2)+.5*(m.I-m.m*(m.c[0]**2+m.c[1]**2))*velocity**2-m.m*9.81*position[1];
   },momentum=(a,t)=>{const r=rotate(m.c,a),v=physics.input(t).pawls[key].velocity;return m.I*velocity+m.m*(-v[0]*r[1]+v[1]*r[0]);},
   numerical=(L(alpha+lagrangeH,time)-L(alpha-lagrangeH,time))/(2*lagrangeH)
    -(momentum(alpha+velocity*lagrangeH,time+lagrangeH)-momentum(alpha-velocity*lagrangeH,time-lagrangeH))/(2*lagrangeH);
  assess('force',Math.abs(numerical-F[i+1]),{sample,key,numerical,expected:F[i+1]});
 }
}
if(counts.jacobian<100||counts.timeDerivative<30)issues.push({kind:'insufficient-smooth-feature-checks',counts});
const files=[trajectoryFile,'scripts/check-pull-pawl-formulas.mjs','scripts/lib/pull-pawl-dynamics-study.mjs','scripts/lib/pull-pawl-contact-study.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/jointed-tappet-contact-study.mjs'],
 report={movement:78,status:'independent-contact-and-force-formula-check',passed:issues.length===0,productionChanged:false,mechanicsPassed:false,
 h,lagrangeH,counts,maximum,limits,issues,
 qualification:'Compare the BVH signed profile query against an independent brute-force polygon implementation; differentiate stable contact features with respect to all three free angles and prescribed input time; recover moving-pivot pawl forces from finite differences of the full translational/rotational Lagrangian. Nonsmooth feature changes are counted separately. This does not validate every contact transition or energy balance.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('artifacts/review/078-formula-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,counts,maximum,issues:issues.slice(0,5)});if(!report.passed)process.exitCode=1;
