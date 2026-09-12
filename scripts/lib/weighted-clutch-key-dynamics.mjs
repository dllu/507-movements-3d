import {makeWeightedClutchInertia} from './weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeCouplings} from './weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchFastStud} from './weighted-clutch-fast-stud.mjs';
import {makeWeightedClutchSplitGravity} from './weighted-clutch-split-gravity.mjs';
import {makeWeightedClutchNativeKey} from './weighted-clutch-native-key.mjs';
import {makeClutchSeatingProfile} from './weighted-clutch-seating-contact.mjs';
import {projectClutchKeyFriction} from './weighted-clutch-key-friction.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

export function makeWeightedClutchKeyDynamics(model,profile,{staticCoefficient,kineticCoefficient}){
 const u=model.root.userData,inertia=makeWeightedClutchInertia(model),coupling=makeWeightedClutchNativeCouplings(model),
  stud=makeWeightedClutchFastStud(model),key=makeWeightedClutchNativeKey(model),gravity=makeWeightedClutchSplitGravity(model,inertia),
  jaw=makeClutchSeatingProfile(profile,u.geometry.mainRatio),b=inertia.parameters.bodies,
  omegaInput=profile.omegaInput,phaseSign=profile.side==='left'?-1:1,
  shaftInertia=b.shaft.inertia+b.pinion.inertia+b.E.inertia/u.geometry.eRatio**2,
  friction={staticCoefficient,kineticCoefficient};
 const phase=(q,t)=>({input:profile.input0+omegaInput*t,output:q[3],clutch:q[4],e:q[3]/u.geometry.eRatio,
   relative:q[4]+phaseSign*u.geometry.mainRatio*(profile.input0+omegaInput*t),key:q[3]-q[4]}),
  mass=q=>[inertia.linkage(q[0]).inertia,b.shifter.inertia,b.D.mass,shaftInertia,b.D.inertia],
  forces=(q,v)=>{const g=gravity.at(q[3],q[4]);return[
   -.5*inertia.linkage(q[0]).inertiaDerivative*v[0]**2-inertia.linkage(q[0]).potentialDerivative,
   -inertia.shifter(q[1]).potentialDerivative,0,-g.gradient[3],-g.gradient[4]];},
  energy=(q,v)=>inertia.linkage(q[0]).potential+inertia.shifter(q[1]).potential+gravity.at(q[3],q[4]).potential+
   .5*dot(mass(q),v.map(x=>x*x));
 function query(q,t,margin=1e-7){
  const p=phase(q,t),s=stud.evaluate(q[0],p.e);
  return[...coupling.query(q).map(c=>({...c,gradient:[...c.gradient,0,0],inputGradient:0})),
   {kind:'stud',gap:s.gap,gradient:[s.gradientLever,0,0,s.gradientWheel/u.geometry.eRatio,0],inputGradient:0},
   ...jaw.evaluate(p.relative,q[2],margin).map(c=>({...c,gradient:[...c.gradient.slice(0,3),0,c.gradient[3]]})),...key.query(q)];
 }
 const project=(free,m,contacts,previousSlip)=>projectClutchKeyFriction(free,m,contacts,{...friction,previousSlip});
 function initial(q,v,active=[]){
  const E=energy(q,v);return{time:0,q:q.slice(),v:v.slice(),active,energy:E,initialEnergy:E,loss:0,work:0,
   defect:0,absoluteDefect:0,phase:phase(q,0),minimumGap:Math.min(...query(q,0).map(c=>c.gap))};
 }
 function step(before,h){
  const time=before.time+h,m=mass(before.q),force=forces(before.q,before.v),free=before.v.map((v,k)=>v+h*force[k]/m[k]);
  let q=before.q.map((x,i)=>x+h*free[i]),iterations=0,transport;
  for(;iterations<40;iterations++){
   const constraints=query(q,time,Math.max(1e-7,h)).map(c=>({...c,target:(dot(c.gradient,q.map((x,i)=>x-before.q[i]))-c.gap)/h})),
    p=project(free,m,constraints,before.v[2]),next=before.q.map((x,i)=>x+h*p.v[i]),
    change=Math.max(...next.map((x,i)=>Math.abs(x-q[i])));
   q=next;transport=p;if(change<5e-12)break;
  }
  if(iterations===40)throw Error('Key-contact position iteration failed at '+time);
  const contacts=query(q,time),minimumGap=Math.min(...contacts.map(c=>c.gap));
  if(minimumGap< -2e-9)throw Error('Key-contact penetration: '+minimumGap);
  const constraints=contacts.filter(c=>c.gap<=2e-8).map(c=>({...c,target:-c.inputGradient*omegaInput})),
   p=project(free,m,constraints,before.v[2]),E=energy(q,p.v),defect=E-before.energy-p.work+p.loss;
  return{time,q,v:p.v,energy:E,loss:before.loss+p.loss,work:before.work+p.work,defect:before.defect+defect,
   absoluteDefect:before.absoluteDefect+Math.abs(defect),stepDefect:defect,h,iterations:iterations+1,minimumGap,
   active:p.active,mode:p.mode,slip:p.slip,freeVelocity:free,transportVelocity:transport.v,phase:phase(q,time),
   impulseEnergyResidual:p.impulseEnergyResidual,frictionWork:p.frictionWork,
   selectedPriorityVelocitySpread:p.selectedPriorityVelocitySpread,allModesVelocitySpread:p.allModesVelocitySpread,
   feasibleModes:p.feasibleModes,transportMode:transport.mode,
   transportPriorityVelocitySpread:transport.selectedPriorityVelocitySpread};
 }
 return{initial,step,query,mass,forces,energy,phase,inertia,coupling,stud,key,gravity,jaw,project,
  parameters:{side:profile.side,direction:profile.direction,omegaInput,omegaOutput:-phaseSign*u.geometry.mainRatio*omegaInput,
   shaftInertia,clutchInertia:b.D.inertia,friction,profilePeak:profile.peak,
   qualification:'Five independent coordinates with native feather angular clearance, unit-normal key forces and axial Coulomb friction. Native slot/fork/stud and measured jaw profiles remain unilateral. Input spin alone is prescribed. A discrete static/sliding mode law is a material hypothesis requiring convergence, contact, release and full-cycle checks.'}};
}
